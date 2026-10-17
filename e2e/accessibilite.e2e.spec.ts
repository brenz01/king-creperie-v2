import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { connecterStaff, reinitialiser } from './outils';

// Accessibilité automatisée (axe-core, règles WCAG 2.0/2.1 A et AA) sur
// chaque écran : accueil et carte, fiche, panier, suivi, espace staff.
// Les animations d'entrée sont coupées (prefers-reduced-motion) pour que
// les contrastes soient mesurés sur l'état final.
test.use({ contextOptions: { reducedMotion: 'reduce' } });

async function analyser(page: Page, ecran: string) {
  await page.waitForTimeout(400);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const resume = violations.map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}`);
  expect(resume, `${ecran} : violations WCAG`).toEqual([]);
}

test.beforeEach(async () => {
  await reinitialiser();
});

test('accueil, carte, fiche et panier', async ({ page }) => {
  await page.goto('/');
  await analyser(page, 'accueil');
  await page.locator('#carte').getByRole('button', { name: 'Ajouter Eau minérale' }).click();
  await analyser(page, 'carte avec panier');
  await page.locator('#carte').getByRole('button', { name: 'Composer Crêpe Jambon Fromage', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await analyser(page, 'fiche produit');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Voir mon panier/ }).click();
  await expect(page.getByRole('dialog', { name: 'Votre commande' })).toBeVisible();
  await analyser(page, 'panneau panier');
});

test('suivi de commande', async ({ page, request }) => {
  const r = await request.post('/api/commandes', {
    data: {
      client_nom: 'Test Accessibilité',
      // Numéro dédié : la limite anti-spam (4 commandes / 10 min) est par numéro.
      client_telephone: '781234567',
      adresse_precise: 'Mermoz, villa test',
      zone_id: 2,
      items: [{ produit_id: '00000000-0000-4000-8000-000000000015', quantite: 1, extras_ids: [] }],
    },
  });
  const { id } = await r.json();
  await page.goto(`/suivi?id=${id}`);
  await expect(page.getByText('Dernière mise à jour à')).toBeVisible();
  await analyser(page, 'suivi');
});

test('espace staff', async ({ page }) => {
  await page.goto('/admin/login');
  await analyser(page, 'connexion staff');
  await connecterStaff(page);
  await page.goto('/admin/dashboard');
  await expect(page.locator('article').first()).toBeVisible();
  await analyser(page, 'commandes staff');
  for (const onglet of ['Carte', 'Boutique']) {
    await page.locator('nav[aria-label="Sections"] button', { hasText: onglet }).click();
    await analyser(page, `${onglet} staff`);
  }
});

test('page introuvable', async ({ page }) => {
  await page.goto('/une-page-qui-nexiste-pas');
  await analyser(page, '404');
});

// Aucune page ne déborde en largeur sur un petit téléphone (375 px) ni
// sur ordinateur (1280 px), panier rempli.
for (const largeur of [375, 1280]) {
  test(`aucun débordement horizontal à ${largeur} px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 800 });
    const deborde = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.goto('/');
    await page.locator('#carte').getByRole('button', { name: 'Ajouter Eau minérale' }).click();
    expect(await deborde(), 'accueil').toBeLessThanOrEqual(0);
    await page.goto('/suivi');
    expect(await deborde(), 'suivi').toBeLessThanOrEqual(0);
    await connecterStaff(page);
    await page.goto('/admin/dashboard');
    await expect(page.locator('article').first()).toBeVisible();
    expect(await deborde(), 'staff').toBeLessThanOrEqual(0);
  });
}

// Le suivi tient sur un seul écran de téléphone, sans défilement, même
// avec le bouton WhatsApp à envoyer.
for (const [l, h] of [[360, 640], [390, 844]]) {
  test(`suivi sans défilement à ${l} × ${h}`, async ({ page, request }) => {
    await page.setViewportSize({ width: l, height: h });
    const r = await request.post('/api/commandes', {
      data: {
        client_nom: 'Test Écran',
        client_telephone: '761234567',
        adresse_precise: 'Mermoz, villa test',
        zone_id: 2,
        items: [{ produit_id: '00000000-0000-4000-8000-000000000015', quantite: 1, extras_ids: [] }],
      },
    });
    const { id } = await r.json();
    // Message WhatsApp pas encore envoyé : le bouton vert est affiché.
    await page.goto('/');
    await page.evaluate((cle) => sessionStorage.setItem(cle, 'Bonjour King Crêperie'), `king_creperie_wa_${id}`);
    await page.goto(`/suivi?id=${id}`);
    await expect(page.getByRole('link', { name: 'Envoyer sur WhatsApp pour confirmer' })).toBeVisible();
    const depasse = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    expect(depasse, 'hauteur en trop (px)').toBeLessThanOrEqual(0);
    // L'aide s'ouvre dans une feuille, puis se referme avec Échap.
    await page.getByRole('button', { name: 'Aide et options' }).click();
    await expect(page.getByRole('dialog', { name: 'Besoin d’aide ?' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
