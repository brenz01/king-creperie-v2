'use client';

import { Suspense, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import confetti from 'canvas-confetti';
import { Inbox, CookingPot, Bike, CheckCircle2, Loader2, ShoppingBag, XCircle, MessageCircle, RefreshCw } from 'lucide-react';
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
  { key: 'recue', titre: 'Demande reçue', texte: 'Nous avons reçu votre demande. On vous la confirme sur WhatsApp.', icon: Inbox },
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

function celebrer(commandeId: string) {
  const cle = `king_creperie_fete_${commandeId}`;
  if (lireStockage('session', cle)) return;
  try {
    sessionStorage.setItem(cle, '1');
  } catch {}
  confetti({ particleCount: 110, spread: 70, origin: { y: 0.6 }, colors: ['#F2A93B', '#F7E6A7', '#BE2D52', '#1F2A5C'] });
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
}

const heure = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

type Etat =
  | { type: 'ok'; id: string; suivi: SuiviPublic; verifieA: string }
  | { type: 'introuvable'; id: string }
  | { type: 'reseau'; id: string };

// Rappel WhatsApp : si le client n'a pas encore envoyé son récapitulatif
// (ou s'il revient sur la page), le bouton reste à portée de main.
function RappelWhatsApp({ commandeId }: { commandeId: string }) {
  const message = useSyncExternalStore(sAbonnerVide, () => lireStockage('session', CLE_WHATSAPP(commandeId)), () => null);
  const dejaEnvoye = useSyncExternalStore(sAbonnerVide, () => lireStockage('session', CLE_WA_ENVOYE(commandeId)) === '1', () => false);
  const [envoye, setEnvoye] = useState(false);
  if (!message) return null;

  if (dejaEnvoye || envoye) {
    return (
      <div className="bg-kc-beurre/60 rounded-3xl p-5 mb-6">
        <p className="font-display text-xl">Jërëjëf pour votre commande</p>
        <p className="mt-1 text-kc-encre/75">On vous tient au courant ici et sur WhatsApp.</p>
        <a href={urlWhatsApp(message)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-kc-indigo underline">
          Renvoyer le message WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-[#1FA855] rounded-3xl p-5 mb-6">
      <p className="font-display text-xl">Dernière étape : confirmez sur WhatsApp</p>
      <p className="mt-1 text-kc-encre/75">Votre demande est prête. Envoyez le message pour que nous puissions confirmer votre commande.</p>
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
        className="mt-4 flex items-center justify-center gap-2 bg-[#1FA855] hover:bg-[#178a45] text-white font-semibold py-3.5 rounded-full"
      >
        <MessageCircle className="w-5 h-5" /> Envoyer sur WhatsApp pour confirmer
      </a>
    </div>
  );
}

function BesoinAide() {
  return (
    <div className="mt-8 text-center">
      <p className="text-kc-encre/70">Un souci avec votre commande ? Écrivez-nous sur WhatsApp.</p>
      <a
        href={urlContactWhatsApp()}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-2 border border-kc-encre/20 hover:border-kc-encre/50 font-semibold px-5 py-3 rounded-full"
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

  const idStocke = useSyncExternalStore(sAbonnerVide, () => lireStockage('local', CLE_DERNIERE_COMMANDE), () => null);
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
          if (suivi.statut === 'en_livraison') celebrer(id);
        }),
    []
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
            : prev
        );
        if (record.statut === 'en_livraison') celebrer(commandeId);
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
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-kc-indigo">
        <Loader2 className="w-9 h-9 animate-spin" />
        <p className="text-kc-encre/70 text-sm">Chargement du suivi…</p>
      </div>
    );
  }

  if (!idValide || !courant || courant.type !== 'ok') {
    const titre = !commandeId ? 'Aucune commande à suivre' : courant?.type === 'reseau' ? 'Le suivi ne charge pas' : 'Commande introuvable';
    const texte = !commandeId
      ? 'Aucune commande récente sur ce téléphone. Le lien de suivi se trouve dans votre message WhatsApp.'
      : courant?.type === 'reseau'
        ? 'Vérifiez votre connexion et réessayez.'
        : 'Nous ne retrouvons pas cette commande. Vérifiez le lien reçu sur WhatsApp.';
    return (
      <div className="max-w-md mx-auto my-10 px-5">
        <div className="bg-white rounded-3xl border border-kc-encre/10 p-8 text-center">
          <ShoppingBag className="w-10 h-10 text-kc-encre/25 mx-auto" />
          <h1 className="font-display text-2xl mt-3">{titre}</h1>
          <p className="text-kc-encre/70 mt-2">{texte}</p>
          <div className="mt-6 flex flex-col gap-2">
            {courant?.type === 'reseau' && commandeId && (
              <button onClick={() => void charger(commandeId)} className="bg-kc-bissap text-white font-semibold py-3.5 rounded-full">
                Réessayer
              </button>
            )}
            <Link href="/#carte" className="border border-kc-encre/20 font-semibold py-3.5 rounded-full">
              Voir la carte
            </Link>
          </div>
        </div>
        <BesoinAide />
      </div>
    );
  }

  const { suivi } = courant;
  const annulee = suivi.statut === 'annulee';
  const indexCourant = Math.max(0, ORDRE.indexOf(suivi.statut));
  const termine = suivi.statut === 'livree' || annulee;
  const etapeCourante = ETAPES[indexCourant];

  return (
    <div className="max-w-xl mx-auto px-5 pt-6 pb-12">
      {idVientDuStockage && <p className="mb-4 text-sm text-kc-encre/60 text-center">Votre dernière commande passée sur ce téléphone.</p>}

      {!annulee && <RappelWhatsApp commandeId={suivi.id} />}

      <h1 className="font-display text-3xl">Suivi de votre commande</h1>
      <p className="mt-1 text-kc-encre/60">
        Commande n° {suivi.id.slice(0, 8).toUpperCase()}, passée à {heure(suivi.created_at)}
      </p>

      {annulee ? (
        <div className="mt-6 bg-white rounded-3xl border border-kc-bissap/30 p-6 text-center">
          <XCircle className="w-12 h-12 text-kc-bissap mx-auto" />
          <h2 className="font-display text-2xl mt-3">Commande annulée</h2>
          <p className="text-kc-encre/70 mt-2">Cette commande a été annulée par la crêperie. Une question ? Écrivez-nous sur WhatsApp.</p>
        </div>
      ) : (
        <>
          {/* Statut actuel, en grand */}
          <div className="mt-6 bg-kc-indigo text-kc-beurre rounded-3xl p-6">
            <div className="flex items-center gap-4">
              <span className="w-14 h-14 rounded-full bg-kc-beurre text-kc-indigo flex items-center justify-center shrink-0">
                <etapeCourante.icon className="w-7 h-7" />
              </span>
              <div>
                <p className="font-display text-2xl leading-tight">{etapeCourante.titre}</p>
                <p className="text-kc-brume mt-0.5">{etapeCourante.texte}</p>
              </div>
            </div>
            <p className="mt-5 text-sm text-kc-brume/80">
              Dernière mise à jour à {heure(suivi.updated_at)}
              {!termine && '. La page se met à jour toute seule.'}
            </p>
          </div>

          {/* Les étapes */}
          <ol className="mt-6 space-y-1">
            {ETAPES.map((etape, i) => {
              const fait = i < indexCourant || suivi.statut === 'livree';
              const actuelle = i === indexCourant && suivi.statut !== 'livree';
              return (
                <li key={etape.key} aria-current={actuelle ? 'step' : undefined} className="flex items-center gap-3 py-2">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      fait ? 'bg-kc-indigo text-kc-beurre' : actuelle ? 'bg-kc-bissap text-white' : 'border-2 border-kc-encre/15 text-kc-encre/40'
                    }`}
                  >
                    {fait ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </span>
                  <span className={`font-semibold ${fait || actuelle ? '' : 'text-kc-encre/45'}`}>{etape.titre}</span>
                </li>
              );
            })}
          </ol>

          {!termine && (
            <div className="mt-6 flex flex-wrap gap-3 items-center">
              <PushOptIn cible={{ commandeId: suivi.id }} />
              <button
                type="button"
                onClick={() => {
                  setActualisation(true);
                  void charger(suivi.id);
                }}
                className="inline-flex items-center gap-2 text-sm font-semibold text-kc-indigo px-4 py-2.5 rounded-full border border-kc-indigo/25 hover:border-kc-indigo/60"
              >
                <RefreshCw className={`w-4 h-4 ${actualisation ? 'animate-spin' : ''}`} /> Actualiser le suivi
              </button>
            </div>
          )}
        </>
      )}

      {nouvelle && !annulee && (
        <div className="mt-8">
          <InstallPrompt contexte="suivi" />
        </div>
      )}

      <BesoinAide />
    </div>
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
