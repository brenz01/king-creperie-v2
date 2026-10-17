import { test, expect } from '@playwright/test';
import { changerStatut, journal, reinitialiser } from './outils';

// Parcours client complet : carte (onglets, grille) → fiche → panneau panier → livraison
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
  const onglet = (nom: string) => carte.getByRole('group', { name: 'Catégories' }).getByRole('button', { name: nom, exact: true });
  await expect(onglet('Tout')).toHaveAttribute('aria-pressed', 'true');
  await expect(carte.locator('article')).toHaveCount(20);

  // Onglets : chaque rubrique filtre la grille.
  await onglet('Salées').click();
  await expect(carte.locator('article')).toHaveCount(7);
  await onglet('Sucrées').click();
  await expect(carte.locator('article')).toHaveCount(7);
  // Épuisée : en fin de rubrique, ni fiche ni ajout.
  const epuisee = carte.locator('article').last();
  await expect(epuisee).toContainText('Épuisé');
  await expect(epuisee).toContainText('Crêpe aux Trois Chocolats');
  await expect(epuisee.getByRole('button')).toHaveCount(0);

  // Boisson : ajout direct depuis la carte, confirmé dans la barre panier.
  await onglet('Boissons').click();
  await expect(carte.locator('article')).toHaveCount(6);
  await expect(carte.getByRole('button', { name: /^Composer/ })).toHaveCount(0);
  await carte.getByRole('button', { name: 'Ajouter Eau minérale' }).click();
  const barre = page.getByRole('button', { name: /Voir mon panier/ });
  await expect(barre).toContainText('Ajouté au panier');
  await expect(barre).toHaveAccessibleName(/1 article : 500 FCFA/);

  // Crêpe : fiche, extras facultatifs, aucun présélectionné.
  // Le + devient un compteur sur la carte.
  await expect(carte.getByRole('group', { name: 'Eau minérale au panier' }).locator('output')).toHaveText('1');

  await onglet('Salées').click();
  await carte.getByRole('button', { name: 'Composer Crêpe Jambon Fromage', exact: true }).click();
  const fiche = page.getByRole('dialog');
  await expect(fiche).toContainText('Extras gourmands (facultatif)');
  await expect(fiche.locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(fiche.getByRole('button', { name: 'Partager cette crêpe' })).toBeVisible();
  await fiche.getByRole('button', { name: /Double fromage/ }).click();
  await fiche.getByRole('button', { name: /Ajouter au panier/ }).click();
  await expect(barre).toContainText('Crêpe ajoutée');

  // Panneau panier sur la même page.
  await expect(barre).toHaveAccessibleName(/2 articles : 3\s000 FCFA/);
  await barre.click();
  const panneau = page.getByRole('dialog', { name: 'Votre commande' });
  await expect(panneau).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(panneau).toContainText(/selon le quartier, 1\s000 F à 2\s000 F/);

  // Quartier choisi dès le panier : total exact avant le formulaire.
  // Bouton jamais grisé : un clic trop tôt explique ce qui manque.
  await panneau.getByRole('button', { name: 'Passer à la livraison' }).click();
  await expect(panneau.getByRole('alert')).toContainText('Choisissez votre quartier');
  await expect(page.locator('#quartier')).toBeFocused();
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

test('carte : le + devient un compteur', async ({ page }) => {
  await page.goto('/');
  const carte = page.locator('#carte');
  const barre = page.getByRole('button', { name: /Voir mon panier/ });
  await carte.getByRole('button', { name: 'Ajouter Eau minérale' }).click();
  const compteur = carte.getByRole('group', { name: 'Eau minérale au panier' });
  await compteur.getByRole('button', { name: 'Une Eau minérale de plus' }).click();
  await expect(compteur.locator('output')).toHaveText('2');
  await expect(barre).toHaveAccessibleName(/2 articles : 1\s000 FCFA/);
  await compteur.getByRole('button', { name: 'Une Eau minérale de moins' }).click();
  await compteur.getByRole('button', { name: 'Une Eau minérale de moins' }).click();
  await expect(carte.getByRole('button', { name: 'Ajouter Eau minérale' })).toBeVisible();
  await expect(barre).toHaveCount(0);
});

test('panier : quantités, retrait, panier vide', async ({ page }) => {
  await page.goto('/');
  await page.locator('#carte').getByRole('button', { name: 'Ajouter Eau minérale' }).click();
  await page.getByRole('button', { name: /Voir mon panier/ }).click();
  const panneau = page.getByRole('dialog', { name: 'Votre commande' });
  const ligne = panneau.locator('ul > li').first();
  const nom = (await ligne.locator('p').first().textContent())?.trim() ?? '';

  await panneau.getByRole('button', { name: `Une ${nom} de plus` }).click();
  await expect(ligne.locator('output')).toHaveText('2');
  await panneau.getByRole('button', { name: `Une ${nom} de moins` }).click();
  await expect(ligne.locator('output')).toHaveText('1');
  await panneau.getByRole('button', { name: `Retirer ${nom}` }).click();
  await expect(panneau.getByText('Votre panier est vide')).toBeVisible();
  await panneau.getByRole('button', { name: 'Voir la carte' }).click();
  await expect(panneau).toHaveCount(0);
});

test('recherche : trouve sans accents ni majuscules', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Chercher une crêpe' }).click();
  await page.fill('#recherche-carte', 'NUTELLA');
  await expect(page.getByText('3 résultats pour « NUTELLA »')).toBeVisible();
  await expect(page.locator('#carte article')).toHaveCount(3);
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
  await expect(page.locator('body')).toContainText('Votre panier est vide');
  await page.goto('/suivi?id=11111111-1111-4111-8111-111111111111');
  await expect(page.locator('body')).toContainText('Vérifiez le lien reçu sur WhatsApp');
  await page.goto('/une-page-qui-nexiste-pas');
  await expect(page.locator('body')).toContainText('Cette page n’existe pas.');
});
