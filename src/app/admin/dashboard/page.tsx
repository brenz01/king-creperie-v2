'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Commande, StatutCommande } from '@/types';
import { useRouter } from 'next/navigation';
import { RefreshCw, LogOut } from 'lucide-react';

export default function AdminDashboardPage() {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchCommandes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('commandes')
      .select('*, commande_items(*)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCommandes(data as Commande[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Vérification de la session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/admin/login');
    });

    fetchCommandes();

    // Abonnement Realtime pour la réception en direct des commandes
    const channel = supabase
      .channel('admin-commandes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'commandes' },
        () => fetchCommandes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateStatus = async (id: string, newStatut: StatutCommande) => {
    const { error } = await supabase
      .from('commandes')
      .update({ statut: newStatut })
      .eq('id', id);

    if (!error) {
      setCommandes((prev) =>
        prev.map((c) => (c.id === id ? { ...c, statut: newStatut } : c))
      );
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  return (
    <div className="min-h-screen pt-28 pb-16 px-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center mb-8 gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-black font-serif text-white">Tableau de bord Staff</h1>
          <p className="text-slate-400 text-sm">Gestion du flux de commandes en temps réel</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={fetchCommandes}
            className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 font-bold px-4 py-2.5 rounded-xl hover:bg-red-500/20 text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-amber-400 text-center py-12">Chargement des commandes...</p>
      ) : (
        <div className="space-y-4">
          {commandes.map((cmd) => (
            <div key={cmd.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-amber-400 text-sm">#{cmd.id.slice(0, 8)}</span>
                  <span className="text-xs text-slate-500">{new Date(cmd.created_at).toLocaleString('fr-FR')}</span>
                </div>
                <p className="text-white font-bold">{cmd.client_nom} — <span className="text-amber-400">{cmd.client_telephone}</span></p>
                <p className="text-xs text-slate-400">{cmd.adresse_livraison}</p>

                {cmd.commande_items && cmd.commande_items.length > 0 && (
                  <ul className="mt-2 text-xs text-slate-300 space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    {cmd.commande_items.map((it) => (
                      <li key={it.id}>• {it.quantite}x {it.nom_produit}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 border-t lg:border-t-0 border-slate-800 pt-4 lg:pt-0">
                <div className="text-right">
                  <p className="text-xs text-slate-500 uppercase font-bold">Total</p>
                  <p className="text-xl font-black text-white">{cmd.total.toLocaleString('fr-FR')} FCFA</p>
                </div>

                <select
                  value={cmd.statut}
                  onChange={(e) => handleUpdateStatus(cmd.id, e.target.value as StatutCommande)}
                  className="bg-slate-950 border border-slate-800 text-white font-bold text-sm py-2 px-3 rounded-xl focus:outline-none focus:border-amber-500"
                >
                  <option value="recue">Commande Reçue</option>
                  <option value="en_preparation">En Préparation</option>
                  <option value="en_livraison">En Livraison</option>
                  <option value="livree">Livrée</option>
                  <option value="annulee">Annulée</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}