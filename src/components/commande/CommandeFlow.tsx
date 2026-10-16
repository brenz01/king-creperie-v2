'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Clock,
  Loader2,
  MessageCircle,
  Minus,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { useCart, cleLigne, type ChangementsPanier } from '@/context/CartContext';
import { chargerExtras, chargerProduits } from '@/lib/catalogue';
import { FRAIS_MAX, FRAIS_MIN, QUARTIERS, trouverQuartier, trouverZone } from '@/lib/zones';
import { genererUuid } from '@/lib/uuid';
import { CLE_WHATSAPP, urlContactWhatsApp, urlWhatsApp } from '@/lib/whatsapp';
import { rafraichirBoutique, useBoutique } from '@/lib/useBoutique';
import { phraseFermeture } from '@/lib/horaires';

// ------------------------------------------------------------------
// Parcours de commande en 3 étapes, utilisé dans le panneau (même page
// que la carte) et sur la page /commande (secours, lien direct).
//   1. Votre panier   2. Livraison   3. Confirmer sur WhatsApp
// L'étape 3 existe parce qu'un window.open() après l'appel serveur est
// bloqué sur iPhone : WhatsApp doit s'ouvrir sur un vrai toucher.
// ------------------------------------------------------------------

type Etape = 'panier' | 'livraison' | 'whatsapp';

interface Formulaire {
  quartier: string; // nom d'un quartier de QUARTIERS, 'autre', ou ''
  nom: string;
  telephone: string;
  adresse: string;
  repere: string;
  note: string;
  creneau: string;
}

const FORMULAIRE_VIDE: Formulaire = { quartier: '', nom: '', telephone: '', adresse: '', repere: '', note: '', creneau: '' };
const CLE_FORMULAIRE = 'king_creperie_formulaire';
const CLE_DERNIERE_COMMANDE = 'king_creperie_derniere_commande';
export const CLE_WA_ENVOYE = (id: string) => `king_creperie_wa_envoye_${id}`;

interface ReponseCommande {
  id: string;
  sous_total: number;
  frais_livraison: number;
  total: number;
  zone_nom: string;
  items: Array<{ nom_produit: string; quantite: number; prix_unitaire: number }>;
  client: { nom: string; telephone: string; adresse: string; creneau: string };
}

const f = (n: number) => `${n.toLocaleString('fr-FR')} F`;

function lireFormulaire(): Formulaire {
  try {
    const brut = sessionStorage.getItem(CLE_FORMULAIRE);
    return brut ? { ...FORMULAIRE_VIDE, ...(JSON.parse(brut) as Partial<Formulaire>) } : FORMULAIRE_VIDE;
  } catch {
    return FORMULAIRE_VIDE;
  }
}

function messageWhatsApp(c: ReponseCommande, origine: string): string {
  const lignes = c.items
    .map((i) => `- ${i.quantite} x ${i.nom_produit} : ${(i.prix_unitaire * i.quantite).toLocaleString('fr-FR')} F`)
    .join('\n');
  return (
    `Bonjour King Crêperie, je souhaite confirmer ma commande n° ${c.id.slice(0, 8).toUpperCase()}.\n\n` +
    `${lignes}\n\n` +
    `Livraison (${c.zone_nom}) : ${c.frais_livraison.toLocaleString('fr-FR')} F\n` +
    `*Total à payer à la livraison : ${c.total.toLocaleString('fr-FR')} F*\n\n` +
    `Nom : ${c.client.nom}\n` +
    `Téléphone : ${c.client.telephone}\n` +
    `Adresse : ${c.client.adresse}\n` +
    `Pour : ${c.client.creneau}\n\n` +
    `Suivi : ${origine}/suivi?id=${c.id}`
  );
}

interface CommandeFlowProps {
  mode: 'panneau' | 'page';
  onFermer?: () => void;
}

