'use client';

import { useSyncExternalStore } from 'react';
import type { StatutCommande } from '@/types';
import { prixF } from '@/lib/produit';

// ------------------------------------------------------------------
// Éléments partagés par les écrans de KC Staff.
// ------------------------------------------------------------------

export const EN_COURS: StatutCommande[] = ['recue', 'en_preparation', 'en_livraison'];

export const numero = (id: string) => id.slice(0, 8).toUpperCase();
export const prix = prixF;
export const heure = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// Horloge partagée (30 s) pour les « il y a 6 min » et l'état ouvert/fermé,
// sans setState dans un effet.
function sAbonnerHorloge(f: () => void) {
  const t = setInterval(f, 30_000);
  return () => clearInterval(t);
}
const lireHorloge = () => Math.floor(Date.now() / 30_000);
export function useMaintenant(): number {
  return useSyncExternalStore(sAbonnerHorloge, lireHorloge, () => 0) * 30_000;
}

export function minutesDepuis(iso: string, maintenant: number): number {
  if (!maintenant) return 0;
  return Math.max(0, Math.round((maintenant - new Date(iso).getTime()) / 60_000));
}

export function depuis(iso: string, maintenant: number): string {
  if (!maintenant) return heure(iso);
  const min = minutesDepuis(iso, maintenant);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `il y a ${h} h ${String(min % 60).padStart(2, '0')}` : new Date(iso).toLocaleDateString('fr-FR');
}

export function Interrupteur({
  actif,
  libelle,
  onChange,
  desactive,
}: {
  actif: boolean;
  libelle: string;
  onChange: (v: boolean) => void;
  desactive?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={libelle}
      disabled={desactive}
      onClick={() => onChange(!actif)}
      className={`relative w-14 h-8 rounded-full shrink-0 transition-colors disabled:opacity-50 ${actif ? 'bg-amber-600' : 'bg-white/15'}`}
    >
      <span
        className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${actif ? 'translate-x-6' : ''}`}
      />
    </button>
  );
}

export function Carte({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-kc-carte border border-kc-bord text-kc-creme ${className}`}>{children}</div>;
}

export function TitreSection({ children, aide }: { children: React.ReactNode; aide?: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-serif font-semibold text-2xl text-kc-creme leading-tight">{children}</h2>
      {aide && <p className="mt-1 text-sm text-kc-sable/70">{aide}</p>}
    </div>
  );
}
