import 'server-only';
import webpush, { type PushSubscription as WebPushSubscription, WebPushError } from 'web-push';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// ------------------------------------------------------------------
// Configuration — tout est optionnel : sans clés VAPID le push est
// simplement désactivé (routes en 503, bouton masqué côté client).
// ------------------------------------------------------------------
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contact@king-creperie.sn';

export const pushConfigure = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
if (pushConfigure) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC!, VAPID_PRIVATE!);

// Seuls les services push des navigateurs sont acceptés comme endpoint :
// sans cette liste, /api/push/dispatch deviendrait un relais SSRF
// (le serveur POSTerait vers n'importe quelle URL fournie par un client).
const HOTES_PUSH = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

export const SchemaAbonnement = z.object({
  endpoint: z
    .url()
    .max(1000)
    .refine((u) => {
      const url = new URL(u);
      return url.protocol === 'https:' && HOTES_PUSH.some((h) => h.test(url.hostname));
    }, 'Service push non reconnu.'),
  keys: z.object({
    p256dh: z.string().min(16).max(200),
    auth: z.string().min(8).max(100),
  }),
});

export type Abonnement = z.infer<typeof SchemaAbonnement>;

interface LigneAbonnement {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface MessagePush {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

// Envoie à une liste d'abonnements ; supprime ceux que le service push
// déclare expirés (404/410) pour garder la table propre.
export async function envoyer(lignes: LigneAbonnement[], message: MessagePush): Promise<{ envoyes: number; supprimes: number }> {
  if (!pushConfigure || lignes.length === 0) return { envoyes: 0, supprimes: 0 };
  const expires: string[] = [];
  let envoyes = 0;

  await Promise.all(
    lignes.map(async (l) => {
      const sub: WebPushSubscription = { endpoint: l.endpoint, keys: { p256dh: l.p256dh, auth: l.auth } };
      try {
        await webpush.sendNotification(sub, JSON.stringify(message), { TTL: 3600, urgency: 'high' });
        envoyes += 1;
      } catch (e) {
        if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) expires.push(l.id);
        else console.error('Échec envoi push:', e instanceof WebPushError ? `${e.statusCode} ${e.body}` : e);
      }
    })
  );

  if (expires.length > 0) {
    await getSupabaseAdmin().from('push_subscriptions').delete().in('id', expires);
  }
  return { envoyes, supprimes: expires.length };
}
