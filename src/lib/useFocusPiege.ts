'use client';

import { useEffect, type RefObject } from 'react';

const FOCUSABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Fenêtres et panneaux : Tab et Maj+Tab tournent à l'intérieur tant que la
// surface est ouverte, et le focus revient à l'élément d'origine à la
// fermeture.
export function useFocusPiege(ref: RefObject<HTMLElement | null>, actif = true) {
  useEffect(() => {
    if (!actif) return;
    const avant = document.activeElement as HTMLElement | null;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !ref.current) return;
      const elements = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLES)].filter((el) => el.offsetParent !== null);
      if (elements.length === 0) return;
      const premier = elements[0];
      const dernier = elements[elements.length - 1];
      const courant = document.activeElement;
      if (e.shiftKey && (courant === premier || !ref.current.contains(courant))) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && (courant === dernier || !ref.current.contains(courant))) {
        e.preventDefault();
        premier.focus();
      }
    };
    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('keydown', surTouche);
      avant?.focus?.({ preventScroll: true });
    };
  }, [ref, actif]);
}
