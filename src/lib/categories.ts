import type { CategorieProduit } from '@/types';

// Source unique des catégories de la carte : ordre d'affichage, libellés
// côté client (onglets) et côté staff (rubriques, formulaire), extras.
// Les valeurs doivent correspondre à la contrainte de la base
// (migration 20261017200000_gestion_carte.sql).
export interface InfoCategorie {
  id: CategorieProduit;
  /** Onglet de la carte, côté client. */
  onglet: string;
  /** Titre de rubrique dans KC Staff. */
  rubrique: string;
  /** Les extras (Nutella, chantilly…) peuvent s'y ajouter. */
  personnalisable: boolean;
  /** Nom d'un article, pour les messages (« Gaufre ajoutée », « Partager cette gaufre »). */
  article: { un: string; des: string };
}

export const CATEGORIES_PRODUIT: readonly InfoCategorie[] = [
  { id: 'salee', onglet: 'Salées', rubrique: 'Crêpes salées', personnalisable: true, article: { un: 'crêpe', des: 'crêpes' } },
  { id: 'sucree', onglet: 'Sucrées', rubrique: 'Crêpes sucrées', personnalisable: true, article: { un: 'crêpe', des: 'crêpes' } },
  { id: 'gaufre', onglet: 'Gaufres', rubrique: 'Gaufres', personnalisable: true, article: { un: 'gaufre', des: 'gaufres' } },
  { id: 'boisson', onglet: 'Boissons', rubrique: 'Boissons', personnalisable: false, article: { un: 'boisson', des: 'boissons' } },
  { id: 'autre', onglet: 'Autres', rubrique: 'Autres', personnalisable: false, article: { un: 'article', des: 'articles' } },
];

export const ORDRE_CATEGORIES: readonly CategorieProduit[] = CATEGORIES_PRODUIT.map((c) => c.id);

export const estCategorie = (v: unknown): v is CategorieProduit =>
  typeof v === 'string' && (ORDRE_CATEGORIES as readonly string[]).includes(v);

/** Nom d'un article de la catégorie (« crêpe » par défaut). */
export const articleDe = (c: CategorieProduit | undefined) =>
  CATEGORIES_PRODUIT.find((x) => x.id === c)?.article ?? { un: 'crêpe', des: 'crêpes' };
