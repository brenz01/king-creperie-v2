'use client';

import { useEffect, useState } from 'react';
import type { Produit } from '@/types';
import type { Extra } from '@/lib/extras';
import { useCart } from '@/context/CartContext';
import { motion } from 'framer-motion';
import { X, Plus, Minus, Check } from 'lucide-react';
import Image from 'next/image';

interface ProductModalProps {
  produit: Produit;
  extras: readonly Extra[];
  onClose: () => void;
}

export default function ProductModal({ produit, extras, onClose }: ProductModalProps) {
  const { addToCart } = useCart();
  const [selection, setSelection] = useState<Extra[]>([]);
  const [quantite, setQuantite] = useState(1);

  // Échap pour fermer + blocage du scroll de la page derrière.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const toggle = (extra: Extra) =>
    setSelection((prev) =>
      prev.some((e) => e.id === extra.id) ? prev.filter((e) => e.id !== extra.id) : [...prev, extra]
    );

  const prixUnitaire = produit.prix + selection.reduce((s, e) => s + e.prix, 0);
  const prixFinal = prixUnitaire * quantite;

  const ajouter = () => {
    if (!produit.disponible) return;
    const nomComplet = selection.length > 0
      ? `${produit.nom} (${selection.map((s) => s.nom).join(', ')})`
      : produit.nom;
    addToCart(
      {
        ...produit,
        nom: nomComplet,
        prix: prixUnitaire,
        prixBase: produit.prix,
        extrasChoisis: selection.map((s) => ({ id: s.id, nom: s.nom, prix: s.prix })),
      },
      quantite
    );
    onClose();
  };

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-950/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-produit"
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto overscroll-contain shadow-2xl flex flex-col"
      >
        <div className="relative h-52 w-full bg-stone-100 shrink-0">
          {produit.image_url && (
            <Image src={produit.image_url} alt={produit.nom} fill unoptimized sizes="512px" className="object-cover" />
          )}
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-4 right-4 bg-white/90 backdrop-blur-md p-2 rounded-full text-stone-800 hover:bg-white transition-colors shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          <div>
            <h3 id="titre-produit" className="font-serif text-2xl font-semibold text-stone-900">{produit.nom}</h3>
            {produit.description && (
              <p className="text-sm text-stone-500 mt-1 leading-relaxed">{produit.description}</p>
            )}
          </div>

          {extras.length > 0 && (
            <div>
              <p className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-3">
                Ajouter des extras gourmands
              </p>
              <div className="flex flex-wrap gap-2">
                {extras.map((extra) => {
                  const actif = selection.some((s) => s.id === extra.id);
                  return (
                    <button
                      key={extra.id}
                      type="button"
                      aria-pressed={actif}
                      onClick={() => toggle(extra)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                        actif ? 'bg-stone-900 text-white scale-[1.02]' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {actif && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      <span>{extra.nom}</span>
                      <span className="text-stone-400">+{extra.prix} FCFA</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-stone-100">
            <span className="text-sm font-semibold text-stone-700">Quantité</span>
            <div className="flex items-center gap-3 bg-stone-100 p-1 rounded-lg">
              <button
                type="button"
                aria-label="Diminuer la quantité"
                onClick={() => setQuantite((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-md bg-white text-stone-800 flex items-center justify-center font-bold shadow-sm hover:bg-stone-50"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-6 text-center font-bold text-stone-900">{quantite}</span>
              <button
                type="button"
                aria-label="Augmenter la quantité"
                onClick={() => setQuantite((q) => Math.min(20, q + 1))}
                className="w-8 h-8 rounded-md bg-white text-stone-800 flex items-center justify-center font-bold shadow-sm hover:bg-stone-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 bg-stone-50 border-t border-stone-100 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={ajouter}
            disabled={!produit.disponible}
            className="w-full bg-stone-900 hover:bg-amber-700 text-white font-bold py-4 rounded-xl flex items-center justify-between px-6 transition-colors active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{produit.disponible ? 'Ajouter au panier' : 'Indisponible'}</span>
            <motion.span
              key={prixFinal}
              initial={{ scale: 1.15 }}
              animate={{ scale: 1 }}
              className="font-serif bg-white/15 px-3 py-1 rounded-lg text-sm"
            >
              {prixFinal.toLocaleString('fr-FR')} FCFA
            </motion.span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
