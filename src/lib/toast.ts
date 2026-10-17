'use client';

import { useSyncExternalStore } from 'react';

// Messages courts de confirmation (« Crêpe ajoutée au panier. »).
// genre « panier » : confirmation d'ajout, affichée DANS la barre panier
// (là où regarde le client) plutôt que dans une bulle qui recouvre la page.
// genre « limite » : information sans coche (ex. stock restant atteint).
type Genre = 'info' | 'panier' | 'limite';
let message: { id: number; texte: string; genre: Genre } | null = null;
let minuteur: ReturnType<typeof setTimeout> | undefined;
const abonnes = new Set<() => void>();
const notifier = () => abonnes.forEach((f) => f());

export function afficherToast(texte: string, dureeMs = 2200, genre: Genre = 'info') {
  message = { id: Date.now(), texte, genre };
  notifier();
  clearTimeout(minuteur);
  minuteur = setTimeout(() => {
    message = null;
    notifier();
  }, dureeMs);
}

// Ajout au panier : message dans la barre + petite vibration (Android).
export function confirmerAjout(texte: string) {
  afficherToast(texte, 1800, 'panier');
  try {
    navigator.vibrate?.(30);
  } catch {
    // vibration indisponible : sans importance
  }
}

export function useToast() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => message,
    () => null,
  );
}
