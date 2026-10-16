'use client';

import Image from 'next/image';
import { Plus } from 'lucide-react';
import type { CategorieProduit, Produit } from '@/types';
import { estPersonnalisable } from '@/lib/extras';
import { estEpuise, memoriserOrigine, portionsRestantes, prixF } from '@/lib/produit';

export interface Rubrique {
  categorie: CategorieProduit;
  titre: string;
  court: string;
}

interface ListeCarteProps {
  rubriques: Array<Rubrique & { produits: Produit[] }>;
  recherche: string;
  onComposer: (p: Produit) => void;
  onAjouter: (p: Produit, photo: HTMLElement | null) => void;
}

// Toute la carte d'un coup d'œil, pour qui sait ce qu'il veut ou veut
// comparer : une ligne par recette, photo, nom, prix, ajout direct.
export default function ListeCarte({ rubriques, recherche, onComposer, onAjouter }: ListeCarteProps) {
  const total = rubriques.reduce((s, r) => s + r.produits.length, 0);

  if (total === 0) {
    return (
      <div className="px-5 py-14 text-center">
        <p className="font-semibold text-kc-encre">Aucune recette ne correspond à « {recherche} ».</p>
        <p className="mt-1 text-kc-encre/65">Vérifiez l’orthographe ou essayez un ingrédient : poulet, banane, bissap…</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 pb-6">
      {recherche && (
        <p className="pt-2 pb-1 text-sm text-kc-encre/65" aria-live="polite">
          {total} résultat{total > 1 ? 's' : ''} pour « {recherche} »
        </p>
      )}
      {rubriques
        .filter((r) => r.produits.length > 0)
        .map((r) => (
          <section key={r.categorie} id={`liste-${r.categorie}`} className="scroll-mt-40 pt-5">
            <h3 className="font-display text-2xl text-kc-indigo px-1">
              {r.titre} <span className="font-sans text-base font-semibold text-kc-encre/50">{r.produits.length}</span>
            </h3>
            <ul className="mt-2 divide-y divide-kc-ligne">
              {r.produits.map((p) => (
                <LigneProduit key={p.id} produit={p} onComposer={onComposer} onAjouter={onAjouter} />
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

function LigneProduit({
  produit: p,
  onComposer,
  onAjouter,
}: {
  produit: Produit;
  onComposer: (p: Produit) => void;
  onAjouter: (p: Produit, photo: HTMLElement | null) => void;
}) {
  const ko = estEpuise(p);
  const aComposer = estPersonnalisable(p.categorie);
  const restant = portionsRestantes(p);

  const agir = (e: React.MouseEvent<HTMLElement>) => {
    if (ko) return;
    const photo = (e.currentTarget.closest('li') as HTMLElement | null)?.querySelector<HTMLElement>('[data-photo]') ?? null;
    if (aComposer) {
      memoriserOrigine(photo?.getBoundingClientRect() ?? null);
      onComposer(p);
    } else onAjouter(p, photo);
  };

  return (
    <li className="flex items-center gap-3 py-3">
      <button
        type="button"
        onClick={agir}
        disabled={ko}
        className="appui flex flex-1 min-w-0 items-center gap-3 text-left disabled:cursor-not-allowed"
        aria-label={`${p.nom}, ${prixF(p.prix)}${ko ? ', épuisé' : ''}`}
      >
        <span data-photo className="relative shrink-0 w-16 h-16 rounded-full overflow-hidden bg-kc-nuit ring-4 ring-kc-nuit">
          {p.image_url && (
            <Image
              src={p.image_url}
              alt=""
              fill
              unoptimized
              sizes="64px"
              loading="lazy"
              className={`object-cover ${ko ? 'grayscale opacity-50' : ''}`}
            />
          )}
        </span>
        <span className="min-w-0">
          <span className={`block font-semibold leading-snug ${ko ? 'text-kc-encre/45' : 'text-kc-encre'}`}>{p.nom}</span>
          {p.description && <span className="block text-sm text-kc-encre/60 truncate">{p.description}</span>}
          <span className="mt-0.5 flex items-center gap-2 text-sm">
            <span className={`prix ${ko ? 'text-kc-encre/40' : 'text-kc-bissap'}`}>{prixF(p.prix)}</span>
            {ko && <span className="font-semibold text-kc-encre/55">Épuisé</span>}
            {restant && <span className="font-semibold text-kc-encre/60">Plus que {restant}</span>}
          </span>
        </span>
      </button>
      {!ko && (
        <button
          type="button"
          onClick={agir}
          aria-label={aComposer ? `Composer ${p.nom}` : `Ajouter ${p.nom}`}
          className="appui shrink-0 w-11 h-11 rounded-full bg-kc-bissap text-white flex items-center justify-center"
        >
          <Plus className="w-5 h-5" strokeWidth={2.6} />
        </button>
      )}
    </li>
  );
}
