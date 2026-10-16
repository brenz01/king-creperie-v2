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

export const prixF = (n: number) => `${n.toLocaleString('fr-FR')} F`;

// Dernière position connue de la photo touchée : la fiche s'ouvre
// depuis cet endroit (transition « la crêpe quitte la plaque »).
let origine: DOMRect | null = null;
export const memoriserOrigine = (r: DOMRect | null) => {
  origine = r;
};
export const lireOrigine = () => {
  const r = origine;
  origine = null;
  return r;
};
