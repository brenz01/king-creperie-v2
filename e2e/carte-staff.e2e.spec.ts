import { test, expect, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';
import { connecterStaff, reinitialiser } from './outils';

// KC Staff → La carte : ajouter, modifier, supprimer un produit (nom,
// photo, prix, catégorie, description), et le voir côté client.

test.beforeEach(async ({ page }) => {
  await reinitialiser();
  await connecterStaff(page);
  await page.goto('/admin/dashboard');
  await page.locator('nav[aria-label="Sections"] button', { hasText: 'Carte' }).click();
});

// Petite image PNG valide (dégradé), générée sans dépendance.
function png(l = 64, h = 48): Buffer {
  const crc = (b: Buffer) => {
    let c = ~0;
    for (const x of b) {
      c ^= x;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const bloc = (type: string, data: Buffer) => {
    const t = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(t));
    return Buffer.concat([len, t, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(l, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const lignes = Buffer.concat(
    Array.from({ length: h }, (_, y) =>
      Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: l }, (_, x) => [200, 120 + x, 40 + y]).flat())]),
    ),
  );
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', ihdr),
    bloc('IDAT', deflateSync(lignes)),
    bloc('IEND', Buffer.alloc(0)),
  ]);
}

const fiche = (page: Page) => page.getByRole('dialog');

test('ajouter une gaufre avec photo, puis la voir sur la carte client', async ({ page }) => {
  await page.getByRole('button', { name: 'Ajouter un produit' }).click();
  const f = fiche(page);
  await expect(f.getByRole('heading', { name: 'Ajouter un produit' })).toBeVisible();
  await expect(f.getByLabel('Nom')).toBeFocused();

  // Envoi sans rien remplir : erreurs claires, focus sur le premier champ fautif.
  await f.getByRole('button', { name: 'Ajouter à la carte' }).click();
  await expect(f.getByText('Donnez un nom au produit (2 caractères au moins).')).toBeVisible();
  await expect(f.getByText('Indiquez le prix en francs CFA.')).toBeVisible();
  await expect(f.getByLabel('Nom')).toBeFocused();

  await f.getByLabel('Nom').fill('Gaufre Nutella');
  await expect(f.getByText('Donnez un nom au produit (2 caractères au moins).')).toHaveCount(0);
  await f.getByText('Gaufres', { exact: true }).click();
  await expect(f.getByText('Les clients pourront y ajouter des extras (Nutella, chantilly…).')).toBeVisible();
  await f.getByLabel('Prix').fill('1 500');
  await f.getByLabel(/Description/).fill('Gaufre croustillante, Nutella fondant.');
  await f.locator('input[type="file"]').setInputFiles({ name: 'gaufre.png', mimeType: 'image/png', buffer: png() });
  await expect(f.getByRole('img', { name: 'Photo de Gaufre Nutella' })).toBeVisible();
  await expect(f.getByText('Changer la photo')).toBeVisible();

  await f.getByRole('button', { name: 'Ajouter à la carte' }).click();
  await expect(page.getByText('Ajouté à la carte : Gaufre Nutella.')).toBeVisible();
  await expect(fiche(page)).toHaveCount(0);
  const rubrique = page.locator('div', { has: page.getByRole('heading', { name: 'Gaufres', exact: true }) }).last();
  await expect(rubrique).toContainText('Gaufre Nutella');
  await expect(rubrique).toContainText('1 500 F');

  // Côté client : nouvel onglet « Gaufres », la gaufre avec sa photo déposée.
  await page.goto('/#carte');
  const onglets = page.getByRole('group', { name: 'Catégories' });
  await onglets.getByRole('button', { name: 'Gaufres', exact: true }).click();
  const carteClient = page.locator('#carte');
  await expect(carteClient.getByText('Gaufre Nutella')).toBeVisible();
  // La photo déposée depuis KC Staff s'affiche réellement (image décodée).
  const photo = carteClient.locator('[aria-label="Gaufre Nutella"] img').first();
  await expect(photo).toHaveAttribute('src', /\/storage\/v1\/object\/public\/produits\/carte\/.+\.(webp|jpg)/);
  await expect.poll(() => photo.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  // Une gaufre accepte les extras : sa fiche s'ouvre, et l'ajout parle de gaufre.
  await carteClient.getByRole('button', { name: 'Composer Gaufre Nutella', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Partager cette gaufre')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /Ajouter au panier/ }).click();
  await expect(page.getByText('Gaufre ajoutée').first()).toBeVisible();
});

test('modifier le prix et le nom d’un produit', async ({ page }) => {
  await page.getByRole('button', { name: 'Modifier Crêpe Jambon Fromage', exact: true }).click();
  const f = fiche(page);
  await expect(f.getByRole('heading', { name: 'Modifier « Crêpe Jambon Fromage »' })).toBeVisible();
  await expect(f.getByLabel('Prix')).toHaveValue('2000');

  await f.getByLabel('Prix').fill('20');
  await f.getByLabel('Prix').blur();
  await expect(f.getByText('Entre 50 et 1 000 000 F.')).toBeVisible();
  await f.getByLabel('Prix').fill('2200');
  await expect(f.getByText('Entre 50 et 1 000 000 F.')).toHaveCount(0);
  await f.getByLabel('Nom').fill('Crêpe Jambon Emmental');
  await f.getByRole('button', { name: 'Enregistrer les modifications' }).click();

  await expect(page.getByText('Modifications enregistrées : Crêpe Jambon Emmental.')).toBeVisible();
  const ligne = page.locator('li', { hasText: 'Crêpe Jambon Emmental' });
  await expect(ligne).toContainText('2 200 F');
});

test('supprimer un produit demande une confirmation nommée', async ({ page }) => {
  await page.getByRole('button', { name: 'Modifier Jus de Bouye', exact: true }).click();
  const f = fiche(page);
  await f.getByRole('button', { name: 'Supprimer ce produit' }).click();
  await expect(f.getByText('Supprimer « Jus de Bouye » de la carte ?')).toBeVisible();
  await expect(f.getByRole('button', { name: 'Garder le produit' })).toBeFocused();

  // Échap annule la confirmation, sans fermer la fiche.
  await page.keyboard.press('Escape');
  await expect(f.getByRole('button', { name: 'Supprimer ce produit' })).toBeVisible();

  await f.getByRole('button', { name: 'Supprimer ce produit' }).click();
  await f.getByRole('button', { name: 'Supprimer « Jus de Bouye »' }).click();
  await expect(page.getByText('Supprimé de la carte : Jus de Bouye.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Modifier Jus de Bouye', exact: true })).toHaveCount(0);
});

test('Échap ferme la fiche sans rien enregistrer', async ({ page }) => {
  await page.getByRole('button', { name: 'Modifier Crêpe Nutella', exact: true }).click();
  await fiche(page).getByLabel('Nom').fill('Ne pas garder');
  await page.keyboard.press('Escape');
  await expect(fiche(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Modifier Crêpe Nutella', exact: true })).toBeFocused();
  await expect(page.getByText('Ne pas garder')).toHaveCount(0);
});

test('la revalidation de la carte est réservée au staff', async ({ request }) => {
  expect((await request.post('/api/admin/carte')).status()).toBe(401);
  expect((await request.post('/api/admin/carte', { headers: { Authorization: 'Bearer pas-un-jeton' } })).status()).toBe(403);
});
