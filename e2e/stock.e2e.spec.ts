import { test, expect, type Page } from '@playwright/test';
import { MOCK, journal, reinitialiser } from './outils';

// Stock suivi : « Crêpe Viande Hachée (Fromage) » n'a plus que 2 portions
// dans le faux catalogue. Le client ne peut jamais en commander plus, ni
// depuis la carte, ni depuis la fiche, ni par un panier ancien, ni en
// appelant l'API directement.
const NOM = 'Crêpe Viande Hachée (Fromage)';

test.beforeEach(async () => {
  await reinitialiser();
});

const produitMock = async (nom: string) => {
  const r = await fetch(`${MOCK}/rest/v1/produits?select=*`);
  const tous: Array<{ id: string; nom: string } & Record<string, unknown>> = await r.json();
  return tous.find((p) => p.nom === nom)!;
};

async function ouvrirSalees(page: Page) {
  await page.goto('/#carte');
  const carte = page.locator('#carte');
  await carte.getByRole('group', { name: 'Catégories' }).getByRole('button', { name: 'Salées', exact: true }).click();
  return carte;
}

test('la fiche ne propose pas plus que le stock restant', async ({ page }) => {
  const carte = await ouvrirSalees(page);
  await expect(carte.locator(`[aria-label="${NOM}"]`)).toContainText('Plus que 2');
  await carte.getByRole('button', { name: `Composer ${NOM}`, exact: true }).click();
  const fiche = page.getByRole('dialog');
  await expect(fiche).toContainText('Plus que 2 en stock');
  const unDePlus = fiche.getByRole('button', { name: 'Une de plus' });
  await unDePlus.click();
  await expect(fiche.locator('output')).toHaveText('2');
  await expect(unDePlus).toHaveAttribute('aria-disabled', 'true');
  // Un appui de plus (forcé : le bouton est annoncé indisponible) ne change rien.
  await unDePlus.click({ force: true });
  await expect(fiche.locator('output')).toHaveText('2');
  await fiche.getByRole('button', { name: /Ajouter au panier/ }).click();
  const barre = page.getByRole('button', { name: /Voir mon panier/ });
  await expect(barre).toHaveAccessibleName(/2 articles/);

  // Sur la carte, le « + » du compteur est à sa limite : un appui l'explique sans rien ajouter.
  const compteur = carte.getByRole('group', { name: `${NOM} au panier` });
  await expect(compteur.locator('output')).toHaveText('2');
  const plus = compteur.getByRole('button', { name: `Une ${NOM} de plus` });
  await expect(plus).toHaveAttribute('aria-disabled', 'true');
  await plus.dispatchEvent('click');
  await expect(page.getByRole('status').filter({ hasText: 'Plus que 2 : toutes sont dans votre panier' })).toBeVisible();
  await expect(compteur.locator('output')).toHaveText('2');
  await expect(barre).toHaveAccessibleName(/2 articles/);

  // Même crêpe avec un extra : même stock, déjà entièrement au panier.
  await carte.getByRole('button', { name: `Composer ${NOM}`, exact: true }).click();
  await fiche.getByRole('button', { name: /Double fromage/ }).click();
  await expect(fiche.getByRole('button', { name: /Déjà tout au panier/ })).toBeDisabled();
  await expect(fiche).toContainText('Plus que 2 : toutes sont dans votre panier');
});

test('un panier ancien est ramené au stock restant', async ({ page }) => {
  const p = await produitMock(NOM);
  await page.goto('/');
  // Panier gardé depuis ce matin : 4 portions, quand le stock en avait encore.
  await page.evaluate(
    (produit) =>
      localStorage.setItem(
        'king_creperie_cart',
        JSON.stringify([{ produit: { ...produit, stock_quantite: 5 }, quantite: 4 }])
      ),
    p
  );
  await page.reload();
  const barre = page.getByRole('button', { name: /Voir mon panier/ });
  await expect(barre).toHaveAccessibleName(/2 articles/);
  await barre.click();
  const panneau = page.getByRole('dialog', { name: 'Votre commande' });
  await expect(panneau.locator('li output')).toHaveText('2');
  await expect(panneau.getByRole('button', { name: `Une ${NOM} de plus` })).toHaveAttribute('aria-disabled', 'true');
});

test('le serveur refuse une quantité supérieure au stock, même hors de l’interface', async ({ request }) => {
  const p = await produitMock(NOM);
  const commande = (items: Array<{ produit_id: string; quantite: number; extras_ids?: string[] }>) =>
    request.post('/api/commandes', {
      // Adresse et numéro propres à ce test : hors des limites anti-abus des autres specs.
      headers: { 'x-forwarded-for': '203.0.113.42' },
      data: {
        client_nom: 'Test Stock',
        client_telephone: '78 555 01 23',
        adresse_precise: 'Villa 12, rue MZ-40',
        zone_id: 2,
        items,
      },
    });

  // 3 d'un coup, puis 1 + 2 réparties sur deux lignes (nature et avec extra).
  const r1 = await commande([{ produit_id: p.id, quantite: 3 }]);
  expect(r1.status()).toBe(409);
  const c1 = await r1.json();
  expect(c1.stock).toBe(true);
  expect(c1.error).toContain('Il ne reste que 2');

  const extras: Array<{ id: string }> = await (await fetch(`${MOCK}/rest/v1/extras?select=*`)).json();
  const r2 = await commande([
    { produit_id: p.id, quantite: 1 },
    { produit_id: p.id, quantite: 2, extras_ids: [extras[0].id] },
  ]);
  expect(r2.status()).toBe(409);
  expect((await r2.json()).error).toContain('vous en demandez 3');
  expect((await journal()).rpcLog).toHaveLength(0);

  // Dans la limite : acceptée.
  const r3 = await commande([{ produit_id: p.id, quantite: 2 }]);
  expect(r3.status()).toBe(200);
  expect((await journal()).rpcLog).toHaveLength(1);
});
