'use client';

import { Suspense, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Inbox,
  CookingPot,
  Bike,
  Check,
  CheckCircle2,
  Loader2,
  XCircle,
  MessageCircle,
  RefreshCw,
  WifiOff,
  SearchX,
} from 'lucide-react';
import Link from 'next/link';
import type { StatutCommande } from '@/types';
import { UUID_REGEX } from '@/lib/uuid';
import { useEstHydrate } from '@/lib/useEstHydrate';
import { CLE_WHATSAPP, urlContactWhatsApp, urlWhatsApp } from '@/lib/whatsapp';
import { CLE_WA_ENVOYE } from '@/components/commande/CommandeFlow';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import PushOptIn from '@/components/pwa/PushOptIn';

interface SuiviPublic {
  id: string;
  statut: StatutCommande;
  updated_at: string;
  created_at: string;
}

// Les statuts affichés correspondent exactement à ceux que le staff
// choisit dans le dashboard : pas d'étape ni de délai inventés.
const ETAPES: Array<{ key: StatutCommande; titre: string; texte: string; icon: React.ElementType }> = [
  {
    key: 'recue',
    titre: 'Demande reçue',
    texte: 'Nous avons reçu votre demande. On vous la confirme sur WhatsApp.',
    icon: Inbox,
  },
  { key: 'en_preparation', titre: 'En préparation', texte: 'Vos crêpes sont sur la plaque.', icon: CookingPot },
  { key: 'en_livraison', titre: 'En route', texte: 'Le livreur a pris la route.', icon: Bike },
  { key: 'livree', titre: 'Livrée', texte: 'Bonne dégustation, et à bientôt !', icon: CheckCircle2 },
];
const ORDRE = ETAPES.map((e) => e.key);

const CLE_DERNIERE_COMMANDE = 'king_creperie_derniere_commande';
const sAbonnerVide = () => () => {};

function lireStockage(store: 'local' | 'session', cle: string): string | null {
  try {
    return (store === 'local' ? localStorage : sessionStorage).getItem(cle);
  } catch {
    return null;
  }
}

// Le livreur part : une vibration, une seule fois par commande. Pas de
// confettis : l'anneau qui se complète suffit.
function signalerDepart(commandeId: string) {
  const cle = `king_creperie_fete_${commandeId}`;
  if (lireStockage('session', cle)) return;
  try {
    sessionStorage.setItem(cle, '1');
  } catch {}
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
}

// L'anneau de la plaque : quatre arcs, un par statut réel. Les étapes
// passées sont dorées, celle en cours se trace en bissap.
const R = 44;
const CIRC = 2 * Math.PI * R;
const ECART = 7;
const ARC = CIRC / 4 - ECART;

function AnneauSuivi({ index, statut }: { index: number; statut: StatutCommande }) {
  const annulee = statut === 'annulee';
  const livree = statut === 'livree';
  const Icone = annulee ? XCircle : ETAPES[index].icon;
  return (
    <div className="relative w-[min(64vw,15rem)] aspect-square">
      <div className="absolute inset-[9%] rounded-full bg-kc-nuit shadow-[0_30px_60px_-28px_rgba(0,0,0,0.8)]" />
      <svg viewBox="-50 -50 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
        {ETAPES.map((e, i) => {
          const fait = !annulee && (i < index || livree);
          const enCours = !annulee && !livree && i === index;
          return (
            <circle
              key={enCours ? `${e.key}-en-cours` : e.key}
              r={R}
              fill="none"
              strokeWidth={4.5}
              strokeLinecap="round"
              strokeDasharray={`${ARC} ${CIRC}`}
              transform={`rotate(${i * 90 + (ECART / CIRC) * 180})`}
              style={{ '--long': `${ARC}px` } as React.CSSProperties}
              className={
                annulee
                  ? 'stroke-kc-bissap/50'
                  : fait
                    ? 'stroke-kc-caramel'
                    : enCours
                      ? 'kc-trace stroke-kc-bissap'
                      : 'stroke-kc-beurre/15'
              }
            />
          );
        })}
      </svg>
      <div key={statut} className="kc-apparait absolute inset-0 flex flex-col items-center justify-center text-kc-beurre">
        <Icone className={`w-12 h-12 ${annulee ? 'text-kc-bissap' : livree ? 'text-kc-caramel' : ''}`} strokeWidth={1.6} />
        {!annulee && (
          <span className="mt-2 text-sm text-kc-brume tabular-nums">
            {livree ? 'Terminé' : `Étape ${index + 1} sur ${ETAPES.length}`}
          </span>
        )}
      </div>
    </div>
  );
}

