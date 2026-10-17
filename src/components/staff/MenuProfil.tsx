'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut, Store } from 'lucide-react';
import InfoBulle from '../ui/InfoBulle';

// Compte connecté : une pastille avec l'initiale dans l'en-tête. Elle ouvre
// un petit menu (adresse du compte, réglages, déconnexion). Échap ou un
// clic ailleurs le referme ; le focus revient à la pastille.
export default function MenuProfil({
  email,
  onReglages,
  onDeconnexion,
}: {
  email: string;
  onReglages: () => void;
  onDeconnexion: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);
  const premier = useRef<HTMLButtonElement>(null);
  const initiale = (email.trim()[0] ?? '?').toUpperCase();

  useEffect(() => {
    if (!ouvert) return;
    premier.current?.focus();
    const fermer = (rendreFocus: boolean) => {
      setOuvert(false);
      if (rendreFocus) declencheur.current?.focus();
    };
    const surTouche = (e: KeyboardEvent) => e.key === 'Escape' && fermer(true);
    const surClic = (e: MouseEvent) => {
      if (zone.current && !zone.current.contains(e.target as Node)) fermer(false);
    };
    document.addEventListener('keydown', surTouche);
    document.addEventListener('mousedown', surClic);
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.removeEventListener('mousedown', surClic);
    };
  }, [ouvert]);

  const ligne = 'appui w-full min-h-12 flex items-center gap-3 px-3 rounded-xl text-left text-sm font-semibold';

  return (
    <div ref={zone} className="relative">
      <InfoBulle libelle="Mon compte" cote="basDroite" sombre>
        <button
          ref={declencheur}
          type="button"
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
          aria-controls="menu-profil"
          aria-label="Mon compte"
          className="appui w-11 h-11 rounded-full flex items-center justify-center"
        >
          <span className="w-8 h-8 rounded-full bg-amber-500 text-kc-nuit font-semibold flex items-center justify-center">
            {initiale}
          </span>
        </button>
      </InfoBulle>

      {ouvert && (
        <div
          id="menu-profil"
          role="group"
          aria-label="Mon compte"
          className="kc-apparait absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-kc-bord bg-kc-carte p-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)]"
        >
          <div className="px-3 py-2">
            <p className="text-xs text-kc-sable">Connecté en tant que</p>
            <p className="mt-0.5 text-sm font-semibold text-kc-creme truncate">{email}</p>
          </div>
          <div className="my-1 border-t border-kc-bord" />
          <button
            ref={premier}
            type="button"
            onClick={() => {
              setOuvert(false);
              onReglages();
            }}
            className={`${ligne} text-kc-creme hover:bg-white/5`}
          >
            <Store className="w-4 h-4 text-kc-sable" aria-hidden /> Réglages de la boutique
          </button>
          <button type="button" onClick={onDeconnexion} className={`${ligne} text-rose-300 hover:bg-rose-500/10`}>
            <LogOut className="w-4 h-4" aria-hidden /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
