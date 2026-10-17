'use client';

import { useEffect } from 'react';
import type { Commande } from '@/types';
import { heure, numero, prix } from './commun';

// Ticket de cuisine (imprimante thermique 80 mm ou feuille A4) : invisible
// à l'écran, seul élément imprimé. L'impression part dès l'affichage.
export default function Ticket({ commande, onFini }: { commande: Commande; onFini: () => void }) {
  useEffect(() => {
    const fin = () => onFini();
    window.addEventListener('afterprint', fin);
    // Laisse le temps au ticket d'être peint avant d'ouvrir la boîte d'impression.
    const t = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('afterprint', fin);
    };
  }, [onFini]);

  const creneau = commande.creneau_souhaite && commande.creneau_souhaite !== 'Dès que possible' ? commande.creneau_souhaite : null;

  return (
    <div className="ticket-impression hidden print:block text-black bg-white font-sans text-[13px] leading-snug">
      <p className="text-center text-lg font-semibold">King Crêperie</p>
      <p className="text-center">
        Commande n° {numero(commande.id)}, {heure(commande.created_at)}
      </p>
      {creneau && <p className="mt-1 text-center font-semibold">Pour : {creneau}</p>}
      <hr className="my-2 border-black border-dashed" />
      <ul>
        {(commande.commande_items ?? []).map((it, i) => (
          <li key={it.id ?? i} className="py-0.5">
            <span className="font-semibold">{it.quantite} ×</span> {it.nom_produit}
            {it.extras && it.extras.length > 0 && <span className="block pl-4">+ {it.extras.map((e) => e.nom).join(', ')}</span>}
          </li>
        ))}
      </ul>
      <hr className="my-2 border-black border-dashed" />
      <p className="font-semibold">{commande.client_nom}</p>
      <p>{commande.client_telephone}</p>
      <p>{commande.adresse_livraison}</p>
      <hr className="my-2 border-black border-dashed" />
      <p className="flex justify-between font-semibold text-base">
        <span>Total à encaisser</span>
        <span>{prix(commande.total)}</span>
      </p>
      <p>Paiement en espèces à la livraison.</p>
    </div>
  );
}
