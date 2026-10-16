'use client';

import { Clock } from 'lucide-react';
import { useBoutique } from '@/lib/useBoutique';
import { phraseFermeture } from '@/lib/horaires';

// Ouvert / fermé, visible dès l'accueil : le client sait tout de suite
// s'il peut commander, au lieu de le découvrir à la fin du panier.
export function PastilleBoutique() {
  const { etat } = useBoutique();
  if (!etat) return null;
  return (
    <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-semibold">
      <span className={`w-2 h-2 rounded-full ${etat.ouvert ? 'bg-emerald-400' : 'bg-kc-bissap'}`} aria-hidden />
      {etat.ouvert
        ? etat.fermeA
          ? `Ouvert, commandes jusqu’à ${etat.fermeA}`
          : 'Ouvert, commandez maintenant'
        : etat.enPause
          ? 'Commandes en pause'
          : etat.prochaineOuverture
            ? `Fermé, ouverture ${etat.prochaineOuverture}`
            : 'Fermé pour le moment'}
    </p>
  );
}

export function AvisFermeture() {
  const { etat } = useBoutique();
  if (!etat || etat.ouvert) return null;
  return (
    <div role="status" className="mt-5 max-w-xl rounded-2xl bg-kc-beurre text-kc-encre p-4 flex gap-3">
      <Clock className="w-5 h-5 shrink-0 mt-0.5 text-kc-indigo" />
      <div>
        <p className="font-semibold">{phraseFermeture(etat)}</p>
        <p className="text-sm text-kc-encre/70 mt-1">Vous pouvez déjà regarder la carte et préparer votre panier.</p>
      </div>
    </div>
  );
}
