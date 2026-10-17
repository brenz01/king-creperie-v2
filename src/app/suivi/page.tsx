'use client';

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Inbox,
  CookingPot,
  Bike,
  CheckCircle2,
  Loader2,
  XCircle,
  MessageCircle,
  RefreshCw,
  WifiOff,
  SearchX,
  CircleHelp,
  Download,
  Share,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import type { StatutCommande } from '@/types';
import { UUID_REGEX } from '@/lib/uuid';
import { useEstHydrate } from '@/lib/useEstHydrate';
import { CLE_WHATSAPP, urlContactWhatsApp, urlWhatsApp } from '@/lib/whatsapp';
import { CLE_WA_ENVOYE } from '@/components/commande/CommandeFlow';
import { useInstallation } from '@/lib/pwa/install';
import { useFocusPiege } from '@/lib/useFocusPiege';
import InfoBulle from '@/components/ui/InfoBulle';
import PushOptIn from '@/components/pwa/PushOptIn';

interface SuiviPublic {
  id: string;
  statut: StatutCommande;
  updated_at: string;
  created_at: string;
}

// Les statuts affichés correspondent exactement à ceux que le staff
// choisit dans le dashboard : pas d'étape ni de délai inventés.
const ETAPES: Array<{ key: StatutCommande; titre: string; court: string; texte: string; icon: React.ElementType }> = [
  {
    key: 'recue',
    titre: 'Demande reçue',
    court: 'Reçue',
    texte: 'Nous avons reçu votre demande. On vous la confirme sur WhatsApp.',
    icon: Inbox,
  },
  { key: 'en_preparation', titre: 'En préparation', court: 'En cuisine', texte: 'Vos crêpes sont sur la plaque.', icon: CookingPot },
  { key: 'en_livraison', titre: 'En route', court: 'En route', texte: 'Le livreur a pris la route.', icon: Bike },
  { key: 'livree', titre: 'Livrée', court: 'Livrée', texte: 'Bonne dégustation, et à bientôt !', icon: CheckCircle2 },
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

// Le livreur part : une vibration, une seule fois par commande.
function signalerDepart(commandeId: string) {
  const cle = `king_creperie_fete_${commandeId}`;
  if (lireStockage('session', cle)) return;
  try {
    sessionStorage.setItem(cle, '1');
  } catch {}
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
}

const heure = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });


type Etat =
  | { type: 'ok'; id: string; suivi: SuiviPublic; verifieA: string }
  | { type: 'introuvable'; id: string }
  | { type: 'reseau'; id: string };

