'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart, cleLigne } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { Send, MapPin, Phone, User, Trash2, ArrowLeft, Clock, WifiOff, RefreshCw, Truck } from 'lucide-react';
import Link from 'next/link';
import { ZONES_LIVRAISON } from '@/lib/zones';
import { genererUuid } from '@/lib/uuid';
import { CLE_WHATSAPP } from '@/lib/whatsapp';
import { useEstHydrate } from '@/lib/useEstHydrate';
import { chargerExtras, chargerProduits } from '@/lib/catalogue';
import type { ChangementsPanier } from '@/context/CartContext';
import { Loader2 } from 'lucide-react';

interface ItemServeur {
  produit_id: string;
  nom_produit: string;
  quantite: number;
  prix_unitaire: number;
}

interface ReponseCommande {
  id: string;
  statut: string;
  created_at: string;
  deja_existante: boolean;
  sous_total: number;
  frais_livraison: number;
  total: number;
  zone_nom: string;
  items: ItemServeur[];
  client: { nom: string; telephone: string; adresse: string; creneau: string };
}

type TypeErreur = 'reseau' | 'validation' | 'conflit' | 'serveur' | null;

const CLE_DERNIERE_COMMANDE = 'king_creperie_derniere_commande';

function construireMessageWhatsApp(c: ReponseCommande, origine: string): string {
  const lignes = c.items
    .map((i) => `• ${i.quantite}x ${i.nom_produit} (${(i.prix_unitaire * i.quantite).toLocaleString('fr-FR')} FCFA)`)
    .join('\n');
  return (
    `👑 *NOUVELLE COMMANDE KING CRÊPERIE*\n\n` +
    `🆔 *N° Commande :* #${c.id.slice(0, 8)}\n` +
    `👤 *Client :* ${c.client.nom}\n` +
    `📞 *Tel :* ${c.client.telephone}\n` +
    `📍 *Adresse :* ${c.client.adresse} (${c.zone_nom})\n` +
    `⏰ *Créneau :* ${c.client.creneau}\n\n` +
    `📜 *DÉTAILS DU PANIER :*\n${lignes}\n\n` +
    `🚚 *Livraison :* ${c.frais_livraison.toLocaleString('fr-FR')} FCFA\n` +
    `💰 *TOTAL À PAYER :* *${c.total.toLocaleString('fr-FR')} FCFA*\n\n` +
    `🔗 *Suivi en direct :* ${origine}/suivi?id=${c.id}`
  );
}

