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
    <div className="min-h-screen bg-kc-lait text-kc-encre pt-24 pb-16 px-5">
      <div className="max-w-lg mx-auto">
        <Link href="/#carte" className="inline-flex items-center gap-1.5 text-kc-encre/70 font-semibold text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> La carte
        </Link>
        {hydrate ? (
          <CommandeFlow mode="page" />
        ) : (
          <div className="py-24 flex justify-center text-kc-indigo">
            <Loader2 className="w-8 h-8 animate-spin" aria-label="Chargement" />
          </div>
        )}
      </div>
    </div>
  );
}
