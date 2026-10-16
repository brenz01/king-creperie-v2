'use client';

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Produit } from '@/types';
import PlaqueItem from './PlaqueItem';

interface PlaqueRailProps {
  id: string;
  titre: string;
  unite: string;
  produits: Produit[];
  onChoisir: (produit: Produit) => void;
  onAjouterDirect: (produit: Produit) => void;
}

// Une rangée = une catégorie. On fait glisser au doigt (snap au centre) ;
// sur ordinateur, des flèches font avancer d'un écran.
export default function PlaqueRail({ id, titre, unite, produits, onChoisir, onAjouterDirect }: PlaqueRailProps) {
  const rail = useRef<HTMLUListElement>(null);
  // « Tout voir » : toute la rubrique d'un coup, pour qui sait déjà ce
  // qu'il veut. « Faire défiler » revient à la plaque.
  const [grille, setGrille] = useState(false);

  const defiler = (sens: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    el.scrollBy({ left: sens * el.clientWidth * 0.7, behavior: 'smooth' });
  };

  if (produits.length === 0) return null;

  return (
    <section id={id} aria-labelledby={`${id}-titre`} className="scroll-mt-32 pt-10 first:pt-4">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 flex items-end justify-between gap-4">
        <div>
          <h3 id={`${id}-titre`} className="font-display text-[2rem] sm:text-4xl leading-none text-kc-indigo">
            {titre}
          </h3>
          <p className="mt-2 text-sm text-kc-encre/60">
            {produits.length} {unite}
          </p>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setGrille((g) => !g)}
            aria-pressed={grille}
            className="h-11 px-4 shrink-0 whitespace-nowrap rounded-full border border-kc-indigo/30 text-kc-indigo text-sm font-semibold hover:border-kc-indigo transition-colors"
          >
            {grille ? 'Afficher en rangée' : 'Tout voir'}
          </button>
          {!grille && (
            <>
              <button
                type="button"
                onClick={() => defiler(-1)}
                aria-label={`${titre} : précédents`}
                className="hidden sm:flex w-11 h-11 rounded-full border border-kc-indigo/30 text-kc-indigo hover:border-kc-indigo items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => defiler(1)}
                aria-label={`${titre} : suivants`}
                className="hidden sm:flex w-11 h-11 rounded-full border border-kc-indigo/30 text-kc-indigo hover:border-kc-indigo items-center justify-center transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {grille ? (
        <ul className="max-w-6xl mx-auto px-5 sm:px-6 mt-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-7">
          {produits.map((p) => (
            <PlaqueItem key={p.id} produit={p} disposition="grille" onChoisir={onChoisir} onAjouterDirect={onAjouterDirect} />
          ))}
        </ul>
      ) : (
        <ul
          ref={rail}
          className="mt-4 flex gap-1 sm:gap-6 overflow-x-auto overscroll-x-contain snap-x snap-mandatory sm:snap-proximity scrollbar-none py-4 px-[24vw] sm:px-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] sm:scroll-px-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] lg:grid lg:grid-cols-5 lg:gap-x-6 lg:gap-y-8 lg:overflow-visible lg:max-w-6xl lg:mx-auto lg:px-6"
        >
          {produits.map((p) => (
            <PlaqueItem key={p.id} produit={p} onChoisir={onChoisir} onAjouterDirect={onAjouterDirect} />
          ))}
        </ul>
      )}
    </section>
  );
}
