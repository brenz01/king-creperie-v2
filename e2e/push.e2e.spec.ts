import { test, expect, type Page } from '@playwright/test';
import { reinitialiser } from './outils';

// Notifications de suivi : un abonnement est rattaché à UNE commande.
// Un client qui a déjà autorisé les notifications (commande précédente)
// doit être abonné d'office à sa nouvelle commande, sans clic.

test.beforeEach(async () => {
  await reinitialiser();
});

// Le navigateur de test n'a pas de service push : on simule un
// abonnement navigateur (même forme qu'un vrai, endpoint FCM).
// Le navigateur sans interface refuse les notifications par défaut :
// « permission » simule le choix déjà fait par le client.
async function simulerPush(page: Page, permission: NotificationPermission) {
  await page.addInitScript((perm) => {
    Object.defineProperty(Notification, 'permission', { configurable: true, get: () => perm });
    Notification.requestPermission = async () => perm;
    const abonnement = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-e2e',
      toJSON: () => ({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-e2e',
        keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' },
      }),
    };
    const pm = { getSubscription: async () => abonnement, subscribe: async () => abonnement };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: pm }), register: async () => ({}), addEventListener() {}, controller: null },
    });
  }, permission);
}

async function nouvelleCommande(page: Page, telephone: string) {
  const r = await page.request.post('/api/commandes', {
    data: {
      client_nom: 'Test Push',
      client_telephone: telephone,
      adresse_precise: 'Mermoz, villa test',
      zone_id: 2,
      items: [{ produit_id: '00000000-0000-4000-8000-000000000015', quantite: 1, extras_ids: [] }],
    },
  });
  expect(r.ok()).toBe(true);
  return ((await r.json()) as { id: string }).id;
}

test('notifications déjà autorisées : la nouvelle commande est abonnée sans clic', async ({ page }) => {
  await simulerPush(page, 'granted');
  const enregistrements: Array<{ commande_id?: string }> = [];
  await page.route('**/api/push/subscribe', async (route) => {
    enregistrements.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, json: { ok: true } });
  });

  // Deux commandes successives : chacune doit recevoir son abonnement.
  for (const tel of ['781110001', '781110002']) {
    const id = await nouvelleCommande(page, tel);
    await page.goto(`/suivi?id=${id}`);
    await expect(page.getByText('Vous serez prévenu à chaque étape.')).toBeVisible();
    await expect.poll(() => enregistrements.map((e) => e.commande_id)).toContain(id);
  }
  expect(enregistrements).toHaveLength(2);
});

test('notifications refusées : aucun abonnement, explication affichée', async ({ page }) => {
  await simulerPush(page, 'denied');
  let appels = 0;
  await page.route('**/api/push/subscribe', (route) => {
    appels += 1;
    return route.fulfill({ status: 201, json: { ok: true } });
  });
  const id = await nouvelleCommande(page, '781110003');
  await page.goto(`/suivi?id=${id}`);
  await expect(page.getByText('Notifications bloquées')).toBeVisible();
  await page.waitForTimeout(500);
  expect(appels).toBe(0);
});
