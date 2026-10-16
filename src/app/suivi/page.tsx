'use client';

import { Suspense, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Inbox, CookingPot, Bike, CheckCircle2, Clock, Loader2, Timer, ShoppingBag, XCircle, MessageCircle, Check,
} from 'lucide-react';
import Link from 'next/link';
import type { StatutCommande } from '@/types';
import { UUID_REGEX } from '@/lib/uuid';
import { useEstHydrate } from '@/lib/useEstHydrate';
import { CLE_WHATSAPP, urlContactWhatsApp, urlWhatsApp } from '@/lib/whatsapp';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import PushOptIn from '@/components/pwa/PushOptIn';

interface SuiviPublic {
  id: string;
  statut: StatutCommande;
  updated_at: string;
  created_at: string;
}

const ESTIMATION_MINUTES: Record<StatutCommande, number> = {
  recue: 5,
  en_preparation: 15,
  en_livraison: 20,
  livree: 0,
  annulee: 0,
};

const ORDRE: StatutCommande[] = ['recue', 'en_preparation', 'en_livraison', 'livree'];

function estimationRestante(statut: StatutCommande): number {
  const i = ORDRE.indexOf(statut);
  if (i === -1 || statut === 'livree') return 0;
  return ORDRE.slice(i, -1).reduce((t, e) => t + ESTIMATION_MINUTES[e], 0);
}

const ETAPES: Array<{ key: StatutCommande; titre: string; description: string; icon: React.ElementType }> = [
  { key: 'recue', titre: 'Commande reçue', description: 'Votre commande a été transmise en cuisine', icon: Inbox },
  { key: 'en_preparation', titre: 'En préparation', description: 'Nos crêpiers préparent vos gourmandises', icon: CookingPot },
  { key: 'en_livraison', titre: 'En livraison', description: 'Votre commande est en route', icon: Bike },
  { key: 'livree', titre: 'Livrée', description: 'Commande livrée ou récupérée. Bon appétit !', icon: CheckCircle2 },
];

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
  // Une seule fois par commande, même après rechargement.
  const cle = `king_creperie_fete_${commandeId}`;
  if (lireStockage('session', cle)) return;
  try {
    sessionStorage.setItem(cle, '1');
  } catch {}
  confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#B8621B', '#DDA15E', '#6B8763', '#2A1B12'] });
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 300]);
}

type EtatChargement =
  | { type: 'ok'; id: string; suivi: SuiviPublic }
  | { type: 'erreur'; id: string; message: string };

// ---------------------------------------------------------------
// Bouton WhatsApp : l'envoi se fait par un vrai clic (lien), seule
// méthode fiable sur Safari iOS et en mode app installée.
// ---------------------------------------------------------------
function EnvoiWhatsApp({ commandeId }: { commandeId: string }) {
  const message = useSyncExternalStore(sAbonnerVide, () => lireStockage('session', CLE_WHATSAPP(commandeId)), () => null);
  const [envoye, setEnvoye] = useState(false);

  if (!message) return null;

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 sm:p-6 mb-8">
      <p className="font-serif text-lg font-semibold text-stone-900">
        {envoye ? 'Merci ! Votre commande a été transmise.' : 'Dernière étape : confirmez sur WhatsApp'}
      </p>
      <p className="text-sm text-stone-600 mt-1 mb-4">
        {envoye
          ? 'Vous pouvez suivre la préparation en direct ci-dessous.'
          : 'Votre commande est enregistrée. Envoyez le récapitulatif à la crêperie pour qu’elle démarre la préparation.'}
      </p>
      <a
        href={urlWhatsApp(message)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setEnvoye(true)}
        className={`inline-flex items-center gap-2 font-bold px-5 py-3 rounded-xl transition-colors ${
          envoye ? 'bg-white border border-emerald-300 text-emerald-800' : 'bg-[#1FA855] hover:bg-[#178a45] text-white shadow-md'
        }`}
      >
        {envoye ? <Check className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
        {envoye ? 'Renvoyer sur WhatsApp' : 'Envoyer ma commande sur WhatsApp'}
      </a>
    </div>
  );
}

