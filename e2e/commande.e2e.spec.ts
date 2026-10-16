import { test, expect } from '@playwright/test';
import { changerStatut, journal, reinitialiser } from './outils';

// Parcours client complet : carte → fiche → panneau panier → livraison
// → WhatsApp → suivi. Prix du faux catalogue : Eau minérale 500 F,
// Crêpe Jambon Fromage 2 000 F + Double fromage 500 F, livraison Mermoz 1 500 F.
const TOTAL_ATTENDU = 500 + 2000 + 500 + 1500;

test.beforeEach(async () => {
  await reinitialiser();
});

test('commande de bout en bout', async ({ page, context }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));

  await page.goto('/');
  await expect(page.locator('#carte-salee')).toContainText('7 recettes');
  await expect(page.locator('#carte-boisson')).toContainText('6 boissons');

  // « Tout voir » : la rubrique passe en grille, puis revient en rangée.
  await page.locator('#carte-sucree').getByRole('button', { name: 'Tout voir' }).click();
  await expect(page.locator('#carte-sucree ul.grid li')).toHaveCount(7);
  await page.locator('#carte-sucree').getByRole('button', { name: 'Faire défiler' }).click();

  // Boisson : ajout direct.
  await page.locator('#carte-boisson li button').first().click();
  await expect(page.getByText('ajouté au panier.')).toBeVisible();

  // Crêpe : fiche, extras facultatifs, aucun présélectionné.
  await page.locator('#carte-salee li button').first().click();
  const fiche = page.getByRole('dialog');
  await expect(fiche).toContainText('Extras (facultatif)');
  await expect(fiche.locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(fiche.getByRole('button', { name: 'Partager cette crêpe' })).toBeVisible();
  await fiche.getByRole('button', { name: /Double fromage/ }).click();
  await fiche.getByRole('button', { name: /Ajouter au panier/ }).click();
  await expect(page.getByText('Crêpe ajoutée au panier.')).toBeVisible();

  // Panneau panier sur la même page.
  const barre = page.getByRole('button', { name: /Voir mon panier/ });
  await expect(barre).toContainText('2 articles');
  await barre.click();
  const panneau = page.getByRole('dialog', { name: 'Votre commande' });
  await expect(panneau).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(panneau).toContainText(/de 1\s000 F à 2\s000 F/);

  await panneau.getByRole('button', { name: 'Passer à la livraison' }).click();
  await page.selectOption('#quartier', 'Mermoz');
  await expect(panneau).toContainText('Livraison à Mermoz');
  await page.fill('#nom', 'Awa Ndiaye');
  await page.fill('#tel', '12 34');
  await page.fill('#adresse', 'Villa 12, rue MZ-40');
  await page.fill('#repere', 'En face de la boulangerie');

  // Fermer puis rouvrir : le formulaire est conservé.
  await panneau.getByRole('button', { name: 'Fermer le panier' }).click();
  await page.getByRole('button', { name: /Voir mon panier/ }).click();
  await page.getByRole('dialog', { name: 'Votre commande' }).getByRole('button', { name: 'Passer à la livraison' }).click();
  await expect(page.locator('#nom')).toHaveValue('Awa Ndiaye');
  await expect(page.locator('#quartier')).toHaveValue('Mermoz');

  // Téléphone invalide refusé par le serveur, puis commande acceptée.
  await panneau.getByRole('button', { name: 'Valider ma commande' }).click();
  await expect(panneau.getByRole('alert')).toContainText('téléphone');
  await page.fill('#tel', '77 123 45 67');
  await panneau.getByRole('button', { name: 'Valider ma commande' }).click();
  await expect(panneau.getByText('Dernière étape')).toBeVisible();

  const wa = panneau.getByRole('link', { name: 'Envoyer sur WhatsApp pour confirmer' });
  const href = decodeURIComponent((await wa.getAttribute('href')) ?? '');
  expect(href).toMatch(/^https:\/\/wa\.me\//);
  expect(href).toContain('je souhaite confirmer ma commande');
  expect(href).toContain('Repère : En face de la boulangerie');

  // Une seule commande, total calculé côté serveur.
  const log = await journal();
  expect(log.rpcLog).toHaveLength(1);
  expect(log.rpcLog[0].p_total).toBe(TOTAL_ATTENDU);
  expect(log.rpcLog[0].p_adresse_livraison.startsWith('Mermoz, Villa 12')).toBe(true);

  const [whatsapp] = await Promise.all([context.waitForEvent('page'), wa.click()]);
  await whatsapp.close();

  // Suivi.
  await panneau.getByRole('link', { name: 'Suivre ma commande' }).click();
  await page.waitForURL(/\/suivi\?id=/);
  await expect(page.getByText('Jërëjëf pour votre commande')).toBeVisible();
  await expect(page.locator('body')).toContainText('Demande reçue');
  await expect(page.locator('body')).toContainText('Dernière mise à jour à');
  await expect(page.locator('body')).not.toContainText('min environ');

  await changerStatut(log.commandes[0].id, 'en_preparation');
  await page.getByRole('button', { name: 'Actualiser le suivi' }).click();
  await expect(page.locator('body')).toContainText('Vos crêpes sont sur la plaque.');
  await expect(page.getByRole('button', { name: /Voir mon panier/ })).toHaveCount(0);

  expect(erreurs).toEqual([]);
});

test('lien partagé : ouvre directement la fiche', async ({ page }) => {
  await page.goto('/?produit=00000000-0000-4000-8000-000000000009#carte');
  await expect(page.getByRole('dialog')).toContainText('Crêpe Beurre Sucre');
});

test('pages de secours', async ({ page }) => {
  await page.goto('/commande');
  await expect(page.locator('body')).toContainText('Votre panier est vide');
  await page.goto('/suivi?id=11111111-1111-4111-8111-111111111111');
  await expect(page.locator('body')).toContainText('Vérifiez le lien reçu sur WhatsApp');
  await page.goto('/une-page-qui-nexiste-pas');
  await expect(page.locator('body')).toContainText('Cette page n’est pas sur la plaque.');
});
