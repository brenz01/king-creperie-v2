'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingBag, X } from 'lucide-react';
import { fermerPanier, usePanierOuvert } from '@/lib/panneauPanier';
import CommandeFlow from './CommandeFlow';
import { useFocusPiege } from '@/lib/useFocusPiege';
import InfoBulle from '../ui/InfoBulle';

// Panneau de commande : tiroir à droite sur un voile flouté, plein écran
// sur téléphone. On ne quitte jamais la carte, qu'on retrouve au même
// endroit en fermant.
export default function CommandePanel() {
  const ouvert = usePanierOuvert();
  const pathname = usePathname();
  const tiroir = useRef<HTMLElement>(null);
  const fermer = useRef<HTMLButtonElement>(null);
  useFocusPiege(tiroir, ouvert);

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
    fermer.current?.focus({ preventScroll: true });
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
            className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2 } }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            onClick={fermerPanier}
          />
          <motion.aside
            ref={tiroir}
            role="dialog"
            aria-modal="true"
            aria-label="Votre commande"
            initial={{ x: '100%' }}
            animate={{ x: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ x: '100%', transition: { duration: 0.15, ease: [0.7, 0, 0.84, 0] } }}
            className="absolute inset-y-0 right-0 w-full sm:w-[440px] bg-brand-cream text-stone-900 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-4 bg-white border-b border-stone-200">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-700" />
                <p className="font-serif text-xl font-semibold text-stone-900">Votre commande</p>
              </div>
              <InfoBulle libelle="Fermer le panier" cote="gauche">
                <button
                  ref={fermer}
                  onClick={fermerPanier}
                  aria-label="Fermer le panier"
                  className="appui w-11 h-11 rounded-lg flex items-center justify-center hover:bg-stone-100 text-stone-600 hover:text-stone-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </InfoBulle>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <CommandeFlow mode="panneau" onFermer={fermerPanier} />
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
