'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Inbox, CookingPot, PartyPopper, CheckCircle2, Clock, Loader2
} from 'lucide-react';

type StatutCommande = 'recue' | 'en_preparation' | 'en_livraison' | 'livree' | 'annulee';

// Ce que le RPC public renvoie désormais — volontairement minimal
interface SuiviPublic {
  id: string;
  statut: StatutCommande;
  updated_at: string;
  created_at: string;
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

function TrackingContent() {
  const searchParams = useSearchParams();
  const commandeId = searchParams.get('id');

  const [suivi, setSuivi] = useState<SuiviPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const triggerCelebration = () => {
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#d97706', '#f59e0b', '#10b981', '#1c1917'],
    });
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
  };

  useEffect(() => {
    if (!commandeId) {
      setLoading(false);
      setErreur('Aucun identifiant de commande fourni dans l\u2019URL.');
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
      .channel(`commande-${commandeId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'commandes', filter: `id=eq.${commandeId}` },
        (payload) => {
          const nouveauStatut = payload.new.statut as StatutCommande;
          const nouveauUpdatedAt = payload.new.updated_at as string;
          setSuivi((prev) => prev ? { ...prev, statut: nouveauStatut, updated_at: nouveauUpdatedAt } : prev);
          if (nouveauStatut === 'en_livraison') triggerCelebration();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [commandeId]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-amber-600 gap-3">
        <Loader2 className="w-10 h-10 animate-spin" />
        <p className="text-stone-600 font-medium text-sm">Chargement du suivi de commande...</p>
      </div>
    );
  }

  if (erreur || !suivi) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-stone-200 shadow-sm text-center">
        <p className="text-amber-700 font-bold mb-2">Oups !</p>
        <p className="text-stone-600 text-sm">{erreur || 'Commande inexistante'}</p>
      </div>
    );
  }

  const currentStepIndex = Math.max(0, ORDER_INDEX[suivi.statut] ?? 0);
  const progressPercentage = (currentStepIndex / (ETAPES.length - 1)) * 100;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-sm mb-8 text-center">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/60">
          En direct de la cuisine
        </span>
        <h1 className="text-2xl sm:text-3xl font-serif font-black text-stone-900 mt-2">
          Commande #{suivi.id.slice(0, 8)}
        </h1>
        <p className="text-xs text-stone-400 mt-1 flex items-center gap-1 justify-center">
          <Clock className="w-3.5 h-3.5" />
          Passée le {new Date(suivi.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-sm">
        <h2 className="text-lg font-bold text-stone-900 mb-6">Statut de la préparation</h2>

        <div className="relative mb-10">
          <div className="absolute top-1/2 left-0 right-0 h-2 bg-stone-100 -translate-y-1/2 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-amber-600 rounded-full"
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
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                    isCompleted ? 'bg-amber-600 text-white'
                      : isCurrent ? 'bg-amber-500 text-white ring-4 ring-amber-100'
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
            return (
              <div key={etape.key} className={`flex items-start gap-4 p-4 rounded-2xl transition-all ${
                isCurrent ? 'bg-amber-50/80 border border-amber-200/60 shadow-sm'
                  : isCompleted ? 'opacity-80' : 'opacity-40'
              }`}>
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  isCurrent ? 'bg-amber-600 text-white'
                    : isCompleted ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-400'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`font-bold text-sm sm:text-base ${isCurrent ? 'text-amber-950 font-extrabold' : 'text-stone-800'}`}>
                    {etape.titre}
                  </h3>
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
        <div className="min-h-screen flex items-center justify-center text-amber-600">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }>
        <TrackingContent />
      </Suspense>
    </main>
  );
}