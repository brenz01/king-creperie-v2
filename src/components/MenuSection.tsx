'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Produit } from '@/types';
import ProductCard from './ProductCard';
import CategoryTabs from './CategoryTabs';
import ProductModal from './ProductModal';
import { Loader2 } from 'lucide-react';

export default function MenuSection() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('tout');
  const [selectedProduct, setSelectedProduct] = useState<Produit | null>(null);

  useEffect(() => {
    async function fetchProduits() {
      try {
        const { data, error } = await supabase.from('produits').select('*');
        if (error) throw error;
        setProduits(data || []);
      } catch (err) {
        console.error('Erreur chargement menu:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProduits();
  }, []);

  // Filtrage tolérant (gère les différences de pluriel "salees" vs "salee")
  const filtered = produits.filter((p) => {
    if (activeCategory === 'tout') return true;
    const catProduit = String(p.categorie || '').toLowerCase();
    const catFiltre = activeCategory.toLowerCase();
    return (
      catProduit.includes(catFiltre.replace(/s$/, '')) ||
      catFiltre.includes(catProduit)
    );
  });

  return (
    <section id="menu" className="py-16 min-h-screen">
      <div className="text-center mb-6 px-6 max-w-7xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-black font-serif text-stone-900 tracking-tight">
          Notre <span className="text-amber-600">Carte</span>
        </h2>
        <p className="text-stone-600 mt-3 text-base md:text-lg">
          Sélectionnez vos gourmandises préférées et personnalisez vos extras
        </p>
      </div>

      {/* Onglets de catégories Sticky */}
      <CategoryTabs
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
      />

      {/* Grille et état de chargement */}
      <div className="max-w-7xl mx-auto px-6">
        {loading ? (
          <div className="flex justify-center items-center py-20 text-amber-600">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-stone-200/80 p-8 text-stone-500">
            Aucun produit disponible dans cette catégorie pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((produit) => (
              <ProductCard
                key={produit.id}
                produit={produit}
                onOpenCustomization={(p) => setSelectedProduct(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tiroir / Modale de Personnalisation */}
      {selectedProduct && (
        <ProductModal
          produit={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </section>
  );
}