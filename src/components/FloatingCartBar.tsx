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
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-xl"
      >
        <div className="bg-amber-500 text-slate-950 p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-amber-400/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative bg-slate-950 text-amber-400 p-2.5 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-black rounded-full h-5 w-5 flex items-center justify-center">
                {totalCount}
              </span>
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-slate-900/70 tracking-wider">
                Votre commande
              </p>
              <p className="font-extrabold text-lg">
                {totalAmount.toLocaleString('fr-FR')} FCFA
              </p>
            </div>
          </div>

          <Link
            href="/commande"
            className="bg-slate-950 hover:bg-slate-900 text-amber-400 font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95 text-sm"
          >
            <span>Valider</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}