import type { ReactNode } from 'react';

const POSITION = {
  bas: 'top-full mt-2 left-1/2 -translate-x-1/2',
  haut: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
  gauche: 'right-full mr-2 top-1/2 -translate-y-1/2',
  basDroite: 'top-full mt-2 right-0',
} as const;

// Info-bulle des boutons icône : même libellé que le nom accessible du
// bouton, visible au survol (pointeur fin) et au focus clavier. Le nom
// reste porté par aria-label sur le bouton ; la bulle est visuelle.
// Masquée (display: none) au repos : elle ne crée aucun débordement.
export default function InfoBulle({
  libelle,
  cote = 'bas',
  sombre = false,
  children,
}: {
  libelle: string;
  cote?: keyof typeof POSITION;
  sombre?: boolean;
  children: ReactNode;
}) {
  return (
    <span className="relative inline-flex group/bulle">
      {children}
      <span
        aria-hidden
        className={`kc-fondu pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium pointer-fine:group-hover/bulle:block group-has-[:focus-visible]/bulle:block ${POSITION[cote]} ${
          sombre ? 'bg-kc-creme text-kc-nuit' : 'bg-stone-900 text-white'
        }`}
      >
        {libelle}
      </span>
    </span>
  );
}
