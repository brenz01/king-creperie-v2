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
        setError('Erreur lors de la connexion.');
        setLoading(false);
        return;
      }

      router.push('/admin/dashboard');
    } catch (err) {
      console.error('Erreur login:', err);
      setError('Erreur de connexion. Réessayez.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-28 pb-16 px-6 flex items-center justify-center bg-[#1C1712]">
      <div className="bg-[#26201A] border border-[#3D332A] p-8 rounded-2xl w-full max-w-md shadow-xl">
        <div className="text-center mb-6">
          <Crown className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <h1 className="font-serif text-2xl font-semibold text-white">Espace Admin</h1>
          <p className="text-stone-400 text-sm">Gestion des commandes King Crêperie</p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl mb-4 text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-stone-400 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 w-4 h-4" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#1C1712] border border-[#3D332A] rounded-xl py-2.5 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-stone-400 mb-1">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 w-4 h-4" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#1C1712] border border-[#3D332A] rounded-xl py-2.5 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl transition-all mt-2 shadow-md shadow-amber-600/20 active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}