export default function CommandeFlow({ mode, onFermer }: CommandeFlowProps) {
  const { cart, totalAmount, updateQuantity, removeFromCart, clearCart, synchroniser } = useCart();
  const [etape, setEtape] = useState<Etape>('panier');
  const [form, setForm] = useState<Formulaire>(lireFormulaire);
  const [majPanier, setMajPanier] = useState<ChangementsPanier | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<{ type: 'reseau' | 'validation' | 'serveur'; texte: string } | null>(null);
  const [commande, setCommande] = useState<ReponseCommande | null>(null);
  const [waOuvert, setWaOuvert] = useState(false);
  const [precisions, setPrecisions] = useState(() => {
    const f0 = lireFormulaire();
    return !!(f0.note || f0.creneau);
  });
  const cleIdempotence = useRef<string>(genererUuid());
  const envoiEnCours = useRef(false);
  const haut = useRef<HTMLDivElement>(null);
  // Boutique fermée (horaires ou pause) : on garde le panier, on bloque l'envoi.
  const { etat: etatBoutique } = useBoutique();
  const ferme = etatBoutique !== null && !etatBoutique.ouvert;

  // Recalage du panier (prix, disponibilité) à l'ouverture.
  useEffect(() => {
    let actif = true;
    void Promise.all([chargerProduits(), chargerExtras()]).then(([p, e]) => {
      if (!actif || !p) return;
      const ch = synchroniser(p, e);
      if (ch.retires.length > 0 || ch.prixModifies.length > 0) setMajPanier(ch);
    });
    return () => {
      actif = false;
    };
  }, [synchroniser]);

  // Le formulaire survit à la fermeture du panneau et aux allers-retours.
  useEffect(() => {
    try {
      sessionStorage.setItem(CLE_FORMULAIRE, JSON.stringify(form));
    } catch {}
  }, [form]);

  const changer =
    (champ: keyof Formulaire) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [champ]: e.target.value }));

  const allerA = (suivante: Etape) => {
    setEtape(suivante);
    setErreur(null);
    haut.current?.scrollIntoView({ block: 'start' });
  };

  const quartier = trouverQuartier(form.quartier);
  const zone = quartier ? trouverZone(quartier.zoneId) : undefined;
  const horsZone = form.quartier === 'autre';
  const total = totalAmount + (zone?.prix ?? 0);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zone || cart.length === 0 || envoiEnCours.current) return;
    envoiEnCours.current = true;
    setEnvoi(true);
    setErreur(null);

    const morceaux = [form.adresse.trim()];
    if (form.repere.trim()) morceaux.push(`Repère : ${form.repere.trim()}`);
    if (form.note.trim()) morceaux.push(`Pour le livreur : ${form.note.trim()}`);
    const adresse = `${quartier!.nom}, ${morceaux.join('. ')}`.slice(0, 300);

    const fin = (err: { type: 'reseau' | 'validation' | 'serveur'; texte: string }) => {
      setErreur(err);
      envoiEnCours.current = false;
      setEnvoi(false);
    };

    let res: Response;
    try {
      res = await fetch('/api/commandes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_nom: form.nom,
          client_telephone: form.telephone,
          adresse_precise: adresse,
          zone_id: zone.id,
          creneau_souhaite: form.creneau.trim() || 'Dès que possible',
          items: cart.map((i) => ({
            produit_id: i.produit.id,
            quantite: i.quantite,
            extras_ids: (i.produit.extrasChoisis ?? []).map((x) => x.id),
          })),
          idempotency_key: cleIdempotence.current,
        }),
      });
    } catch {
      return fin({ type: 'reseau', texte: 'La connexion a été interrompue. Réessayez, votre panier est conservé.' });
    }

    const data: unknown = await res.json().catch(() => null);
    if (!res.ok || !data) {
      const d = (data ?? {}) as { error?: string; details?: string[]; ferme?: boolean };
      if (d.ferme) void rafraichirBoutique();
      const texte =
        (Array.isArray(d.details) ? d.details.join(' ') : d.error) || 'La commande n’a pas pu être enregistrée. Réessayez.';
      return fin({ type: res.status >= 500 ? 'serveur' : 'validation', texte });
    }

    const c = data as ReponseCommande;
    try {
      localStorage.setItem(CLE_DERNIERE_COMMANDE, c.id);
      sessionStorage.setItem(CLE_WHATSAPP(c.id), messageWhatsApp(c, window.location.origin));
    } catch {}
    cleIdempotence.current = genererUuid(); // la prochaine commande sera une nouvelle commande
    envoiEnCours.current = false;
    setEnvoi(false);
    setCommande(c);
    clearCart();
    allerA('whatsapp');
  };

  const champ =
    'w-full bg-white border border-kc-encre/15 rounded-2xl px-4 py-3.5 text-base text-kc-encre placeholder:text-kc-encre/40 focus:outline-none focus:border-kc-indigo focus:ring-2 focus:ring-kc-indigo/20';
  const etiquette = 'block text-sm font-semibold text-kc-encre mb-1.5';

  // ---------------------------------------------------------------- 3
  if (etape === 'whatsapp' && commande) {
    const message = messageWhatsApp(commande, typeof window !== 'undefined' ? window.location.origin : '');
    return (
      <div ref={haut} className="flex flex-col gap-6">
        <div className="text-center pt-4">
          <span className="mx-auto w-16 h-16 rounded-full bg-kc-indigo text-kc-beurre flex items-center justify-center">
            <MessageCircle className="w-8 h-8" />
          </span>
          <h2 className="font-display text-3xl mt-4">Dernière étape</h2>
          <p className="mt-2 text-kc-encre/75 leading-relaxed max-w-sm mx-auto">
            Plus qu’un geste : envoyez le récapitulatif sur WhatsApp, et nous vous confirmons la commande tout de suite.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-kc-encre/10 p-5">
          <p className="text-sm text-kc-encre/60">Commande n° {commande.id.slice(0, 8).toUpperCase()}</p>
          <p className="mt-1 flex items-baseline justify-between">
            <span className="font-semibold">Total à payer à la livraison</span>
            <span className="prix text-2xl">{f(commande.total)}</span>
          </p>
          <p className="mt-1 text-sm text-kc-encre/60">Paiement en espèces à la réception.</p>
        </div>

        <a
          href={urlWhatsApp(message)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            setWaOuvert(true);
            try {
              sessionStorage.setItem(CLE_WA_ENVOYE(commande.id), '1');
            } catch {}
          }}
          className="flex items-center justify-center gap-2 bg-[#1FA855] hover:bg-[#178a45] text-white font-semibold text-base py-4 rounded-full transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          {waOuvert ? 'Renvoyer sur WhatsApp' : 'Envoyer sur WhatsApp pour confirmer'}
        </a>

        <Link
          href={`/suivi?id=${commande.id}&nouvelle=1`}
          onClick={onFermer}
          className={`flex items-center justify-center font-semibold text-base py-4 rounded-full transition-colors ${
            waOuvert
              ? 'bg-kc-indigo text-kc-beurre hover:bg-kc-nuit'
              : 'border border-kc-encre/20 text-kc-encre hover:border-kc-encre/50'
          }`}
        >
          Suivre ma commande
        </Link>
      </div>
    );
  }

  // ---------------------------------------------------------- panier vide
  if (cart.length === 0) {
    return (
      <div ref={haut} className="flex flex-col items-center text-center py-16">
        <ShoppingBag className="w-12 h-12 text-kc-encre/25" />
        <p className="font-display text-2xl mt-4">Votre panier est vide</p>
        <p className="text-kc-encre/70 mt-2">Choisissez une crêpe pour commencer.</p>
        {mode === 'panneau' ? (
          <button
            onClick={onFermer}
            className="mt-6 bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold px-6 py-3.5 rounded-full"
          >
            Retour à la carte
          </button>
        ) : (
          <Link
            href="/#carte"
            className="mt-6 bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold px-6 py-3.5 rounded-full"
          >
            Retour à la carte
          </Link>
        )}
      </div>
    );
  }

  const recap = (
    <dl className="space-y-1.5 text-[0.95rem]">
      <div className="flex justify-between">
        <dt className="text-kc-encre/70">Sous-total</dt>
        <dd className="prix">{f(totalAmount)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-kc-encre/70">Livraison{quartier ? ` à ${quartier.nom}` : ''}</dt>
        <dd className={zone ? 'prix' : 'text-sm text-kc-encre/60 text-right'}>
          {zone ? f(zone.prix) : `selon le quartier, ${f(FRAIS_MIN)} à ${f(FRAIS_MAX)}`}
        </dd>
      </div>
      <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-kc-encre/10">
        <dt className="font-semibold">{zone ? 'Total à payer' : 'Total hors livraison'}</dt>
        <dd className="prix text-2xl">{f(total)}</dd>
      </div>
      <p className="text-sm text-kc-encre/60 pt-1">Paiement en espèces à la réception.</p>
    </dl>
  );

  // Le quartier se choisit dès le panier : le client voit son total exact
  // avant de remplir quoi que ce soit.
  const choixQuartier = (
    <div>
      <label htmlFor="quartier" className={etiquette}>
        Livrer à
      </label>
      <select id="quartier" required value={form.quartier} onChange={changer('quartier')} className={champ}>
        <option value="" disabled>
          Choisissez votre quartier
        </option>
        {QUARTIERS.map((q) => (
          <option key={q.nom} value={q.nom}>
            {q.nom} : livraison {f(trouverZone(q.zoneId)!.prix)}
          </option>
        ))}
        <option value="autre">Mon quartier n&apos;est pas dans la liste</option>
      </select>
      {horsZone && (
        <p className="mt-2 text-sm">
          Nous ne livrons pas encore dans ce quartier.{' '}
          <a
            href={urlContactWhatsApp()}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-kc-bissap underline"
          >
            Écrivez-nous sur WhatsApp pour vérifier.
          </a>
        </p>
      )}
    </div>
  );

  // ---------------------------------------------------------------- 1
  if (etape === 'panier') {
    return (
      <div ref={haut} className="flex flex-col gap-5">
        <div>
          <h2 className="font-display text-3xl">Votre panier</h2>
          <p className="text-kc-encre/70 mt-1">Vérifiez votre commande et choisissez votre quartier.</p>
        </div>

        {majPanier && (
          <div role="status" className="bg-kc-beurre/60 rounded-2xl p-4 text-sm">
            <p className="font-semibold">Votre panier a été mis à jour</p>
            {majPanier.retires.length > 0 && <p className="mt-1">Plus disponible, retiré : {majPanier.retires.join(', ')}.</p>}
            {majPanier.prixModifies.length > 0 && <p className="mt-1">Prix actualisé : {majPanier.prixModifies.join(', ')}.</p>}
          </div>
        )}

        <ul className="divide-y divide-kc-encre/10 bg-white rounded-3xl border border-kc-encre/10 px-4">
          {cart.map((item) => {
            const cle = cleLigne(item.produit);
            return (
              <li key={cle} className="py-4 flex gap-3 items-start">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold leading-snug">{item.produit.nom}</p>
                  <p className="text-sm text-kc-encre/60 mt-0.5">{f(item.produit.prix)} l&apos;unité</p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex items-center bg-kc-lait border border-kc-encre/10 rounded-full">
                      <button
                        type="button"
                        aria-label="Une de moins"
                        onClick={() => updateQuantity(cle, -1)}
                        className="w-11 h-11 flex items-center justify-center"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-6 text-center font-semibold" aria-live="polite">
                        {item.quantite}
                      </span>
                      <button
                        type="button"
                        aria-label="Une de plus"
                        onClick={() => updateQuantity(cle, 1)}
                        className="w-11 h-11 flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      aria-label={`Retirer ${item.produit.nom}`}
                      onClick={() => removeFromCart(cle)}
                      className="w-10 h-10 flex items-center justify-center rounded-full text-kc-bissap hover:bg-kc-bissap/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <span className="prix text-lg shrink-0">{f(item.produit.prix * item.quantite)}</span>
              </li>
            );
          })}
        </ul>

        <div className="bg-white rounded-3xl border border-kc-encre/10 p-4 space-y-4">
          {choixQuartier}
          {recap}
        </div>

        {ferme && etatBoutique && (
          <div role="status" className="bg-kc-beurre rounded-2xl p-4 flex gap-3">
            <Clock className="w-5 h-5 shrink-0 mt-0.5 text-kc-indigo" />
            <div>
              <p className="font-semibold">{phraseFermeture(etatBoutique)}</p>
              <p className="text-sm text-kc-encre/70 mt-1">
                Votre panier est gardé sur ce téléphone. Vous pourrez commander dès l’ouverture.
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => allerA('livraison')}
          disabled={ferme || !zone}
          className="bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold text-base py-4 rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-kc-bissap"
        >
          {ferme ? 'Commandes fermées pour le moment' : zone ? 'Passer à la livraison' : 'Choisissez votre quartier'}
        </button>
        {mode === 'panneau' && (
          <button type="button" onClick={onFermer} className="text-kc-encre/70 font-semibold py-1">
            Continuer mes achats
          </button>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------- 2
  return (
    <div ref={haut}>
      <form onSubmit={valider} className="flex flex-col gap-5">
        <div>
          <button
            type="button"
            onClick={() => allerA('panier')}
            className="inline-flex items-center gap-1.5 text-kc-encre/70 font-semibold text-sm py-1"
          >
            <ArrowLeft className="w-4 h-4" /> Retour au panier
          </button>
          <h2 className="font-display text-3xl mt-2">Où vous livre-t-on ?</h2>
        </div>

        <p className="flex items-center justify-between gap-3 rounded-2xl bg-white border border-kc-encre/10 px-4 py-3 text-sm">
          <span>
            Livraison à <span className="font-semibold">{quartier?.nom ?? '…'}</span>
            {zone && <span className="text-kc-encre/60"> : {f(zone.prix)}</span>}
          </span>
          <button type="button" onClick={() => allerA('panier')} className="font-semibold text-kc-indigo underline shrink-0">
            Modifier
          </button>
        </p>

        <fieldset disabled={!zone} className={`flex flex-col gap-5 transition-opacity ${zone ? '' : 'opacity-40'}`}>
          <div>
            <label htmlFor="nom" className={etiquette}>
              Nom et prénom
            </label>
            <input
              id="nom"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              value={form.nom}
              onChange={changer('nom')}
              className={champ}
            />
          </div>
          <div>
            <label htmlFor="tel" className={etiquette}>
              Téléphone WhatsApp
            </label>
            <input
              id="tel"
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              maxLength={20}
              placeholder="77 000 00 00"
              value={form.telephone}
              onChange={changer('telephone')}
              className={champ}
            />
          </div>
          <div>
            <label htmlFor="adresse" className={etiquette}>
              Adresse de livraison
            </label>
            <textarea
              id="adresse"
              required
              minLength={3}
              maxLength={150}
              rows={2}
              autoComplete="street-address"
              placeholder="Rue, maison ou immeuble, étage"
              value={form.adresse}
              onChange={changer('adresse')}
              className={champ}
            />
          </div>
          <div>
            <label htmlFor="repere" className={etiquette}>
              Repère à proximité <span className="font-normal text-kc-encre/50">(facultatif)</span>
            </label>
            <input
              id="repere"
              maxLength={60}
              placeholder="En face de la pharmacie…"
              value={form.repere}
              onChange={changer('repere')}
              className={champ}
            />
          </div>
          {precisions ? (
            <>
              <div>
                <label htmlFor="note" className={etiquette}>
                  Précision pour le livreur <span className="font-normal text-kc-encre/50">(facultatif)</span>
                </label>
                <input
                  id="note"
                  maxLength={60}
                  placeholder="Appeler en arrivant…"
                  value={form.note}
                  onChange={changer('note')}
                  className={champ}
                />
              </div>
              <div>
                <label htmlFor="creneau" className={etiquette}>
                  Pour quand ? <span className="font-normal text-kc-encre/50">(facultatif)</span>
                </label>
                <input
                  id="creneau"
                  maxLength={60}
                  placeholder="Dès que possible, ou 20 h 30…"
                  value={form.creneau}
                  onChange={changer('creneau')}
                  className={champ}
                />
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setPrecisions(true)}
              className="self-start text-sm font-semibold text-kc-indigo underline py-1"
            >
              Ajouter une précision ou une heure de livraison
            </button>
          )}
        </fieldset>

        <div className="bg-white rounded-3xl border border-kc-encre/10 p-5">{recap}</div>

        {ferme && etatBoutique && (
          <div role="status" className="bg-kc-beurre rounded-2xl p-4 flex gap-3">
            <Clock className="w-5 h-5 shrink-0 mt-0.5 text-kc-indigo" />
            <div>
              <p className="font-semibold">{phraseFermeture(etatBoutique)}</p>
              <p className="text-sm text-kc-encre/70 mt-1">
                Votre panier est gardé sur ce téléphone. Vous pourrez commander dès l’ouverture.
              </p>
            </div>
          </div>
        )}

        {erreur && (
          <div role="alert" className="bg-kc-bissap/10 text-kc-bissap-fonce rounded-2xl p-4 text-sm font-medium flex gap-3">
            {erreur.type === 'reseau' && <WifiOff className="w-5 h-5 shrink-0" />}
            <p className="flex-1">{erreur.texte}</p>
            {erreur.type !== 'validation' && <RefreshCw className="w-5 h-5 shrink-0" aria-hidden />}
          </div>
        )}

        <button
          type="submit"
          disabled={!zone || envoi || ferme}
          className="flex items-center justify-center gap-2 bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold text-base py-4 rounded-full transition-colors disabled:opacity-50"
        >
          {envoi ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {envoi ? 'Enregistrement…' : 'Valider ma commande'}
        </button>
        <p className="text-sm text-center text-kc-encre/60 -mt-2">Votre commande sera confirmée par notre équipe sur WhatsApp.</p>
      </form>
    </div>
  );
}
