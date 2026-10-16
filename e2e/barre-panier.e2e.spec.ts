import { test, expect, type Page } from '@playwright/test';
import { reinitialiser } from './outils';

// La barre panier (fixe, en bas d'écran) ne doit jamais recouvrir l'action
// de la recette sur la plaque. Géométrie réelle : intersection des
// rectangles et test de clic au centre du bouton (elementFromPoint), à
// l'arrivée sur la carte puis sur tout le défilement.

const ENTETE = 64; // barre de navigation fixe (h-16)

type Mesure = {
  recouvrement: number;
  cliquable: boolean;
  dansEcran: boolean;
  place: boolean;
  titreVisible: boolean;
  titreRecouvert: boolean;
};

const mesurer = (page: Page) =>
  page.evaluate((entete): Mesure => {
    const action = [...document.querySelectorAll<HTMLButtonElement>('#carte button')].find(
      (b) => b.textContent?.trim() === 'Composer cette crêpe',
    )!;
    const barre = [...document.querySelectorAll('button')].find((b) => /Voir mon panier/.test(b.textContent ?? ''))!;
    const a = action.getBoundingClientRect();
    const b = barre.getBoundingClientRect();
    const t = document.querySelector('#carte h3')!.getBoundingClientRect();
    const chevauche = Math.min(a.right, b.right) > Math.max(a.left, b.left);
    const centre = document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2);
    return {
      recouvrement: chevauche ? Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) : 0,
      cliquable: !!centre && action.contains(centre),
      dansEcran: a.top >= entete && a.bottom <= innerHeight,
      // Il y a la place de poser l'action entre le titre et la barre panier.
      place: t.top >= entete && t.bottom + 16 + a.height + 12 <= b.top,
      titreVisible: t.top >= entete && t.bottom <= b.top,
      titreRecouvert: a.top < t.bottom - 0.5 && a.bottom > t.top,
    };
  }, ENTETE);

async function verifier(page: Page) {
  await reinitialiser();
  await page.goto('/');
  const carte = page.locator('#carte');
  const barre = page.getByRole('button', { name: /Voir mon panier/ });

  // Un article au panier : la barre apparaît.
  await carte.getByRole('button', { name: /^Boissons/ }).click();
  await carte.getByRole('button', { name: 'Ajouter au panier' }).click();
  await expect(barre).toBeVisible();
  await carte.getByRole('button', { name: /^Salées/ }).click();
  const action = carte.getByRole('button', { name: 'Composer cette crêpe' });
  await expect(action).toBeVisible();

  // Arrivée sur la carte (lien « Voir la carte ») : action entière et cliquable.
  await page.evaluate(() => document.getElementById('carte')!.scrollIntoView());
  await page.waitForTimeout(400); // transition éventuelle de l'action (300 ms)
  const arrivee = await mesurer(page);
  expect(arrivee.recouvrement, 'recouvrement à l’arrivée sur la carte').toBe(0);
  expect(arrivee.cliquable, 'bouton non cliquable à l’arrivée').toBe(true);
  expect(arrivee.dansEcran, 'bouton hors écran à l’arrivée').toBe(true);
  expect(arrivee.titreRecouvert, 'titre recouvert à l’arrivée').toBe(false);

  // Tout le défilement : dès qu'il y a la place, jamais sous la barre ;
  // le titre de la recette n'est jamais recouvert par l'action.
  const hauteur = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  let verifiees = 0;
  for (let y = 0; y <= hauteur; y += 12) {
    await page.evaluate((v) => scrollTo(0, v), y);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const m = await mesurer(page);
    if (m.titreVisible) expect(m.titreRecouvert, `titre recouvert à y=${y}`).toBe(false);
    if (!m.place) continue;
    verifiees++;
    expect(m.recouvrement, `recouvrement à y=${y}`).toBe(0);
    expect(m.cliquable, `bouton non cliquable à y=${y}`).toBe(true);
    expect(m.dansEcran, `bouton hors écran à y=${y}`).toBe(true);
  }
  expect(verifiees, 'positions réellement vérifiées').toBeGreaterThan(3);

  // L'action reste utilisable : la fiche s'ouvre puis se referme.
  await action.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(barre).toBeVisible();
}

