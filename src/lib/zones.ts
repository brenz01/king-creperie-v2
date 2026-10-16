// Source unique des zones de livraison — importée par le tunnel de
// commande (affichage) ET par /api/commandes (calcul serveur), pour
// qu'un changement de tarif ne puisse plus diverger entre les deux.
export interface ZoneLivraison {
  id: number;
  nom: string;
  prix: number;
}

export const ZONES_LIVRAISON: readonly ZoneLivraison[] = [
  { id: 1, nom: 'Zone 1 (Almadies, Ngor, Ouakam)', prix: 1000 },
  { id: 2, nom: 'Zone 2 (Mermoz, Fann, Point E, Liberté 6)', prix: 1500 },
  { id: 3, nom: 'Zone 3 (Plateau, Yoff, Maristes, VDN)', prix: 2000 },
] as const;

export function trouverZone(id: number): ZoneLivraison | undefined {
  return ZONES_LIVRAISON.find((z) => z.id === id);
}
