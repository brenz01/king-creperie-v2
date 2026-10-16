import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { envoyer, pushConfigure, type MessagePush } from '@/lib/pushServeur';
import type { StatutCommande } from '@/types';

// Appelé UNIQUEMENT par la base (trigger notifier_push_commande via
// pg_net), authentifié par un secret partagé stocké dans Supabase Vault
// et dans la variable PUSH_WEBHOOK_SECRET de Vercel.

const SchemaEvenement = z.object({
  type: z.enum(['INSERT', 'UPDATE']),
  commande_id: z.guid(),
  statut: z.enum(['recue', 'en_preparation', 'en_livraison', 'livree', 'annulee']),
  total: z.number().int().nonnegative().optional(),
});

const MESSAGES_CLIENT: Partial<Record<StatutCommande, { title: string; body: string }>> = {
  en_preparation: { title: '👨‍🍳 En préparation', body: 'Nos crêpiers sont sur votre commande.' },
  en_livraison: { title: '🛵 Votre commande est en route !', body: 'Le livreur vient de partir. Préparez-vous à vous régaler.' },
  livree: { title: '✅ Commande livrée', body: 'Bon appétit ! Merci d’avoir commandé chez King Crêperie.' },
  annulee: { title: 'Commande annulée', body: 'Votre commande a été annulée. Touchez pour plus d’infos.' },
};

function secretValide(request: NextRequest): boolean {
  const attendu = process.env.PUSH_WEBHOOK_SECRET;
  const recu = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!attendu || attendu.length < 32) return false;
  const a = Buffer.from(attendu);
  const b = Buffer.from(recu);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!secretValide(request)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  if (!pushConfigure) return NextResponse.json({ ok: true, ignore: 'push non configuré' });

  const parse = SchemaEvenement.safeParse(await request.json().catch(() => null));
  if (!parse.success) return NextResponse.json({ error: 'Événement invalide.' }, { status: 400 });
  const evt = parse.data;
  const admin = getSupabaseAdmin();
  const court = evt.commande_id.slice(0, 8);

  if (evt.type === 'INSERT') {
    const { data: lignes } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .not('staff_user_id', 'is', null);
    const message: MessagePush = {
      title: '🔔 Nouvelle commande',
      body: `#${court}${evt.total != null ? ` — ${evt.total.toLocaleString('fr-FR')} FCFA` : ''}`,
      url: '/admin/dashboard',
      tag: `staff-${evt.commande_id}`,
    };
    return NextResponse.json(await envoyer(lignes ?? [], message));
  }

  const contenu = MESSAGES_CLIENT[evt.statut];
  if (!contenu) return NextResponse.json({ ok: true, ignore: 'statut sans notification' });

  const { data: lignes } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('commande_id', evt.commande_id);

  const resultat = await envoyer(lignes ?? [], {
    ...contenu,
    url: `/suivi?id=${evt.commande_id}`,
    tag: `commande-${evt.commande_id}`, // remplace la notif de l'étape précédente
  });

  // Commande terminée : plus rien à notifier, on purge ses abonnements.
  if (evt.statut === 'livree' || evt.statut === 'annulee') {
    await admin.from('push_subscriptions').delete().eq('commande_id', evt.commande_id);
  }
  return NextResponse.json(resultat);
}
