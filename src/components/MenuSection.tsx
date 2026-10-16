'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CategorieProduit, Produit } from '@/types';
import type { Extra } from '@/lib/extras';
import { chargerExtras, chargerProduits } from '@/lib/catalogue';
import { useCart } from '@/context/CartContext';
import PlaqueRail from './carte/PlaqueRail';
import { estEpuise } from './carte/PlaqueItem';
import ProductModal from './ProductModal';
import { AvisFermeture } from './StatutBoutique';
import { Loader2 } from 'lucide-react';

const RUBRIQUES: Array<{ categorie: CategorieProduit; titre: string; court: string; unite: string }> = [
  { categorie: 'salee', titre: 'Crêpes salées', court: 'Salées', unite: 'recettes' },
  { categorie: 'sucree', titre: 'Crêpes sucrées', court: 'Sucrées', unite: 'recettes' },
  { categorie: 'boisson', titre: 'Boissons et jus maison', court: 'Boissons', unite: 'boissons' },
];

interface MenuSectionProps {
  produitsInitiaux: Produit[] | null;
  extrasInitiaux: Extra[];
}

// Les produits disponibles d'abord, les épuisés en fin de rangée.
function trier(produits: Produit[]): Produit[] {
  return [...produits].sort((a, b) => Number(estEpuise(a)) - Number(estEpuise(b)) || a.prix - b.prix);
}

export default function MenuSection({ produitsInitiaux, extrasInitiaux }: MenuSectionProps) {
  const [produits, setProduits] = useState<Produit[] | null>(produitsInitiaux);
  const [extras, setExtras] = useState<Extra[]>(extrasInitiaux);
  const [selection, setSelection] = useState<Produit | null>(null);
  const [erreur, setErreur] = useState(false);
  const [active, setActive] = useState<CategorieProduit>('salee');
  const { synchroniser, addToCart } = useCart();

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

  const rubriques = useMemo(
    () =>
      RUBRIQUES.map((r) => ({ ...r, produits: trier((produits ?? []).filter((p) => p.categorie === r.categorie)) })).filter(
        (r) => r.produits.length > 0,
      ),
    [produits],
  );

  // Onglet actif = rangée la plus visible à l'écran.
  useEffect(() => {
    const sections = rubriques
      .map((r) => document.getElementById(`carte-${r.categorie}`))
      .filter((el): el is HTMLElement => !!el);
    if (sections.length === 0) return;
    const obs = new IntersectionObserver(
      (entrees) => {
        const visible = entrees.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id.replace('carte-', '') as CategorieProduit);
      },
      { rootMargin: '-35% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [rubriques]);

  return (
    // Pas de z-index ici : il créerait un contexte d'empilement et la fiche
    // produit (rendue dans la section) passerait sous la barre panier.
    <section id="carte" className="relative -mt-8 rounded-t-[2.5rem] bg-kc-lait text-kc-encre pt-8 pb-28 scroll-mt-16">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 pt-4">
        <h2 className="font-display text-5xl sm:text-6xl leading-none text-kc-indigo">La carte</h2>
        <p className="mt-3 text-kc-encre/70 text-base max-w-md leading-relaxed">
          Glissez pour voir les recettes, touchez une crêpe pour la composer.
        </p>
        <AvisFermeture />
      </div>

      {rubriques.length > 1 && (
        <nav
          aria-label="Rubriques de la carte"
          className="sticky top-16 z-30 mt-6 bg-kc-lait/95 backdrop-blur-md border-b border-kc-encre/10"
        >
          <div className="max-w-6xl mx-auto px-5 sm:px-6 py-3 flex gap-2 overflow-x-auto scrollbar-none">
            {rubriques.map((r) => (
              <a
                key={r.categorie}
                href={`#carte-${r.categorie}`}
                aria-current={active === r.categorie ? 'true' : undefined}
                className={`shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                  active === r.categorie
                    ? 'bg-kc-indigo text-kc-beurre'
                    : 'text-kc-indigo border border-kc-indigo/30 hover:border-kc-indigo'
                }`}
              >
                {r.court}
              </a>
            ))}
          </div>
        </nav>
      )}

      {produits === null ? (
        <div className="max-w-6xl mx-auto px-5 py-20 text-center text-kc-encre/70">
          {erreur ? (
            <p>La carte ne charge pas. Vérifiez votre connexion puis rechargez la page.</p>
          ) : (
            <Loader2 className="w-8 h-8 animate-spin mx-auto" aria-label="Chargement de la carte" />
          )}
        </div>
      ) : (
        rubriques.map((r) => (
          <PlaqueRail
            key={r.categorie}
            id={`carte-${r.categorie}`}
            titre={r.titre}
            unite={r.unite}
            produits={r.produits}
            onChoisir={setSelection}
            onAjouterDirect={(p) => addToCart(p)}
          />
        ))
      )}

      {selection && <ProductModal produit={selection} extras={extras} onClose={() => setSelection(null)} />}
    </section>
  );
}
