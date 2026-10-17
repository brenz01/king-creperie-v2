'use client';

import { useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowRight, Check, ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/lib/toast';
import { ouvrirPanier, usePanierOuvert } from '@/lib/panneauPanier';
import { nombreF } from '@/lib/produit';

// Barre panier flottante : visible dès le premier article, ouvre le
// panneau de commande sans quitter la carte.
export default function FloatingCartBar() {
  const { totalCount, totalAmount } = useCart();
  const pathname = usePathname();
  const ouvert = usePanierOuvert();
  // Confirmation d'ajout affichée ici, là où le client regarde.
  const toast = useToast();
  const ajout = toast?.genre === 'panier' ? toast : null;
  const zone = useRef<HTMLDivElement>(null);
  const visible = !(ouvert || totalCount === 0 || pathname === '/commande' || pathname === '/suivi' || pathname.startsWith('/admin'));

  // Hauteur réellement occupée en bas de l'écran (barre + marge + zone de
  // sécurité), publiée en --reserve-panier : la carte s'en sert pour que
  // la dernière rangée ne reste jamais dessous. 0 quand la barre est absente.
  useLayoutEffect(() => {
    const racine = document.documentElement;
    const el = zone.current;
    if (!visible || !el) {
      racine.style.setProperty('--reserve-panier', '0px');
      return;
    }
    const publier = () => racine.style.setProperty('--reserve-panier', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    publier();
    const observateur = new ResizeObserver(publier);
    observateur.observe(el);
    return () => {
      observateur.disconnect();
      racine.style.setProperty('--reserve-panier', '0px');
    };
  }, [visible]);

  if (!visible) return null;

  const articles = `${totalCount} article${totalCount > 1 ? 's' : ''}`;

  return (
    <div ref={zone} className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none">
      <p className="sr-only" aria-live="polite">
        {ajout ? `${ajout.texte}.` : ''}
      </p>
      <button
        key={ajout?.id ?? 'repos'}
        type="button"
        onClick={ouvrirPanier}
        className={`${ajout ? 'barre-rebond ' : ''}pointer-events-auto w-full max-w-xl mx-auto verre-sombre bg-stone-900/95 backdrop-blur-md text-white p-3 sm:p-4 rounded-xl shadow-[0_12px_32px_-12px_rgba(0,0,0,0.3)] border border-stone-700 flex items-center justify-between gap-3 text-left`}
      >
        <span className="flex items-center gap-3 min-w-0">
          <span data-cible-panier className={`relative p-2.5 rounded-lg shrink-0 transition-colors ${ajout ? 'bg-emerald-700' : 'bg-amber-700'}`}>
            {ajout ? <Check className="w-5 h-5" strokeWidth={3} /> : <ShoppingBag className="w-5 h-5" />}
            <span aria-hidden className="absolute -top-2 -right-2 bg-white text-stone-900 text-xs font-semibold rounded-full h-5 min-w-5 px-1 flex items-center justify-center tabular-nums">
              {totalCount}
            </span>
          </span>
          <span className="min-w-0">
            <span className="sr-only">Voir mon panier, {articles} : </span>
            <span aria-hidden className={`block text-xs font-semibold truncate ${ajout ? 'text-amber-300' : 'text-stone-300'}`}>
              {ajout ? ajout.texte : 'Voir mon panier'}
            </span>
            <span className="prix block text-lg text-white">{nombreF(totalAmount)} FCFA</span>
          </span>
        </span>
        <span className="bg-amber-700 text-white font-semibold px-4 sm:px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm shrink-0">
          Valider
          <ArrowRight className="w-4 h-4" />
        </span>
      </button>
    </div>
  );
}
