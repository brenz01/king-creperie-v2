'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Check, Plus } from 'lucide-react';
import type { Produit } from '@/types';
import { estPersonnalisable } from '@/lib/extras';
import { confirmerAjout } from '@/lib/toast';

interface PlaqueItemProps {
  produit: Produit;
  disposition?: 'rang' | 'grille';
  onChoisir: (produit: Produit) => void;
  onAjouterDirect: (produit: Produit) => void;
}

export function estEpuise(p: Produit): boolean {
  return !p.disponible || (p.stock_gere === true && p.stock_quantite === 0);
}

// Une crêpe vue du dessus : photo ronde posée sur son assiette, nom et
// prix dessous, rien d'autre. Les détails s'ouvrent au toucher.
export default function PlaqueItem({ produit, disposition = 'rang', onChoisir, onAjouterDirect }: PlaqueItemProps) {
  const rang = disposition === 'rang';
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
    confirmerAjout('Ajouté au panier');
    setAjoute(true);
    window.setTimeout(() => setAjoute(false), 1200);
  };

  return (
    <li
      className={
        rang
          ? 'plaque-item snap-center sm:snap-start shrink-0 w-[52vw] max-w-[15rem] sm:w-52 lg:w-auto lg:max-w-none flex flex-col items-center text-center'
          : 'flex flex-col items-center text-center'
      }
    >
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
        className={`relative w-full aspect-square rounded-full disabled:cursor-not-allowed ${ajoute ? 'plaque-pop' : ''}`}
      >
        {/* L'assiette */}
        <span className="absolute inset-0 rounded-full bg-kc-nuit shadow-[0_22px_40px_-18px_rgba(22,30,69,0.6)]" />
        {/* La crêpe */}
        <span
          className={`${rang ? 'plaque-photo ' : ''}absolute inset-[7%] rounded-full overflow-hidden bg-kc-nuit ${epuise ? 'grayscale opacity-50' : ''}`}
        >
          {produit.image_url && <Image src={produit.image_url} alt="" fill unoptimized sizes="240px" className="object-cover" />}
        </span>

        {epuise ? (
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-fit bg-kc-lait text-kc-encre text-sm font-semibold px-3 py-1 rounded-full">
            Épuisé pour le moment
          </span>
        ) : (
          <span
            aria-hidden
            className={`absolute bottom-[4%] right-[4%] ${rang ? 'w-12 h-12' : 'w-11 h-11'} rounded-full flex items-center justify-center shadow-lg transition-colors ${
              ajoute ? 'bg-kc-lait text-kc-encre' : 'bg-kc-bissap text-white'
            }`}
          >
            {ajoute ? <Check className="w-6 h-6" strokeWidth={3} /> : <Plus className="w-6 h-6" strokeWidth={3} />}
          </span>
        )}
      </button>

      <p
        className={`${rang ? 'mt-4 text-base' : 'mt-3 text-[0.95rem]'} px-1 text-kc-encre font-semibold leading-snug line-clamp-2 min-h-[2.6em]`}
      >
        {produit.nom}
      </p>
      <p className="prix text-xl text-kc-bissap leading-none mt-1.5">{prix} F</p>
      {stockBas && <p className="mt-1.5 text-sm font-semibold text-kc-encre/60">Plus que {produit.stock_quantite}</p>}
    </li>
  );
}
