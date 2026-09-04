'use client';

import { useCart } from '@/context/CartContext';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function FloatingCartBar() {
  const { totalCount, totalAmount } = useCart();
  const pathname = usePathname();

  // Cacher la barre sur les pages de commande et de suivi
  if (totalCount === 0 || pathname === '/commande' || pathname === '/suivi') {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-xl"
      >
        <div className="bg-stone-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-stone-800/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative bg-amber-600 text-white p-2.5 rounded-xl shadow-inner">
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 bg-stone-900 text-amber-400 text-xs font-black rounded-full h-5 w-5 flex items-center justify-center border border-amber-500/30">
                {totalCount}
              </span>
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-stone-400 tracking-wider">
                Votre commande
              </p>
              <p className="font-extrabold text-lg text-stone-50">
                {totalAmount.toLocaleString('fr-FR')} FCFA
              </p>
            </div>
          </div>

          <Link
            href="/commande"
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95 text-sm shadow-md shadow-amber-600/20"
          >
            <span>Valider</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}