test('mobile : la barre panier ne recouvre pas l’action de la plaque', async ({ page }) => {
  await verifier(page);
});

test.describe('ordinateur', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  test('la barre panier ne recouvre pas l’action de la plaque', async ({ page }) => {
    await verifier(page);
  });
});

// Petit téléphone (360 × 740), panier rempli : dès l'arrivée sur la carte,
// pour chaque recette, titre entier, prix et action visibles au-dessus de
// la barre panier, et action utilisable sans aucun défilement.
test.describe('360 × 740, panier rempli', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('titre, prix et action lisibles dès l’arrivée, pour chaque recette', async ({ page }) => {
    await reinitialiser();
    await page.goto('/');
    const carte = page.locator('#carte');
    await carte.getByRole('button', { name: /^Boissons/ }).click();
    await carte.getByRole('button', { name: 'Ajouter au panier' }).click();
    await expect(page.getByRole('button', { name: /Voir mon panier/ })).toBeVisible();

    const arriver = async () => {
      await page.evaluate(() => document.getElementById('carte')!.scrollIntoView());
      await page.waitForTimeout(400); // transition éventuelle de l'action (300 ms)
    };
    const etat = () =>
      page.evaluate((entete) => {
        const dock = document.querySelector<HTMLElement>('#carte .dock-recette')!;
        const action = dock.querySelector('button')!;
        const prix = dock.querySelector('.prix')!;
        const barre = [...document.querySelectorAll('button')].find((b) => /Voir mon panier/.test(b.textContent ?? ''))!;
        const titre = document.querySelector('#carte h3')!;
        const a = action.getBoundingClientRect();
        const d = dock.getBoundingClientRect();
        const p = prix.getBoundingClientRect();
        const b = barre.getBoundingClientRect();
        const t = titre.getBoundingClientRect();
        const cx = a.left + a.width / 2;
        const cy = a.top + a.height / 2;
        const centre = document.elementFromPoint(cx, cy);
        return {
          nom: titre.textContent ?? '',
          titreEntierVisible: t.top >= entete && t.bottom <= b.top,
          titreRecouvert: d.top < t.bottom - 0.5,
          prixVisible: p.top >= entete && p.bottom <= b.top && p.width > 0,
          recouvrement: Math.max(0, Math.min(d.bottom, b.bottom) - Math.max(d.top, b.top)),
          dansEcran: d.top >= entete && d.bottom <= innerHeight,
          cliquable: !!centre && action.contains(centre),
          libelleEntier: action.scrollWidth <= action.clientWidth + 1,
          cx,
          cy,
        };
      }, ENTETE);

    let verifiees = 0;
    for (const rubrique of [/^Salées/, /^Sucrées/, /^Boissons/]) {
      await carte.getByRole('button', { name: rubrique }).click();
      const n = await carte.locator('.plaque-tour > li').count();
      for (let i = 0; i < n; i++) {
        await arriver();
        const e = await etat();
        expect(e.titreEntierVisible, `titre masqué : ${e.nom}`).toBe(true);
        expect(e.titreRecouvert, `titre recouvert : ${e.nom}`).toBe(false);
        expect(e.prixVisible, `prix masqué : ${e.nom}`).toBe(true);
        expect(e.recouvrement, `barre panier sur l’action : ${e.nom}`).toBe(0);
        expect(e.dansEcran, `action hors écran : ${e.nom}`).toBe(true);
        expect(e.cliquable, `action non cliquable : ${e.nom}`).toBe(true);
        expect(e.libelleEntier, `libellé coupé : ${e.nom}`).toBe(true);
        verifiees++;
        if (i < n - 1) await carte.getByRole('button', { name: 'Recette suivante' }).click();
      }
    }
    expect(verifiees, 'recettes vérifiées').toBeGreaterThan(10);

    // Clic réel aux coordonnées mesurées, sans défilement automatique :
    // l'action est utilisable telle qu'affichée à l'arrivée.
    await carte.getByRole('button', { name: /^Salées/ }).click();
    await arriver();
    const avant = await page.evaluate(() => scrollY);
    const e = await etat();
    await page.mouse.click(e.cx, e.cy);
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.evaluate(() => scrollY)).toBe(avant);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
