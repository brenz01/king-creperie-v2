'use client';

import { Check, Info } from 'lucide-react';
import { useToast } from '@/lib/toast';

export default function ToastZone() {
  const toast = useToast();
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(max(var(--reserve-panier,0px),env(safe-area-inset-bottom))+1rem)] inset-x-0 z-[55] flex justify-center pointer-events-none px-4"
    >
      {toast && toast.genre !== 'panier' && (
        <p
          key={toast.id}
          className="kc-apparait flex items-center gap-2 bg-stone-900/95 backdrop-blur-md text-white font-semibold text-sm px-4 py-2.5 rounded-lg shadow-xl"
        >
          {toast.genre === 'limite' ? (
            <Info className="w-4 h-4 text-amber-400" strokeWidth={2.5} aria-hidden />
          ) : (
            <Check className="w-4 h-4 text-amber-400" strokeWidth={3} />
          )}
          {toast.texte}
        </p>
      )}
    </div>
  );
}
