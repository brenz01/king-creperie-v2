'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CategorieProduit, Produit } from '@/types';
import type { Extra } from '@/lib/extras';
import { chargerExtras, chargerProduits } from '@/lib/catalogue';
import { useCart } from '@/context/CartContext';
import { estEpuise } from '@/lib/produit';
import ProductCard from './ProductCard';
import CategoryTabs, { CATEGORIES, type IdCategorie } from './CategoryTabs';
import ProductModal from './ProductModal';
import { AvisFermeture } from './StatutBoutique';
import { ORDRE_CATEGORIES } from '@/lib/categories';

interface MenuSectionProps {
  // Rendu serveur (SEO + affichage immédiat).
  produitsInitiaux: Produit[] | null;
  extrasInitiaux: Extra[];
}

const ORDRE: readonly CategorieProduit[] = ORDRE_CATEGORIES;

// Par rubrique, les produits disponibles d'abord, les épuisés à la fin.
function trier(produits: Produit[]): Produit[] {
  return [...produits].sort(
    (a, b) =>
      ORDRE.indexOf(a.categorie) - ORDRE.indexOf(b.categorie) ||
      Number(estEpuise(a)) - Number(estEpuise(b)) ||
      a.prix - b.prix,
  );
}

// Recherche tolérante : sans accents ni majuscules (« creme » trouve « crème »).
const normaliser = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function MenuSection({ produitsInitiaux, extrasInitiaux }: MenuSectionProps) {
  const [produits, setProduits] = useState<Produit[] | null>(produitsInitiaux);
  const [extras, setExtras] = useState<Extra[]>(extrasInitiaux);
  const [categorie, setCategorie] = useState<IdCategorie>('tout');
  const [selection, setSelection] = useState<Produit | null>(null);
  const [erreur, setErreur] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
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
        // Lien partagé « ?produit=<id> » : ouvre directement la fiche.
        const partage = new URLSearchParams(window.location.search).get('produit');
        const cible = partage ? p.find((x) => x.id === partage && !estEpuise(x)) : undefined;
        if (cible) setSelection(cible);
      } else setErreur(true);
      setExtras(e);
    });
    return () => {
      actif = false;
    };
  }, [synchroniser]);

  const tries = useMemo(() => trier(produits ?? []), [produits]);

  const categories = useMemo(
    () => CATEGORIES.filter((c) => c.id === 'tout' || tries.some((p) => p.categorie === c.id)),
    [tries],
  );

  const terme = normaliser(recherche.trim());
  const affiches = useMemo(
    () =>
      terme
        ? tries.filter((p) => normaliser(`${p.nom} ${p.description ?? ''}`).includes(terme))
        : tries.filter((p) => categorie === 'tout' || p.categorie === categorie),
    [tries, categorie, terme],
  );

  const choisir = (id: IdCategorie) => {
    setCategorie(id);
    // On revient en haut de la grille, juste sous la barre collée.
    const grille = document.getElementById('grille-carte');
    if (grille && grille.getBoundingClientRect().top < 0) grille.scrollIntoView({ block: 'start' });
  };

  return (
    // Pas de z-index ici : il créerait un contexte d'empilement et la fiche
    // produit (rendue dans la section) passerait sous la barre panier.
    <section id="carte" aria-labelledby="titre-carte" className="carte-reserve pt-14 sm:pt-20 scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-6">
        <h2 id="titre-carte" className="font-serif text-4xl sm:text-5xl font-semibold tracking-tight text-stone-900">
          La carte
        </h2>
        <p className="mt-2 text-stone-600">Touchez une crêpe pour choisir vos extras, ou le + pour l’ajouter telle quelle.</p>
        <AvisFermeture />
      </div>

      {categories.length > 0 && (
        <CategoryTabs
          categories={categories}
          activeCategory={categorie}
          onSelectCategory={choisir}
          recherche={recherche}
          onRecherche={setRecherche}
          rechercheOuverte={rechercheOuverte}
          onRechercheOuverte={setRechercheOuverte}
        />
      )}

      <div id="grille-carte" className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 scroll-mt-[calc(8rem+env(safe-area-inset-top))]">
        {terme && produits !== null && affiches.length > 0 && (
          <p className="mb-5 text-sm text-stone-600" aria-live="polite">
            {`${affiches.length} résultat${affiches.length > 1 ? 's' : ''} pour « ${recherche.trim()} »`}
          </p>
        )}

        {produits === null ? (
          erreur ? (
            <div role="alert" className="py-16 text-center">
              <p className="font-serif text-xl font-semibold text-stone-900">La carte ne s’est pas chargée</p>
              <p className="mt-2 text-stone-600">La connexion a été coupée. Rechargez la page pour la retrouver.</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="appui mt-5 bg-stone-900 pointer-fine:hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-lg"
              >
                Recharger la carte
              </button>
            </div>
          ) : (
            // Squelette de la grille : même géométrie que les cartes.
            <div aria-label="Chargement de la carte" role="status" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-7 sm:gap-x-6 sm:gap-y-9">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i}>
                  <div className="aspect-square rounded-2xl bg-stone-200/70 motion-safe:animate-pulse" />
                  <div className="mt-3 h-4 w-3/4 rounded bg-stone-200/70" />
                  <div className="mt-2 h-4 w-1/3 rounded bg-stone-200/70" />
                </div>
              ))}
            </div>
          )
        ) : affiches.length === 0 ? (
          terme ? (
            <div aria-live="polite" className="py-12 text-center">
              <p className="font-serif text-xl font-semibold text-stone-900">Aucune recette ne correspond à « {recherche.trim()} ».</p>
              <p className="mt-2 text-stone-600">Essayez un ingrédient : nutella, poulet, fromage…</p>
              <button
                type="button"
                onClick={() => setRecherche('')}
                className="appui mt-5 bg-stone-900 pointer-fine:hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-lg"
              >
                Effacer la recherche
              </button>
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="font-serif text-xl font-semibold text-stone-900">Rien dans cette rubrique pour le moment</p>
              <p className="mt-2 text-stone-600">Le reste de la carte vous attend.</p>
              <button
                type="button"
                onClick={() => choisir('tout')}
                className="appui mt-5 bg-stone-900 pointer-fine:hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-lg"
              >
                Voir toute la carte
              </button>
            </div>
          )
        ) : (
          <div key={terme || categorie} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-7 sm:gap-x-6 sm:gap-y-9">
            {affiches.map((produit, i) => (
              <ProductCard key={produit.id} produit={produit} onOuvrir={setSelection} rang={i} prioritaire={i < 4} />
            ))}
          </div>
        )}
      </div>

      {selection && <ProductModal produit={selection} extras={extras} onClose={() => setSelection(null)} />}
    </section>
  );
}
