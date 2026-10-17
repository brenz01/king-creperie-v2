import { test, expect } from '@playwright/test';
import {
  bilanDuJour,
  cleTelephone,
  clients,
  commandesParHeure,
  ecart,
  exportCsv,
  memeJourSemaineDerniere,
  plageHeures,
  vitesseService,
  type CommandeResume,
} from '../src/lib/staff/statistiques';

const c = (id: string, created_at: string, total: number, statut: CommandeResume['statut'], tel = '771234567', nom = 'Awa'): CommandeResume => ({
  id,
  created_at,
  total,
  statut,
  client_telephone: tel,
  client_nom: nom,
});

const jeu = [
  c('a', '2026-10-16T12:10:00Z', 3000, 'livree'),
  c('b', '2026-10-16T12:40:00Z', 5000, 'en_preparation', '+221 76 555 11 22', 'Moussa'),
  c('d', '2026-10-16T19:05:00Z', 2000, 'annulee'),
  c('e', '2026-10-09T12:30:00Z', 4000, 'livree', '77 123 45 67', 'Awa N.'),
];

test('bilan du jour : livrées encaissées, annulées à part', () => {
  expect(bilanDuJour(jeu, '2026-10-16')).toEqual({
    commandes: 2,
    encaisse: 3000,
    aEncaisser: 5000,
    panierMoyen: 4000,
    annulees: 1,
  });
});

test('écart et même jour la semaine dernière', () => {
  expect(ecart(150, 100)).toBe(50);
  expect(ecart(50, 0)).toBeNull();
  expect(memeJourSemaineDerniere(new Date('2026-10-16T08:00:00Z'))).toBe('2026-10-09');
});

test('commandes par heure (heure de Dakar) et plage affichée', () => {
  const h = commandesParHeure(jeu, '2026-10-16');
  expect(h[12]).toBe(2);
  expect(h[19]).toBe(0); // annulée
  expect(plageHeures(h)).toEqual([11, 23]);
  const tot = Array.from({ length: 24 }, () => 0);
  tot[9] = 1;
  expect(plageHeures(tot)).toEqual([9, 23]);
});

test('vitesse du service : médianes par étape, journal incomplet ignoré', () => {
  const journal = [
    { commande_id: 'a', nouveau_statut: 'en_preparation', created_at: '2026-10-16T12:16:00Z' },
    { commande_id: 'a', nouveau_statut: 'en_livraison', created_at: '2026-10-16T12:30:00Z' },
    { commande_id: 'a', nouveau_statut: 'livree', created_at: '2026-10-16T12:52:00Z' },
    // e : pas de passage « en_livraison » enregistré, ignorée.
    { commande_id: 'e', nouveau_statut: 'en_preparation', created_at: '2026-10-09T12:35:00Z' },
    { commande_id: 'e', nouveau_statut: 'livree', created_at: '2026-10-09T13:10:00Z' },
  ];
  expect(vitesseService(jeu, journal)).toEqual({ avantCuisine: 6, enCuisine: 14, livraison: 22, total: 42, echantillon: 1 });
  expect(vitesseService(jeu, []).total).toBeNull();
});

test('clients regroupés par numéro, quel que soit le format', () => {
  expect(cleTelephone('+221 77 123 45 67')).toBe('771234567');
  const liste = clients(jeu);
  expect(liste).toHaveLength(2);
  expect(liste[0]).toMatchObject({ nom: 'Awa', commandes: 2, depense: 7000, premiere: '2026-10-09T12:30:00Z' });
  expect(liste[1]).toMatchObject({ nom: 'Moussa', commandes: 1, depense: 5000 });
});

test('export CSV : point-virgule, guillemets échappés, BOM pour Excel', () => {
  const csv = exportCsv([c('abcdef12-0000', '2026-10-16T12:10:00Z', 3000, 'livree', '771234567', 'Awa "la reine"; Ndiaye')]);
  expect(csv.startsWith('﻿Date;Heure;Commande')).toBe(true);
  expect(csv).toContain('2026-10-16;12:10;ABCDEF12;"Awa ""la reine""; Ndiaye";771234567;livree;3000');
});
