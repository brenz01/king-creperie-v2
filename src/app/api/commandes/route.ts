import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { etatBoutique, phraseFermeture, type Boutique } from '@/lib/horaires';
import { verifierRateLimit, extraireIp, minutesRestantes } from '@/lib/rateLimit';
import { trouverZone } from '@/lib/zones';
import { estPersonnalisable, MAX_EXTRAS_PAR_ARTICLE } from '@/lib/extras';

// Le client service_role bypass RLS : tout le contrôle d'accès et la
// validation sont faits explicitement dans ce fichier.

// Téléphone sénégalais : 9 chiffres commençant par 7, préfixe 221 optionnel.
const TELEPHONE_SN_REGEX = /^(?:\+?221)?[\s.-]?7[0-9](?:[\s.-]?[0-9]){7}$/;

// Retire les caractères de contrôle (affichage WhatsApp / dashboard).
const texte = (max: number) =>
  z
    .string()
    .transform((v) => v.replace(/[\x00-\x1F\x7F]/g, ' ').trim().slice(0, max));

const SchemaCommande = z.object({
  client_nom: texte(100).pipe(z.string().min(2, 'Le nom doit contenir au moins 2 caractères.')),
  client_telephone: z
    .string()
    .trim()
    .regex(TELEPHONE_SN_REGEX, 'Numéro de téléphone invalide (format sénégalais attendu, ex : 77 000 00 00).'),
  adresse_precise: texte(300).pipe(z.string().min(3, "L'adresse doit contenir au moins 3 caractères.")),
  zone_id: z.coerce.number().int(),
  creneau_souhaite: texte(100).optional(),
  items: z
    .array(
      z.object({
        produit_id: z.guid('Identifiant produit invalide.'),
        quantite: z.number().int().min(1, 'Quantité invalide (1 à 20).').max(20, 'Quantité invalide (1 à 20).'),
        extras_ids: z
          .array(z.string().min(1).max(50))
          .max(MAX_EXTRAS_PAR_ARTICLE, `${MAX_EXTRAS_PAR_ARTICLE} extras maximum par article.`)
          .default([]),
      })
    )
    .min(1, 'Le panier est vide.')
    .max(50, "Trop d'articles dans une seule commande."),
  // Optionnelle (rétro-compatibilité) ; ignorée si ce n'est pas un UUID.
  idempotency_key: z.guid().optional().catch(undefined),
});

// Seuils calibrés pour le CGNAT des opérateurs mobiles sénégalais :
// beaucoup de clients partagent une même IP publique, donc le seuil IP
// est large et la vraie limite anti-spam porte sur le numéro.
const LIMITE_IP = { max: 30, fenetreMs: 10 * 60 * 1000 };
const LIMITE_TELEPHONE = { max: 4, fenetreMs: 10 * 60 * 1000 };

function json429(ms?: number) {
  return NextResponse.json(
    { error: `Trop de commandes envoyées. Réessayez dans ${minutesRestantes(ms)} minute(s).` },
    { status: 429 }
  );
}