export default function CommandePage() {
  const { cart, totalAmount, updateQuantity, removeFromCart, clearCart, synchroniser } = useCart();
  const router = useRouter();
  const hydrate = useEstHydrate();
  const [redirection, setRedirection] = useState(false);
  const [majPanier, setMajPanier] = useState<ChangementsPanier | null>(null);

  // Le panier vient de localStorage : on le recale sur les prix et la
  // disponibilité réels avant que le client ne valide un total faux.
  useEffect(() => {
    let actif = true;
    void Promise.all([chargerProduits(), chargerExtras()]).then(([p, e]) => {
      if (!actif || !p) return;
      const changements = synchroniser(p, e);
      if (changements.retires.length > 0 || changements.prixModifies.length > 0) setMajPanier(changements);
    });
    return () => {
      actif = false;
    };
  }, [synchroniser]);

  const [zoneIndex, setZoneIndex] = useState<number | null>(null);
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [adresse, setAdresse] = useState('');
  const [creneau, setCreneau] = useState('Au plus vite');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [typeErreur, setTypeErreur] = useState<TypeErreur>(null);

  // Clé d'idempotence stable pour toute la durée de vie de la page :
  // un retry (réseau, 5xx) renvoie la même clé → jamais de doublon.
  const [idempotencyKey] = useState(genererUuid);
  const envoiEnCoursRef = useRef(false);

  const zoneChoisie = zoneIndex !== null ? ZONES_LIVRAISON[zoneIndex] : null;
  const fraisLivraison = zoneChoisie?.prix ?? 0;
  const totalGeneral = totalAmount + fraisLivraison;

  const echec = (type: Exclude<TypeErreur, null>, message: string) => {
    setTypeErreur(type);
    setErrorMsg(message);
    // Aucune commande n'a été créée : le formulaire doit rester
    // utilisable (avant : bloqué silencieusement après toute 4xx).
    envoiEnCoursRef.current = false;
    setLoading(false);
  };

  const envoyerCommande = async () => {
    if (cart.length === 0 || zoneChoisie === null || envoiEnCoursRef.current) return;

    envoiEnCoursRef.current = true;
    setLoading(true);
    setErrorMsg('');
    setTypeErreur(null);

    let reponse: Response;
    try {
      reponse = await fetch('/api/commandes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_nom: nom,
          client_telephone: telephone,
          adresse_precise: adresse,
          zone_id: zoneChoisie.id,
          creneau_souhaite: creneau,
          items: cart.map((item) => ({
            produit_id: item.produit.id,
            quantite: item.quantite,
            extras_ids: (item.produit.extrasChoisis ?? []).map((e) => e.id),
          })),
          idempotency_key: idempotencyKey,
        }),
      });
    } catch {
      return echec('reseau', 'Impossible de joindre le serveur. Vérifiez votre connexion internet.');
    }

    const data: unknown = await reponse.json().catch(() => null);

    if (!reponse.ok || !data) {
      const d = (data ?? {}) as { error?: string; details?: string[] };
      const message = (Array.isArray(d.details) ? d.details.join(' ') : d.error)
        || 'Une erreur est survenue lors de la création de la commande.';
      if (reponse.status === 400) return echec('validation', message);
      if (reponse.status === 409 || reponse.status === 429) return echec('conflit', message);
      return echec('serveur', message);
    }

    const commande = data as ReponseCommande;

    try {
      localStorage.setItem(CLE_DERNIERE_COMMANDE, commande.id);
      // Le message WhatsApp est préparé ici puis envoyé depuis /suivi par
      // un vrai clic : un window.open() après un await est bloqué par
      // Safari iOS (et en mode PWA installée), la notif n'était jamais envoyée.
      sessionStorage.setItem(CLE_WHATSAPP(commande.id), construireMessageWhatsApp(commande, window.location.origin));
    } catch {
      // stockage indisponible : /suivi proposera le contact WhatsApp simple
    }

    setRedirection(true);
    clearCart();
    router.push(`/suivi?id=${commande.id}&nouvelle=1`);
  };

  const peutReessayer = typeErreur === 'reseau' || typeErreur === 'serveur';

  if (!hydrate || redirection) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center gap-3 text-kc-bissap">
        <Loader2 className="w-8 h-8 animate-spin" />
        {redirection && <p className="text-sm text-stone-600">Commande enregistrée, redirection vers le suivi…</p>}
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen pt-32 pb-16 px-6 max-w-2xl mx-auto text-center flex flex-col items-center justify-center">
        <div className="bg-white border border-stone-200/80 shadow-sm p-8 rounded-2xl w-full">
          <h1 className="font-serif text-2xl font-semibold text-kc-encre mb-2">Votre panier est vide</h1>
          <p className="text-stone-500 mb-6">Ajoutez quelques crêpes depuis notre carte avant d&apos;effectuer une commande.</p>
          <Link
            href="/#menu"
            className="inline-flex items-center gap-2 bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retourner à la carte</span>
          </Link>
        </div>
      </div>
    );
  }

  const champ =
    'w-full bg-stone-50 border border-stone-200 rounded-lg py-3 pl-12 pr-4 text-kc-encre placeholder:text-stone-400 focus:outline-none focus:border-kc-indigo focus:ring-1 focus:ring-kc-indigo transition-all';

  return (
    <div className="min-h-screen pt-28 pb-16 px-6 max-w-5xl mx-auto">
      <Link href="/#menu" className="inline-flex items-center gap-2 text-stone-500 hover:text-kc-bissap text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Continuer mes achats</span>
      </Link>

      <h1 className="font-serif text-3xl md:text-4xl font-semibold text-kc-encre mb-8">
        Votre commande
      </h1>

      {majPanier && (
        <div role="status" className="bg-kc-beurre/50 border border-kc-beurre text-kc-encre p-4 rounded-xl mb-6 text-sm">
          <p className="font-semibold">Votre panier a été mis à jour</p>
          {majPanier.retires.length > 0 && (
            <p className="mt-1">Plus disponible, retiré : {majPanier.retires.join(', ')}.</p>
          )}
          {majPanier.prixModifies.length > 0 && (
            <p className="mt-1">Prix actualisé : {majPanier.prixModifies.join(', ')}.</p>
          )}
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl mb-6 text-sm font-medium flex items-start gap-3">
          {typeErreur === 'reseau' && <WifiOff className="w-5 h-5 shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p>{errorMsg}</p>
            {peutReessayer && (
              <button
                type="button"
                onClick={envoyerCommande}
                disabled={loading}
                className="mt-3 inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{loading ? 'Nouvelle tentative...' : 'Réessayer'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void envoyerCommande();
          }}
          className="lg:col-span-7 bg-white border border-stone-200/80 shadow-sm p-6 md:p-8 rounded-2xl space-y-5"
        >
          {/* ÉTAPE 1 — Zone de livraison en premier : le vrai total est
              visible avant de remplir les coordonnées. */}
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-stone-100">
              <span className="w-6 h-6 rounded-full bg-kc-indigo text-kc-beurre text-xs font-bold flex items-center justify-center shrink-0">1</span>
              <h2 className="font-serif text-xl font-semibold text-kc-encre">Où livrer ?</h2>
            </div>
            <label htmlFor="zone" className="block text-sm font-semibold text-kc-encre/80 mb-2">Zone de livraison</label>
            <div className="relative">
              <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5 pointer-events-none" />
              <select
                id="zone"
                required
                value={zoneIndex ?? ''}
                onChange={(e) => setZoneIndex(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg py-3 pl-12 pr-4 text-kc-encre focus:outline-none focus:border-kc-indigo focus:ring-1 focus:ring-kc-indigo transition-all"
              >
                <option value="" disabled>Sélectionnez votre zone</option>
                {ZONES_LIVRAISON.map((z, idx) => (
                  <option key={z.id} value={idx}>
                    {z.nom} (+{z.prix.toLocaleString('fr-FR')} FCFA)
                  </option>
                ))}
              </select>
            </div>
            {zoneChoisie && (
              <p className="text-xs text-kc-bissap font-medium mt-2">
                Frais de livraison : {zoneChoisie.prix.toLocaleString('fr-FR')} FCFA — total mis à jour dans le récapitulatif
              </p>
            )}
          </div>

          {/* ÉTAPE 2 — Coordonnées */}
          <fieldset
            disabled={zoneIndex === null}
            className={`space-y-5 transition-opacity ${zoneIndex === null ? 'opacity-40' : 'opacity-100'}`}
          >
            <div className="flex items-center gap-2 pt-2 pb-3 border-b border-stone-100">
              <span className="w-6 h-6 rounded-full bg-kc-indigo text-kc-beurre text-xs font-bold flex items-center justify-center shrink-0">2</span>
              <h2 className="font-serif text-xl font-semibold text-kc-encre">Vos coordonnées</h2>
            </div>

            <div>
              <label htmlFor="nom" className="block text-sm font-semibold text-kc-encre/80 mb-2">Nom et prénom</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                <input id="nom" type="text" required minLength={2} maxLength={100} autoComplete="name"
                  value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex: Babacar Diop" className={champ} />
              </div>
            </div>

            <div>
              <label htmlFor="tel" className="block text-sm font-semibold text-kc-encre/80 mb-2">Numéro de téléphone</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                <input id="tel" type="tel" required inputMode="tel" autoComplete="tel" maxLength={20}
                  value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Ex: 77 000 00 00" className={champ} />
              </div>
            </div>

            <div>
              <label htmlFor="adresse" className="block text-sm font-semibold text-kc-encre/80 mb-2">Adresse précise</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-3 text-stone-400 w-5 h-5" />
                <textarea id="adresse" required rows={2} minLength={3} maxLength={300} autoComplete="street-address"
                  value={adresse} onChange={(e) => setAdresse(e.target.value)}
                  placeholder="Rue, Immeuble, Appt, Repère visuel..." className={champ} />
              </div>
            </div>

            <div>
              <label htmlFor="creneau" className="block text-sm font-semibold text-kc-encre/80 mb-2">Créneau souhaité</label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                <input id="creneau" type="text" maxLength={100}
                  value={creneau} onChange={(e) => setCreneau(e.target.value)} placeholder="Ex: Au plus vite / 20h00" className={champ} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || zoneIndex === null}
              className="w-full mt-4 bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.99] disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
              <span>{loading ? 'Traitement...' : 'Valider ma commande'}</span>
            </button>
            <p className="text-xs text-stone-400 text-center">Paiement en espèces à la livraison. Vous confirmerez ensuite sur WhatsApp.</p>
          </fieldset>
        </form>

        <div className="lg:col-span-5 bg-white border border-stone-200/80 shadow-sm p-6 md:p-8 rounded-2xl h-fit lg:sticky lg:top-28">
          <h2 className="font-serif text-xl font-semibold text-kc-encre mb-4 border-b border-stone-100 pb-3">Récapitulatif</h2>

          <div data-lenis-prevent className="space-y-4 max-h-80 overflow-y-auto overscroll-contain pr-2 mb-6">
            {cart.map((item) => {
              const cle = cleLigne(item.produit);
              return (
                <div key={cle} className="flex justify-between items-center border-b border-stone-100 pb-3">
                  <div className="flex-1 pr-2">
                    <p className="font-semibold text-kc-encre text-sm">{item.produit.nom}</p>
                    <p className="text-xs text-kc-bissap font-medium">{item.produit.prix.toLocaleString('fr-FR')} FCFA</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Retirer un" onClick={() => updateQuantity(cle, -1)}
                      className="bg-stone-100 hover:bg-stone-200 text-stone-800 w-7 h-7 rounded-md flex items-center justify-center font-bold transition-colors">-</button>
                    <span className="text-sm font-bold w-4 text-center text-kc-encre">{item.quantite}</span>
                    <button type="button" aria-label="Ajouter un" onClick={() => updateQuantity(cle, 1)}
                      className="bg-stone-100 hover:bg-stone-200 text-stone-800 w-7 h-7 rounded-md flex items-center justify-center font-bold transition-colors">+</button>
                    <button type="button" aria-label="Supprimer l'article" onClick={() => removeFromCart(cle)}
                      className="text-rose-500 hover:text-rose-600 ml-2 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2 border-t border-stone-100 pt-4 text-sm">
            <div className="flex justify-between text-stone-500">
              <span>Sous-total</span>
              <span className="font-medium text-stone-800">{totalAmount.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Frais de livraison</span>
              <span className="font-medium text-stone-800">
                {zoneChoisie ? `${fraisLivraison.toLocaleString('fr-FR')} FCFA` : '— (choisir une zone)'}
              </span>
            </div>
            <div className="flex justify-between text-lg font-serif font-semibold text-kc-bissap border-t border-stone-100 pt-3">
              <span>Total</span>
              <span>{totalGeneral.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
