'use client';

import { motion } from 'framer-motion';
import { Plus, Check, Star, Flame, Leaf, SlidersHorizontal } from 'lucide-react';
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

  const estPersonnalisable = produit.categorie === 'salee' || produit.categorie === 'sucree';
  const estBestSeller = produit.prix >= 4500;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(produit);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  const renderBadge = () => {
    const nameLower = produit.nom.toLowerCase();
    const descLower = (produit.description || '').toLowerCase();

    if (nameLower.includes('nutella') || nameLower.includes('bueno') || nameLower.includes('kinder')) {
      return (
        <span className="inline-flex items-center gap-1 bg-white/95 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
          <Flame className="w-3 h-3" /> Gourmand
        </span>
      );
    }
    if (nameLower.includes('végé') || descLower.includes('végétarien') || nameLower.includes('légume')) {
      return (
        <span className="inline-flex items-center gap-1 bg-white/95 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
          <Leaf className="w-3 h-3" /> Végétarien
        </span>
      );
    }
    return null;
  };

  const renderBadgeStock = () => {
    if (!produit.stock_gere || produit.stock_quantite === null || produit.stock_quantite === undefined) {
      return null;
    }
    if (produit.stock_quantite === 0) {
      return (
        <span className="inline-flex items-center gap-1 bg-stone-800/90 text-stone-200 text-[10px] font-bold px-2.5 py-1 rounded-full">
          Épuisé
        </span>
      );
    }
    if (produit.stock_quantite <= 3) {
      return (
        <span className="inline-flex items-center gap-1 bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
          Plus que {produit.stock_quantite}
        </span>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35 }}
      onClick={() => estPersonnalisable && onOpenCustomization && onOpenCustomization(produit)}
      className={`group bg-white rounded-xl overflow-hidden flex flex-col border transition-all ${
        estBestSeller ? 'border-t-[3px] border-t-amber-700 border-x-stone-200/70 border-b-stone-200/70' : 'border-stone-200/70'
      } hover:shadow-[0_12px_32px_-12px_rgba(42,27,18,0.18)] hover:-translate-y-0.5 ${
        estPersonnalisable ? 'cursor-pointer' : ''
      }`}
    >
      <div className="relative w-full aspect-[4/3] bg-stone-100 overflow-hidden">
        {produit.image_url ? (
          <Image
            src={produit.image_url}
            alt={produit.nom}
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm">
            Pas de visuel
          </div>
        )}

        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {estBestSeller && (
            <span className="inline-flex items-center gap-1 bg-amber-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
              <Star className="w-3 h-3 fill-white" /> Best-seller
            </span>
          )}
          {renderBadge()}
          {renderBadgeStock()}
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start gap-3 mb-2">
          <h3 className="font-serif text-lg font-semibold text-stone-900 leading-snug group-hover:text-amber-800 transition-colors">
            {produit.nom}
          </h3>
          <span className="shrink-0 font-serif text-base font-semibold text-amber-800 pt-0.5">
            {produit.prix.toLocaleString('fr-FR')}
          </span>
        </div>

        {produit.description && (
          <p className="text-stone-500 text-[13px] leading-relaxed line-clamp-2 mb-4">
            {produit.description}
          </p>
        )}

        <div className="mt-auto flex gap-2 pt-1">
          {onOpenCustomization && estPersonnalisable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCustomization(produit);
              }}
              className="p-2.5 rounded-lg border border-stone-200 hover:border-stone-900 hover:bg-stone-900 hover:text-white text-stone-600 transition-colors"
              title="Personnaliser"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleAdd}
            disabled={!produit.disponible}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              !produit.disponible
                ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                : added
                ? 'bg-emerald-700 text-white'
                : 'bg-stone-900 hover:bg-amber-700 text-white active:scale-[0.98]'
            }`}
          >
            {added ? (
              <>
                <Check className="w-4 h-4" />
                <span>Ajouté</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>{produit.disponible ? 'Ajouter' : 'Épuisé'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}