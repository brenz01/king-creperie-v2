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
  const carte = page.locator('#carte');
  await expect(carte.getByRole('button', { name: 'Salées 7' })).toBeVisible();
  await expect(carte.getByRole('button', { name: 'Boissons 6' })).toBeVisible();

  // La plaque : la recette au centre est décrite sous la plaque.
  await expect(carte.getByText('1 sur 7')).toBeVisible();
  await carte.getByRole('button', { name: 'Recette suivante' }).click();
  await expect(carte.getByText('2 sur 7')).toBeVisible();

  // Vue liste : toute la rubrique d'un coup, puis retour à la plaque.
  await carte.getByRole('button', { name: 'Liste' }).click();
  await expect(page.locator('#liste-sucree li')).toHaveCount(7);
  await carte.getByRole('button', { name: 'Plaque' }).click();

  // Boisson : ajout direct, confirmé dans la barre panier.
  await carte.getByRole('button', { name: 'Boissons 6' }).click();
  await carte.getByRole('button', { name: 'Ajouter au panier' }).click();
  await expect(page.getByRole('button', { name: /Voir mon panier/ })).toContainText('Ajouté au panier, 1 article');

  // Crêpe : fiche, extras facultatifs, aucun présélectionné.
  await carte.getByRole('button', { name: 'Salées 7' }).click();
  await carte.getByRole('button', { name: 'Composer cette crêpe' }).click();
  const fiche = page.getByRole('dialog');
  await expect(fiche).toContainText('Extras (facultatif)');
  await expect(fiche.locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(fiche.getByRole('button', { name: 'Partager cette crêpe' })).toBeVisible();
  await fiche.getByRole('button', { name: /Double fromage/ }).click();
  await fiche.getByRole('button', { name: /Ajouter au panier/ }).click();
  await expect(page.getByRole('button', { name: /Voir mon panier/ })).toContainText('Crêpe ajoutée, 2 articles');

  // Panneau panier sur la même page.
  const barre = page.getByRole('button', { name: /Voir mon panier/ });
  await expect(barre).toContainText('2 articles');
  await barre.click();
  const panneau = page.getByRole('dialog', { name: 'Votre commande' });
  await expect(panneau).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(panneau).toContainText(/selon le quartier, 1\s000 F à 2\s000 F/);

  // Quartier choisi dès le panier : total exact avant le formulaire.
  await expect(panneau.getByRole('button', { name: 'Choisissez votre quartier' })).toBeDisabled();
  await page.selectOption('#quartier', 'Mermoz');
  await expect(panneau).toContainText('Livraison à Mermoz');
  await expect(panneau).toContainText(/Total à payer\s*4\s500 F/);
  await panneau.getByRole('button', { name: 'Passer à la livraison' }).click();
  await page.fill('#nom', 'Awa Ndiaye');
  await page.fill('#tel', '12 34');
  await page.fill('#adresse', 'Villa 12, rue MZ-40');
  await page.fill('#repere', 'En face de la boulangerie');

  // Fermer puis rouvrir : le formulaire est conservé.
  await panneau.getByRole('button', { name: 'Fermer le panier' }).click();
  await page.getByRole('button', { name: /Voir mon panier/ }).click();
  await expect(page.locator('#quartier')).toHaveValue('Mermoz');
  await page.getByRole('dialog', { name: 'Votre commande' }).getByRole('button', { name: 'Passer à la livraison' }).click();
  await expect(page.locator('#nom')).toHaveValue('Awa Ndiaye');

  // Téléphone invalide refusé avant l'envoi, aucune commande créée.
  await panneau.getByRole('button', { name: 'Vérifier ma commande' }).click();
  await expect(panneau.getByRole('alert')).toContainText('téléphone');
  expect((await journal()).rpcLog).toHaveLength(0);
  await page.fill('#tel', '77 123 45 67');
  await panneau.getByRole('button', { name: 'Vérifier ma commande' }).click();

  // Récapitulatif : modifier puis revenir, les données restent.
  await expect(panneau.getByRole('heading', { name: 'On vérifie ?' })).toBeVisible();
  await expect(panneau).toContainText('Awa Ndiaye');
  await expect(panneau).toContainText('Mermoz, Villa 12, rue MZ-40');
  await expect(panneau).toContainText(/Total à payer\s*4\s500 F/);
  await panneau.getByRole('button', { name: 'Modifier' }).nth(1).click();
  await expect(page.locator('#adresse')).toHaveValue('Villa 12, rue MZ-40');
  await panneau.getByRole('button', { name: 'Vérifier ma commande' }).click();
  expect((await journal()).rpcLog).toHaveLength(0);
  await panneau.getByRole('button', { name: 'Envoyer ma commande' }).click();
  await expect(panneau.getByText('Dernière étape')).toBeVisible();
  // Pas de « confirmée » tant que la crêperie n'a pas répondu.
  await expect(panneau).toContainText('en attente de confirmation');
  await expect(panneau).not.toContainText(/commande confirmée/i);

  // Secours si WhatsApp ne s'ouvre pas : message lisible et numéro.
  await panneau.getByRole('button', { name: 'WhatsApp ne s’ouvre pas ?' }).click();
  await expect(panneau.locator('#message-wa')).toHaveValue(/je souhaite confirmer ma commande/);
  await expect(panneau.getByRole('button', { name: 'Copier le message' })).toBeVisible();

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

test('panier : quantités, retrait, panier vide', async ({ page }) => {
  await page.goto('/');
  const carte = page.locator('#carte');
  await carte.getByRole('button', { name: 'Boissons 6' }).click();
  await carte.getByRole('button', { name: 'Ajouter au panier' }).click();
  await page.getByRole('button', { name: /Voir mon panier/ }).click();
  const panneau = page.getByRole('dialog', { name: 'Votre commande' });
  const ligne = panneau.locator('ul > li').first();
  const nom = (await ligne.locator('p').first().textContent())?.trim() ?? '';

  await panneau.getByRole('button', { name: `Une ${nom} de plus` }).click();
  await expect(ligne.locator('output')).toHaveText('2');
  await panneau.getByRole('button', { name: `Une ${nom} de moins` }).click();
  await expect(ligne.locator('output')).toHaveText('1');
  await panneau.getByRole('button', { name: `Retirer ${nom}` }).click();
  await expect(panneau.getByText('La plaque est vide')).toBeVisible();
  await panneau.getByRole('button', { name: 'Voir la carte' }).click();
  await expect(panneau).toHaveCount(0);
});

test('recherche : trouve sans accents ni majuscules', async ({ page }) => {
  await page.goto('/');
  await page.fill('#recherche-carte', 'NUTELLA');
  await expect(page.getByText('3 résultats pour « NUTELLA »')).toBeVisible();
  await page.fill('#recherche-carte', 'bechamel');
  await expect(page.locator('#carte')).toContainText('Crêpe Poulet Béchamel');
  await page.fill('#recherche-carte', 'zzz');
  await expect(page.locator('#carte')).toContainText('Aucune recette ne correspond à « zzz »');
});

test('lien partagé : ouvre directement la fiche', async ({ page }) => {
  await page.goto('/?produit=00000000-0000-4000-8000-000000000009#carte');
  await expect(page.getByRole('dialog')).toContainText('Crêpe Beurre Sucre');
});

test('pages de secours', async ({ page }) => {
  await page.goto('/commande');
  await expect(page.locator('body')).toContainText('La plaque est vide');
  await page.goto('/suivi?id=11111111-1111-4111-8111-111111111111');
  await expect(page.locator('body')).toContainText('Vérifiez le lien reçu sur WhatsApp');
  await page.goto('/une-page-qui-nexiste-pas');
  await expect(page.locator('body')).toContainText('Cette page n’est pas sur la plaque.');
});
