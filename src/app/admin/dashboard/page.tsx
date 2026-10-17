'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { ChartNoAxesColumn, ClipboardList, Crown, Loader2, RefreshCw, Store, UsersRound, UtensilsCrossed, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Commande, Produit, StatutCommande } from '@/types';
import { etatBoutique, type Boutique } from '@/lib/horaires';
import PushOptIn from '@/components/pwa/PushOptIn';
import VueCommandes from '@/components/staff/VueCommandes';
import VueCarte from '@/components/staff/VueCarte';
import VueBoutique, { type LigneAuditLog } from '@/components/staff/VueBoutique';
import { EN_COURS, useMaintenant } from '@/components/staff/commun';
import { definirSon, jouerCarillon, sonActif, useSonActive } from '@/lib/staff/son';
import InfoBulle from '@/components/ui/InfoBulle';
import VueAujourdhui from '@/components/staff/VueAujourdhui';
import VueClients from '@/components/staff/VueClients';
import Ticket from '@/components/staff/Ticket';
import MenuProfil from '@/components/staff/MenuProfil';
import type { CommandeResume } from '@/lib/staff/statistiques';

// ------------------------------------------------------------------
// KC Staff. Cinq écrans :
//   Aujourd'hui : à faire maintenant, chiffres du jour, vitesse, bilan ;
//   Commandes   : ce qu'il faut faire maintenant (une action par carte) ;
//   Clients     : qui revient, combien, un geste pour écrire ;
//   Carte       : retirer / remettre un produit d'un geste ;
//   Boutique    : ouvert ou fermé, pause, horaires, journal.
// Téléphone : navigation en bas. Tablette et ordinateur : barre latérale.
// ------------------------------------------------------------------
type Onglet = 'aujourdhui' | 'commandes' | 'clients' | 'carte' | 'boutique';

const JOUR_MS = 24 * 3600 * 1000;

