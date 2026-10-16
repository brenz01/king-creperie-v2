import type { CategorieProduit } from '@/types';

export interface Extra {
  id: string;
  nom: string;
  prix: number;
}

// Catégories sur lesquelles des extras peuvent être ajoutés.
// Appliqué côté UI (bouton « Personnaliser ») ET côté serveur
// (/api/commandes refuse un extra sur une boisson).
export const CATEGORIES_PERSONNALISABLES: readonly CategorieProduit[] = ['salee', 'sucree'];

export const MAX_EXTRAS_PAR_ARTICLE = 10;

// Liste de secours, utilisée uniquement si la table `extras` est
// illisible (réseau, RLS). La source de vérité reste la base : c'est
// elle que le serveur utilise pour valider et facturer.
export const EXTRAS_SECOURS: readonly Extra[] = [
  { id: 'nutella', nom: 'Extra Nutella 🍫', prix: 500 },
  { id: 'banane', nom: 'Banane fraîche 🍌', prix: 300 },
  { id: 'chantilly', nom: 'Chantilly Maison 🍦', prix: 400 },
  { id: 'kinder', nom: 'Bueno / Kinder 🍫', prix: 700 },
  { id: 'speculoos', nom: 'Éclats de Spéculoos 🍪', prix: 400 },
  { id: 'fromage', nom: 'Double Fromage 🧀', prix: 500 },
];

export function estPersonnalisable(categorie: string | undefined): boolean {
  return CATEGORIES_PERSONNALISABLES.includes(categorie as CategorieProduit);
}
