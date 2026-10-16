'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
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
import { CLE_WHATSAPP, numeroCreperieAffiche, urlContactWhatsApp, urlWhatsApp } from '@/lib/whatsapp';
import { rafraichirBoutique, useBoutique } from '@/lib/useBoutique';
import { phraseFermeture } from '@/lib/horaires';

// ------------------------------------------------------------------
// Parcours de commande en 4 étapes, utilisé dans le panneau (même page
// que la carte) et sur la page /commande (secours, lien direct).
//   1. Panier (et quartier)   2. Livraison   3. Vérification
//   4. Envoi sur WhatsApp
// La commande est enregistrée à la fin de l'étape 3 ; elle reste « en
// attente » tant que l'équipe ne l'a pas confirmée. L'étape 4 existe
// parce qu'un window.open() après l'appel serveur est bloqué sur
// iPhone : WhatsApp doit s'ouvrir sur un vrai toucher.
// ------------------------------------------------------------------

type Etape = 'panier' | 'livraison' | 'recap' | 'whatsapp';

const ETAPES: Array<{ id: Etape; libelle: string }> = [
  { id: 'panier', libelle: 'Panier' },
  { id: 'livraison', libelle: 'Livraison' },
  { id: 'recap', libelle: 'Vérification' },
  { id: 'whatsapp', libelle: 'WhatsApp' },
];

