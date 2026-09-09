import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifierRateLimit, extraireIp } from '@/lib/rateLimit';

// Client serveur avec la clé service_role — ne JAMAIS exposer côté client.
// Cette clé bypass RLS entièrement : tout le contrôle d'accès et la
// validation doivent être faits explicitement dans ce fichier.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const ZONES_LIVRAISON: Record<number, { nom: string; prix: number }> = {
  1: { nom: 'Zone 1 (Almadies, Ngor, Ouakam)', prix: 1000 },
  2: { nom: 'Zone 2 (Mermoz, Fann, Point E, Liberté 6)', prix: 1500 },
  3: { nom: 'Zone 3 (Plateau, Yoff, Maristes, VDN)', prix: 2000 },
};

// Regex téléphone sénégalais : 9 chiffres commençant par 7,
// avec ou sans le préfixe 221, espaces tolérés.
const TELEPHONE_SN_REGEX = /^(?:\+?221)?[\s.-]?7[0-9](?:[\s.-]?[0-9]){7}$/;

// Format UUID v4 basique — la clé d'idempotence doit être un vrai UUID
// généré côté client (crypto.randomUUID()), pas une chaîne arbitraire.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ItemPanier {
  produit_id: string;
  quantite: number;
  extras_ids: string[]; // juste les IDs, jamais les prix — recalculés serveur
}

interface RequeteCommande {
  client_nom: string;
  client_telephone: string;
  adresse_precise: string;
  zone_id: number;
  creneau_souhaite?: string;
  items: ItemPanier[];
  idempotency_key?: string;
}

function nettoyerTexte(valeur: string, maxLength: number): string {
  return valeur
    .trim()
    .slice(0, maxLength)
    // Retire les caractères de contrôle qui pourraient perturber
    // l'affichage WhatsApp ou l'admin dashboard.
    .replace(/[\x00-\x1F\x7F]/g, '');
}

