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
    <p className="kc-fondu mt-6 self-start inline-flex items-center gap-2 rounded-full bg-white border border-stone-200 px-3.5 py-1.5 text-sm font-semibold text-stone-700">
      <span className={`w-2 h-2 rounded-full ${etat.ouvert ? 'bg-emerald-600' : 'bg-rose-600'}`} aria-hidden />
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
    <div role="status" className="max-w-2xl mx-auto mt-6 rounded-xl bg-amber-50/80 border border-amber-200/70 text-stone-800 p-4 flex gap-3 text-left">
      <Clock className="w-5 h-5 shrink-0 mt-0.5 text-amber-700" />
      <div>
        <p className="font-semibold">{phraseFermeture(etat)}</p>
        <p className="text-sm text-stone-600 mt-1">Vous pouvez déjà regarder la carte et préparer votre panier.</p>
      </div>
    </div>
  );
}
