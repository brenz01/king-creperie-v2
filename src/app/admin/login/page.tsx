'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Crown } from 'lucide-react';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const reponse = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await reponse.json();

      if (!reponse.ok) {
        setError(data.error || 'Identifiants incorrects.');
        setLoading(false);
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (sessionError) {
        setError('Connexion impossible. Réessayez.');
        setLoading(false);
        return;
      }

      router.push('/admin/dashboard');
    } catch (err) {
      console.error('Erreur login:', err);
      setError('Pas de réponse du serveur. Vérifiez la connexion puis réessayez.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-kc-nuit text-kc-beurre px-5 pt-[max(3rem,env(safe-area-inset-top))] pb-12 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="mx-auto w-24 h-24 rounded-full bg-kc-indigo flex items-center justify-center shadow-[0_24px_48px_-24px_rgba(0,0,0,0.9)]">
            <span className="w-16 h-16 rounded-full border-2 border-dashed border-kc-beurre/25 flex items-center justify-center">
              <Crown className="w-8 h-8 text-kc-caramel" strokeWidth={2.4} />
            </span>
          </span>
          <h1 className="mt-5 font-display text-4xl leading-none">KC Staff</h1>
          <p className="mt-2 text-sm text-kc-brume/80">Commandes de King Crêperie, en direct.</p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-2xl bg-kc-bissap/15 border border-kc-bissap/40 text-kc-beurre px-4 py-3 text-sm"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-kc-brume/50 w-4 h-4" />
              <input
                id="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-2xl py-3.5 pl-11 pr-4 text-base text-kc-lait placeholder:text-kc-brume/40 focus:outline-none focus:border-kc-caramel transition-colors"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold mb-1.5">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-kc-brume/50 w-4 h-4" />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-2xl py-3.5 pl-11 pr-4 text-base text-kc-lait focus:outline-none focus:border-kc-caramel transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="appui w-full bg-kc-caramel hover:bg-kc-beurre text-kc-nuit font-semibold py-4 rounded-full transition-colors mt-2 disabled:opacity-50"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
