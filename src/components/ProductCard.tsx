'use client';

import { motion } from 'framer-motion';
import { Plus, Check, Star, Flame, Sparkles, Leaf, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import { Produit } from '@/types';
import { useCart } from '@/context/CartContext';

interface ProductCardProps {
  produit: Produit;
  onOpenCustomization?: (produit: Produit) => void;
}

export default function ProductCard({ produit, onOpenCustomization }: ProductCardProps) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(produit);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  const renderBadge = () => {
    const nameLower = produit.nom.toLowerCase();
    const descLower = (produit.description || '').toLowerCase();

    // 1. 🍫 Badge Gourmand
    if (nameLower.includes('nutella') || nameLower.includes('bueno') || nameLower.includes('kinder')) {
      return (
        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[10px] font-black px-2.5 py-1 rounded-full border border-amber-200 shadow-sm">
          <Flame className="w-3 h-3 text-amber-600 fill-amber-600" /> Gourmand
        </span>
      );
    }
    // 2. 🌿 Badge Végétarien
    if (nameLower.includes('végé') || descLower.includes('végétarien') || nameLower.includes('légume')) {
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-200 shadow-sm">
          <Leaf className="w-3 h-3 text-emerald-600 fill-emerald-600" /> Végétarien
        </span>
      );
    }
    // 3. ⭐ Badge Best-seller
    if (produit.prix >= 4500) {
      return (
        <span className="inline-flex items-center gap-1 bg-amber-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm">
          <Star className="w-3 h-3 fill-white" /> Best-seller
        </span>
      );
    }
    // 4. 🧀 / ⚡ Badge Formule
    if (String(produit.categorie).toLowerCase() === 'formules') {
      return (
        <span className="inline-flex items-center gap-1 bg-stone-900 text-amber-400 text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm">
          <Sparkles className="w-3 h-3" /> Formule
        </span>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.3 }}
      onClick={() => onOpenCustomization && onOpenCustomization(produit)}
      className="bg-white border border-stone-200/80 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-amber-600/40 hover:shadow-xl transition-all shadow-sm group cursor-pointer"
    >
      <div>
        {/* Photo avec Zoom Hover & Badges */}
        <div className="relative w-full h-48 bg-stone-100 overflow-hidden">
          {produit.image_url ? (
            <Image
              src={produit.image_url}
              alt={produit.nom}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm font-medium">
              Pas de visuel
            </div>
          )}

          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {renderBadge()}
          </div>
        </div>

        {/* Détails du produit */}
        <div className="p-6">
          <div className="flex justify-between items-start gap-2 mb-3">
            <h3 className="text-xl font-bold text-stone-900 font-serif group-hover:text-amber-600 transition-colors">
              {produit.nom}
            </h3>
            <span className="shrink-0 text-amber-700 font-bold bg-amber-50 px-3 py-1 rounded-full text-sm border border-amber-200/60">
              {produit.prix.toLocaleString('fr-FR')} FCFA
            </span>
          </div>

          {produit.description && (
            <p className="text-stone-600 text-sm leading-relaxed line-clamp-3">
              {produit.description}
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-6 pt-0 flex gap-2">
        {onOpenCustomization && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenCustomization(produit);
            }}
            className="p-3 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-700 transition-colors"
            title="Personnaliser"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        )}

        <button
          type="button"
          onClick={handleAdd}
          disabled={!produit.disponible}
          className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            !produit.disponible
              ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
              : added
              ? 'bg-emerald-600 text-white'
              : 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 active:scale-95'
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
              <span>{produit.disponible ? 'Ajouter direct' : 'Épuisé'}</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}