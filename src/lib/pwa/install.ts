'use client';

import { useSyncExternalStore } from 'react';

// L'événement beforeinstallprompt (Chrome/Edge/Samsung Internet sur
// Android et desktop) n'est émis qu'une fois, souvent avant le montage
// des composants : on le capture au chargement du module et on
// l'expose via un petit store. Safari iOS ne l'émet jamais → instructions.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type EtatInstallation =
  | { mode: 'inconnu' } // rendu serveur / hydratation
  | { mode: 'installee' } // déjà ouverte en mode app
  | { mode: 'android'; installer: () => Promise<boolean> }
  | { mode: 'ios' } // Safari iOS : Partager → Sur l'écran d'accueil
  | { mode: 'indisponible' };

let evenementDiffere: BeforeInstallPromptEvent | null = null;
let installee = false;
let instantane: EtatInstallation = { mode: 'inconnu' };
const abonnes = new Set<() => void>();

function estStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function estIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Chrome/Firefox iOS (CriOS/FxiOS) ne savent pas installer de PWA avant iOS 16.4,
  // et passent de toute façon par le même menu Partager : on garde le message.
  return ios;
}

async function installer(): Promise<boolean> {
  if (!evenementDiffere) return false;
  const e = evenementDiffere;
  evenementDiffere = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  recalculer();
  return outcome === 'accepted';
}

function recalculer() {
  if (typeof window === 'undefined') return;
  if (installee || estStandalone()) instantane = { mode: 'installee' };
  else if (evenementDiffere) instantane = { mode: 'android', installer };
  else if (estIosSafari()) instantane = { mode: 'ios' };
  else instantane = { mode: 'indisponible' };
  abonnes.forEach((f) => f());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    evenementDiffere = e as BeforeInstallPromptEvent;
    recalculer();
  });
  window.addEventListener('appinstalled', () => {
    installee = true;
    evenementDiffere = null;
    recalculer();
  });
  recalculer();
}

const SERVEUR: EtatInstallation = { mode: 'inconnu' };

export function useInstallation(): EtatInstallation {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => instantane,
    () => SERVEUR
  );
}