export default function AdminDashboardPage() {
  const [onglet, setOnglet] = useState<Onglet>('commandes');
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [historique, setHistorique] = useState<CommandeResume[]>([]);
  const [historiqueCharge, setHistoriqueCharge] = useState(false);
  const [ticket, setTicket] = useState<Commande | null>(null);
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

  // 90 jours, colonnes légères (ni adresse ni articles) : chiffres du jour,
  // comparaison à la semaine dernière, clients, export.
  const fetchHistorique = useCallback(async () => {
    const { data, error } = await supabase
      .from('commandes')
      .select('id, created_at, client_nom, client_telephone, total, statut')
      .gte('created_at', new Date(Date.now() - 90 * JOUR_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(5000);
    if (!error && data) setHistorique(data as CommandeResume[]);
    setHistoriqueCharge(true);
  }, []);

  // 7 jours de journal : vitesse du service et écran Boutique.
  const fetchAuditLog = useCallback(async () => {
    const { data, error } = await supabase
      .from('commandes_audit_log')
      .select('*')
      .gte('created_at', new Date(Date.now() - 7 * JOUR_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(2000);
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
    void fetchHistorique();
    void fetchProduits();
    void fetchAuditLog();
    void fetchBoutique();
  }, [fetchCommandes, fetchHistorique, fetchProduits, fetchAuditLog, fetchBoutique]);

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
          void fetchHistorique();
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
  }, [router, toutRecharger, fetchCommandes, fetchHistorique, fetchAuditLog, fetchProduits]);

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
    setHistorique((prev) => prev.map((c) => (c.id === id ? { ...c, statut } : c)));
    void fetchAuditLog();
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
      <div className="min-h-[100dvh] flex items-center justify-center bg-kc-nuit text-kc-creme">
        <Loader2 className="w-6 h-6 animate-spin" aria-label="Vérification de la session" />
      </div>
    );
  }

  // Sur grand écran (tablette posée, ordinateur), les commandes passent
  // en trois colonnes : à lancer, au four, chez le livreur.
  const largeur = onglet === 'commandes' || onglet === 'aujourdhui' ? 'max-w-3xl lg:max-w-6xl' : 'max-w-3xl';
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
          className="w-full text-left rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm text-kc-creme"
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
    <div className="min-h-[100dvh] bg-kc-nuit text-kc-creme pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10 lg:pl-60">
      <header className="verre-staff sticky top-0 z-30 bg-kc-nuit/90 backdrop-blur-md border-b border-kc-bord pt-[env(safe-area-inset-top)]">
        <div className={`${largeur} mx-auto px-4 h-16 flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-2 min-w-0 lg:invisible">
            <Crown className="w-6 h-6 text-kc-caramel shrink-0" strokeWidth={2.4} />
            <span className="hidden min-[400px]:inline font-serif font-semibold text-xl text-kc-creme leading-none">KC Staff</span>
          </div>
          <div className="flex items-center gap-1">
            {etat && (
              <button
                onClick={() => setOnglet('boutique')}
                className="appui inline-flex items-center gap-1.5 min-h-11 rounded-full border border-kc-bord px-3 text-xs font-semibold text-kc-creme"
              >
                <span className={`w-2 h-2 rounded-full ${etat.ouvert ? 'bg-emerald-400' : 'bg-rose-500'}`} aria-hidden />
                {etat.ouvert ? 'Ouvert' : etat.enPause ? 'En pause' : 'Fermé'}
              </button>
            )}
            <InfoBulle libelle={son ? 'Couper le son' : 'Activer le son'} cote="basDroite" sombre>
              <button
                onClick={() => definirSon(!son)}
                aria-pressed={son}
                aria-label={son ? 'Couper le son des nouvelles commandes' : 'Activer le son des nouvelles commandes'}
                className="appui w-11 h-11 rounded-full flex items-center justify-center text-kc-sable hover:bg-white/10"
              >
                {son ? <Volume2 className="w-5 h-5 text-kc-caramel" /> : <VolumeX className="w-5 h-5" />}
              </button>
            </InfoBulle>
            <InfoBulle libelle="Actualiser les commandes" cote="basDroite" sombre>
              <button
                onClick={() => {
                  setActualisation(true);
                  toutRecharger();
                }}
                aria-label="Actualiser les commandes"
                className="appui w-11 h-11 rounded-full flex items-center justify-center text-kc-sable hover:bg-white/10"
              >
                <RefreshCw className={`w-5 h-5 ${actualisation ? 'motion-safe:animate-spin' : ''}`} />
              </button>
            </InfoBulle>
            <MenuProfil
              email={session.user.email ?? 'Compte staff'}
              onReglages={() => setOnglet('boutique')}
              onDeconnexion={() => void deconnexion()}
            />
          </div>
        </div>
      </header>

      <main className={`${largeur} mx-auto px-4 pt-5`}>
        {erreur && (
          <div
            role="alert"
            className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-kc-creme px-4 py-3 text-sm"
          >
            {erreur}
          </div>
        )}

        {onglet === 'aujourdhui' && (
          <VueAujourdhui
            historique={historique}
            commandes={commandes}
            journal={auditLog}
            maintenant={maintenant}
            chargement={!historiqueCharge}
            onVoirCommandes={() => setOnglet('commandes')}
          />
        )}
        {onglet === 'commandes' && (
          <VueCommandes
            commandes={commandes}
            loading={loading}
            nouvelles={nouvelles}
            onStatut={changerStatut}
            bandeaux={bandeaux}
            onImprimer={setTicket}
          />
        )}
        {onglet === 'clients' && <VueClients historique={historique} maintenant={maintenant} />}
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

      {/* Navigation : en bas au pouce sur téléphone, barre latérale sur grand
          écran. Les pastilles disent où il y a quelque chose à faire. */}
      <nav
        aria-label="Sections"
        className="verre-staff fixed z-30 bg-kc-nuit/90 backdrop-blur-md border-kc-bord bottom-0 inset-x-0 border-t pb-[env(safe-area-inset-bottom)] lg:inset-y-0 lg:left-0 lg:right-auto lg:w-60 lg:border-t-0 lg:border-r lg:pb-6 lg:bg-kc-nuit"
      >
        <div className="hidden lg:flex items-center gap-2 h-16 px-5">
          <Crown className="w-6 h-6 text-kc-caramel shrink-0" strokeWidth={2.4} />
          <span className="font-serif font-semibold text-xl text-kc-creme leading-none">KC Staff</span>
        </div>
        <div className="max-w-3xl mx-auto grid grid-cols-5 lg:mt-4 lg:flex lg:flex-col lg:gap-1 lg:px-3">
          {(
            [
              { id: 'aujourdhui', libelle: 'Aujourd’hui', Icone: ChartNoAxesColumn, badge: 0, urgent: false },
              {
                id: 'commandes',
                libelle: 'Commandes',
                Icone: ClipboardList,
                badge: nbALancer || nbEnCours,
                urgent: nbALancer > 0,
              },
              { id: 'clients', libelle: 'Clients', Icone: UsersRound, badge: 0, urgent: false },
              { id: 'carte', libelle: 'Carte', Icone: UtensilsCrossed, badge: nbHorsCarte, urgent: false },
              { id: 'boutique', libelle: 'Boutique', Icone: Store, badge: etat && !etat.ouvert ? 1 : 0, urgent: false },
            ] as const
          ).map(({ id, libelle, Icone, badge, urgent }) => {
            const actif = onglet === id;
            return (
              <button
                key={id}
                onClick={() => setOnglet(id)}
                aria-current={actif ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors lg:flex-row lg:gap-3 lg:px-4 lg:min-h-12 lg:rounded-xl lg:text-sm ${
                  actif ? 'text-kc-caramel lg:bg-white/5' : 'text-kc-sable/80 hover:text-kc-sable lg:hover:bg-white/5'
                }`}
              >
                <Icone className="w-5 h-5 shrink-0" aria-hidden />
                <span className="truncate max-w-full">{libelle}</span>
                {badge > 0 &&
                  (id === 'boutique' ? (
                    <span
                      className="absolute top-2 left-1/2 ml-2.5 w-2.5 h-2.5 rounded-full bg-rose-500 lg:static lg:ml-auto"
                      aria-label="Fermé"
                    />
                  ) : (
                    <span
                      className={`absolute top-1.5 left-1/2 ml-2 min-w-5 h-5 px-1 rounded-full text-xs leading-5 text-center lg:static lg:ml-auto ${
                        urgent ? 'bg-rose-600 text-white' : id === 'carte' ? 'bg-white/15 text-kc-sable' : 'bg-kc-caramel text-kc-nuit'
                      }`}
                    >
                      {badge}
                    </span>
                  ))}
              </button>
            );
          })}
        </div>
      </nav>

      {ticket && <Ticket commande={ticket} onFini={() => setTicket(null)} />}
    </div>
  );
}