function TrackingContent() {
  const searchParams = useSearchParams();
  const hydrate = useEstHydrate();
  const idUrl = searchParams.get('id');
  const nouvelle = searchParams.get('nouvelle') === '1';

  // Repli sur la dernière commande de CET appareil si aucun ID en URL.
  const idStocke = useSyncExternalStore(sAbonnerVide, () => lireStockage('local', CLE_DERNIERE_COMMANDE), () => null);
  const commandeId = idUrl ?? idStocke;
  const idVientDuStockage = !idUrl && !!idStocke;
  const idValide = !!commandeId && UUID_REGEX.test(commandeId);

  const [etat, setEtat] = useState<EtatChargement | null>(null);

  // Chaîne .then() (et non async/await) : les setState se font dans le
  // callback de la promesse, jamais de façon synchrone dans l'effet.
  const charger = useCallback(
    (id: string) =>
      supabase
        .rpc('suivi_commande', { p_id: id })
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            setEtat((prev) =>
              prev?.type === 'ok' && prev.id === id ? prev : { type: 'erreur', id, message: 'Commande introuvable.' }
            );
            return;
          }
          const suivi = data as SuiviPublic;
          setEtat({ type: 'ok', id, suivi });
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
            ? { ...prev, suivi: { ...prev.suivi, statut: record.statut!, updated_at: record.updated_at ?? prev.suivi.updated_at } }
            : prev
        );
        if (record.statut === 'en_livraison') celebrer(commandeId);
      })
      .subscribe((status) => {
        // Resynchronisation à chaque (re)connexion : couvre la fenêtre
        // entre le fetch initial et l'abonnement, et les reconnexions.
        if (status === 'SUBSCRIBED') void charger(commandeId);
      });

    // Téléphone verrouillé / app en arrière-plan : la WebSocket est
    // suspendue. On recharge l'état au retour au premier plan.
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

  const etatCourant = etat && etat.id === commandeId ? etat : null;

  if (!hydrate || (idValide && !etatCourant)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-amber-700 gap-3">
        <Loader2 className="w-10 h-10 animate-spin" />
        <p className="text-stone-600 font-medium text-sm">Chargement du suivi de commande...</p>
      </div>
    );
  }

  if (!idValide || !etatCourant || etatCourant.type === 'erreur') {
    const message = !commandeId
      ? 'Aucune commande récente trouvée sur cet appareil.'
      : etatCourant?.type === 'erreur'
        ? etatCourant.message
        : 'Lien de suivi invalide.';
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-2xl border border-stone-200 shadow-sm text-center">
        <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto mb-3" />
        <p className="text-amber-700 font-bold mb-2">{idUrl ? 'Commande introuvable' : 'Aucune commande à suivre'}</p>
        <p className="text-stone-600 text-sm mb-5">{message}</p>
        <Link href="/#menu" className="inline-flex items-center gap-2 bg-stone-900 hover:bg-amber-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm">
          Voir la carte
        </Link>
      </div>
    );
  }

  const suivi = etatCourant.suivi;
  const annulee = suivi.statut === 'annulee';
  const indexCourant = Math.max(0, ORDRE.indexOf(suivi.statut));
  const progression = (indexCourant / (ETAPES.length - 1)) * 100;
  const minutesRestantes = estimationRestante(suivi.statut);
  const termine = suivi.statut === 'livree' || annulee;

  return (
    <div className="max-w-3xl mx-auto px-4 pt-24 pb-8 sm:pt-28 sm:pb-12">
      {idVientDuStockage && (
        <div className="mb-6 bg-stone-100 border border-stone-200 text-stone-600 text-xs px-4 py-2.5 rounded-lg text-center">
          Voici votre dernière commande passée sur cet appareil.
        </div>
      )}

      {!annulee && <EnvoiWhatsApp commandeId={suivi.id} />}

      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200/80 shadow-sm mb-8 text-center">
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/60">
          En direct de la cuisine
        </span>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-stone-900 mt-2">
          Commande #{suivi.id.slice(0, 8)}
        </h1>
        <p className="text-xs text-stone-400 mt-1 flex items-center gap-1 justify-center">
          <Clock className="w-3.5 h-3.5" />
          Passée le {new Date(suivi.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </p>

        {!termine && minutesRestantes > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 mt-4 bg-stone-900 text-white px-4 py-2.5 rounded-xl"
          >
            <Timer className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold">Estimation : encore {minutesRestantes} min environ</span>
          </motion.div>
        )}

        {!termine && (
          <div className="mt-5 flex justify-center">
            <PushOptIn cible={{ commandeId: suivi.id }} />
          </div>
        )}
      </div>

      {annulee ? (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-rose-200 shadow-sm text-center">
          <XCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="font-serif text-xl font-semibold text-stone-900">Commande annulée</h2>
          <p className="text-sm text-stone-600 mt-2 mb-5">
            Cette commande a été annulée par la crêperie. Une question ? Contactez-nous directement.
          </p>
          <a href={urlContactWhatsApp()} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-stone-900 hover:bg-amber-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm">
            <MessageCircle className="w-4 h-4" /> Nous écrire sur WhatsApp
          </a>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200/80 shadow-sm">
          <h2 className="font-serif text-lg font-semibold text-stone-900 mb-6">Statut de la préparation</h2>

          <div className="relative mb-10">
            <div className="absolute top-1/2 left-0 right-0 h-2 bg-stone-100 -translate-y-1/2 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-amber-700 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progression}%` }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
              />
            </div>
            <div className="relative z-10 flex justify-between items-center">
              {ETAPES.map((etape, index) => {
                const fait = index < indexCourant || suivi.statut === 'livree';
                const courant = index === indexCourant && suivi.statut !== 'livree';
                const Icon = etape.icon;
                return (
                  <motion.div
                    key={etape.key}
                    animate={courant ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                    transition={courant ? { repeat: Infinity, duration: 2 } : {}}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                      fait ? 'bg-amber-700 text-white'
                        : courant ? 'bg-stone-900 text-white ring-4 ring-amber-100'
                          : 'bg-white border-2 border-stone-200 text-stone-400'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </motion.div>
                );
              })}
            </div>
          </div>

          <ol className="space-y-6 pt-4">
            {ETAPES.map((etape, index) => {
              const fait = index < indexCourant;
              const courant = index === indexCourant;
              const Icon = etape.icon;
              const minutesEtape = ESTIMATION_MINUTES[etape.key];
              return (
                <li key={etape.key} aria-current={courant ? 'step' : undefined} className={`flex items-start gap-4 p-4 rounded-xl transition-all ${
                  courant ? 'bg-amber-50/70 border border-amber-200/50 shadow-sm' : fait ? 'opacity-80' : 'opacity-40'
                }`}>
                  <div className={`p-2.5 rounded-lg shrink-0 ${
                    courant ? 'bg-stone-900 text-white' : fait ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`font-semibold text-sm sm:text-base ${courant ? 'text-stone-900' : 'text-stone-800'}`}>{etape.titre}</h3>
                      {courant && minutesEtape > 0 && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">~{minutesEtape} min</span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-stone-500 mt-0.5">{etape.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {nouvelle && !annulee && (
        <div className="mt-8">
          <InstallPrompt contexte="suivi" />
        </div>
      )}
    </div>
  );
}

export default function SuiviPage() {
  return (
    <div className="min-h-screen bg-brand-cream/50">
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
