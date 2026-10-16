'use client';

import { motion } from 'framer-motion';

export interface Category {
  id: string;
  nom: string;
  icon: string;
}

export const CATEGORIES: Category[] = [
  { id: 'tout', nom: 'Toute la carte', icon: '👑' },
  { id: 'salee', nom: 'Crêpes Salées', icon: '🧀' },
  { id: 'sucree', nom: 'Crêpes Sucrées', icon: '🍫' },
  { id: 'boisson', nom: 'Boissons', icon: '🥤' },
];

interface CategoryTabsProps {
  categories: Category[];
  activeCategory: string;
  onSelectCategory: (id: string) => void;
}

export default function CategoryTabs({ categories, activeCategory, onSelectCategory }: CategoryTabsProps) {
  return (
    <div className="sticky top-16 sm:top-20 z-30 bg-brand-cream/90 backdrop-blur-md py-4 border-b border-stone-200/70 mb-8">
      <div role="tablist" aria-label="Catégories" className="max-w-7xl mx-auto px-6 overflow-x-auto scrollbar-none flex gap-2">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectCategory(cat.id)}
              className={`relative px-5 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                isActive ? 'text-white' : 'text-stone-600 hover:text-stone-900 bg-white border border-stone-200/80'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activePill"
                  className="absolute inset-0 bg-stone-900 rounded-lg"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <span aria-hidden>{cat.icon}</span>
                <span>{cat.nom}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