export async function POST(request: NextRequest) {
  try {
    // ------------------------------------------------------------
    // 0. RATE LIMITING — avant tout traitement, avant même de lire
    //    le body, pour couper court le plus tôt possible.
    // ------------------------------------------------------------
    const ip = extraireIp(request);
    const { autorise, reessayerDansMs } = verifierRateLimit(ip);

    if (!autorise) {
      const minutesRestantes = Math.ceil((reessayerDansMs || 0) / 60000);
      return NextResponse.json(
        { error: `Trop de commandes envoyées depuis cette connexion. Réessayez dans ${minutesRestantes} minute(s).` },
        { status: 429 }
      );
    }

    const body = (await request.json()) as Partial<RequeteCommande>;

    // ------------------------------------------------------------
    // 1. VALIDATION STRICTE DES CHAMPS
    // ------------------------------------------------------------
    const erreurs: string[] = [];

    const clientNom = typeof body.client_nom === 'string' ? nettoyerTexte(body.client_nom, 100) : '';
    if (clientNom.length < 2) {
      erreurs.push('Le nom doit contenir au moins 2 caractères.');
    }

    const clientTelephone = typeof body.client_telephone === 'string' ? body.client_telephone.trim() : '';
    if (!TELEPHONE_SN_REGEX.test(clientTelephone)) {
      erreurs.push('Numéro de téléphone invalide (format sénégalais attendu, ex: 77 000 00 00).');
    }

    const adressePrecise = typeof body.adresse_precise === 'string' ? nettoyerTexte(body.adresse_precise, 300) : '';
    if (adressePrecise.length < 3) {
      erreurs.push("L'adresse doit contenir au moins 3 caractères.");
    }

    const zoneId = Number(body.zone_id);
    const zone = ZONES_LIVRAISON[zoneId];
    if (!zone) {
      erreurs.push('Zone de livraison invalide.');
    }

    const creneauSouhaite = typeof body.creneau_souhaite === 'string'
      ? nettoyerTexte(body.creneau_souhaite, 100)
      : 'Au plus vite';

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      erreurs.push('Le panier est vide.');
    }
    if (items.length > 50) {
      erreurs.push('Trop d\'articles dans une seule commande.');
    }

    for (const [index, item] of items.entries()) {
      if (typeof item.produit_id !== 'string' || item.produit_id.length === 0) {
        erreurs.push(`Article #${index + 1} : identifiant produit manquant.`);
      }
      if (!Number.isInteger(item.quantite) || item.quantite < 1 || item.quantite > 20) {
        erreurs.push(`Article #${index + 1} : quantité invalide (1 à 20).`);
      }
      if (!Array.isArray(item.extras_ids)) {
        erreurs.push(`Article #${index + 1} : format des extras invalide.`);
      }
    }

    // La clé d'idempotence est optionnelle (rétro-compatibilité),
    // mais si elle est fournie, elle doit être un UUID valide —
    // sinon on l'ignore silencieusement plutôt que de bloquer la commande.
    const idempotencyKey = typeof body.idempotency_key === 'string' && UUID_REGEX.test(body.idempotency_key)
      ? body.idempotency_key
      : null;

    if (erreurs.length > 0) {
      return NextResponse.json({ error: 'Validation échouée', details: erreurs }, { status: 400 });
    }

    // ------------------------------------------------------------
    // 2. RECHARGER LES VRAIS PRIX DEPUIS LA BASE (jamais faire
    //    confiance à un prix envoyé par le client)
    // ------------------------------------------------------------
    const produitIds = [...new Set(items.map((i) => i.produit_id))];
    const { data: produits, error: produitsError } = await supabaseAdmin
      .from('produits')
      .select('id, nom, prix, disponible')
      .in('id', produitIds);

    if (produitsError) {
      console.error('Erreur chargement produits:', produitsError);
      return NextResponse.json({ error: 'Erreur serveur (produits)' }, { status: 500 });
    }

    const produitsMap = new Map(produits.map((p) => [p.id, p]));

    const extraIds = [...new Set(items.flatMap((i) => i.extras_ids))];
    const { data: extras, error: extrasError } = extraIds.length > 0
      ? await supabaseAdmin.from('extras').select('id, nom, prix, actif').in('id', extraIds)
      : { data: [], error: null };

    if (extrasError) {
      console.error('Erreur chargement extras:', extrasError);
      return NextResponse.json({ error: 'Erreur serveur (extras)' }, { status: 500 });
    }

    const extrasMap = new Map((extras || []).map((e) => [e.id, e]));

    // ------------------------------------------------------------
    // 3. VALIDER CHAQUE ITEM ET CALCULER LE TOTAL SERVEUR
    // ------------------------------------------------------------
    const itemsValides: Array<{
      produit_id: string;
      nom_produit: string;
      quantite: number;
      prix_unitaire: number;
      extras: Array<{ id: string; nom: string; prix: number }>;
    }> = [];

    let sousTotal = 0;

    for (const [index, item] of items.entries()) {
      const produit = produitsMap.get(item.produit_id);
      if (!produit) {
        return NextResponse.json(
          { error: `Article #${index + 1} : produit introuvable.` },
          { status: 400 }
        );
      }
      if (!produit.disponible) {
        return NextResponse.json(
          { error: `"${produit.nom}" n'est plus disponible.` },
          { status: 409 }
        );
      }

      const extrasResolus: Array<{ id: string; nom: string; prix: number }> = [];
      for (const extraId of item.extras_ids) {
        const extra = extrasMap.get(extraId);
        if (!extra || !extra.actif) {
          return NextResponse.json(
            { error: `Extra "${extraId}" invalide sur "${produit.nom}".` },
            { status: 400 }
          );
        }
        extrasResolus.push({ id: extra.id, nom: extra.nom, prix: extra.prix });
      }

      const prixExtras = extrasResolus.reduce((sum, e) => sum + e.prix, 0);
      const prixUnitaire = produit.prix + prixExtras;
      const nomComplet = extrasResolus.length > 0
        ? `${produit.nom} (${extrasResolus.map((e) => e.nom).join(', ')})`
        : produit.nom;

      itemsValides.push({
        produit_id: produit.id,
        nom_produit: nomComplet,
        quantite: item.quantite,
        prix_unitaire: prixUnitaire,
        extras: extrasResolus,
      });

      sousTotal += prixUnitaire * item.quantite;
    }

    const totalGeneral = sousTotal + zone.prix;

    // ------------------------------------------------------------
    // 4. TRANSACTION ATOMIQUE : commande + items, tout ou rien.
    //    La fonction gère aussi l'idempotence : si idempotencyKey
    //    correspond à une commande déjà créée, elle la renvoie
    //    telle quelle au lieu d'en créer une nouvelle.
    // ------------------------------------------------------------
    const { data: resultat, error: rpcError } = await supabaseAdmin.rpc('creer_commande_complete', {
      p_client_nom: clientNom,
      p_client_telephone: clientTelephone,
      p_adresse_livraison: `${adressePrecise} (${zone.nom})`,
      p_creneau_souhaite: creneauSouhaite,
      p_total: totalGeneral,
      p_items: itemsValides,
      p_idempotency_key: idempotencyKey,
    });

    if (rpcError) {
  console.error('Erreur creer_commande_complete:', rpcError);
  if (rpcError.message?.includes('Stock insuffisant')) {
    return NextResponse.json(
      { error: 'Un des articles de votre panier vient de rentrer en rupture de stock. Retournez au menu pour vérifier.' },
      { status: 409 }
    );
  }
  return NextResponse.json({ error: 'Erreur lors de la création de la commande.' }, { status: 500 });
}

    const commande = Array.isArray(resultat) ? resultat[0] : resultat;

    // ------------------------------------------------------------
    // 5. RÉPONSE — le client utilise CES données pour WhatsApp,
    //    jamais les siennes, pour éviter tout affichage incohérent
    //    avec ce qui a réellement été enregistré.
    // ------------------------------------------------------------
    return NextResponse.json({
      id: commande.id,
      statut: commande.statut,
      created_at: commande.created_at,
      deja_existante: commande.deja_existante || false,
      sous_total: sousTotal,
      frais_livraison: zone.prix,
      total: totalGeneral,
      zone_nom: zone.nom,
      items: itemsValides,
    });
  } catch (err) {
    console.error('Erreur inattendue /api/commandes:', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue.' }, { status: 500 });
  }
}