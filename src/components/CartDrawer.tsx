'use client';

import { useEffect } from 'react';
import { useCart, cleLigne } from '@/context/CartContext';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { cart, totalAmount, updateQuantity, removeFromCart } = useCart();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="panier" data-lenis-prevent>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-950/40 backdrop-blur-sm z-50"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Votre panier"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white z-50 shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-700" />
                <h2 className="font-serif text-xl font-semibold text-stone-900">Votre panier</h2>
              </div>
              <button onClick={onClose} aria-label="Fermer le panier" className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-16">
                  <ShoppingBag className="w-12 h-12 text-stone-200 mb-4" />
                  <p className="text-stone-500 font-medium">Votre panier est vide</p>
                  <p className="text-stone-400 text-sm mt-1">Ajoutez des crêpes depuis notre carte</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => {
                    const cle = cleLigne(item.produit);
                    return (
                      <div key={cle} className="flex gap-3 pb-4 border-b border-stone-100 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-stone-900 text-sm leading-snug">{item.produit.nom}</p>
                          <p className="text-xs text-amber-700 font-medium mt-1">
                            {item.produit.prix.toLocaleString('fr-FR')} FCFA
                          </p>

                          <div className="flex items-center gap-2 mt-3">
                            <button
                              onClick={() => updateQuantity(cle, -1)}
                              aria-label="Retirer un"
                              className="w-7 h-7 rounded-md bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-sm font-bold w-5 text-center text-stone-900">{item.quantite}</span>
                            <button
                              onClick={() => updateQuantity(cle, 1)}
                              aria-label="Ajouter un"
                              className="w-7 h-7 rounded-md bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => removeFromCart(cle)}
                              aria-label="Supprimer l'article"
                              className="ml-2 text-rose-500 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <span className="font-serif font-semibold text-stone-900 text-sm shrink-0">
                          {(item.produit.prix * item.quantite).toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-stone-100 px-6 py-5 bg-stone-50 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-stone-600">Sous-total</span>
                  <span className="font-serif text-lg font-semibold text-stone-900">
                    {totalAmount.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <p className="text-xs text-stone-400 mb-4">Frais de livraison calculés à l&apos;étape suivante</p>
                <Link
                  href="/commande"
                  onClick={onClose}
                  className="w-full bg-stone-900 hover:bg-amber-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Passer la commande</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
