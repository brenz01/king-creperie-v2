'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Produit, CategorieProduit } from '@/types';
import ProductCard from './ProductCard';
import { Loader2 } from 'lucide-react';

export default function MenuSection() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CategorieProduit | 'toutes'>('toutes');

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

  const filtered = activeTab === 'toutes'
    ? produits
    : produits.filter((p) => p.categorie === activeTab);

  return (
    <section id="menu" className="py-24 px-6 max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-4xl md:text-5xl font-black font-serif text-white tracking-tight">
          Notre <span className="text-amber-400">Carte</span>
        </h2>
        <p className="text-slate-400 mt-3 text-base md:text-lg">
          Sélectionnez vos gourmandises préférées
        </p>

        {/* Onglets */}
        <div className="flex flex-wrap justify-center gap-2 mt-8">
          {[
            { id: 'toutes', label: 'Toutes' },
            { id: 'salee', label: 'Crêpes Salées' },
            { id: 'sucree', label: 'Crêpes Sucrées' },
            { id: 'boisson', label: 'Boissons' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-amber-400">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          Aucun produit disponible dans cette catégorie pour le moment.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((produit) => (
            <ProductCard key={produit.id} produit={produit} />
          ))}
        </div>
      )}
    </section>
  );
}