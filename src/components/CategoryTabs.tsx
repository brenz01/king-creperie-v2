'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import type { CategorieProduit } from '@/types';
import InfoBulle from './ui/InfoBulle';
import { CATEGORIES_PRODUIT } from '@/lib/categories';

export type IdCategorie = 'tout' | CategorieProduit;

export interface Category {
  id: IdCategorie;
  nom: string;
}

// Seules les rubriques qui contiennent au moins un produit sont affichées
// (filtrage dans MenuSection) : « Gaufres » ou « Autres » n'apparaissent
// qu'une fois un premier produit ajouté depuis KC Staff.
export const CATEGORIES: Category[] = [
  { id: 'tout', nom: 'Tout' },
  ...CATEGORIES_PRODUIT.map((c) => ({ id: c.id, nom: c.onglet })),
];

interface CategoryTabsProps {
  categories: Category[];
  activeCategory: IdCategorie;
  onSelectCategory: (id: IdCategorie) => void;
  recherche: string;
  onRecherche: (texte: string) => void;
  rechercheOuverte: boolean;
  onRechercheOuverte: (ouverte: boolean) => void;
}

// Barre collée sous l'en-tête, crème translucide : les rubriques, et la
// loupe qui remplace les rubriques par le champ de recherche.
export default function CategoryTabs({
  categories,
  activeCategory,
  onSelectCategory,
  recherche,
  onRecherche,
  rechercheOuverte,
  onRechercheOuverte,
}: CategoryTabsProps) {
  const champ = useRef<HTMLInputElement>(null);
  // Plus de rubriques que de place (téléphone) : la barre défile. Un fondu
  // au bord signale les rubriques cachées, et la rubrique touchée se recentre.
  const barre = useRef<HTMLDivElement>(null);
  const [cache, setCache] = useState({ gauche: false, droite: false });
  const mesurer = useCallback(() => {
    const b = barre.current;
    if (!b) return;
    setCache({ gauche: b.scrollLeft > 4, droite: b.scrollLeft + b.clientWidth < b.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    const b = barre.current;
    if (!b) return;
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(b);
    return () => obs.disconnect();
  }, [mesurer, categories.length, rechercheOuverte]);
  const masque =
    cache.gauche || cache.droite
      ? `linear-gradient(to right, ${cache.gauche ? 'transparent 0, black 1.75rem' : 'black 0'}, ${
          cache.droite ? 'black calc(100% - 1.75rem), transparent 100%' : 'black 100%'
        })`
      : undefined;

  return (
    <div className="verre-clair sticky top-[calc(4rem+env(safe-area-inset-top))] z-30 bg-creme/90 backdrop-blur-md border-b border-stone-300/80">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center gap-1 sm:gap-2">
        {rechercheOuverte ? (
          <label className="kc-fondu relative flex-1 min-w-0 flex items-center gap-3">
            <span className="sr-only sm:not-sr-only sm:shrink-0 text-sm font-semibold text-stone-700">Chercher</span>
            <span className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute z-10 left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-stone-500" />
            <input
              ref={champ}
              id="recherche-carte"
              type="search"
              inputMode="search"
              autoComplete="off"
              autoFocus
              value={recherche}
              onChange={(e) => onRecherche(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && onRechercheOuverte(false)}
              placeholder="nutella, poulet, bissap…"
              className="w-full h-11 rounded-full bg-white border border-stone-300 pl-10 pr-4 text-base text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
            />
            </span>
          </label>
        ) : (
          <div
            ref={barre}
            role="group"
            aria-label="Catégories"
            onScroll={mesurer}
            style={{ maskImage: masque, WebkitMaskImage: masque }}
            className="flex-1 min-w-0 overflow-x-auto scrollbar-none flex gap-0.5 sm:gap-1.5"
          >
            {categories.map((cat) => {
              const actif = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={actif}
                  onClick={(e) => {
                    onSelectCategory(cat.id);
                    e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
                  }}
                  className={`appui relative h-11 px-2.5 min-[380px]:px-3 sm:px-4 rounded-full text-[0.9rem] sm:text-[0.95rem] font-semibold whitespace-nowrap transition-colors ${
                    actif ? 'text-white' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {actif && (
                    <motion.span
                      layoutId="rubriqueActive"
                      className="absolute inset-0 bg-stone-900 rounded-full"
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                  <span className="relative z-10">{cat.nom}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Icône seule sur téléphone (avec info-bulle), icône + texte au-delà. */}
        <InfoBulle libelle={rechercheOuverte ? 'Fermer la recherche' : 'Chercher une crêpe'} cote="gauche">
          <button
            type="button"
            onClick={() => {
              if (rechercheOuverte) onRecherche('');
              onRechercheOuverte(!rechercheOuverte);
            }}
            aria-label={rechercheOuverte ? 'Fermer la recherche' : 'Chercher une crêpe'}
            aria-expanded={rechercheOuverte}
            className={`appui shrink-0 h-11 -mr-1 sm:mr-0 rounded-full flex items-center justify-center gap-2 text-stone-700 pointer-fine:hover:bg-white pointer-fine:hover:text-stone-900 ${
              rechercheOuverte ? 'w-11' : 'w-11 sm:w-auto sm:px-4 sm:border sm:border-stone-300 sm:bg-white'
            }`}
          >
            {rechercheOuverte ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            {!rechercheOuverte && <span className="hidden sm:inline text-sm font-semibold">Chercher</span>}
          </button>
        </InfoBulle>
      </div>
    </div>
  );
}
