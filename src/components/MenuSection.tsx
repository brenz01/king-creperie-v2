'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleDot, List, Search, X } from 'lucide-react';
import type { CategorieProduit, Produit } from '@/types';
import type { Extra } from '@/lib/extras';
import { chargerExtras, chargerProduits } from '@/lib/catalogue';
import { useCart } from '@/context/CartContext';
import { estEpuise } from '@/lib/produit';
import { confirmerAjout } from '@/lib/toast';
import PlaqueTournante from './carte/PlaqueTournante';
import ListeCarte, { type Rubrique } from './carte/ListeCarte';
import ProductModal from './ProductModal';
import { AvisFermeture } from './StatutBoutique';

const RUBRIQUES: Rubrique[] = [
  { categorie: 'salee', titre: 'Crêpes salées', court: 'Salées' },
  { categorie: 'sucree', titre: 'Crêpes sucrées', court: 'Sucrées' },
  { categorie: 'boisson', titre: 'Boissons', court: 'Boissons' },
];

type Vue = 'plaque' | 'liste';

interface MenuSectionProps {
  produitsInitiaux: Produit[] | null;
  extrasInitiaux: Extra[];
}

// Les produits disponibles d'abord, les épuisés en fin de plaque.
function trier(produits: Produit[]): Produit[] {
  return [...produits].sort((a, b) => Number(estEpuise(a)) - Number(estEpuise(b)) || a.prix - b.prix);
}