// Même règle que le serveur (/api/commandes) : 9 chiffres commençant par 7,
// indicatif 221 facultatif.
const TELEPHONE_SN = /^(?:\+?221)?[\s.-]?7[0-9](?:[\s.-]?[0-9]){7}$/;

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
  const [secours, setSecours] = useState(false);
  const [copie, setCopie] = useState(false);
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

  // Étape 2 → 3 : contrôles locaux, rien n'est encore envoyé.
  const verifier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zone) return;
    if (!TELEPHONE_SN.test(form.telephone.trim())) {
      setErreur({
        type: 'validation',
        texte: 'Numéro de téléphone invalide : 9 chiffres commençant par 7, par exemple 77 000 00 00.',
      });
      return;
    }
    allerA('recap');
  };

  const adresseComplete = () => {
    const morceaux = [form.adresse.trim()];
    if (form.repere.trim()) morceaux.push(`Repère : ${form.repere.trim()}`);
    if (form.note.trim()) morceaux.push(`Pour le livreur : ${form.note.trim()}`);
    return `${quartier!.nom}, ${morceaux.join('. ')}`.slice(0, 300);
  };

  const valider = async () => {
    if (!zone || cart.length === 0 || envoiEnCours.current) return;
    envoiEnCours.current = true;
    setEnvoi(true);
    setErreur(null);

    const adresse = adresseComplete();

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
    'w-full bg-white border-2 border-kc-ligne rounded-2xl px-4 py-3.5 text-base text-kc-encre placeholder:text-kc-encre/40 transition-colors focus:outline-none focus:border-kc-indigo';
  const etiquette = 'block text-sm font-semibold text-kc-encre mb-1.5';
  const titre = 'font-display text-[2rem] leading-none text-kc-indigo';
  const boutonPrincipal =
    'appui w-full flex items-center justify-center gap-2 bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold text-base py-4 rounded-full disabled:opacity-50 disabled:hover:bg-kc-bissap';

  const indexEtape = ETAPES.findIndex((x) => x.id === etape);
  // Fil d'étapes : on peut revenir en arrière (données conservées), jamais
  // sauter en avant ; après l'envoi, plus de retour possible.
  const fil = (
    <ol className="flex items-center gap-1.5 mb-6" aria-label="Étapes de la commande">
      {ETAPES.map((x, i) => {
        const fait = i < indexEtape;
        const courant = i === indexEtape;
        const retour = fait && etape !== 'whatsapp';
        return (
          <li key={x.id} className="flex-1 min-w-0">
            <button
              type="button"
              disabled={!retour}
              onClick={() => retour && allerA(x.id)}
              aria-current={courant ? 'step' : undefined}
              className="w-full text-left disabled:cursor-default"
            >
              <span
                className={`block h-1.5 rounded-full transition-colors duration-300 ${
                  fait || courant ? 'bg-kc-bissap' : 'bg-kc-encre/12'
                }`}
              />
              <span className={`mt-1.5 block text-xs font-semibold truncate ${courant ? 'text-kc-encre' : 'text-kc-encre/50'}`}>
                {x.libelle}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  const avisFerme = ferme && etatBoutique && (
    <div role="status" className="bg-kc-indigo text-kc-beurre rounded-2xl p-4 flex gap-3">
      <Clock className="w-5 h-5 shrink-0 mt-0.5 text-kc-caramel" />
      <div>
        <p className="font-semibold">{phraseFermeture(etatBoutique)}</p>
        <p className="text-sm text-kc-brume mt-1">
          Votre panier est gardé sur ce téléphone. Vous pourrez commander dès l’ouverture.
        </p>
      </div>
    </div>
  );

  const blocErreur = erreur && (
    <div role="alert" className="kc-apparait bg-kc-bissap/10 text-kc-bissap-fonce rounded-2xl p-4 text-sm font-medium flex gap-3">
      {erreur.type === 'reseau' && <WifiOff className="w-5 h-5 shrink-0" />}
      <p className="flex-1">{erreur.texte}</p>
      {erreur.type !== 'validation' && <RefreshCw className="w-5 h-5 shrink-0" aria-hidden />}
    </div>
  );

  // ---------------------------------------------------------------- 4
  if (etape === 'whatsapp' && commande) {
    const message = messageWhatsApp(commande, typeof window !== 'undefined' ? window.location.origin : '');
    const copier = async () => {
      try {
        await navigator.clipboard.writeText(message);
        setCopie(true);
      } catch {
        setCopie(false);
        (document.getElementById('message-wa') as HTMLTextAreaElement | null)?.select();
      }
    };
    return (
      <div ref={haut} className="flex flex-col gap-5">
        {fil}
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-kc-caramel/20 px-3 py-1 text-sm font-semibold text-kc-encre">
            <span className="w-2 h-2 rounded-full bg-kc-caramel" aria-hidden /> Demande enregistrée, en attente de confirmation
          </p>
          <h2 className={`${titre} mt-3`}>Dernière étape</h2>
          <p className="mt-2 text-kc-encre/75 leading-relaxed">
            Envoyez le récapitulatif sur WhatsApp : l’équipe vous confirme la commande et lance la préparation.
          </p>
        </div>

        <div className="rounded-3xl bg-white border border-kc-ligne p-5">
          <p className="text-sm text-kc-encre/60">Commande n° {commande.id.slice(0, 8).toUpperCase()}</p>
          <p className="mt-1 flex items-baseline justify-between gap-3">
            <span className="font-semibold">À payer à la livraison</span>
            <span className="prix text-2xl text-kc-indigo">{f(commande.total)}</span>
          </p>
          <p className="mt-1 text-sm text-kc-encre/60">En espèces, à la réception.</p>
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
          className="appui flex items-center justify-center gap-2 bg-[#1FA855] hover:bg-[#178a45] text-white font-semibold text-base py-4 rounded-full"
        >
          <MessageCircle className="w-5 h-5" />
          {waOuvert ? 'Renvoyer sur WhatsApp' : 'Envoyer sur WhatsApp pour confirmer'}
        </a>

        {/* Secours : WhatsApp ne s'ouvre pas (navigateur intégré, appli absente). */}
        {secours ? (
          <div className="kc-apparait rounded-2xl bg-white border border-kc-ligne p-4 text-sm">
            <p className="font-semibold">Envoyez ce message au {numeroCreperieAffiche()}</p>
            <textarea
              id="message-wa"
              readOnly
              rows={5}
              value={message}
              className="mt-2 w-full rounded-xl border border-kc-ligne bg-kc-lait p-3 text-[0.8rem] leading-snug"
            />
            <button
              type="button"
              onClick={() => void copier()}
              className="appui mt-2 inline-flex items-center gap-2 rounded-full border-2 border-kc-indigo px-4 py-2.5 font-semibold text-kc-indigo"
            >
              {copie ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copie ? 'Message copié' : 'Copier le message'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSecours(true)}
            className="self-center text-sm font-semibold text-kc-indigo underline py-1"
          >
            WhatsApp ne s’ouvre pas ?
          </button>
        )}

        <Link
          href={`/suivi?id=${commande.id}&nouvelle=1`}
          onClick={onFermer}
          className={`appui flex items-center justify-center font-semibold text-base py-4 rounded-full ${
            waOuvert
              ? 'bg-kc-indigo text-kc-beurre hover:bg-kc-nuit'
              : 'border-2 border-kc-ligne text-kc-encre hover:border-kc-encre/40'
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
        <span className="w-24 h-24 rounded-full bg-kc-indigo flex items-center justify-center">
          <span className="w-16 h-16 rounded-full border-2 border-dashed border-kc-beurre/40 flex items-center justify-center">
            <ShoppingBag className="w-7 h-7 text-kc-beurre" />
          </span>
        </span>
        <p className="font-display text-3xl mt-5 text-kc-indigo">La plaque est vide</p>
        <p className="text-kc-encre/70 mt-2">Choisissez une crêpe pour commencer votre commande.</p>
        {mode === 'panneau' ? (
          <button
            onClick={onFermer}
            className="appui mt-6 bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold px-7 py-4 rounded-full"
          >
            Voir la carte
          </button>
        ) : (
          <Link
            href="/#carte"
            className="appui mt-6 bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold px-7 py-4 rounded-full"
          >
            Voir la carte
          </Link>
        )}
      </div>
    );
  }

  const totaux = (
    <dl className="space-y-1.5 text-[0.95rem]">
      <div className="flex justify-between gap-3">
        <dt className="text-kc-encre/70">Sous-total</dt>
        <dd className="prix">{f(totalAmount)}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-kc-encre/70">Livraison{quartier ? ` à ${quartier.nom}` : ''}</dt>
        <dd className={zone ? 'prix' : 'text-sm text-kc-encre/60 text-right'}>
          {zone ? f(zone.prix) : `selon le quartier, ${f(FRAIS_MIN)} à ${f(FRAIS_MAX)}`}
        </dd>
      </div>
      <div className="flex justify-between items-baseline gap-3 pt-2 mt-1 border-t border-kc-ligne">
        <dt className="font-semibold">{zone ? 'Total à payer' : 'Total hors livraison'}</dt>
        <dd className="prix text-2xl text-kc-indigo">{f(total)}</dd>
      </div>
      <p className="text-sm text-kc-encre/60 pt-1">Paiement en espèces à la réception.</p>
    </dl>
  );

  // ---------------------------------------------------------------- 1
  if (etape === 'panier') {
    return (
      <div ref={haut} className="flex flex-col gap-5">
        {fil}
        <div>
          <h2 className={titre}>Votre panier</h2>
          <p className="text-kc-encre/70 mt-2">Vérifiez les quantités, puis choisissez votre quartier.</p>
        </div>

        {majPanier && (
          <div role="status" className="bg-kc-beurre/70 rounded-2xl p-4 text-sm">
            <p className="font-semibold">Votre panier a été mis à jour</p>
            {majPanier.retires.length > 0 && <p className="mt-1">Plus disponible, retiré : {majPanier.retires.join(', ')}.</p>}
            {majPanier.prixModifies.length > 0 && <p className="mt-1">Prix actualisé : {majPanier.prixModifies.join(', ')}.</p>}
          </div>
        )}

        <ul className="divide-y divide-kc-ligne rounded-3xl bg-white border border-kc-ligne px-4">
          {cart.map((item) => {
            const cle = cleLigne(item.produit);
            const extras = item.produit.extrasChoisis ?? [];
            const nomBase = extras.length > 0 ? item.produit.nom.replace(/\s*\(.*\)$/, '') : item.produit.nom;
            return (
              <li key={cle} className="py-4 flex gap-3 items-start">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold leading-snug">{nomBase}</p>
                  {extras.length > 0 && (
                    <p className="text-sm font-semibold text-kc-bissap mt-0.5">+ {extras.map((x) => x.nom).join(', ')}</p>
                  )}
                  <p className="text-sm text-kc-encre/60 mt-0.5">{f(item.produit.prix)} l’unité</p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex items-center bg-kc-lait border border-kc-ligne rounded-full">
                      <button
                        type="button"
                        aria-label={`Une ${nomBase} de moins`}
                        onClick={() => updateQuantity(cle, -1)}
                        className="appui w-11 h-11 flex items-center justify-center"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <output className="w-6 text-center prix" aria-live="polite">
                        {item.quantite}
                      </output>
                      <button
                        type="button"
                        aria-label={`Une ${nomBase} de plus`}
                        onClick={() => updateQuantity(cle, 1)}
                        className="appui w-11 h-11 flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      aria-label={`Retirer ${nomBase}`}
                      onClick={() => removeFromCart(cle)}
                      className="appui w-11 h-11 flex items-center justify-center rounded-full text-kc-bissap hover:bg-kc-bissap/10"
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

        <div className="rounded-3xl bg-white border border-kc-ligne p-4 space-y-4">
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
              <option value="autre">Mon quartier n’est pas dans la liste</option>
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
          {totaux}
        </div>

        {avisFerme}

        <button type="button" onClick={() => allerA('livraison')} disabled={ferme || !zone} className={boutonPrincipal}>
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

  // ---------------------------------------------------------------- 3
  if (etape === 'recap') {
    const modifier = (vers: Etape) => (
      <button type="button" onClick={() => allerA(vers)} className="text-sm font-semibold text-kc-indigo underline shrink-0">
        Modifier
      </button>
    );
    return (
      <div ref={haut} className="flex flex-col gap-5">
        {fil}
        <div>
          <h2 className={titre}>On vérifie ?</h2>
          <p className="text-kc-encre/70 mt-2">Relisez avant d’envoyer : c’est ce que l’équipe recevra.</p>
        </div>

        <section className="rounded-3xl bg-white border border-kc-ligne p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Votre commande</h3>
            {modifier('panier')}
          </div>
          <ul className="mt-2 space-y-1.5 text-[0.95rem]">
            {cart.map((item) => (
              <li key={cleLigne(item.produit)} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="prix">{item.quantite} ×</span> {item.produit.nom}
                </span>
                <span className="prix shrink-0">{f(item.produit.prix * item.quantite)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl bg-white border border-kc-ligne p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Livraison</h3>
            {modifier('livraison')}
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[0.95rem]">
            <dt className="text-kc-encre/60">Pour</dt>
            <dd className="font-semibold">{form.nom}</dd>
            <dt className="text-kc-encre/60">Téléphone</dt>
            <dd>{form.telephone}</dd>
            <dt className="text-kc-encre/60">Adresse</dt>
            <dd className="min-w-0 break-words">{adresseComplete()}</dd>
            <dt className="text-kc-encre/60">Quand</dt>
            <dd>{form.creneau.trim() || 'Dès que possible'}</dd>
          </dl>
        </section>

        <div className="rounded-3xl bg-white border border-kc-ligne p-4">{totaux}</div>

        {avisFerme}
        {blocErreur}

        <button type="button" onClick={() => void valider()} disabled={envoi || ferme} className={boutonPrincipal}>
          {envoi ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {envoi ? 'Envoi en cours…' : 'Envoyer ma commande'}
        </button>
        <p className="text-sm text-center text-kc-encre/60 -mt-2">Vous confirmerez ensuite sur WhatsApp.</p>
      </div>
    );
  }

  // ---------------------------------------------------------------- 2
  return (
    <div ref={haut}>
      {fil}
      <form onSubmit={verifier} noValidate={false} className="flex flex-col gap-5">
        <div>
          <button
            type="button"
            onClick={() => allerA('panier')}
            className="inline-flex items-center gap-1.5 text-kc-encre/70 font-semibold text-sm py-1"
          >
            <ArrowLeft className="w-4 h-4" /> Retour au panier
          </button>
          <h2 className={`${titre} mt-2`}>Où vous livre-t-on ?</h2>
        </div>

        <p className="flex items-center justify-between gap-3 rounded-2xl bg-white border border-kc-ligne px-4 py-3 text-sm">
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
              aria-describedby="aide-tel"
            />
            <p id="aide-tel" className="mt-1.5 text-sm text-kc-encre/55">
              Le numéro sur lequel l’équipe vous confirmera la commande.
            </p>
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
            <div className="kc-apparait flex flex-col gap-5">
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
            </div>
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

        {avisFerme}
        {blocErreur}

        <button type="submit" disabled={!zone || ferme} className={boutonPrincipal}>
          Vérifier ma commande
        </button>
      </form>
    </div>
  );
}
