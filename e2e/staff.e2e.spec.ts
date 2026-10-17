import { test, expect } from '@playwright/test';
import { connecterStaff, reinitialiser } from './outils';

// KC Staff : une action par commande, carte modifiable d'un geste,
// pause des commandes depuis l'écran Boutique.
test.beforeEach(async ({ page }) => {
  await reinitialiser();
  await connecterStaff(page);
  await page.goto('/admin/dashboard');
});

const onglet = (page: import('@playwright/test').Page, nom: string) =>
  page.locator('nav[aria-label="Sections"] button', { hasText: nom });

test('commandes : la commande à lancer passe en préparation', async ({ page }) => {
  const premiere = page.locator('article').first();
  await expect(premiere).toContainText('Awa Ndiaye');
  await expect(premiere).toContainText('À lancer');
  await premiere.getByRole('button', { name: 'Lancer la préparation' }).click();
  await expect(page.locator('article', { hasText: 'Awa Ndiaye' })).toContainText('En préparation');
  await expect(
    page.locator('article', { hasText: 'Awa Ndiaye' }).getByRole('button', { name: 'Remettre au livreur' }),
  ).toBeVisible();
});

test('commandes : l’annulation demande une confirmation', async ({ page }) => {
  const carte = page.locator('article', { hasText: 'Awa Ndiaye' });
  await carte.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(carte).toContainText('Annuler la commande de Awa Ndiaye ?');
  await expect(carte.getByRole('button', { name: 'Garder la commande' })).toBeFocused();
  await carte.getByRole('button', { name: 'Garder la commande' }).click();
  await expect(carte.getByRole('button', { name: 'Lancer la préparation' })).toBeVisible();
});

test('carte : retirer un produit d’un geste', async ({ page }) => {
  await onglet(page, 'Carte').click();
  const interrupteur = page.getByRole('switch', { name: 'Crêpe Jambon Fromage sur la carte' });
  await expect(interrupteur).toHaveAttribute('aria-checked', 'true');
  await interrupteur.click();
  await expect(page.getByText('Crêpe Jambon Fromage est retiré de la carte.')).toBeVisible();
});

test('boutique : pause des commandes et horaires', async ({ page }) => {
  await onglet(page, 'Boutique').click();
  await expect(page.getByText('Les clients peuvent commander.')).toBeVisible();

  await page.getByRole('switch', { name: 'Mettre les commandes en pause' }).click();
  await expect(page.getByText('Commandes en pause.')).toBeVisible();
  await expect(page.locator('header')).toContainText('En pause');
  await onglet(page, 'Commandes').click();
  await expect(page.getByText(/Les clients ne\s+peuvent pas commander/)).toBeVisible();

  await onglet(page, 'Boutique').click();
  await page.getByRole('switch', { name: 'Mettre les commandes en pause' }).click();
  await expect(page.getByText('Commandes reprises.')).toBeVisible();

  // Horaires : dimanche fermé, enregistrement.
  await page.getByRole('switch', { name: 'Ouvert le dimanche' }).click();
  await page.getByRole('button', { name: 'Enregistrer les horaires' }).click();
  await expect(page.getByText('Horaires enregistrés. Le site est à jour.')).toBeVisible();
  await expect(page.getByText(/Dim\. fermé/)).toBeVisible();
});

test('son des nouvelles commandes : coupé par défaut, mémorisé sur l’appareil', async ({ page }) => {
  const activer = page.getByRole('button', { name: 'Activer le son des nouvelles commandes' });
  await expect(activer).toHaveAttribute('aria-pressed', 'false');
  await activer.click();
  await expect(page.getByRole('button', { name: 'Couper le son des nouvelles commandes' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Couper le son des nouvelles commandes' })).toBeVisible();
});
