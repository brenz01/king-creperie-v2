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
  // Repliée par défaut : l'action apparaît en dépliant la carte.
  await expect(premiere.getByRole('button', { name: 'Lancer la préparation' })).toHaveCount(0);
  await premiere.locator('button[aria-expanded]').click();
  await expect(premiere.locator('button[aria-expanded]')).toHaveAttribute('aria-expanded', 'true');
  await premiere.getByRole('button', { name: 'Lancer la préparation' }).click();
  await expect(page.locator('article', { hasText: 'Awa Ndiaye' })).toContainText('En préparation');
  await expect(
    page.locator('article', { hasText: 'Awa Ndiaye' }).getByRole('button', { name: 'Remettre au livreur' }),
  ).toBeVisible();
});

test('commandes : l’annulation demande une confirmation', async ({ page }) => {
  const carte = page.locator('article', { hasText: 'Awa Ndiaye' });
  await carte.locator('button[aria-expanded]').click();
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

test('aujourd’hui : chiffres du jour, vitesse, bilan et export', async ({ page }) => {
  await onglet(page, 'Aujourd’hui').click();
  const region = page.locator('main');
  await expect(region.getByText('Encaissé')).toBeVisible();
  await expect(region.getByText('Panier moyen')).toBeVisible();
  await expect(region.getByRole('img', { name: 'Commandes par heure' })).toBeVisible();
  await expect(region.getByText('de la commande à la livraison')).toBeVisible();
  const bilan = region.getByRole('link', { name: 'Envoyer le bilan sur WhatsApp' });
  expect(decodeURIComponent((await bilan.getAttribute('href')) ?? '')).toContain('Bilan King Crêperie');
  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    region.getByRole('button', { name: 'Exporter en CSV' }).click(),
  ]);
  expect(telechargement.suggestedFilename()).toMatch(/^king-creperie-ventes-.*\.csv$/);
  // « À faire » mène aux commandes.
  await region.getByRole('button', { name: /à lancer/ }).click();
  await expect(page.locator('article').first()).toContainText('Awa Ndiaye');
});

test('clients : regroupés par numéro, fidèles repérés', async ({ page }) => {
  await onglet(page, 'Clients').click();
  const awa = page.locator('main li', { hasText: 'Awa Ndiaye' });
  await expect(awa).toHaveCount(1);
  await expect(awa).toContainText('Fidèle');
  await expect(awa).toContainText('4 commandes');
  await page.getByRole('searchbox').fill('fatou');
  await expect(page.locator('main li')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Écrire à Fatou Sarr sur WhatsApp' })).toHaveAttribute('href', /wa\.me\/221782223344/);
});

test('ticket de cuisine : imprimé depuis la carte de commande', async ({ page }) => {
  await page.evaluate(() => {
    (window as unknown as { imprime: number }).imprime = 0;
    window.print = () => {
      (window as unknown as { imprime: number }).imprime++;
    };
  });
  await page.locator('article', { hasText: 'Awa Ndiaye' }).locator('button[aria-expanded]').click();
  await page.getByRole('button', { name: 'Imprimer le ticket de Awa Ndiaye' }).click();
  const ticket = page.locator('.ticket-impression');
  await expect(ticket).toContainText('2 × Crêpe Jambon Fromage Œuf');
  await expect(ticket).toContainText('7 300 F');
  await expect.poll(() => page.evaluate(() => (window as unknown as { imprime: number }).imprime)).toBe(1);
});

test('compte : menu avec l’adresse et la déconnexion', async ({ page }) => {
  await page.getByRole('button', { name: 'Mon compte' }).click();
  const menu = page.getByRole('group', { name: 'Mon compte' });
  await expect(menu).toContainText('staff@exemple.sn');
  await expect(menu.getByRole('button', { name: 'Se déconnecter' })).toBeVisible();
  await menu.getByRole('button', { name: 'Réglages de la boutique' }).click();
  await expect(page.getByText('Les clients peuvent commander.')).toBeVisible();
  await page.getByRole('button', { name: 'Mon compte' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: 'Mon compte' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mon compte' })).toBeFocused();
});