export async function POST(request: NextRequest) {
  try {
    // 0. Rate limit IP — avant même de lire le body.
    const ip = extraireIp(request);
    const parIp = verifierRateLimit(`cmd:ip:${ip}`, LIMITE_IP.max, LIMITE_IP.fenetreMs);
    if (!parIp.autorise) return json429(parIp.reessayerDansMs);

    let brut: unknown;
    try {
      brut = await request.json();
    } catch {
      return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }

    // 1. Validation stricte du format.
    const parse = SchemaCommande.safeParse(brut);
    if (!parse.success) {
      const details = [...new Set(parse.error.issues.map((i) => i.message))];
      return NextResponse.json({ error: 'Validation échouée', details }, { status: 400 });
    }
    const body = parse.data;

    const zone = trouverZone(body.zone_id);
    if (!zone) {
      return NextResponse.json({ error: 'Validation échouée', details: ['Zone de livraison invalide.'] }, { status: 400 });
    }

    // 1bis. Rate limit par numéro (normalisé sur les 9 derniers chiffres).
    const telephoneNormalise = body.client_telephone.replace(/\D/g, '').slice(-9);
    const parTel = verifierRateLimit(`cmd:tel:${telephoneNormalise}`, LIMITE_TELEPHONE.max, LIMITE_TELEPHONE.fenetreMs);
    if (!parTel.autorise) return json429(parTel.reessayerDansMs);

    const items = body.items.map((i) => ({ ...i, extras_ids: [...new Set(i.extras_ids)] }));
    const supabaseAdmin = getSupabaseAdmin();

    // 1ter. Boutique fermée (horaires ou pause du gérant) : refus clair.
    // Table absente (migration pas encore jouée) : on laisse passer.
    const { data: boutique } = await supabaseAdmin
      .from('boutique')
      .select('horaires, fermeture_exceptionnelle, message_fermeture')
      .eq('id', 1)
      .maybeSingle();
    if (boutique) {
      const etat = etatBoutique(boutique as Boutique);
      if (!etat.ouvert) {
        return NextResponse.json({ error: phraseFermeture(etat), ferme: true }, { status: 409 });
      }
    }

    // 2. Recharger les vrais prix depuis la base.
    const produitIds = [...new Set(items.map((i) => i.produit_id))];
    const { data: produits, error: produitsError } = await supabaseAdmin
      .from('produits')
      .select('id, nom, prix, disponible, categorie')
      .in('id', produitIds);

    if (produitsError || !produits) {
      console.error('Erreur chargement produits:', produitsError);
      return NextResponse.json({ error: 'Erreur serveur (produits)' }, { status: 500 });
    }
    const produitsMap = new Map(produits.map((p) => [p.id as string, p]));

    const extraIds = [...new Set(items.flatMap((i) => i.extras_ids))];
    const { data: extras, error: extrasError } = extraIds.length > 0
      ? await supabaseAdmin.from('extras').select('id, nom, prix, actif').in('id', extraIds)
      : { data: [] as Array<{ id: string; nom: string; prix: number; actif: boolean }>, error: null };

    if (extrasError) {
      console.error('Erreur chargement extras:', extrasError);
      return NextResponse.json({ error: 'Erreur serveur (extras)' }, { status: 500 });
    }
    const extrasMap = new Map((extras ?? []).map((e) => [e.id as string, e]));

    // 3. Valider chaque item et calculer le total côté serveur.
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
        return NextResponse.json({ error: `Article #${index + 1} : produit introuvable.` }, { status: 400 });
      }
      if (!produit.disponible) {
        return NextResponse.json({ error: `« ${produit.nom} » n'est plus disponible.` }, { status: 409 });
      }
      if (item.extras_ids.length > 0 && !estPersonnalisable(produit.categorie)) {
        return NextResponse.json({ error: `« ${produit.nom} » ne peut pas recevoir d'extras.` }, { status: 400 });
      }

      const extrasResolus: Array<{ id: string; nom: string; prix: number }> = [];
      for (const extraId of item.extras_ids) {
        const extra = extrasMap.get(extraId);
        if (!extra || !extra.actif) {
          return NextResponse.json(
            { error: `Un extra choisi sur « ${produit.nom} » n'est plus proposé.` },
            { status: 409 }
          );
        }
        extrasResolus.push({ id: extra.id, nom: extra.nom, prix: extra.prix });
      }

      const prixUnitaire = produit.prix + extrasResolus.reduce((s, e) => s + e.prix, 0);
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
    const creneau = body.creneau_souhaite || 'Au plus vite';
    const adresseComplete = `${body.adresse_precise} (${zone.nom})`;

    // 4. Transaction atomique (commande + items + stock) + idempotence.
    const { data: resultat, error: rpcError } = await supabaseAdmin.rpc('creer_commande_complete', {
      p_client_nom: body.client_nom,
      p_client_telephone: body.client_telephone,
      p_adresse_livraison: adresseComplete,
      p_creneau_souhaite: creneau,
      p_total: totalGeneral,
      p_items: itemsValides,
      p_idempotency_key: body.idempotency_key ?? null,
    });

    if (rpcError) {
      console.error('Erreur creer_commande_complete:', rpcError);
      if (rpcError.message?.includes('Stock insuffisant')) {
        return NextResponse.json(
          { error: 'Un des articles de votre panier vient de passer en rupture de stock. Retournez au menu pour vérifier.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Erreur lors de la création de la commande.' }, { status: 500 });
    }

    const commande = Array.isArray(resultat) ? resultat[0] : resultat;

    // 5. Réponse — le client construit le message WhatsApp avec CES
    //    valeurs (nettoyées et recalculées), jamais avec les siennes.
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
      client: {
        nom: body.client_nom,
        telephone: body.client_telephone,
        adresse: body.adresse_precise,
        creneau,
      },
    });
  } catch (err) {
    console.error('Erreur inattendue /api/commandes:', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue.' }, { status: 500 });
  }
}
