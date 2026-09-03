'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Commande, StatutCommande } from '@/types';
import confetti from 'canvas-confetti';
import { CheckCircle2, Clock, Truck, ChefHat, XCircle, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const STEPS: { statut: StatutCommande; label: string; icon: any }[] = [
  { statut: 'recue', label: 'Commande Reçue', icon: Clock },
  { statut: 'en_preparation', label: 'En Préparation', icon: ChefHat },
  { statut: 'en_livraison', label: 'En Cours de Livraison', icon: Truck },
  { statut: 'livree', label: 'Livrée !', icon: CheckCircle2 },
];

function SuiviContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('id') || '';

  const [orderId, setOrderId] = useState(initialId);
  const [inputSearch, setInputSearch] = useState(initialId);
  const [commande, setCommande] = useState<Commande | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const fetchCommande = async (id: string) => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);

    try {
      const { data, error } = await supabase
        .from('commandes')
        .select('*, commande_items(*)')
        .eq('id', id)
        .single();

      if (error || !data) {
        setNotFound(true);
        setCommande(null);
      } else {
        setCommande(data as Commande);
        if (data.statut === 'livree') triggerConfetti();
      }
    } catch (e) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchCommande(orderId);

      // Abonnement Realtime aux changements de statut de cette commande
      const channel = supabase
        .channel(`suivi-${orderId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'commandes',
            filter: `id=eq.${orderId}`,
          },
          (payload) => {
            const updated = payload.new as Commande;
            setCommande((prev) => (prev ? { ...prev, statut: updated.statut } : updated));

            if (updated.statut === 'livree') {
              triggerConfetti();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [orderId]);

  const triggerConfetti = () => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputSearch.trim()) {
      setOrderId(inputSearch.trim());
    }
  };

  const getStepStatus = (stepStatut: StatutCommande) => {
    if (!commande) return 'pending';
    if (commande.statut === 'annulee') return 'cancelled';

    const orderIndex = STEPS.findIndex((s) => s.statut === commande.statut);
    const stepIndex = STEPS.findIndex((s) => s.statut === stepStatut);

    if (stepIndex < orderIndex) return 'completed';
    if (stepIndex === orderIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="min-h-screen pt-28 pb-16 px-6 max-w-3xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-400 text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Retour à l'accueil</span>
      </Link>

      <h1 className="text-3xl md:text-4xl font-black font-serif text-white mb-6">
        Suivi de <span className="text-amber-400">Commande</span>
      </h1>

      {/* Barre de recherche d'ID */}
      <form onSubmit={handleSearch} className="mb-8 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
          <input
            type="text"
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            placeholder="Saisissez votre N° de commande UUID"
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-amber-500"
          />
        </div>
        <button
          type="submit"
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 rounded-xl transition-all"
        >
          Rechercher
        </button>
      </form>

      {loading && <p className="text-center text-amber-400 py-12">Chargement du statut...</p>}

      {notFound && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-lg font-bold text-white">Commande introuvable</p>
          <p className="text-slate-400 text-sm mt-1">Vérifiez l'identifiant renseigné et réessayez.</p>
        </div>
      )}

      {commande && !loading && (
        <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl space-y-8">
          <div className="flex flex-wrap justify-between items-center border-b border-slate-800 pb-4 gap-2">
            <div>
              <p className="text-xs uppercase text-slate-500 font-bold">Commande</p>
              <p className="font-mono text-sm text-amber-400 font-bold">#{commande.id}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-slate-500 font-bold">Montant Total</p>
              <p className="text-lg font-black text-white">{commande.total.toLocaleString('fr-FR')} FCFA</p>
            </div>
          </div>

          {/* Stepper Visuel */}
          <div className="space-y-6">
            {STEPS.map((step) => {
              const status = getStepStatus(step.statut);
              const Icon = step.icon;

              let iconBg = 'bg-slate-800 text-slate-500 border-slate-700';
              let textColor = 'text-slate-500';

              if (status === 'completed') {
                iconBg = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
                textColor = 'text-slate-300';
              } else if (status === 'current') {
                iconBg = 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse';
                textColor = 'text-amber-400 font-bold';
              }

              return (
                <div key={step.statut} className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${iconBg}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-base ${textColor}`}>{step.label}</p>
                    {status === 'current' && (
                      <p className="text-xs text-slate-400">Mise à jour en direct via Realtime</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Détails du client */}
          <div className="bg-slate-950 p-4 rounded-2xl text-sm space-y-1 text-slate-400 border border-slate-800/80">
            <p><span className="text-white font-bold">Client :</span> {commande.client_nom}</p>
            <p><span className="text-white font-bold">Adresse :</span> {commande.adresse_livraison}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SuiviPage() {
  return (
    <Suspense fallback={<div className="pt-28 text-center text-amber-400">Chargement...</div>}>
      <SuiviContent />
    </Suspense>
  );
}