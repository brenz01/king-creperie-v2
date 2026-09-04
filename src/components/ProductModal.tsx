'use client';

import { useState } from 'react';
import { Produit } from '@/types';
import { useCart } from '@/context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Check } from 'lucide-react';
import Image from 'next/image';

interface Ingredient {
  id: string;
  nom: string;
  prix: number;
}

const SUPPLEMENTS: Ingredient[] = [
  { id: 'nutella', nom: 'Extra Nutella 🍫', prix: 500 },
  { id: 'banane', nom: 'Banane fraîche 🍌', prix: 300 },
  { id: 'chantilly', nom: 'Chantilly Maison 🍦', prix: 400 },
  { id: 'kinder', nom: 'Bueno / Kinder 🍫', prix: 700 },
  { id: 'speculoos', nom: 'Éclats de Spéculoos 🍪', prix: 400 },
  { id: 'fromage', nom: 'Double Fromage 🧀', prix: 500 },
];

interface ProductModalProps {
  produit: Produit | null;
  onClose: () => void;
}

export default function ProductModal({ produit, onClose }: ProductModalProps) {
  const { addToCart } = useCart();
  const [selectedSupplements, setSelectedSupplements] = useState<Ingredient[]>([]);
  const [quantite, setQuantite] = useState(1);

  if (!produit) return null;

  const toggleSupplement = (supp: Ingredient) => {
    setSelectedSupplements((prev) =>
      prev.some((item) => item.id === supp.id)
        ? prev.filter((item) => item.id !== supp.id)
        : [...prev, supp]
    );
  };

  const prixSupplements = selectedSupplements.reduce((acc, curr) => acc + curr.prix, 0);
  const prixUnitaireTotal = produit.prix + prixSupplements;
  const prixFinal = prixUnitaireTotal * quantite;

  const handleAddToCart = () => {
  const nomComplet =
    selectedSupplements.length > 0
      ? `${produit.nom} (${selectedSupplements.map((s) => s.nom).join(', ')})`
      : produit.nom;

  for (let i = 0; i < quantite; i++) {
    addToCart({
      ...produit,
      nom: nomComplet,
      prix: prixUnitaireTotal,      // prix affiché (produit + extras) — inchangé pour l'UI
      prixBase: produit.prix,       // prix du produit SEUL, sans extras
      extrasChoisis: selectedSupplements.map((s) => ({ id: s.id, nom: s.nom, prix: s.prix })),
    });
  }
  onClose();
};

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-sm p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-100 flex flex-col"
        >
          <div className="relative h-52 w-full bg-stone-100 shrink-0">
            {produit.image_url && (
              <Image
                src={produit.image_url}
                alt={produit.nom}
                fill
                unoptimized
                className="object-cover"
              />
            )}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 bg-white/80 backdrop-blur-md p-2 rounded-full text-stone-800 hover:bg-white transition-colors shadow-sm"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 flex-1">
            <div>
              <h3 className="text-2xl font-serif font-black text-stone-900">{produit.nom}</h3>
              {produit.description && (
                <p className="text-sm text-stone-500 mt-1 leading-relaxed">{produit.description}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">
                Ajouter des extras gourmands
              </label>
              <div className="flex flex-wrap gap-2">
                {SUPPLEMENTS.map((supp) => {
                  const isSelected = selectedSupplements.some((s) => s.id === supp.id);
                  return (
                    <button
                      key={supp.id}
                      type="button"
                      onClick={() => toggleSupplement(supp)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20 scale-105'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                      <span>{supp.nom}</span>
                      <span className={isSelected ? 'text-amber-200' : 'text-stone-400'}>
                        +{supp.prix} FCFA
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-stone-100">
              <span className="text-sm font-bold text-stone-700">Quantité</span>
              <div className="flex items-center gap-3 bg-stone-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setQuantite((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg bg-white text-stone-800 flex items-center justify-center font-bold shadow-sm hover:bg-stone-50"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-6 text-center font-bold text-stone-900">{quantite}</span>
                <button
                  type="button"
                  onClick={() => setQuantite((q) => q + 1)}
                  className="w-8 h-8 rounded-lg bg-white text-stone-800 flex items-center justify-center font-bold shadow-sm hover:bg-stone-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 bg-stone-50 border-t border-stone-100">
            <button
              type="button"
              onClick={handleAddToCart}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-4 rounded-2xl flex items-center justify-between px-6 transition-all shadow-lg shadow-amber-600/20 active:scale-98"
            >
              <span>Ajouter au panier</span>
              <motion.span
                key={prixFinal}
                initial={{ scale: 1.15 }}
                animate={{ scale: 1 }}
                className="bg-amber-700/50 px-3 py-1 rounded-xl text-sm"
              >
                {prixFinal.toLocaleString('fr-FR')} FCFA
              </motion.span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}