'use client';

import { useSyncExternalStore } from 'react';

// Messages courts de confirmation (« Crêpe ajoutée au panier. »).
let message: { id: number; texte: string } | null = null;
let minuteur: ReturnType<typeof setTimeout> | undefined;
const abonnes = new Set<() => void>();
const notifier = () => abonnes.forEach((f) => f());

export function afficherToast(texte: string, dureeMs = 2200) {
  message = { id: Date.now(), texte };
  notifier();
  clearTimeout(minuteur);
  minuteur = setTimeout(() => {
    message = null;
    notifier();
  }, dureeMs);
}

export function useToast() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => message,
    () => null
  );
}
