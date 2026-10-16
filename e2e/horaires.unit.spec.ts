import { test, expect } from '@playwright/test';
import { etatBoutique, phraseFermeture, SchemaHoraires, type Boutique } from '../src/lib/horaires';
import { tousLesJours } from './outils';

// Tests unitaires du calcul ouvert / fermé (sans navigateur).
// Le 16/10/2026 est un vendredi ; Dakar = UTC.
const b = (horaires: Boutique['horaires'], pause = false, message: string | null = null): Boutique => ({
  horaires,
  fermeture_exceptionnelle: pause,
  message_fermeture: message,
});
const a = (iso: string) => new Date(`${iso}Z`);
const soir = tousLesJours([{ ouvre: '17:00', ferme: '23:00' }]);

test('ouvert toute la journée par défaut', () => {
  const e = etatBoutique(b(tousLesJours([{ ouvre: '00:00', ferme: '24:00' }])), a('2026-10-16T03:00:00'));
  expect(e.ouvert).toBe(true);
  expect(e.fermeA).toBeNull();
});

test('fermé avant l’ouverture, avec la prochaine ouverture', () => {
  const e = etatBoutique(b(soir), a('2026-10-16T15:00:00'));
  expect(e.ouvert).toBe(false);
  expect(e.prochaineOuverture).toBe('aujourd’hui à 17 h');
  expect(phraseFermeture(e)).toBe('Nous sommes fermés. Ouverture aujourd’hui à 17 h.');
});

test('ouvert pendant la plage, avec l’heure de fermeture', () => {
  const e = etatBoutique(b(soir), a('2026-10-16T18:30:00'));
  expect(e).toMatchObject({ ouvert: true, fermeA: '23 h' });
});

test('fermé après la fermeture : réouverture demain', () => {
  expect(etatBoutique(b(soir), a('2026-10-16T23:30:00')).prochaineOuverture).toBe('demain à 17 h');
});

test('plage après minuit (18 h → 1 h)', () => {
  const nuit = tousLesJours([{ ouvre: '18:00', ferme: '01:00' }]);
  expect(etatBoutique(b(nuit), a('2026-10-17T00:30:00'))).toMatchObject({ ouvert: true, fermeA: '1 h' });
  expect(etatBoutique(b(nuit), a('2026-10-17T01:30:00')).ouvert).toBe(false);
});

test('jour de fermeture sauté', () => {
  const sansDimanche = { ...tousLesJours([{ ouvre: '17:00', ferme: '22:30' }]), '0': [] };
  // samedi 23 h : dimanche fermé → lundi
  expect(etatBoutique(b(sansDimanche), a('2026-10-17T23:00:00')).prochaineOuverture).toBe('lundi à 17 h');
});

test('la pause prime sur les horaires et affiche le message du gérant', () => {
  const e = etatBoutique(
    b(tousLesJours([{ ouvre: '00:00', ferme: '24:00' }]), true, 'Fermé ce soir, à demain.'),
    a('2026-10-16T12:00:00'),
  );
  expect(e).toMatchObject({ ouvert: false, enPause: true });
  expect(phraseFermeture(e)).toBe('Fermé ce soir, à demain.');
});

test('validation des horaires', () => {
  expect(SchemaHoraires.safeParse(tousLesJours([{ ouvre: '17:00', ferme: '17:00' }])).success).toBe(false);
  expect(SchemaHoraires.safeParse({ '1': [{ ouvre: '25:00', ferme: '01:00' }] }).success).toBe(false);
  expect(SchemaHoraires.safeParse(tousLesJours([])).success).toBe(true);
});
