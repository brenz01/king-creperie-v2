'use client';

import { useCart } from '@/context/CartContext';
import { ShoppingBag } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { ouvrirPanier, usePanierOuvert } from '@/lib/panneauPanier';

// Barre panier flottante : visible dès le premier article, ouvre le
// panneau de commande sans quitter la carte.
export default function FloatingCartBar() {
  const { totalCount, totalAmount } = useCart();
  const pathname = usePathname();
  const ouvert = usePanierOuvert();

  if (ouvert || totalCount === 0 || pathname === '/commande' || pathname === '/suivi' || pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
      <button
        onClick={ouvrirPanier}
        className="pointer-events-auto w-full max-w-md mx-auto bg-kc-lait text-kc-encre rounded-full shadow-[0_12px_40px_-10px_rgba(0,0,0,0.55)] flex items-center gap-3 p-1.5 pl-2 text-left"
      >
        <span className="relative w-11 h-11 rounded-full bg-kc-indigo text-kc-beurre flex items-center justify-center shrink-0">
          <ShoppingBag className="w-5 h-5" />
        </span>
        <span className="flex-1 leading-tight">
          <span className="block text-sm text-kc-encre/70">
            Mon panier, {totalCount} article{totalCount > 1 ? 's' : ''}
          </span>
          <span className="prix text-lg">{totalAmount.toLocaleString('fr-FR')} F</span>
        </span>
        <span className="bg-kc-bissap text-white font-semibold px-5 py-3 rounded-full shrink-0">Voir mon panier</span>
      </button>
    </div>
  );
}
