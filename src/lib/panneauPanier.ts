'use client';

import { useSyncExternalStore } from 'react';

// Ouverture du panneau de commande depuis n'importe où (barre panier,
// menu, fiche produit) sans faire remonter d'état dans les composants.
let ouvert = false;
const abonnes = new Set<() => void>();
const notifier = () => abonnes.forEach((f) => f());

export function ouvrirPanier() {
  ouvert = true;
  notifier();
}

export function fermerPanier() {
  ouvert = false;
  notifier();
}

export function usePanierOuvert(): boolean {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => ouvert,
    () => false
  );
}
