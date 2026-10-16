'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

export default function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Pas de smooth scroll JS sur écran tactile : le défilement natif
    // est meilleur (inertie iOS/Android) et économise la batterie.
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      autoRaf: true, // boucle RAF gérée (et arrêtée) par Lenis
      anchors: { offset: -80 }, // liens #menu : compense la navbar fixe
    });

    return () => lenis.destroy();
  }, []);

  return <>{children}</>;
}
