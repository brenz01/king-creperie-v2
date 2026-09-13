'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Inbox, CookingPot, PartyPopper, CheckCircle2, Clock, Loader2, Timer, ShoppingBag
} from 'lucide-react';
import Link from 'next/link';

type StatutCommande = 'recue' | 'en_preparation' | 'en_livraison' | 'livree' | 'annulee';

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

function estimationTotaleRestante(statutActuel: StatutCommande): number {
  const ordre: StatutCommande[] = ['recue', 'en_preparation', 'en_livraison', 'livree'];
  const indexActuel = ordre.indexOf(statutActuel);
  if (indexActuel === -1 || statutActuel === 'livree' || statutActuel === 'annulee') return 0;

  return ordre
    .slice(indexActuel, -1)
    .reduce((total, etape) => total + ESTIMATION_MINUTES[etape], 0);
}

const ETAPES: Array<{
  key: StatutCommande;
  titre: string;
  description: string;
  icon: React.ElementType;
}> = [
  { key: 'recue', titre: 'Commande reçue', description: 'Votre commande a été transmise en cuisine', icon: Inbox },
  { key: 'en_preparation', titre: 'En préparation', description: 'Nos crêpiers préparent vos gourmandises', icon: CookingPot },
  { key: 'en_livraison', titre: 'En livraison', description: 'Votre commande est en route', icon: PartyPopper },
  { key: 'livree', titre: 'Livrée', description: 'Commande livrée ou récupérée. Bon appétit !', icon: CheckCircle2 },
];

const ORDER_INDEX: Record<StatutCommande, number> = {
  recue: 0, en_preparation: 1, en_livraison: 2, livree: 3, annulee: -1,
};

const CLE_LOCALSTORAGE = 'king_creperie_derniere_commande';

function TrackingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const commandeIdUrl = searchParams.get('id');

  // Résolution de l'ID : priorité au paramètre d'URL explicite,
  // sinon on retombe sur la dernière commande connue de CE navigateur.
  // On ne fait ça qu'une fois au montage, pas à chaque render.
  const [commandeId, setCommandeId] = useState<string | null>(commandeIdUrl);
  const [idVientDuStockage, setIdVientDuStockage] = useState(false);
  const [resolutionTerminee, setResolutionTerminee] = useState(false);

  const [suivi, setSuivi] = useState<SuiviPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const triggerCelebration = () => {
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#B8621B', '#DDA15E', '#6B8763', '#2A1B12'],
    });
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
  };

  // Étape 1 — résoudre quel ID utiliser (URL explicite, ou localStorage
  // en secours). Se fait avant tout fetch, une seule fois.
  useEffect(() => {
    if (commandeIdUrl) {
      setCommandeId(commandeIdUrl);
      setResolutionTerminee(true);
      return;
    }

    try {
      const derniereCommande = localStorage.getItem(CLE_LOCALSTORAGE);
      if (derniereCommande) {
        setCommandeId(derniereCommande);
        setIdVientDuStockage(true);
      }
    } catch {
      // localStorage indisponible (navigation privée stricte, etc.)
      // — on continue simplement sans ID, l'écran d'erreur habituel
      // s'affichera, ce qui reste correct dans ce cas.
    }
    setResolutionTerminee(true);
  }, [commandeIdUrl]);

  // Étape 2 — une fois l'ID résolu, fetch + abonnement Realtime.
  useEffect(() => {
    if (!resolutionTerminee) return;

    if (!commandeId) {
      setLoading(false);
      setErreur('Aucune commande récente trouvée sur cet appareil.');
      return;
    }

    async function fetchSuivi() {
      try {
        const { data, error } = await supabase
          .rpc('suivi_commande', { p_id: commandeId })
          .single();

        if (error || !data) throw new Error('Commande introuvable');

        setSuivi(data as SuiviPublic);
        if ((data as SuiviPublic).statut === 'en_livraison') {
          triggerCelebration();
        }
      } catch (err: any) {
        setErreur(err.message || 'Impossible de charger la commande.');
      } finally {
        setLoading(false);
      }
    }

    fetchSuivi();

    const channel = supabase
      .channel(`commande-${commandeId}`, { config: { private: true } })
      .on(
        'broadcast',
        { event: 'UPDATE' },
        (payload) => {
          const nouveauStatut = payload.payload.record.statut as StatutCommande;
          const nouveauUpdatedAt = payload.payload.record.updated_at as string;
          setSuivi((prev) => prev ? { ...prev, statut: nouveauStatut, updated_at: nouveauUpdatedAt } : prev);
          if (nouveauStatut === 'en_livraison') triggerCelebration();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [commandeId, resolutionTerminee]);

  if (!resolutionTerminee || loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-amber-700 gap-3">
        <Loader2 className="w-10 h-10 animate-spin" />
        <p className="text-stone-600 font-medium text-sm">Chargement du suivi de commande...</p>
      </div>
    );
  }

  if (erreur || !suivi) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-2xl border border-stone-200 shadow-sm text-center">
        <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto mb-3" />
        <p className="text-amber-700 font-bold mb-2">
          {commandeIdUrl ? 'Commande introuvable' : 'Aucune commande à suivre'}
        </p>
        <p className="text-stone-600 text-sm mb-5">
          {erreur || 'Commande inexistante'}
        </p>
        <Link
          href="/#menu"
          className="inline-flex items-center gap-2 bg-stone-900 hover:bg-amber-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          <span>Voir la carte</span>
        </Link>
      </div>
    );
  }

  const currentStepIndex = Math.max(0, ORDER_INDEX[suivi.statut] ?? 0);
  const progressPercentage = (currentStepIndex / (ETAPES.length - 1)) * 100;
  const minutesRestantes = estimationTotaleRestante(suivi.statut);
  const estTermine = suivi.statut === 'livree' || suivi.statut === 'annulee';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      {idVientDuStockage && (
        <div className="mb-6 bg-stone-100 border border-stone-200 text-stone-600 text-xs px-4 py-2.5 rounded-lg text-center">
          Voici votre dernière commande passée sur cet appareil.
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200/80 shadow-sm mb-8 text-center">
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/60">
          En direct de la cuisine
        </span>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-stone-900 mt-2">
          Commande #{suivi.id.slice(0, 8)}
        </h1>
        <p className="text-xs text-stone-400 mt-1 flex items-center gap-1 justify-center">
          <Clock className="w-3.5 h-3.5" />
          Passée le {new Date(suivi.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>

        {!estTermine && minutesRestantes > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 mt-4 bg-stone-900 text-white px-4 py-2.5 rounded-xl"
          >
            <Timer className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold">
              Estimation : encore {minutesRestantes} min environ
            </span>
          </motion.div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200/80 shadow-sm">
        <h2 className="font-serif text-lg font-semibold text-stone-900 mb-6">Statut de la préparation</h2>

        <div className="relative mb-10">
          <div className="absolute top-1/2 left-0 right-0 h-2 bg-stone-100 -translate-y-1/2 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-amber-700 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
            />
          </div>
          <div className="relative z-10 flex justify-between items-center">
            {ETAPES.map((etape, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const Icon = etape.icon;
              return (
                <motion.div
                  key={etape.key}
                  animate={isCurrent ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                  transition={isCurrent ? { repeat: Infinity, duration: 2 } : {}}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                    isCompleted ? 'bg-amber-700 text-white'
                      : isCurrent ? 'bg-stone-900 text-white ring-4 ring-amber-100'
                      : 'bg-white border-2 border-stone-200 text-stone-400'
                  }`}
                >
                  <Icon className="w-6 h-6" />
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6 pt-4">
          {ETAPES.map((etape, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const Icon = etape.icon;
            const minutesEtape = ESTIMATION_MINUTES[etape.key];

            return (
              <div key={etape.key} className={`flex items-start gap-4 p-4 rounded-xl transition-all ${
                isCurrent ? 'bg-amber-50/70 border border-amber-200/50 shadow-sm'
                  : isCompleted ? 'opacity-80' : 'opacity-40'
              }`}>
                <div className={`p-2.5 rounded-lg shrink-0 ${
                  isCurrent ? 'bg-stone-900 text-white'
                    : isCompleted ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-400'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`font-semibold text-sm sm:text-base ${isCurrent ? 'text-stone-900' : 'text-stone-800'}`}>
                      {etape.titre}
                    </h3>
                    {isCurrent && minutesEtape > 0 && (
                      <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                        ~{minutesEtape} min
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-stone-500 mt-0.5">{etape.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function SuiviPage() {
  return (
    <main className="min-h-screen bg-brand-cream/50">
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center text-amber-700">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }>
        <TrackingContent />
      </Suspense>
    </main>
  );
}