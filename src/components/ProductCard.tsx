'use client';

import { motion } from 'framer-motion';
import { Plus, Check } from 'lucide-react';
import { useState } from 'react';
import { Produit } from '@/types';
import { useCart } from '@/context/CartContext';

export default function ProductCard({ produit }: { produit: Produit }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addToCart(produit);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.3 }}
      className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-amber-500/40 transition-colors shadow-lg group"
    >
      <div>
        {/* Photo du produit */}
        <div className="relative w-full h-48 bg-slate-800 overflow-hidden">
          {produit.image_url ? (
            <img
              src={produit.image_url}
              alt={produit.nom}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm font-medium">
              Pas de visuel
            </div>
          )}
        </div>

        {/* Détails du produit */}
        <div className="p-6">
          <div className="flex justify-between items-start gap-2 mb-3">
            <h3 className="text-xl font-bold text-white font-serif">{produit.nom}</h3>
            <span className="shrink-0 text-amber-400 font-bold bg-amber-500/10 px-3 py-1 rounded-full text-sm border border-amber-500/20">
              {produit.prix.toLocaleString('fr-FR')} FCFA
            </span>
          </div>

          {produit.description && (
            <p className="text-slate-400 text-sm leading-relaxed line-clamp-3">
              {produit.description}
            </p>
          )}
        </div>
      </div>

      <div className="p-6 pt-0">
        <button
          onClick={handleAdd}
          disabled={!produit.disponible}
          className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            !produit.disponible
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : added
              ? 'bg-emerald-500 text-slate-950'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-95'
          }`}
        >
          {added ? (
            <>
              <Check className="w-5 h-5" />
              <span>Ajouté !</span>
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              <span>{produit.disponible ? 'Ajouter au panier' : 'Épuisé'}</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}