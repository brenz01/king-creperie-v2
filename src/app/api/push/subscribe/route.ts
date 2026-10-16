import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { pushConfigure, SchemaAbonnement } from '@/lib/pushServeur';
import { extraireIp, verifierRateLimit } from '@/lib/rateLimit';

// Abonnement push, rattaché :
//  - soit à une commande (client anonyme : l'UUID de commande, non
//    devinable, sert de capacité — comme pour la page /suivi) ;
//  - soit à un compte staff (Authorization: Bearer <access_token>).
// La table push_subscriptions n'a AUCUNE policy RLS : seul ce code
// (service_role) y lit et écrit.

const SchemaPost = z.object({
  subscription: SchemaAbonnement,
  commande_id: z.guid().optional(),
});

const SchemaPatch = z.object({
  ancien_endpoint: z.string().url().max(1000),
  subscription: SchemaAbonnement,
});

const SchemaDelete = z.object({ endpoint: z.string().url().max(1000) });

const indisponible = () => NextResponse.json({ error: 'Notifications non configurées.' }, { status: 503 });

async function staffDepuisJeton(request: NextRequest): Promise<string | null> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(auth.slice(7));
  if (error || !data.user) return null;
  const { data: staff } = await admin
    .from('staff')
    .select('user_id')
    .eq('user_id', data.user.id)
    .eq('actif', true)
    .maybeSingle();
  return staff ? data.user.id : null;
}

export async function POST(request: NextRequest) {
  if (!pushConfigure) return indisponible();

  const { autorise } = verifierRateLimit(`push:ip:${extraireIp(request)}`, 20, 10 * 60 * 1000);
  if (!autorise) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });

  const parse = SchemaPost.safeParse(await request.json().catch(() => null));
  if (!parse.success) return NextResponse.json({ error: 'Abonnement invalide.' }, { status: 400 });
  const { subscription, commande_id } = parse.data;
  const admin = getSupabaseAdmin();

  let cible: { commande_id: string } | { staff_user_id: string };

  if (commande_id) {
    const { data: commande } = await admin.from('commandes').select('id, statut').eq('id', commande_id).maybeSingle();
    if (!commande) return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
    if (commande.statut === 'livree' || commande.statut === 'annulee') {
      return NextResponse.json({ error: 'Commande terminée.' }, { status: 409 });
    }
    cible = { commande_id };
  } else {
    const staffId = await staffDepuisJeton(request);
    if (!staffId) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    cible = { staff_user_id: staffId };
  }

  // Idempotent : un même navigateur ne s'abonne qu'une fois par cible.
  const colonne = 'commande_id' in cible ? 'commande_id' : 'staff_user_id';
  const valeur = 'commande_id' in cible ? cible.commande_id : cible.staff_user_id;
  await admin.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint).eq(colonne, valeur);

  const { error } = await admin.from('push_subscriptions').insert({
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    ...cible,
    user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
  });

  if (error) {
    console.error('Erreur enregistrement abonnement push:', error);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

// Renouvellement par le navigateur (événement pushsubscriptionchange du SW).
export async function PATCH(request: NextRequest) {
  if (!pushConfigure) return indisponible();
  const parse = SchemaPatch.safeParse(await request.json().catch(() => null));
  if (!parse.success) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  const { ancien_endpoint, subscription } = parse.data;

  const { error } = await getSupabaseAdmin()
    .from('push_subscriptions')
    .update({ endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth })
    .eq('endpoint', ancien_endpoint);
  if (error) return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Désabonnement : connaître l'endpoint (secret détenu par le navigateur) suffit.
export async function DELETE(request: NextRequest) {
  if (!pushConfigure) return indisponible();
  const parse = SchemaDelete.safeParse(await request.json().catch(() => null));
  if (!parse.success) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  await getSupabaseAdmin().from('push_subscriptions').delete().eq('endpoint', parse.data.endpoint);
  return NextResponse.json({ ok: true });
}
