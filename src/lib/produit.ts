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

/** Quantité maximale d'une ligne de panier (garde-fou, stock illimité). */
export const QUANTITE_MAX_LIGNE = 20;

/**
 * Portions commandables pour ce produit, toutes lignes du panier confondues
 * (une crêpe nature et la même avec extras puisent dans le même stock),
 * ou null si le stock n'est pas suivi.
 */
export function stockCommandable(p: Produit): number | null {
  if (!p.disponible) return 0;
  if (!p.stock_gere || p.stock_quantite == null) return null;
  return Math.max(0, Math.floor(p.stock_quantite));
}

/** Message affiché quand le client atteint le stock restant. */
export function messageStockAtteint(stock: number): string {
  return stock <= 1 ? 'Dernière portion : déjà dans votre panier' : `Plus que ${stock} : toutes sont dans votre panier`;
}

// Espace insécable classique plutôt que l'espace fine (U+202F) produite
// par fr-FR : Fraunces n'a pas ce glyphe (« 2000 » au lieu de « 2 000 »).
export const nombreF = (n: number) => n.toLocaleString('fr-FR').replace(/\u202f/g, '\u00a0');
export const prixF = (n: number) => `${nombreF(n)} F`;
