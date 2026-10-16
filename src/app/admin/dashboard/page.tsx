'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { ClipboardList, Crown, Loader2, RefreshCw, Store, UtensilsCrossed, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Commande, Produit, StatutCommande } from '@/types';
import { etatBoutique, type Boutique } from '@/lib/horaires';
import PushOptIn from '@/components/pwa/PushOptIn';
import VueCommandes from '@/components/staff/VueCommandes';
import VueCarte from '@/components/staff/VueCarte';
import VueBoutique, { type LigneAuditLog } from '@/components/staff/VueBoutique';
import { EN_COURS, useMaintenant } from '@/components/staff/commun';
import { definirSon, jouerCarillon, sonActif, useSonActive } from '@/lib/staff/son';

// ------------------------------------------------------------------
// KC Staff. Trois écrans, dans l'ordre du service :
//   Commandes : ce qu'il faut faire maintenant (une action par carte) ;
//   Carte     : retirer / remettre un produit d'un geste ;
//   Boutique  : ouvert ou fermé, pause, horaires, bilan du jour.
// ------------------------------------------------------------------
type Onglet = 'commandes' | 'carte' | 'boutique';

export default function AdminDashboardPage() {
  const [onglet, setOnglet] = useState<Onglet>('commandes');
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [auditLog, setAuditLog] = useState<LigneAuditLog[]>([]);
  const [boutique, setBoutique] = useState<Boutique | null>(null);
  const [boutiqueAbsente, setBoutiqueAbsente] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actualisation, setActualisation] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nouvelles, setNouvelles] = useState<Set<string>>(new Set());
  const vues = useRef<Set<string> | null>(null);
  const router = useRouter();
  const maintenant = useMaintenant();
  const son = useSonActive();

  const fetchCommandes = useCallback(async () => {
    // Les 200 plus récentes : couvre le service du jour et le bilan.
    const { data, error } = await supabase
      .from('commandes')
      .select('*, commande_items(*)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && data) {
      const liste = data as Commande[];
      // Nouvelles commandes depuis le dernier chargement : mises en
      // évidence + vibration (téléphone posé en cuisine).
      if (vues.current) {
        const arrivees = liste.filter((c) => !vues.current!.has(c.id) && c.statut === 'recue').map((c) => c.id);
        if (arrivees.length > 0) {
          setNouvelles((prev) => new Set([...prev, ...arrivees]));
          navigator.vibrate?.([180, 80, 180]);
          if (sonActif()) jouerCarillon();
        }
      }
      vues.current = new Set(liste.map((c) => c.id));
      setCommandes(liste);
    }
    setLoading(false);
    setActualisation(false);
  }, []);

  const fetchProduits = useCallback(async () => {
    const { data, error } = await supabase.from('produits').select('*').order('prix', { ascending: true });
    if (!error && data) setProduits(data as Produit[]);
  }, []);

  const fetchAuditLog = useCallback(async () => {
    const { data, error } = await supabase
      .from('commandes_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && data) setAuditLog(data as LigneAuditLog[]);
  }, []);

  const fetchBoutique = useCallback(async () => {
    const { data, error } = await supabase
      .from('boutique')
      .select('horaires, fermeture_exceptionnelle, message_fermeture')
      .eq('id', 1)
      .maybeSingle();
    if (data) {
      setBoutique(data as Boutique);
      setBoutiqueAbsente(false);
    } else if (error && /boutique|does not exist|schema cache/i.test(error.message)) {
      setBoutiqueAbsente(true);
    }
  }, []);

  const toutRecharger = useCallback(() => {
    void fetchCommandes();
    void fetchProduits();
    void fetchAuditLog();
    void fetchBoutique();
  }, [fetchCommandes, fetchProduits, fetchAuditLog, fetchBoutique]);

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
      toutRecharger();

      channel = supabase
        .channel('admin-commandes', { config: { private: true } })
        .on('broadcast', { event: '*' }, () => {
          void fetchCommandes();
          void fetchAuditLog();
          void fetchProduits(); // le stock bouge à chaque commande
        })
        .subscribe();
    });

    // Retour au premier plan (téléphone sorti de veille) : resynchronisation,
    // le canal Realtime a pu être coupé entre-temps.
    const auRetour = () => {
      if (document.visibilityState === 'visible') toutRecharger();
    };
    document.addEventListener('visibilitychange', auRetour);

    return () => {
      actif = false;
      ecoute.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', auRetour);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router, toutRecharger, fetchCommandes, fetchAuditLog, fetchProduits]);

  const changerStatut = async (id: string, statut: StatutCommande): Promise<boolean> => {
    setErreur(null);
    const { error } = await supabase.from('commandes').update({ statut }).eq('id', id);
    if (error) {
      setErreur(
        /fetch|network/i.test(error.message)
          ? 'Pas de réseau : le changement n’a pas été enregistré. Réessayez.'
          : `Changement refusé : ${error.message}`,
      );
      return false;
    }
    setCommandes((prev) => prev.map((c) => (c.id === id ? { ...c, statut } : c)));
    setNouvelles((prev) => {
      if (!prev.has(id)) return prev;
      const copie = new Set(prev);
      copie.delete(id);
      return copie;
    });
    return true;
  };

  const deconnexion = async () => {
    await supabase.auth.signOut();
    router.replace('/admin/login');
  };

  if (!session) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-kc-nuit text-kc-beurre">
        <Loader2 className="w-6 h-6 animate-spin" aria-label="Vérification de la session" />
      </div>
    );
  }

  // Sur grand écran (tablette posée, ordinateur), les commandes passent
  // en trois colonnes : à lancer, au four, chez le livreur.
  const largeur = onglet === 'commandes' ? 'max-w-3xl lg:max-w-6xl' : 'max-w-3xl';
  const nbEnCours = commandes.filter((c) => EN_COURS.includes(c.statut)).length;
  const nbALancer = commandes.filter((c) => c.statut === 'recue').length;
  const etat = boutique ? etatBoutique(boutique, new Date(maintenant)) : null;
  const nbHorsCarte = produits.filter((p) => !p.disponible || (p.stock_gere && (p.stock_quantite ?? 0) <= 0)).length;

  // Bandeaux en tête de la liste : seulement ce qui empêche de recevoir
  // ou de voir des commandes.
  const bandeaux = (
    <div className="space-y-2 mb-4 empty:hidden">
      {etat && !etat.ouvert && (
        <button
          onClick={() => setOnglet('boutique')}
          className="w-full text-left rounded-2xl bg-kc-bissap/15 border border-kc-bissap/40 px-4 py-3 text-sm text-kc-beurre"
        >
          <span className="font-semibold">{etat.enPause ? 'Commandes en pause.' : 'Boutique fermée.'}</span> Les clients ne
          peuvent pas commander.{' '}
          <span className="underline font-semibold">{etat.enPause ? 'Reprendre' : 'Voir les horaires'}</span>
        </button>
      )}
      <PushOptIn
        cible={{ accessToken: session.access_token }}
        libelle="Activer les alertes pour ne rater aucune commande"
        compact
        masquerSiActif
      />
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-kc-nuit text-kc-lait pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-kc-nuit border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <div className={`${largeur} mx-auto px-4 h-16 flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-2 min-w-0">
            <Crown className="w-6 h-6 text-kc-caramel shrink-0" strokeWidth={2.4} />
            <span className="font-display text-xl text-kc-beurre leading-none">KC Staff</span>
          </div>
          <div className="flex items-center gap-1">
            {etat && (
              <button
                onClick={() => setOnglet('boutique')}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-kc-beurre"
              >
                <span className={`w-2 h-2 rounded-full ${etat.ouvert ? 'bg-[#5fd08b]' : 'bg-kc-bissap'}`} aria-hidden />
                {etat.ouvert ? 'Ouvert' : etat.enPause ? 'En pause' : 'Fermé'}
              </button>
            )}
            <button
              onClick={() => definirSon(!son)}
              aria-pressed={son}
              aria-label={son ? 'Couper le son des nouvelles commandes' : 'Activer le son des nouvelles commandes'}
              title={son ? 'Son activé' : 'Son coupé'}
              className="appui w-11 h-11 rounded-full flex items-center justify-center text-kc-brume hover:bg-white/10"
            >
              {son ? <Volume2 className="w-5 h-5 text-kc-caramel" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <button
              onClick={() => {
                setActualisation(true);
                toutRecharger();
              }}
              aria-label="Actualiser"
              className="w-11 h-11 rounded-full flex items-center justify-center text-kc-brume hover:bg-white/10"
            >
              <RefreshCw className={`w-5 h-5 ${actualisation ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className={`${largeur} mx-auto px-4 pt-5`}>
        {erreur && (
          <div
            role="alert"
            className="mb-4 rounded-2xl bg-kc-bissap/15 border border-kc-bissap/40 text-kc-beurre px-4 py-3 text-sm"
          >
            {erreur}
          </div>
        )}

        {onglet === 'commandes' && (
          <VueCommandes
            commandes={commandes}
            loading={loading}
            nouvelles={nouvelles}
            onStatut={changerStatut}
            bandeaux={bandeaux}
          />
        )}
        {onglet === 'carte' && <VueCarte produits={produits} onRefresh={fetchProduits} />}
        {onglet === 'boutique' && (
          <VueBoutique
            boutique={boutique}
            boutiqueAbsente={boutiqueAbsente}
            maintenant={maintenant}
            commandes={commandes}
            auditLog={auditLog}
            session={session}
            onBoutique={setBoutique}
            onDeconnexion={() => void deconnexion()}
          />
        )}
      </main>

      {/* Navigation au pouce. Les pastilles disent où il y a quelque chose à faire. */}
      <nav
        aria-label="Sections"
        className="fixed bottom-0 inset-x-0 z-30 bg-kc-nuit border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-3xl mx-auto grid grid-cols-3">
          {(
            [
              {
                id: 'commandes',
                libelle: 'Commandes',
                Icone: ClipboardList,
                badge: nbALancer || nbEnCours,
                urgent: nbALancer > 0,
              },
              { id: 'carte', libelle: 'Carte', Icone: UtensilsCrossed, badge: nbHorsCarte, urgent: false },
              { id: 'boutique', libelle: 'Boutique', Icone: Store, badge: etat && !etat.ouvert ? 1 : 0, urgent: false },
            ] as const
          ).map(({ id, libelle, Icone, badge, urgent }) => (
            <button
              key={id}
              onClick={() => setOnglet(id)}
              aria-current={onglet === id ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors ${
                onglet === id ? 'text-kc-caramel' : 'text-kc-brume/60 hover:text-kc-brume'
              }`}
            >
              <Icone className="w-5 h-5" />
              {libelle}
              {badge > 0 &&
                (id === 'boutique' ? (
                  <span className="absolute top-2 left-1/2 ml-2.5 w-2.5 h-2.5 rounded-full bg-kc-bissap" aria-label="Fermé" />
                ) : (
                  <span
                    className={`absolute top-1.5 left-1/2 ml-2 min-w-5 h-5 px-1 rounded-full text-[11px] leading-5 text-center ${
                      urgent
                        ? 'bg-kc-bissap text-white'
                        : id === 'carte'
                          ? 'bg-white/15 text-kc-brume'
                          : 'bg-kc-caramel text-kc-nuit'
                    }`}
                  >
                    {badge}
                  </span>
                ))}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
