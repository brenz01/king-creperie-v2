'use client';

import { useCallback, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import CartDrawer from './CartDrawer';

// Barre panier flottante : n'apparaît qu'avec au moins un article,
// jamais sur les pages commande / suivi / admin.
export default function FloatingCartBar() {
  const { totalCount, totalAmount } = useCart();
  const pathname = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const fermer = useCallback(() => setOuvert(false), []);

  if (totalCount === 0 || pathname === '/commande' || pathname === '/suivi' || pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
        <div className="pointer-events-auto max-w-md mx-auto bg-kc-lait text-kc-encre rounded-full shadow-[0_12px_40px_-10px_rgba(0,0,0,0.55)] flex items-center p-1.5 pl-2">
          <button
            onClick={() => setOuvert(true)}
            className="flex-1 flex items-center gap-3 text-left pl-1 pr-2 py-1 rounded-full"
            aria-label={`Voir le panier : ${totalCount} article${totalCount > 1 ? 's' : ''}`}
          >
            <span className="relative w-11 h-11 rounded-full bg-kc-indigo text-kc-beurre flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-kc-caramel text-kc-encre text-xs font-bold flex items-center justify-center">
                {totalCount}
              </span>
            </span>
            <span className="font-display text-xl leading-none">{totalAmount.toLocaleString('fr-FR')} F</span>
          </button>
          <Link
            href="/commande"
            className="bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold px-5 py-3 rounded-full transition-colors shrink-0"
          >
            Commander
          </Link>
        </div>
      </div>

      <CartDrawer isOpen={ouvert} onClose={fermer} />
    </>
  );
}
