'use client';

import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import CommandeFlow from '@/components/commande/CommandeFlow';
import { useEstHydrate } from '@/lib/useEstHydrate';

// Page de secours (lien direct, ancien favori). Le parcours normal se
// fait dans le panneau, sans quitter la carte.
export default function CommandePage() {
  const hydrate = useEstHydrate();
  return (
    <div className="min-h-screen bg-brand-cream text-stone-900 pt-24 pb-16 px-5">
      <div className="max-w-lg mx-auto">
        <Link href="/#carte" className="inline-flex items-center gap-1.5 text-stone-600 hover:text-amber-800 font-semibold text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Notre carte
        </Link>
        {hydrate ? (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-stone-200/80 shadow-sm p-5 sm:p-6">
            <CommandeFlow mode="page" />
          </div>
        ) : (
          <div className="py-24 flex justify-center text-amber-700">
            <Loader2 className="w-8 h-8 animate-spin" aria-label="Chargement" />
          </div>
        )}
      </div>
    </div>
  );
}
