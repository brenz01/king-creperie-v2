'use client';

import { useSyncExternalStore } from 'react';
import { chargerBoutique } from '@/lib/catalogue';
import { etatBoutique, type Boutique, type EtatBoutique } from '@/lib/horaires';

// Store partagé (carte, panneau de commande, en-tête) : une seule
// lecture réseau, rafraîchie chaque minute et au retour sur l'onglet.
// L'état ouvert/fermé est recalculé à chaque minute même sans réseau.
let boutique: Boutique | null = null;
let charge = false;
let minute = 0;
let instantane: { charge: boolean; etat: EtatBoutique | null } = { charge: false, etat: null };
const abonnes = new Set<() => void>();
let minuteur: ReturnType<typeof setInterval> | null = null;

function recalculer() {
  instantane = { charge, etat: boutique ? etatBoutique(boutique) : null };
  abonnes.forEach((f) => f());
}

export async function rafraichirBoutique(): Promise<void> {
  boutique = await chargerBoutique();
  charge = true;
  recalculer();
}

function demarrer() {
  void rafraichirBoutique();
  minuteur = setInterval(() => {
    minute++;
    // Relecture réseau toutes les 2 minutes, recalcul local chaque minute.
    if (minute % 2 === 0) void rafraichirBoutique();
    else recalculer();
  }, 60_000);
  document.addEventListener('visibilitychange', surVisibilite);
}

function surVisibilite() {
  if (document.visibilityState === 'visible') void rafraichirBoutique();
}

function sAbonner(f: () => void) {
  abonnes.add(f);
  if (abonnes.size === 1) demarrer();
  return () => {
    abonnes.delete(f);
    if (abonnes.size === 0 && minuteur) {
      clearInterval(minuteur);
      minuteur = null;
      document.removeEventListener('visibilitychange', surVisibilite);
    }
  };
}

const SERVEUR = { charge: false, etat: null };

/** etat = null : boutique inconnue (chargement, ou table absente) → considérée ouverte. */
export function useBoutique(): { charge: boolean; etat: EtatBoutique | null } {
  return useSyncExternalStore(
    sAbonner,
    () => instantane,
    () => SERVEUR,
  );
}