const heure = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

type Etat =
  | { type: 'ok'; id: string; suivi: SuiviPublic; verifieA: string }
  | { type: 'introuvable'; id: string }
  | { type: 'reseau'; id: string };

// Rappel WhatsApp : si le client n'a pas encore envoyé son récapitulatif
// (ou s'il revient sur la page), le bouton reste à portée de main.
function RappelWhatsApp({ commandeId }: { commandeId: string }) {
  const message = useSyncExternalStore(
    sAbonnerVide,
    () => lireStockage('session', CLE_WHATSAPP(commandeId)),
    () => null,
  );
  const dejaEnvoye = useSyncExternalStore(
    sAbonnerVide,
    () => lireStockage('session', CLE_WA_ENVOYE(commandeId)) === '1',
    () => false,
  );
  const [envoye, setEnvoye] = useState(false);
  if (!message) return null;

  if (dejaEnvoye || envoye) {
    return (
      <div className="bg-kc-beurre/70 rounded-3xl p-5">
        <p className="font-display text-xl">Jërëjëf pour votre commande</p>
        <p className="mt-1 text-kc-encre/75">On vous tient au courant ici et sur WhatsApp.</p>
        <a
          href={urlWhatsApp(message)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-semibold text-kc-indigo underline"
        >
          Renvoyer le message WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-[#1FA855] rounded-3xl p-5">
      <p className="font-display text-xl">Dernière étape : confirmez sur WhatsApp</p>
      <p className="mt-1 text-kc-encre/75">
        Votre demande est prête. Envoyez le message pour que nous puissions confirmer votre commande.
      </p>
      <a
        href={urlWhatsApp(message)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          setEnvoye(true);
          try {
            sessionStorage.setItem(CLE_WA_ENVOYE(commandeId), '1');
          } catch {}
        }}
        className="appui mt-4 flex items-center justify-center gap-2 bg-[#1FA855] hover:bg-[#178a45] text-white font-semibold py-3.5 rounded-full"
      >
        <MessageCircle className="w-5 h-5" /> Envoyer sur WhatsApp pour confirmer
      </a>
    </div>
  );
}

function BesoinAide() {
  return (
    <div className="mt-2 text-center">
      <p className="text-kc-encre/70">Un souci avec votre commande ? Écrivez-nous sur WhatsApp.</p>
      <a
        href={urlContactWhatsApp()}
        target="_blank"
        rel="noopener noreferrer"
        className="appui mt-3 inline-flex items-center gap-2 border-2 border-kc-ligne hover:border-kc-encre/40 font-semibold px-5 py-3 rounded-full"
      >
        <MessageCircle className="w-4 h-4" /> Contacter King Crêperie
      </a>
    </div>
  );
}

function TrackingContent() {
  const searchParams = useSearchParams();
  const hydrate = useEstHydrate();
  const idUrl = searchParams.get('id');
  const nouvelle = searchParams.get('nouvelle') === '1';

  const idStocke = useSyncExternalStore(
    sAbonnerVide,
    () => lireStockage('local', CLE_DERNIERE_COMMANDE),
    () => null,
  );
  const commandeId = idUrl ?? idStocke;
  const idVientDuStockage = !idUrl && !!idStocke;
  const idValide = !!commandeId && UUID_REGEX.test(commandeId);

  const [etat, setEtat] = useState<Etat | null>(null);
  const [actualisation, setActualisation] = useState(false);

  // Chaîne .then() : les setState se font dans le callback de la
  // promesse, jamais de façon synchrone dans l'effet.
  const charger = useCallback(
    (id: string) =>
      supabase
        .rpc('suivi_commande', { p_id: id })
        .single()
        .then(({ data, error }) => {
          setActualisation(false);
          if (error && error.code !== 'PGRST116') {
            // Problème réseau : on garde le dernier état connu s'il existe.
            setEtat((prev) => (prev?.type === 'ok' && prev.id === id ? prev : { type: 'reseau', id }));
            return;
          }
          if (!data) {
            setEtat({ type: 'introuvable', id });
            return;
          }
          const suivi = data as SuiviPublic;
          setEtat({ type: 'ok', id, suivi, verifieA: new Date().toISOString() });
          if (suivi.statut === 'en_livraison') signalerDepart(id);
        }),
    [],
  );

  useEffect(() => {
    if (!idValide || !commandeId) return;
    void charger(commandeId);

    const channel = supabase
      .channel(`commande-${commandeId}`, { config: { private: true } })
      .on('broadcast', { event: 'UPDATE' }, (payload) => {
        const record = payload.payload?.record as Partial<SuiviPublic> | undefined;
        if (!record?.statut) return;
        setEtat((prev) =>
          prev?.type === 'ok' && prev.id === commandeId
            ? {
                ...prev,
                verifieA: new Date().toISOString(),
                suivi: { ...prev.suivi, statut: record.statut!, updated_at: record.updated_at ?? new Date().toISOString() },
              }
            : prev,
        );
        if (record.statut === 'en_livraison') signalerDepart(commandeId);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void charger(commandeId);
      });

    // Téléphone verrouillé / app en arrière-plan : on recharge au retour.
    const auRetour = () => {
      if (document.visibilityState === 'visible') void charger(commandeId);
    };
    document.addEventListener('visibilitychange', auRetour);
    window.addEventListener('online', auRetour);
    return () => {
      document.removeEventListener('visibilitychange', auRetour);
      window.removeEventListener('online', auRetour);
      void supabase.removeChannel(channel);
    };
  }, [commandeId, idValide, charger]);

  const courant = etat && etat.id === commandeId ? etat : null;

  if (!hydrate || (idValide && !courant)) {
    return (
      <div className="bg-kc-indigo text-kc-beurre min-h-[70vh] flex flex-col items-center justify-center gap-4" role="status">
        <div className="w-40 h-40 rounded-full bg-kc-nuit flex items-center justify-center">
          <span className="w-28 h-28 rounded-full border-2 border-dashed border-kc-beurre/25 motion-safe:animate-[spin_6s_linear_infinite]" />
        </div>
        <p className="text-kc-brume">Chargement du suivi…</p>
      </div>
    );
  }

  if (!idValide || !courant || courant.type !== 'ok') {
    const reseau = courant?.type === 'reseau';
    const titre = !commandeId ? 'Aucune commande à suivre' : reseau ? 'Le suivi ne charge pas' : 'Commande introuvable';
    const texte = !commandeId
      ? 'Aucune commande récente sur ce téléphone. Le lien de suivi se trouve dans votre message WhatsApp.'
      : reseau
        ? 'Vérifiez votre connexion et réessayez.'
        : 'Nous ne retrouvons pas cette commande. Vérifiez le lien reçu sur WhatsApp.';
    const Icone = reseau ? WifiOff : SearchX;
    return (
      <>
        <div className="bg-kc-indigo text-kc-beurre px-5 pt-10 pb-12 text-center">
          <span className="mx-auto w-24 h-24 rounded-full bg-kc-nuit flex items-center justify-center">
            <Icone className="w-9 h-9 text-kc-caramel" strokeWidth={1.8} />
          </span>
          <h1 className="font-display text-[2.2rem] leading-none mt-5">{titre}</h1>
          <p className="text-kc-brume mt-3 max-w-sm mx-auto">{texte}</p>
        </div>
        <div className="max-w-md mx-auto px-5 py-8 flex flex-col gap-3">
          {reseau && commandeId && (
            <button
              onClick={() => void charger(commandeId)}
              className="appui bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold py-4 rounded-full"
            >
              Réessayer
            </button>
          )}
          <Link
            href="/#carte"
            className="appui text-center border-2 border-kc-ligne hover:border-kc-encre/40 font-semibold py-4 rounded-full"
          >
            Voir la carte
          </Link>
          <BesoinAide />
        </div>
      </>
    );
  }

  const { suivi } = courant;
  const annulee = suivi.statut === 'annulee';
  const indexCourant = Math.max(0, ORDRE.indexOf(suivi.statut));
  const termine = suivi.statut === 'livree' || annulee;
  const etapeCourante = ETAPES[indexCourant];

  return (
    <>
      {/* La plaque : le statut réel, en grand, dans l'anneau. */}
      <section className="bg-kc-indigo text-kc-beurre px-5 pt-6 pb-10">
        <div className="max-w-xl mx-auto flex flex-col items-center text-center">
          {idVientDuStockage && <p className="mb-3 text-sm text-kc-brume">Votre dernière commande passée sur ce téléphone.</p>}
          <h1 className="text-sm font-semibold text-kc-brume">
            Suivi de la commande n° {suivi.id.slice(0, 8).toUpperCase()}, passée à {heure(suivi.created_at)}
          </h1>
          <div className="mt-5">
            <AnneauSuivi index={indexCourant} statut={suivi.statut} />
          </div>
          <div key={suivi.statut} className="kc-apparait mt-6" aria-live="polite">
            <p className="font-display text-[2.4rem] leading-none">{annulee ? 'Commande annulée' : etapeCourante.titre}</p>
            <p className="mt-2 text-lg text-kc-lait">
              {annulee
                ? 'Cette commande a été annulée par la crêperie. Une question ? Écrivez-nous sur WhatsApp.'
                : etapeCourante.texte}
            </p>
          </div>
          <p className="mt-4 text-sm text-kc-brume">
            Dernière mise à jour à {heure(suivi.updated_at)}
            {!termine && '. La page se met à jour toute seule.'}
          </p>
        </div>
      </section>

      <div className="max-w-xl mx-auto px-5 pt-6 pb-12 flex flex-col gap-6">
        {!annulee && <RappelWhatsApp commandeId={suivi.id} />}

        {!annulee && (
          <ol className="rounded-3xl bg-white border border-kc-ligne px-5 py-2" aria-label="Étapes de la commande">
            {ETAPES.map((etape, i) => {
              const fait = i < indexCourant || suivi.statut === 'livree';
              const actuelle = i === indexCourant && suivi.statut !== 'livree';
              return (
                <li
                  key={etape.key}
                  aria-current={actuelle ? 'step' : undefined}
                  className="relative flex items-center gap-3 py-3 [&:not(:last-child)]:border-b border-kc-ligne"
                >
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors duration-300 ${
                      fait
                        ? 'bg-kc-caramel text-kc-nuit'
                        : actuelle
                          ? 'bg-kc-bissap text-white'
                          : 'border-2 border-kc-ligne text-kc-encre/40'
                    }`}
                  >
                    {fait ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={`flex-1 font-semibold ${fait || actuelle ? '' : 'text-kc-encre/45'}`}>{etape.titre}</span>
                  {actuelle && <span className="text-sm font-semibold text-kc-bissap">En cours</span>}
                </li>
              );
            })}
          </ol>
        )}

        {!termine && (
          <div className="flex flex-wrap gap-3 items-center">
            <PushOptIn cible={{ commandeId: suivi.id }} />
            <button
              type="button"
              onClick={() => {
                setActualisation(true);
                void charger(suivi.id);
              }}
              className="appui inline-flex items-center gap-2 text-sm font-semibold text-kc-indigo px-4 py-2.5 rounded-full border-2 border-kc-indigo/25 hover:border-kc-indigo/60"
            >
              <RefreshCw className={`w-4 h-4 ${actualisation ? 'animate-spin' : ''}`} /> Actualiser le suivi
            </button>
          </div>
        )}

        {suivi.statut === 'livree' && (
          <Link
            href="/#carte"
            className="appui text-center bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold py-4 rounded-full"
          >
            Recommander une crêpe
          </Link>
        )}

        {nouvelle && !annulee && <InstallPrompt contexte="suivi" />}

        <BesoinAide />
      </div>
    </>
  );
}

export default function SuiviPage() {
  return (
    <div className="min-h-screen bg-kc-lait text-kc-encre pt-16">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-kc-indigo">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        }
      >
        <TrackingContent />
      </Suspense>
    </div>
  );
}
