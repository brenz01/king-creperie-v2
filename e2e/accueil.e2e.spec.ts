import { test, expect } from '@playwright/test';

// Le catalogue doit être dans le HTML rendu par le serveur, pas seulement
// chargé ensuite par le navigateur.
//
// Ce fichier passe en premier (ordre alphabétique, un seul worker) : la
// première requête sur « / » reçoit la page générée au build (servie
// telle quelle, ou en « stale » pendant la régénération ISR). Il vérifie
// donc que le build a bien eu accès au faux Supabase (e2e/build.mjs).

test('HTML initial : le catalogue est rendu côté serveur', async ({ request }) => {
  // Requête HTTP brute : aucun JavaScript exécuté, aucun appel Supabase
  // depuis un navigateur ne peut faire passer ce test.
  const reponse = await request.get('/');
  expect(reponse.status()).toBe(200);
  const html = await reponse.text();
  expect(html).toContain('Crêpe Jambon Fromage');
  expect(html).toContain('Eau minérale');
  expect(html).not.toContain('Chargement de la carte');
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('la carte affiche les onglets et toutes les crêpes', async ({ page }) => {
    await page.goto('/');
    const carte = page.locator('#carte');
    await expect(carte.getByRole('button', { name: 'Salées' })).toBeVisible();
    await expect(carte.locator('article')).toHaveCount(20);
    await expect(carte.locator('h3').first()).toHaveText('Crêpe Jambon Fromage');
    // Sans JavaScript, les cartes restent visibles (animation CSS, pas JS).
    await expect(carte.locator('article').first()).toHaveCSS('opacity', '1');
  });
});
