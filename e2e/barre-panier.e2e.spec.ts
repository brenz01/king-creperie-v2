import { test, expect, type Page } from '@playwright/test';
import { reinitialiser } from './outils';

// La barre panier (fixe, en bas d'écran) ne doit jamais rendre une action
// de la carte inaccessible : en bas de page, les boutons de la dernière
// carte sont entiers au-dessus de la barre et cliquables. Géométrie
// réelle : rectangles et test de clic au centre (elementFromPoint).

type Mesure = { nom: string; libelle: string; recouvrement: number; cliquable: boolean; dansEcran: boolean };

const mesurerDerniereCarte = (page: Page) =>
  page.evaluate((): Mesure[] => {
    const cartes = document.querySelectorAll('#carte article');
    const derniere = cartes[cartes.length - 1]!;
    const barre = [...document.querySelectorAll('button')].find((b) => /Voir mon panier/.test(b.textContent ?? ''))!;
    const b = barre.getBoundingClientRect();
    return [...derniere.querySelectorAll('button')].map((bouton) => {
      const a = bouton.getBoundingClientRect();
      const centre = document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2);
      const chevauche = Math.min(a.right, b.right) > Math.max(a.left, b.left);
      return {
        nom: derniere.querySelector('h3')?.textContent ?? '',
        libelle: bouton.getAttribute('aria-label') ?? bouton.textContent ?? '',
        recouvrement: chevauche ? Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) : 0,
        cliquable: !!centre && bouton.contains(centre),
        dansEcran: a.top >= 0 && a.bottom <= innerHeight,
      };
    });
  });

async function verifier(page: Page) {
  await reinitialiser();
  await page.goto('/');
  const carte = page.locator('#carte');
  const onglet = (nom: string) => carte.getByRole('group', { name: 'Catégories' }).getByRole('button', { name: nom, exact: true });
  const barre = page.getByRole('button', { name: /Voir mon panier/ });

  // Panier rempli : la barre est là pendant toute la vérification.
  await carte.getByRole('button', { name: 'Ajouter Eau minérale' }).click();
  await carte.getByRole('button', { name: 'Ajouter Crêpe Nutella', exact: true }).click();
  await expect(barre).toBeVisible();

  let verifiees = 0;
  for (const rubrique of ['Tout', 'Salées', 'Sucrées', 'Boissons']) {
    await onglet(rubrique).click();
    // Tout en bas de la page : la dernière carte doit rester utilisable.
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(450); // apparition des cartes (320 ms)
    for (const m of await mesurerDerniereCarte(page)) {
      expect(m.recouvrement, `${rubrique} : barre panier sur « ${m.libelle} » (${m.nom})`).toBe(0);
      expect(m.dansEcran, `${rubrique} : « ${m.libelle} » hors écran`).toBe(true);
      // Un bouton désactivé (épuisé) n'a pas à être cliquable.
      if (!/épuisé/.test(m.libelle)) expect(m.cliquable, `${rubrique} : « ${m.libelle} » non cliquable`).toBe(true);
      verifiees++;
    }
  }
  expect(verifiees, 'boutons vérifiés').toBeGreaterThanOrEqual(3);

  // L'action reste utilisable : clic réel sur la dernière crêpe salée.
  await onglet('Salées').click();
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await carte.locator('article').last().getByRole('button', { name: /^Composer/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(barre).toBeVisible();
}

test('mobile : la barre panier ne recouvre pas la dernière carte', async ({ page }) => {
  await verifier(page);
});

test.describe('petit téléphone (360 × 740)', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('la barre panier ne recouvre pas la dernière carte', async ({ page }) => {
    await verifier(page);
  });
});

test.describe('ordinateur', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  test('la barre panier ne recouvre pas la dernière carte', async ({ page }) => {
    await verifier(page);
  });
});
