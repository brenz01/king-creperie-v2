'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Check, Plus } from 'lucide-react';
import type { Produit } from '@/types';
import { estPersonnalisable } from '@/lib/extras';

interface PlaqueItemProps {
  produit: Produit;
  onChoisir: (produit: Produit) => void;
  onAjouterDirect: (produit: Produit) => void;
}

export function estEpuise(p: Produit): boolean {
  return !p.disponible || (p.stock_gere === true && p.stock_quantite === 0);
}

// Une crêpe vue du dessus : photo ronde posée sur son assiette, nom et
// prix dessous, rien d'autre. Les détails s'ouvrent au toucher.
export default function PlaqueItem({ produit, onChoisir, onAjouterDirect }: PlaqueItemProps) {
  const [ajoute, setAjoute] = useState(false);
  const epuise = estEpuise(produit);
  const aComposer = estPersonnalisable(produit.categorie);
  const stockBas = !epuise && produit.stock_gere && produit.stock_quantite != null && produit.stock_quantite <= 3;
  const prix = produit.prix.toLocaleString('fr-FR');

  const agir = () => {
    if (epuise) return;
    if (aComposer) {
      onChoisir(produit);
      return;
    }
    onAjouterDirect(produit);
    setAjoute(true);
    window.setTimeout(() => setAjoute(false), 1200);
  };

  return (
    <li className="plaque-item snap-center sm:snap-start shrink-0 w-[52vw] max-w-[15rem] sm:w-52 flex flex-col items-center text-center">
      <button
        type="button"
        onClick={agir}
        disabled={epuise}
        aria-label={
          epuise
            ? `${produit.nom}, épuisé`
            : aComposer
              ? `${produit.nom}, ${prix} francs CFA. Composer`
              : `${produit.nom}, ${prix} francs CFA. Ajouter au panier`
        }
        className="relative w-full aspect-square rounded-full disabled:cursor-not-allowed"
      >
        {/* L'assiette */}
        <span className="absolute inset-0 rounded-full bg-kc-nuit shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)]" />
        {/* La crêpe */}
        <span className={`plaque-photo absolute inset-[7%] rounded-full overflow-hidden bg-kc-nuit ${epuise ? 'grayscale opacity-50' : ''}`}>
          {produit.image_url && (
            <Image
              src={produit.image_url}
              alt=""
              fill
              unoptimized
              sizes="240px"
              className="object-cover"
            />
          )}
        </span>

        {epuise ? (
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-fit bg-kc-lait text-kc-encre text-sm font-semibold px-3 py-1 rounded-full">
            Épuisé
          </span>
        ) : (
          <span
            aria-hidden
            className={`absolute bottom-[4%] right-[4%] w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors ${
              ajoute ? 'bg-kc-lait text-kc-encre' : 'bg-kc-bissap text-white'
            }`}
          >
            {ajoute ? <Check className="w-6 h-6" strokeWidth={3} /> : <Plus className="w-6 h-6" strokeWidth={3} />}
          </span>
        )}
      </button>

      <p className="mt-4 px-2 text-kc-beurre font-semibold text-[0.95rem] leading-snug line-clamp-2 min-h-[2.6em]">
        {produit.nom}
      </p>
      <p className="font-display text-2xl text-kc-caramel leading-none mt-1">
        {prix} <span className="text-base">F</span>
      </p>
      {stockBas && (
        <p className="mt-1.5 text-xs font-semibold text-kc-beurre/80">Plus que {produit.stock_quantite}</p>
      )}
    </li>
  );
}
