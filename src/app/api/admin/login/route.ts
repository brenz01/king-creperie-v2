import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifierRateLimit, extraireIp, minutesRestantes } from '@/lib/rateLimit';

// NB : ce proxy n'est qu'une couche de confort. L'endpoint GoTrue
// (/auth/v1/token) reste joignable directement avec la clé publique :
// la vraie protection anti-bruteforce se configure dans Supabase Auth
// (CAPTCHA Turnstile + MFA TOTP exigé par is_staff()). Cf. supabase/README.md.
const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function POST(request: NextRequest) {
  try {
    const ip = extraireIp(request);

    // 5 tentatives / 15 minutes / IP.
    const { autorise, reessayerDansMs } = verifierRateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
    if (!autorise) {
      return NextResponse.json(
        { error: `Trop de tentatives de connexion. Réessayez dans ${minutesRestantes(reessayerDansMs)} minute(s).` },
        { status: 429 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 });
    }

    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      // Message volontairement générique (pas d'énumération de comptes).
      return NextResponse.json({ error: 'Identifiants incorrects.' }, { status: 401 });
    }

    return NextResponse.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (err) {
    console.error('Erreur inattendue /api/admin/login:', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue.' }, { status: 500 });
  }
}
