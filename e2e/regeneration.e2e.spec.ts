import { test, expect } from '@playwright/test';
import { journal, panneCatalogue, reinitialiser } from './outils';

// src/app/page.tsx lève une erreur si le catalogue est illisible : pendant
// une régénération ISR, Next.js doit alors garder la dernière page valide.
// On attend l'expiration réelle (revalidate = 60 s) : test lent, assumé.
test('régénération ISR en échec : la dernière page valide reste servie', async ({ request }) => {
  test.setTimeout(120_000);
  await reinitialiser();
  const valide = await request.get('/');
  expect(await valide.text()).toContain('Crêpe Jambon Fromage');

  await panneCatalogue(true);
  try {
    await new Promise((r) => setTimeout(r, 62_000));
    const avant = (await journal()).lecturesEnPanne;
    // Requêtes sans navigateur : seules les régénérations côté serveur
    // lisent le catalogue pendant ce test.
    for (let i = 0; i < 2; i++) {
      const reponse = await request.get('/');
      expect(reponse.status()).toBe(200);
      const html = await reponse.text();
      expect(html).toContain('Crêpe Jambon Fromage');
      expect(html).not.toContain('Chargement de la carte');
      await new Promise((r) => setTimeout(r, 1500));
    }
    // Preuve qu'une régénération a été tentée APRÈS l'expiration, et a échoué.
    await expect.poll(async () => (await journal()).lecturesEnPanne, { timeout: 10_000 }).toBeGreaterThan(avant);
  } finally {
    await panneCatalogue(false);
  }
});