// Recherche tolérante : sans accents ni majuscules (« creme » trouve « crème »).
const normaliser = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function MenuSection({ produitsInitiaux, extrasInitiaux }: MenuSectionProps) {
  const [produits, setProduits] = useState<Produit[] | null>(produitsInitiaux);
  const [extras, setExtras] = useState<Extra[]>(extrasInitiaux);
  const [selection, setSelection] = useState<Produit | null>(null);
  const [erreur, setErreur] = useState(false);
  const [categorie, setCategorie] = useState<CategorieProduit>('salee');
  const [vue, setVue] = useState<Vue>('plaque');
  const [recherche, setRecherche] = useState('');
  const champRecherche = useRef<HTMLInputElement>(null);
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

  const terme = normaliser(recherche.trim());
  const rubriquesFiltrees = useMemo(
    () =>
      terme
        ? rubriques.map((r) => ({
            ...r,
            produits: r.produits.filter((p) => normaliser(`${p.nom} ${p.description ?? ''}`).includes(terme)),
          }))
        : rubriques,
    [rubriques, terme],
  );

  const total = rubriques.reduce((s, r) => s + r.produits.length, 0);
  const enListe = vue === 'liste' || terme.length > 0;
  const courante = rubriques.find((r) => r.categorie === categorie) ?? rubriques[0];

  // Ajout direct (boissons) : la photo saute sur la plaque, la barre
  // panier confirme. Aucun rendu React pour l'effet.
  const ajouter = (p: Produit, photo: HTMLElement | null) => {
    addToCart(p);
    confirmerAjout('Ajouté au panier');
    if (photo) {
      photo.classList.remove('plaque-pop');
      void photo.offsetWidth;
      photo.classList.add('plaque-pop');
    }
  };

  const choisirRubrique = (c: CategorieProduit) => {
    setCategorie(c);
    if (enListe) document.getElementById(`liste-${c}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    // Pas de z-index ici : il créerait un contexte d'empilement et la fiche
    // produit (rendue dans la section) passerait sous la barre panier.
    <section
      id="carte"
      aria-labelledby="titre-carte"
      className="carte-reserve relative bg-kc-indigo text-kc-beurre pt-10 scroll-mt-16 overflow-x-clip"
    >
      {/* Au-dessus de la plaque : son disque (150vw) remonte sous les
          rubriques au lieu de les recouvrir. */}
      <div className="relative z-10 max-w-3xl mx-auto px-5 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <h2 id="titre-carte" className="font-display text-5xl sm:text-6xl leading-[0.95]">
            La carte
          </h2>
          {total > 0 && <p className="pb-1 text-sm text-kc-brume tabular-nums">{total} recettes</p>}
        </div>
        <AvisFermeture />

        {/* Recherche + choix de la vue */}
        <div className="mt-6 flex gap-2">
          <label className="relative flex-1 min-w-0">
            <span className="sr-only">Chercher une recette</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-kc-brume/70" />
            <input
              ref={champRecherche}
              id="recherche-carte"
              type="search"
              inputMode="search"
              autoComplete="off"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Chercher une recette"
              // Une seule croix : celle du navigateur est masquée (WebKit/Blink).
              className={`w-full h-12 rounded-full bg-kc-nuit border border-kc-beurre/15 pl-11 ${recherche ? 'pr-11' : 'pr-3'} text-base text-kc-lait placeholder:text-kc-brume/55 focus:outline-none focus:border-kc-caramel [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none`}
            />
            {recherche && (
              <button
                type="button"
                onClick={() => {
                  setRecherche('');
                  champRecherche.current?.focus();
                }}
                aria-label="Effacer la recherche"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-kc-brume"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </label>
          <div
            role="group"
            aria-label="Affichage de la carte"
            className="shrink-0 flex rounded-full bg-kc-nuit p-1 border border-kc-beurre/15"
          >
            {(
              [
                { id: 'plaque', libelle: 'Plaque', Icone: CircleDot },
                { id: 'liste', libelle: 'Liste', Icone: List },
              ] as const
            ).map(({ id, libelle, Icone }) => {
              const actif = id === 'liste' ? enListe : !enListe;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => {
                    setVue(id);
                    if (id === 'plaque') setRecherche('');
                  }}
                  className={`appui h-10 min-w-10 px-3.5 max-sm:px-0 rounded-full flex items-center justify-center gap-1.5 text-sm font-semibold ${
                    actif ? 'bg-kc-beurre text-kc-nuit' : 'text-kc-brume'
                  }`}
                >
                  <Icone className="w-4 h-4" aria-hidden />
                  {/* Sur téléphone, icônes seules : la place revient au champ. */}
                  <span className="max-sm:sr-only">{libelle}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Rubriques */}
        {rubriques.length > 1 && !terme && (
          <div role="group" aria-label="Rubriques" className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-kc-nuit p-1">
            {rubriques.map((r) => {
              const actif = categorie === r.categorie;
              return (
                <button
                  key={r.categorie}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => choisirRubrique(r.categorie)}
                  className={`appui rounded-xl py-2.5 text-sm font-semibold leading-tight ${
                    actif ? 'bg-kc-indigo text-kc-beurre shadow-[inset_0_0_0_1.5px_var(--color-kc-beurre)]' : 'text-kc-brume'
                  }`}
                >
                  {r.court}{' '}
                  <span className={`tabular-nums ${actif ? 'text-kc-caramel' : 'text-kc-brume/60'}`}>{r.produits.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {produits === null ? (
        <div className="py-10" aria-live="polite">
          {erreur ? (
            <p className="max-w-md mx-auto px-5 text-center text-kc-brume">
              La carte ne s’est pas chargée. Vérifiez votre connexion, puis rechargez la page.
            </p>
          ) : (
            <div className="flex justify-center" aria-label="Chargement de la carte">
              <span className="block w-[min(52vw,14rem)] aspect-square rounded-full bg-kc-nuit animate-pulse" />
            </div>
          )}
        </div>
      ) : enListe ? (
        <div key="liste" className="kc-fondu mt-6 max-w-3xl mx-auto sm:px-6">
          <div className="bg-kc-lait text-kc-encre rounded-t-[2rem] sm:rounded-[2rem]">
            <ListeCarte
              rubriques={rubriquesFiltrees}
              recherche={recherche.trim()}
              onComposer={setSelection}
              onAjouter={ajouter}
            />
          </div>
        </div>
      ) : (
        courante && (
          <div key={courante.categorie} className="kc-fondu mt-2">
            <PlaqueTournante
              produits={courante.produits}
              libelle={courante.titre}
              onComposer={setSelection}
              onAjouter={ajouter}
            />
          </div>
        )
      )}

      {selection && <ProductModal produit={selection} extras={extras} onClose={() => setSelection(null)} />}
    </section>
  );
}
