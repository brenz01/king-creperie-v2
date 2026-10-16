'use client';

import { Check } from 'lucide-react';
import { useToast } from '@/lib/toast';

export default function ToastZone() {
  const toast = useToast();
  return (
    <div aria-live="polite" className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] inset-x-0 z-[55] flex justify-center pointer-events-none px-4">
      {toast && (
        <p
          key={toast.id}
          className="flex items-center gap-2 bg-kc-lait text-kc-encre font-semibold text-sm px-4 py-2.5 rounded-full shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]"
        >
          <Check className="w-4 h-4 text-kc-bissap" strokeWidth={3} />
          {toast.texte}
        </p>
      )}
    </div>
  );
}
