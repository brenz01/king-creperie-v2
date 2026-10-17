import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { extraireIp, verifierRateLimit } from '@/lib/rateLimit';

// Après un ajout, une modification ou une suppression de produit dans
// KC Staff : la page d'accueil (rendue avec revalidate = 60) est marquée à
// régénérer, pour que la nouvelle carte s'affiche dès la visite suivante
// au lieu d'attendre jusqu'à une minute.
//
// Réservé au staff, vérifié avec le jeton de l'appelant et la RLS (la table
// `staff` ne renvoie une ligne qu'à un membre du staff) : aucune clé
// service_role, donc utilisable aussi dans un aperçu Vercel.
export async function POST(request: NextRequest) {
  const { autorise } = verifierRateLimit(`carte:${extraireIp(request)}`, 30, 60 * 1000);
  if (!autorise) return NextResponse.json({ error: 'Trop de demandes.' }, { status: 429 });

  const jeton = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!jeton) return NextResponse.json({ error: 'Session requise.' }, { status: 401 });

  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jeton}` } },
  });
  const { data, error } = await client.from('staff').select('user_id').limit(1);
  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: 'Réservé au staff.' }, { status: 403 });
  }

  revalidatePath('/');
  return NextResponse.json({ ok: true });
}
