'use client';

import { useSyncExternalStore } from 'react';

const sAbonner = () => () => {};

// false pendant le rendu serveur et l'hydratation, true ensuite.
// Permet d'éviter les flashs d'état « vide » sur les données lues
// dans localStorage, sans setState dans un effet.
export function useEstHydrate(): boolean {
  return useSyncExternalStore(sAbonner, () => true, () => false);
}
