'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { fermerPanier, usePanierOuvert } from '@/lib/panneauPanier';
import CommandeFlow from './CommandeFlow';

// Panneau de commande : plein écran sur téléphone, colonne à droite sur
// ordinateur. On ne quitte jamais la carte, qu'on retrouve au même
// endroit en fermant.
export default function CommandePanel() {
  const ouvert = usePanierOuvert();
  const pathname = usePathname();

  // Toute navigation (vers le suivi, une autre page) ferme le panneau.
  useEffect(() => {
    fermerPanier();
  }, [pathname]);

  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && fermerPanier();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [ouvert]);

  return (
    <AnimatePresence>
      {ouvert && (
        <div key="panneau" data-lenis-prevent className="fixed inset-0 z-[60]">
          <motion.div
            className="absolute inset-0 bg-kc-nuit/60 hidden sm:block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={fermerPanier}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Votre commande"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 320 }}
            className="absolute inset-y-0 right-0 w-full sm:w-[28rem] bg-kc-lait text-kc-encre flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-end px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-1">
              <button
                onClick={fermerPanier}
                aria-label="Fermer le panier"
                className="w-11 h-11 rounded-full bg-kc-encre/5 hover:bg-kc-encre/10 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <CommandeFlow mode="panneau" onFermer={fermerPanier} />
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
