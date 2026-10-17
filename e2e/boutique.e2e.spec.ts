import { test, expect } from '@playwright/test';
import { horairesFermesMaintenant, journal, reglerBoutique, reinitialiser } from './outils';

// Boutique fermée : le client le voit dès l'accueil, garde son panier,
// ne peut pas envoyer la commande ; le serveur refuse aussi.
const commandeValide = {
  client_nom: 'Test Fermeture',
  client_telephone: '771234567',
  adresse_precise: 'Mermoz, villa test',
  zone_id: 2,
  items: [{ produit_id: '00000000-0000-4000-8000-000000000015', quantite: 1, extras_ids: [] }],
};

test.beforeEach(async () => {
  await reinitialiser();
});

test('pause du gérant : bandeau, panier bloqué, serveur qui refuse', async ({ page, request }) => {
  await reglerBoutique({ fermeture_exceptionnelle: true, message_fermeture: 'Fermé ce soir, on rouvre demain à 17 h.' });
  await page.goto('/');
  await expect(page.getByText('Commandes en pause')).toBeVisible();
  await expect(page.locator('#carte')).toContainText('Fermé ce soir, on rouvre demain à 17 h.');

  // On peut quand même préparer son panier…
  await page.locator('#carte').getByRole('button', { name: 'Ajouter Eau minérale' }).click();
  await page.getByRole('button', { name: /Voir mon panier/ }).click();
  const panneau = page.getByRole('dialog', { name: 'Votre commande' });
  await expect(panneau).toContainText('Votre panier est gardé sur ce téléphone');
  // … mais pas l'envoyer.
  await panneau.getByRole('button', { name: 'Passer à la livraison' }).click();
  await expect(panneau.getByRole('alert')).toContainText('Les commandes sont fermées pour le moment');
  await expect(panneau.getByRole('heading', { name: 'Votre panier' })).toBeVisible();

  const r = await request.post('/api/commandes', { data: commandeValide });
  expect(r.status()).toBe(409);
  expect(await r.json()).toMatchObject({ ferme: true, error: 'Fermé ce soir, on rouvre demain à 17 h.' });
  expect((await journal()).rpcLog).toHaveLength(0);
});

test('hors horaires : prochaine ouverture annoncée et commande refusée', async ({ page, request }) => {
  await reglerBoutique({ horaires: horairesFermesMaintenant() });
  await page.goto('/');
  await expect(page.getByText(/Fermé, ouverture aujourd’hui à \d+ h|Fermé, ouverture demain à \d+ h/)).toBeVisible();

  const r = await request.post('/api/commandes', { data: commandeValide });
  expect(r.status()).toBe(409);
  expect((await r.json()).error).toMatch(/^Nous sommes fermés\. Ouverture (aujourd’hui|demain) à \d+ h\.$/);
});

test('ouvert : la même commande passe', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByText(/Ouvert, commandez maintenant/)).toBeVisible();
  const r = await request.post('/api/commandes', { data: commandeValide });
  expect(r.status()).toBe(200);
  expect((await journal()).rpcLog).toHaveLength(1);
});
