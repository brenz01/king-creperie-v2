'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { LIBELLE_STATUT, type Commande, type StatutCommande, type Produit } from '@/types';
import PushOptIn from '@/components/pwa/PushOptIn';
import { useRouter } from 'next/navigation';
import { RefreshCw, LogOut, Package, ClipboardList, Save, History } from 'lucide-react';

type Onglet = 'commandes' | 'produits' | 'historique';

const COULEUR_STATUT: Record<StatutCommande, string> = {
  recue: 'text-amber-400',
  en_preparation: 'text-blue-400',
  en_livraison: 'text-purple-400',
  livree: 'text-emerald-400',
  annulee: 'text-rose-400',
};

interface LigneAuditLog {
  id: string;
  commande_id: string;
  ancien_statut: string | null;
  nouveau_statut: string;
  modifie_par_email: string | null;
  created_at: string;
}

export default function AdminDashboardPage() {
  const [onglet, setOnglet] = useState<Onglet>('commandes');
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [auditLog, setAuditLog] = useState<LigneAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [erreurStatut, setErreurStatut] = useState<string | null>(null);
  const router = useRouter();

  const fetchCommandes = useCallback(async () => {
    // Les 100 plus récentes : suffisant pour le service, et évite de
    // recharger tout l'historique à chaque événement Broadcast.
    const { data, error } = await supabase
      .from('commandes')
      .select('*, commande_items(*)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && data) setCommandes(data as Commande[]);
    setLoading(false);
  }, []);

  const fetchProduits = useCallback(async () => {
    const { data, error } = await supabase.from('produits').select('*').order('nom', { ascending: true });
    if (!error && data) setProduits(data as Produit[]);
  }, []);

  const fetchAuditLog = useCallback(async () => {
    const { data, error } = await supabase
      .from('commandes_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && data) setAuditLog(data as LigneAuditLog[]);
  }, []);

  useEffect(() => {
    let actif = true;
    let channel: RealtimeChannel | null = null;

    // Garde le jeton Realtime à jour après chaque refresh de session
    // (sinon le canal privé est coupé à l'expiration du JWT, ~1 h).
    const { data: ecoute } = supabase.auth.onAuthStateChange((evenement, s) => {
      if (!actif) return;
      if (evenement === 'SIGNED_OUT' || !s) {
        router.replace('/admin/login');
        return;
      }
      void supabase.realtime.setAuth(s.access_token);
      setSession(s);
    });

    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!actif) return;
      if (!s) {
        router.replace('/admin/login');
        return;
      }
      setSession(s);
      void supabase.realtime.setAuth(s.access_token);
      void fetchCommandes();
      void fetchProduits();
      void fetchAuditLog();

      channel = supabase
        .channel('admin-commandes', { config: { private: true } })
        .on('broadcast', { event: '*' }, () => {
          void fetchCommandes();
          void fetchAuditLog();
        })
        .subscribe();
    });

    // Cleanup réellement retourné par l'effet (avant : retourné depuis
    // le .then(), donc jamais exécuté → canaux dupliqués à chaque visite).
    return () => {
      actif = false;
      ecoute.subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router, fetchCommandes, fetchProduits, fetchAuditLog]);

  const handleUpdateStatus = async (id: string, newStatut: StatutCommande) => {
    setErreurStatut(null);
    const { error } = await supabase.from('commandes').update({ statut: newStatut }).eq('id', id);
    if (error) {
      setErreurStatut(`Changement de statut refusé : ${error.message}`);
      return;
    }
    setCommandes((prev) => prev.map((c) => (c.id === id ? { ...c, statut: newStatut } : c)));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/admin/login');
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1C1712]">
        <p className="text-amber-500 font-medium">Vérification de la session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 pb-16 px-6 max-w-7xl mx-auto text-stone-100 bg-[#1C1712]">
      <div className="flex flex-wrap justify-between items-center mb-8 gap-4 border-b border-[#3D332A] pb-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-white">Tableau de bord Staff</h1>
          <p className="text-stone-400 text-sm">Gestion des commandes, produits et historique</p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <PushOptIn cible={{ accessToken: session.access_token }} libelle="Alertes nouvelles commandes" compact />
          {onglet === 'commandes' && (
            <button
              onClick={() => void fetchCommandes()}
              aria-label="Rafraîchir"
              className="p-3 bg-[#26201A] border border-[#3D332A] rounded-xl text-stone-300 hover:text-white hover:border-amber-600/50 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold px-4 py-2.5 rounded-xl hover:bg-rose-500/20 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-8 flex-wrap">
        <button
          onClick={() => setOnglet('commandes')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${
            onglet === 'commandes'
              ? 'bg-amber-600 text-white'
              : 'bg-[#26201A] border border-[#3D332A] text-stone-400 hover:text-white'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Commandes</span>
        </button>
        <button
          onClick={() => setOnglet('produits')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${
            onglet === 'produits'
              ? 'bg-amber-600 text-white'
              : 'bg-[#26201A] border border-[#3D332A] text-stone-400 hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Produits & Stock</span>
        </button>
        <button
          onClick={() => setOnglet('historique')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${
            onglet === 'historique'
              ? 'bg-amber-600 text-white'
              : 'bg-[#26201A] border border-[#3D332A] text-stone-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Historique</span>
        </button>
      </div>

      {erreurStatut && (
        <div role="alert" className="mb-6 bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-sm font-medium">
          {erreurStatut}
        </div>
      )}

      {onglet === 'commandes' && (
        loading ? (
          <p className="text-amber-500 text-center py-12 font-medium">Chargement des commandes...</p>
        ) : (
          <div className="space-y-4">
            {commandes.length === 0 && (
              <p className="text-stone-500 text-center py-12">Aucune commande pour le moment.</p>
            )}
            {commandes.map((cmd) => (
              <div key={cmd.id} className="bg-[#26201A] border border-[#3D332A] p-6 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-md">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-amber-500 text-sm">#{cmd.id.slice(0, 8)}</span>
                    <span className="text-xs text-stone-500">{new Date(cmd.created_at).toLocaleString('fr-FR')}</span>
                  </div>
                  <p className="text-white font-bold">{cmd.client_nom} — <span className="text-amber-500">{cmd.client_telephone}</span></p>
                  <p className="text-xs text-stone-400">{cmd.adresse_livraison}</p>

                  {cmd.commande_items && cmd.commande_items.length > 0 && (
                    <ul className="mt-2 text-xs text-stone-300 space-y-1 bg-[#1C1712] p-3 rounded-xl border border-[#3D332A]">
                      {cmd.commande_items.map((it) => (
                        <li key={it.id}>• {it.quantite}x {it.nom_produit}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 border-t lg:border-t-0 border-[#3D332A] pt-4 lg:pt-0">
                  <div className="text-right">
                    <p className="text-xs text-stone-500 uppercase font-bold">Total</p>
                    <p className="font-serif text-xl font-bold text-white">{cmd.total.toLocaleString('fr-FR')} FCFA</p>
                  </div>

                  <select
                    aria-label={`Statut de la commande ${cmd.id.slice(0, 8)}`}
                    value={cmd.statut}
                    onChange={(e) => handleUpdateStatus(cmd.id, e.target.value as StatutCommande)}
                    className="bg-[#1C1712] border border-[#3D332A] text-white font-bold text-sm py-2 px-3 rounded-xl focus:outline-none focus:border-amber-500 transition-colors"
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
        )
      )}

      {onglet === 'produits' && (
        <GestionProduits produits={produits} onRefresh={fetchProduits} />
      )}

      {onglet === 'historique' && (
        <HistoriqueAudit auditLog={auditLog} commandes={commandes} onRefresh={fetchAuditLog} />
      )}
    </div>
  );
}

interface HistoriqueAuditProps {
  auditLog: LigneAuditLog[];
  commandes: Commande[];
  onRefresh: () => void;
}

function HistoriqueAudit({ auditLog, commandes, onRefresh }: HistoriqueAuditProps) {
  const trouverCommande = (id: string) => commandes.find((c) => c.id === id);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-stone-400 text-sm">{auditLog.length} changement{auditLog.length > 1 ? 's' : ''} récent{auditLog.length > 1 ? 's' : ''}</p>
        <button
          onClick={onRefresh}
          aria-label="Rafraîchir l'historique"
          className="p-2.5 bg-[#26201A] border border-[#3D332A] rounded-xl text-stone-300 hover:text-white hover:border-amber-600/50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {auditLog.length === 0 ? (
        <p className="text-stone-500 text-center py-12">Aucun changement enregistré pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {auditLog.map((ligne) => {
            const commande = trouverCommande(ligne.commande_id);
            return (
              <div
                key={ligne.id}
                className="bg-[#26201A] border border-[#3D332A] px-5 py-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-xs text-stone-500">#{ligne.commande_id.slice(0, 8)}</span>
                  {commande && (
                    <span className="text-sm text-stone-300">{commande.client_nom}</span>
                  )}
                  <span className="text-sm text-stone-500">
                    {ligne.ancien_statut ? (LIBELLE_STATUT[ligne.ancien_statut as StatutCommande] ?? ligne.ancien_statut) : '—'}
                  </span>
                  <span className="text-stone-600">→</span>
                  <span className={`text-sm font-bold ${COULEUR_STATUT[ligne.nouveau_statut as StatutCommande] ?? 'text-white'}`}>
                    {LIBELLE_STATUT[ligne.nouveau_statut as StatutCommande] ?? ligne.nouveau_statut}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-stone-500">
                  <span>{ligne.modifie_par_email || 'Système'}</span>
                  <span>{new Date(ligne.created_at).toLocaleString('fr-FR')}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface GestionProduitsProps {
  produits: Produit[];
  onRefresh: () => void;
}

interface ModifsProduit {
  disponible: boolean;
  stock_gere: boolean;
  stock_quantite: number | null;
}

function GestionProduits({ produits, onRefresh }: GestionProduitsProps) {
  const [modifs, setModifs] = useState<Record<string, ModifsProduit>>({});
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const getValeur = (produit: Produit): ModifsProduit => {
    return modifs[produit.id] || {
      disponible: produit.disponible,
      stock_gere: produit.stock_gere || false,
      stock_quantite: produit.stock_quantite ?? null,
    };
  };

  const modifierChamp = <K extends keyof ModifsProduit>(produitId: string, produit: Produit, champ: K, valeur: ModifsProduit[K]) => {
    setModifs((prev) => ({
      ...prev,
      [produitId]: {
        ...getValeur(produit),
        [champ]: valeur,
      },
    }));
  };

  const sauvegarder = async (produit: Produit) => {
    const valeurs = modifs[produit.id];
    if (!valeurs) return;

    setSauvegardeEnCours(produit.id);
    setErreur(null);

    const payload = valeurs.stock_gere
      ? { disponible: valeurs.disponible, stock_gere: true, stock_quantite: valeurs.stock_quantite ?? 0 }
      : { disponible: valeurs.disponible, stock_gere: false, stock_quantite: null };

    // Verrou optimiste : l'UPDATE ne s'applique que si le stock en base
    // est toujours celui affiché. Sinon une commande passée entre-temps
    // (qui a décrémenté le stock) serait silencieusement écrasée.
    let requete = supabase.from('produits').update(payload).eq('id', produit.id);
    requete = produit.stock_quantite == null
      ? requete.is('stock_quantite', null)
      : requete.eq('stock_quantite', produit.stock_quantite);
    const { data, error } = await requete.select('id');

    if (error) {
      console.error('Erreur sauvegarde produit:', error);
      setErreur(`Erreur lors de la sauvegarde : ${error.message}`);
    } else if (!data || data.length === 0) {
      setErreur(`Le stock de « ${produit.nom} » a changé entre-temps (commande en cours). Valeurs rechargées, vérifiez puis réenregistrez.`);
      setModifs((prev) => {
        const copie = { ...prev };
        delete copie[produit.id];
        return copie;
      });
      onRefresh();
    } else {
      setModifs((prev) => {
        const copie = { ...prev };
        delete copie[produit.id];
        return copie;
      });
      onRefresh();
    }

    setSauvegardeEnCours(null);
  };

  return (
    <div className="space-y-4">
      {erreur && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-sm font-medium">
          {erreur}
        </div>
      )}

      {produits.map((produit) => {
        const valeurs = getValeur(produit);
        const aDesModifs = !!modifs[produit.id];
        const stockBas = valeurs.stock_gere && valeurs.stock_quantite !== null && valeurs.stock_quantite <= 3;

        return (
          <div
            key={produit.id}
            className={`bg-[#26201A] border p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              stockBas ? 'border-amber-500/50' : 'border-[#3D332A]'
            }`}
          >
            <div className="flex-1">
              <p className="text-white font-bold">{produit.nom}</p>
              <p className="text-xs text-stone-500">{produit.prix.toLocaleString('fr-FR')} FCFA — {produit.categorie}</p>
              {stockBas && (
                <p className="text-xs text-amber-500 font-bold mt-1">⚠ Stock bas ({valeurs.stock_quantite} restant{valeurs.stock_quantite === 1 ? '' : 's'})</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-stone-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={valeurs.disponible}
                  onChange={(e) => modifierChamp(produit.id, produit, 'disponible', e.target.checked)}
                  className="w-4 h-4 accent-amber-600"
                />
                <span>Disponible</span>
              </label>

              <label className="flex items-center gap-2 text-sm text-stone-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={valeurs.stock_gere}
                  onChange={(e) => {
                    const geree = e.target.checked;
                    setModifs((prev) => ({
                      ...prev,
                      [produit.id]: {
                        ...getValeur(produit),
                        stock_gere: geree,
                        stock_quantite: geree ? (valeurs.stock_quantite ?? 0) : valeurs.stock_quantite,
                      },
                    }));
                  }}
                  className="w-4 h-4 accent-amber-600"
                />
                <span>Gérer le stock</span>
              </label>

              {valeurs.stock_gere && (
                <input
                  type="number"
                  min={0}
                  value={valeurs.stock_quantite ?? 0}
                  onChange={(e) => modifierChamp(produit.id, produit, 'stock_quantite', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  aria-label={`Stock de ${produit.nom}`}
                  className="w-20 bg-[#1C1712] border border-[#3D332A] text-white text-sm py-2 px-3 rounded-xl focus:outline-none focus:border-amber-500"
                />
              )}

              {aDesModifs && (
                <button
                  onClick={() => void sauvegarder(produit)}
                  disabled={sauvegardeEnCours === produit.id}
                  className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{sauvegardeEnCours === produit.id ? '...' : 'Enregistrer'}</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}