function TrackingContent() {
  const searchParams = useSearchParams();
  const hydrate = useEstHydrate();
  const idUrl = searchParams.get('id');

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
        // Page ouverte : une courte vibration à chaque étape (Android).
        if (record.statut !== 'en_livraison') {
          try {
            navigator.vibrate?.(120);
          } catch {}
        }
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

  // Message WhatsApp préparé à la commande (même téléphone, même session).
  const messageWa = useSyncExternalStore(
    sAbonnerVide,
    () => (commandeId ? lireStockage('session', CLE_WHATSAPP(commandeId)) : null),
    () => null,
  );
  const waDejaEnvoye = useSyncExternalStore(
    sAbonnerVide,
    () => (commandeId ? lireStockage('session', CLE_WA_ENVOYE(commandeId)) === '1' : false),
    () => false,
  );
  const [waEnvoye, setWaEnvoye] = useState(false);
  const [aideOuverte, setAideOuverte] = useState(false);

  // Le statut dans le titre de l'onglet : lisible depuis la liste des onglets.
  const statutActuel = courant?.type === 'ok' ? courant.suivi.statut : null;
  useEffect(() => {
    if (!statutActuel) return;
    const titre = statutActuel === 'annulee' ? 'Commande annulée' : ETAPES[ORDRE.indexOf(statutActuel)]?.titre;
    document.title = `${titre} | Suivi King Crêperie`;
  }, [statutActuel]);

  if (!hydrate || (idValide && !courant)) {
    // Squelette : même géométrie que la page chargée.
    return (
      <div className={ECRAN} role="status" aria-label="Chargement du suivi">
        <div className="h-4 w-56 rounded bg-stone-200/80" />
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-28 h-28 rounded-full bg-stone-200/80 motion-safe:animate-pulse" />
          <div className="mt-6 h-8 w-48 rounded bg-stone-200/80" />
          <div className="mt-3 h-4 w-64 rounded bg-stone-200/80" />
          <div className="mt-8 h-2 w-full max-w-sm rounded-full bg-stone-200/80" />
        </div>
        <div className="h-14 rounded-xl bg-stone-200/80" />
      </div>
    );
  }

  if (!idValide || !courant || courant.type !== 'ok') {
    const reseau = courant?.type === 'reseau';
    const titre = !commandeId ? 'Aucune commande à suivre' : reseau ? 'Le suivi ne charge pas' : 'Commande introuvable';
    const texte = !commandeId
      ? 'Aucune commande récente sur ce téléphone. Le lien de suivi se trouve dans votre message WhatsApp.'
      : reseau
        ? 'La connexion a été coupée. Réessayez dans un instant.'
        : 'Nous ne retrouvons pas cette commande. Vérifiez le lien reçu sur WhatsApp.';
    const Icone = reseau ? WifiOff : SearchX;
    return (
      <div className={ECRAN}>
        <div className="kc-apparait flex-1 flex flex-col items-center justify-center text-center">
          <span className="w-24 h-24 rounded-full bg-white border border-stone-200 flex items-center justify-center">
            <Icone className="w-10 h-10 text-stone-600" aria-hidden />
          </span>
          <h1 className="mt-6 font-serif text-3xl font-semibold text-stone-900">{titre}</h1>
          <p className="mt-2 text-stone-600 max-w-sm">{texte}</p>
          <a
            href={urlContactWhatsApp()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 min-h-11 text-sm font-semibold text-amber-800 underline"
          >
            <MessageCircle className="w-4 h-4" aria-hidden /> Écrire à King Crêperie
          </a>
        </div>
        {reseau && commandeId ? (
          <button onClick={() => void charger(commandeId)} className={BOUTON}>
            Réessayer le suivi
          </button>
        ) : (
          <Link href="/#carte" className={BOUTON}>
            Voir la carte
          </Link>
        )}
      </div>
    );
  }

  const { suivi } = courant;
  const annulee = suivi.statut === 'annulee';
  const livree = suivi.statut === 'livree';
  const indexCourant = Math.max(0, ORDRE.indexOf(suivi.statut));
  const termine = livree || annulee;
  const etapeCourante = ETAPES[indexCourant];
  const Icone = annulee ? XCircle : etapeCourante.icon;
  // Part de la barre remplie : 0 à la réception, 1 à la livraison.
  const avancement = livree ? 1 : indexCourant / (ETAPES.length - 1);
  const waAEnvoyer = !!messageWa && !waDejaEnvoye && !waEnvoye && !termine;
  const merci = !!messageWa && (waDejaEnvoye || waEnvoye) && !annulee;

  // Une seule action en bas d'écran : celle qui compte maintenant.
  let action: React.ReactNode;
  if (annulee) {
    action = (
      <a href={urlContactWhatsApp()} target="_blank" rel="noopener noreferrer" className={BOUTON}>
        <MessageCircle className="w-5 h-5" aria-hidden /> Écrire à King Crêperie
      </a>
    );
  } else if (waAEnvoyer) {
    action = (
      <div className="flex flex-col gap-2">
        <a
          href={urlWhatsApp(messageWa!)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            setWaEnvoye(true);
            try {
              sessionStorage.setItem(CLE_WA_ENVOYE(suivi.id), '1');
            } catch {}
          }}
          className={`${BOUTON} bg-[#15803d] hover:bg-[#166534]`}
        >
          <MessageCircle className="w-5 h-5" aria-hidden /> Envoyer sur WhatsApp pour confirmer
        </a>
        <p className="text-center text-sm text-stone-600">Dernière étape : l’équipe vous confirme la commande sur WhatsApp.</p>
      </div>
    );
  } else if (livree) {
    action = (
      <Link href="/#carte" className={BOUTON}>
        Recommander une crêpe
      </Link>
    );
  } else {
    action = (
      <div className="flex justify-center">
        <PushOptIn cible={{ commandeId: suivi.id }} libelle="Me prévenir à chaque étape" />
      </div>
    );
  }

  return (
    <div className={ECRAN}>
      {/* Ligne du haut : la commande, et deux boutons discrets. */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-stone-600 min-w-0 truncate">
          {idVientDuStockage ? 'Dernière commande' : 'Commande'} n° {suivi.id.slice(0, 8).toUpperCase()}, à{' '}
          {heure(suivi.created_at)}
        </p>
        <div className="flex items-center shrink-0 -mr-2">
          {!termine && (
            <InfoBulle libelle="Actualiser le suivi" cote="basDroite">
              <button
                type="button"
                onClick={() => {
                  setActualisation(true);
                  void charger(suivi.id);
                }}
                aria-label="Actualiser le suivi"
                className="appui w-11 h-11 rounded-full flex items-center justify-center text-stone-700 hover:bg-white"
              >
                <RefreshCw className={`w-5 h-5 ${actualisation ? 'motion-safe:animate-spin' : ''}`} aria-hidden />
              </button>
            </InfoBulle>
          )}
          <InfoBulle libelle="Aide et options" cote="basDroite">
            <button
              type="button"
              onClick={() => setAideOuverte(true)}
              aria-label="Aide et options"
              aria-haspopup="dialog"
              className="appui w-11 h-11 rounded-full flex items-center justify-center text-stone-700 hover:bg-white"
            >
              <CircleHelp className="w-5 h-5" aria-hidden />
            </button>
          </InfoBulle>
        </div>
      </div>

      {/* Le statut, en grand, au centre de l'écran. */}
      <section className="flex-1 flex flex-col items-center justify-center text-center" aria-live="polite">
        {merci && <p className="mb-4 text-sm font-semibold text-amber-800">Jërëjëf pour votre commande</p>}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={suivi.statut}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15, ease: [0.7, 0, 0.84, 0] } }}
            className="flex flex-col items-center"
          >
            <div className="relative w-28 h-28">
              {/* Halo : la cuisine travaille (absent une fois terminé). */}
              {!termine && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-amber-200/70 motion-safe:animate-[suivi-halo_2.4s_ease-out_infinite]"
                />
              )}
              <span
                className={`relative w-28 h-28 rounded-full flex items-center justify-center ${
                  annulee
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : livree
                      ? 'bg-emerald-700 text-white'
                      : 'bg-stone-900 text-amber-300'
                }`}
              >
                <Icone className="w-12 h-12" strokeWidth={1.75} aria-hidden />
              </span>
            </div>
            <h1 className="mt-6 font-serif text-[2rem] leading-tight font-semibold text-stone-900">
              {annulee ? 'Commande annulée' : etapeCourante.titre}
            </h1>
            <p className="mt-2 text-stone-600 max-w-xs">
              {annulee ? 'La crêperie a annulé cette commande.' : etapeCourante.texte}
            </p>
          </motion.div>
        </AnimatePresence>

        {!annulee && (
          <div className="mt-8 w-full max-w-sm">
            {/* Barre d'avancement : remplie par transform (scaleX). */}
            <div className="relative h-2 rounded-full bg-stone-200 overflow-hidden" aria-hidden>
              <motion.div
                className="absolute inset-0 origin-left rounded-full bg-amber-700"
                initial={false}
                animate={{ scaleX: avancement }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <ol className="mt-3 grid grid-cols-4 text-xs font-medium" aria-label="Étapes de la commande">
              {ETAPES.map((etape, i) => (
                <li
                  key={etape.key}
                  aria-current={i === indexCourant && !livree ? 'step' : undefined}
                  className={`${i === 0 ? 'text-left' : i === ETAPES.length - 1 ? 'text-right' : 'text-center'} ${
                    i <= indexCourant || livree ? 'text-stone-900' : 'text-stone-600'
                  }`}
                >
                  {etape.court}
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className="mt-6 text-xs text-stone-600">
          Dernière mise à jour à {heure(suivi.updated_at)}
          {!termine && '. La page se met à jour toute seule.'}
        </p>
      </section>

      {action}

      {aideOuverte && (
        <FeuilleAide
          message={messageWa}
          onFermer={() => setAideOuverte(false)}
          onWaEnvoye={() => {
            setWaEnvoye(true);
            try {
              sessionStorage.setItem(CLE_WA_ENVOYE(suivi.id), '1');
            } catch {}
          }}
        />
      )}
    </div>
  );
}

// Un écran, sans défilement : hauteur visible moins l'en-tête du site.
const ECRAN =
  'max-w-xl mx-auto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] h-[calc(100dvh-4rem-env(safe-area-inset-top))] flex flex-col gap-4';
const BOUTON =
  'appui w-full min-h-14 inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 hover:bg-amber-700 text-white font-semibold';

// Tout ce qui sert rarement : dans une feuille qui monte du bas, à la
// demande. Contact, renvoi du message, installation de l'app.
function FeuilleAide({
  message,
  onFermer,
  onWaEnvoye,
}: {
  message: string | null;
  onFermer: () => void;
  onWaEnvoye: () => void;
}) {
  const feuille = useRef<HTMLDivElement>(null);
  const fermer = useRef<HTMLButtonElement>(null);
  const installation = useInstallation();
  useFocusPiege(feuille);
  useEffect(() => {
    fermer.current?.focus({ preventScroll: true });
    const surTouche = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [onFermer]);

  const ligne =
    'appui w-full min-h-14 flex items-center gap-3 px-4 rounded-xl border border-stone-200 bg-white text-left font-semibold text-stone-900 hover:border-amber-700';

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <motion.div
        className="absolute inset-0 bg-stone-950/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.2 } }}
        onClick={onFermer}
      />
      <motion.div
        ref={feuille}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-aide"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
        className="relative w-full sm:max-w-md bg-brand-cream rounded-t-2xl sm:rounded-2xl border border-stone-200 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          <h2 id="titre-aide" className="font-serif text-xl font-semibold text-stone-900">
            Besoin d’aide ?
          </h2>
          <InfoBulle libelle="Fermer" cote="gauche">
            <button
              ref={fermer}
              onClick={onFermer}
              aria-label="Fermer"
              className="appui w-11 h-11 rounded-full flex items-center justify-center text-stone-700 hover:bg-white"
            >
              <X className="w-5 h-5" aria-hidden />
            </button>
          </InfoBulle>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <a href={urlContactWhatsApp()} target="_blank" rel="noopener noreferrer" className={ligne}>
            <MessageCircle className="w-5 h-5 text-[#15803d]" aria-hidden /> Écrire à King Crêperie
          </a>
          {message && (
            <a href={urlWhatsApp(message)} target="_blank" rel="noopener noreferrer" onClick={onWaEnvoye} className={ligne}>
              <RefreshCw className="w-5 h-5 text-amber-700" aria-hidden /> Renvoyer le message WhatsApp
            </a>
          )}
          {installation.mode === 'android' && (
            <button type="button" onClick={() => void installation.installer()} className={ligne}>
              <Download className="w-5 h-5 text-amber-700" aria-hidden /> Ajouter l’app à l’écran d’accueil
            </button>
          )}
          {installation.mode === 'ios' && (
            <p className="flex items-center gap-2 px-1 py-2 text-sm text-stone-600">
              <Share className="w-4 h-4 shrink-0" aria-hidden /> Pour installer l’app : Partager, puis « Sur l’écran d’accueil ».
            </p>
          )}
          <Link href="/#carte" className={ligne}>
            Voir la carte
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default function SuiviPage() {
  return (
    <div className="min-h-[100dvh] bg-brand-cream text-stone-900 pt-[calc(4rem+env(safe-area-inset-top))]">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-amber-700">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        }
      >
        <TrackingContent />
      </Suspense>
    </div>
  );
}
