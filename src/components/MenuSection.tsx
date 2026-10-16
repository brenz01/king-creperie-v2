'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Produit } from '@/types';
import type { Extra } from '@/lib/extras';
import { chargerExtras, chargerProduits } from '@/lib/catalogue';
import ProductCard from './ProductCard';
import CategoryTabs, { CATEGORIES } from './CategoryTabs';
import ProductModal from './ProductModal';
import { Loader2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';

interface MenuSectionProps {
  // Rendu serveur (SEO + affichage immédiat). null = échec du fetch
  // serveur : on attend le chargement client.
  produitsInitiaux: Produit[] | null;
  extrasInitiaux: Extra[];
}

export default function MenuSection({ produitsInitiaux, extrasInitiaux }: MenuSectionProps) {
  const [produits, setProduits] = useState<Produit[] | null>(produitsInitiaux);
  const [extras, setExtras] = useState<Extra[]>(extrasInitiaux);
  const [activeCategory, setActiveCategory] = useState('tout');
  const [selectedProduct, setSelectedProduct] = useState<Produit | null>(null);
  const [erreur, setErreur] = useState(false);
  const { synchroniser } = useCart();

  // Rafraîchissement silencieux : la page est mise en cache (ISR), le
  // stock et la disponibilité sont donc rechargés au montage.
  useEffect(() => {
    let actif = true;
    void Promise.all([chargerProduits(), chargerExtras()]).then(([p, e]) => {
      if (!actif) return;
      if (p) {
        setProduits(p);
        synchroniser(p, e);
      } else setErreur(true);
      setExtras(e);
    });
    return () => {
      actif = false;
    };
  }, [synchroniser]);

  const categories = useMemo(
    () => CATEGORIES.filter((c) => c.id === 'tout' || produits?.some((p) => p.categorie === c.id)),
    [produits]
  );

  const filtres = useMemo(
    () => (produits ?? []).filter((p) => activeCategory === 'tout' || p.categorie === activeCategory),
    [produits, activeCategory]
  );

  return (
    <section id="menu" className="py-16 min-h-screen scroll-mt-16">
      <div className="text-center mb-6 px-6 max-w-7xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-black font-serif text-stone-900 tracking-tight">
          Notre <span className="text-amber-600">Carte</span>
        </h2>
        <p className="text-stone-600 mt-3 text-base md:text-lg">
          Sélectionnez vos gourmandises préférées et personnalisez vos extras
        </p>
      </div>

      <CategoryTabs categories={categories} activeCategory={activeCategory} onSelectCategory={setActiveCategory} />

      <div className="max-w-7xl mx-auto px-6">
        {produits === null ? (
          erreur ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-stone-200/80 p-8 text-stone-500">
              Impossible de charger la carte. Vérifiez votre connexion puis rechargez la page.
            </div>
          ) : (
            <div className="flex justify-center items-center py-20 text-amber-600" aria-label="Chargement de la carte">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          )
        ) : filtres.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-stone-200/80 p-8 text-stone-500">
            Aucun produit disponible dans cette catégorie pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtres.map((produit) => (
              <ProductCard key={produit.id} produit={produit} onOpenCustomization={setSelectedProduct} />
            ))}
          </div>
        )}
      </div>

      {selectedProduct && (
        <ProductModal produit={selectedProduct} extras={extras} onClose={() => setSelectedProduct(null)} />
      )}
    </section>
  );
}
