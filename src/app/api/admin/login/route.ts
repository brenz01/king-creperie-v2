import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifierRateLimitPersonnalise, extraireIp } from '@/lib/rateLimit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const ip = extraireIp(request);

    // Limite volontairement stricte : 5 tentatives / 15 minutes / IP.
    // Un seul compte admin existe aujourd'hui, donc même un staff
    // légitime qui se trompe plusieurs fois de mot de passe ne
    // devrait normalement pas dépasser ce seuil ; ça bloque en
    // priorité les scripts de bruteforce automatisés.
    const { autorise, reessayerDansMs } = verifierRateLimitPersonnalise(
      `login:${ip}`,
      5,
      15 * 60 * 1000
    );

    if (!autorise) {
      const minutesRestantes = Math.ceil((reessayerDansMs || 0) / 60000);
      return NextResponse.json(
        { error: `Trop de tentatives de connexion. Réessayez dans ${minutesRestantes} minute(s).` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

    if (error) {
      // Message volontairement générique — ne jamais révéler si c'est
      // l'email ou le mot de passe qui est incorrect (évite l'énumération
      // de comptes valides).
      return NextResponse.json({ error: 'Identifiants incorrects.' }, { status: 401 });
    }

    return NextResponse.json({
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
    });
  } catch (err) {
    console.error('Erreur inattendue /api/admin/login:', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue.' }, { status: 500 });
  }
}