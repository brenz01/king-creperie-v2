'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import CartDrawer from './CartDrawer';

export default function FloatingCartBar() {
  const { totalCount, totalAmount } = useCart();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (totalCount === 0 || pathname === '/commande' || pathname === '/suivi') {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-xl"
        >
          <div className="bg-stone-900 text-white p-4 rounded-xl shadow-2xl flex items-center justify-between border border-stone-800/60">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-3 text-left"
            >
              <div className="relative bg-amber-700 text-white p-2.5 rounded-lg">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-2 -right-2 bg-white text-stone-900 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {totalCount}
                </span>
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-stone-400 tracking-wide">
                  Voir le panier
                </p>
                <p className="font-serif font-semibold text-lg text-white">
                  {totalAmount.toLocaleString('fr-FR')} FCFA
                </p>
              </div>
            </button>

            <Link
              href="/commande"
              className="bg-amber-700 hover:bg-amber-600 text-white font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors text-sm"
            >
              <span>Valider</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>

      <CartDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}