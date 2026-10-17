import type { Produit } from '@/types';

/** Épuisé : retiré par le staff, ou stock suivi tombé à 0. */
export function estEpuise(p: Produit): boolean {
  return !p.disponible || (p.stock_gere === true && p.stock_quantite === 0);
}

/** Nombre de portions restantes à annoncer (3 ou moins), sinon null. */
export function portionsRestantes(p: Produit): number | null {
  if (estEpuise(p) || !p.stock_gere || p.stock_quantite == null) return null;
  return p.stock_quantite <= 3 ? p.stock_quantite : null;
}

// Espace insécable classique plutôt que l'espace fine (U+202F) produite
// par fr-FR : Fraunces n'a pas ce glyphe (« 2000 » au lieu de « 2 000 »).
export const nombreF = (n: number) => n.toLocaleString('fr-FR').replace(/\u202f/g, '\u00a0');
export const prixF = (n: number) => `${nombreF(n)} F`;
