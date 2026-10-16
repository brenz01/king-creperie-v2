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

// Le client choisit son quartier (ce qu'il connaît), pas une « zone » :
// la zone et les frais en découlent. Source unique pour l'affichage ;
// le serveur reçoit zone_id et recalcule les frais lui-même.
export interface Quartier {
  nom: string;
  zoneId: number;
}

export const QUARTIERS: readonly Quartier[] = [
  { nom: 'Almadies', zoneId: 1 },
  { nom: 'Fann', zoneId: 2 },
  { nom: 'Liberté 6', zoneId: 2 },
  { nom: 'Maristes', zoneId: 3 },
  { nom: 'Mermoz', zoneId: 2 },
  { nom: 'Ngor', zoneId: 1 },
  { nom: 'Ouakam', zoneId: 1 },
  { nom: 'Plateau', zoneId: 3 },
  { nom: 'Point E', zoneId: 2 },
  { nom: 'VDN', zoneId: 3 },
  { nom: 'Yoff', zoneId: 3 },
];

export const FRAIS_MIN = Math.min(...ZONES_LIVRAISON.map((z) => z.prix));
export const FRAIS_MAX = Math.max(...ZONES_LIVRAISON.map((z) => z.prix));

export function trouverQuartier(nom: string): Quartier | undefined {
  return QUARTIERS.find((q) => q.nom === nom);
}
