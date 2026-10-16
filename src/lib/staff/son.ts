'use client';

import { useSyncExternalStore } from 'react';

// Son « nouvelle commande » de KC Staff : désactivé par défaut, réglé par
// appareil (le téléphone de la cuisine sonne, pas celui du gérant en
// réunion). Deux notes courtes générées en Web Audio : aucun fichier à
// charger, rien qui boucle.
const CLE = 'kc_staff_son';
const auditeurs = new Set<() => void>();

export function sonActif(): boolean {
  try {
    return localStorage.getItem(CLE) === '1';
  } catch {
    return false;
  }
}

export function useSonActive(): boolean {
  return useSyncExternalStore(
    (f) => {
      auditeurs.add(f);
      return () => auditeurs.delete(f);
    },
    sonActif,
    () => false,
  );
}

let contexte: AudioContext | null = null;

export function definirSon(actif: boolean) {
  try {
    localStorage.setItem(CLE, actif ? '1' : '0');
  } catch {}
  // Le navigateur n'autorise l'audio qu'après un geste : on prépare le
  // contexte ici (clic sur l'interrupteur) et on joue un aperçu.
  if (actif) jouerCarillon();
  auditeurs.forEach((f) => f());
}

export function jouerCarillon() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    contexte ??= new Ctx();
    const ctx = contexte;
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const debut = t0 + i * 0.16;
      gain.gain.setValueAtTime(0.0001, debut);
      gain.gain.exponentialRampToValueAtTime(0.25, debut + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, debut + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(debut);
      osc.stop(debut + 0.4);
    });
  } catch {
    // audio indisponible : la vibration et la mise en évidence suffisent
  }
}
