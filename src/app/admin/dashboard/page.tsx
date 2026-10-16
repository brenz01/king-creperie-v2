'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { LIBELLE_STATUT, type Commande, type StatutCommande, type Produit, type CategorieProduit } from '@/types';
import PushOptIn from '@/components/pwa/PushOptIn';
import { urlWhatsAppClient } from '@/lib/whatsapp';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  LogOut,
  Package,
  ClipboardList,
  History,
  Crown,
  Phone,
  MessageCircle,
  Undo2,
  Loader2,
  ChevronDown,
} from 'lucide-react';

type Onglet = 'commandes' | 'produits' | 'historique';
type Filtre = 'en_cours' | 'livrees' | 'annulees';

interface LigneAuditLog {
  id: string;
  commande_id: string;
  ancien_statut: string | null;
  nouveau_statut: string;
  modifie_par_email: string | null;
  created_at: string;
}

// ------------------------------------------------------------------
// Statuts : couleur de pastille, étape suivante (un seul geste en
// plein service) et étape précédente (correction d'une erreur).
// ------------------------------------------------------------------
const PASTILLE: Record<StatutCommande, string> = {
  recue: 'bg-kc-bissap text-white',
  en_preparation: 'bg-kc-caramel text-kc-nuit',
  en_livraison: 'bg-kc-indigo text-kc-beurre',
  livree: 'bg-kc-encre/10 text-kc-encre/70',
  annulee: 'bg-kc-encre/10 text-kc-encre/50 line-through',
};

const SUIVANT: Partial<Record<StatutCommande, { statut: StatutCommande; action: string }>> = {
  recue: { statut: 'en_preparation', action: 'Lancer la préparation' },
  en_preparation: { statut: 'en_livraison', action: 'Remettre au livreur' },
  en_livraison: { statut: 'livree', action: 'Marquer comme livrée' },
};

const PRECEDENT: Partial<Record<StatutCommande, StatutCommande>> = {
  en_preparation: 'recue',
  en_livraison: 'en_preparation',
  livree: 'en_livraison',
};

const EN_COURS: StatutCommande[] = ['recue', 'en_preparation', 'en_livraison'];

const numero = (id: string) => id.slice(0, 8).toUpperCase();
const prix = (n: number) => `${n.toLocaleString('fr-FR')} F`;
const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

// Horloge partagée (30 s) pour les « il y a 6 min », sans setState dans un effet.
function sAbonnerHorloge(f: () => void) {
  const t = setInterval(f, 30_000);
  return () => clearInterval(t);
}
const lireHorloge = () => Math.floor(Date.now() / 30_000);
function useMaintenant(): number {
  return useSyncExternalStore(sAbonnerHorloge, lireHorloge, () => 0) * 30_000;
}

function depuis(iso: string, maintenant: number): string {
  if (!maintenant) return heure(iso);
  const min = Math.max(0, Math.round((maintenant - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `il y a ${h} h ${String(min % 60).padStart(2, '0')}` : new Date(iso).toLocaleDateString('fr-FR');
}

export default function AdminDashboardPage() {
  const [onglet, setOnglet] = useState<Onglet>('commandes');
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [auditLog, setAuditLog] = useState<LigneAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actualisation, setActualisation] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nouvelles, setNouvelles] = useState<Set<string>>(new Set());
  const vues = useRef<Set<string> | null>(null);
  const router = useRouter();

  const fetchCommandes = useCallback(async () => {
    // Les 100 plus récentes : suffisant pour le service, et évite de
    // recharger tout l'historique à chaque événement Broadcast.
    const { data, error } = await supabase
      .from('commandes')
      .select('*, commande_items(*)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && data) {
      const liste = data as Commande[];
      // Nouvelles commandes arrivées depuis le dernier chargement :
      // mises en évidence + vibration (téléphone posé en cuisine).
      if (vues.current) {
        const arrivees = liste.filter((c) => !vues.current!.has(c.id) && c.statut === 'recue').map((c) => c.id);
        if (arrivees.length > 0) {
          setNouvelles((prev) => new Set([...prev, ...arrivees]));
          navigator.vibrate?.([180, 80, 180]);
        }
      }
      vues.current = new Set(liste.map((c) => c.id));
      setCommandes(liste);
    }
    setLoading(false);
    setActualisation(false);
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

    // Retour au premier plan (téléphone sorti de veille) : on resynchronise,
    // le canal Realtime a pu être coupé entre-temps.
    const auRetour = () => {
      if (document.visibilityState === 'visible') void fetchCommandes();
    };
    document.addEventListener('visibilitychange', auRetour);

    return () => {
      actif = false;
      ecoute.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', auRetour);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router, fetchCommandes, fetchProduits, fetchAuditLog]);

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

  const nbEnCours = commandes.filter((c) => EN_COURS.includes(c.statut)).length;
  const nbARecevoir = commandes.filter((c) => c.statut === 'recue').length;

  if (!session) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-kc-nuit text-kc-beurre">
        <Loader2 className="w-6 h-6 animate-spin" aria-label="Vérification de la session" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-kc-nuit text-kc-lait pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-kc-nuit/95 backdrop-blur-md border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Crown className="w-6 h-6 text-kc-caramel shrink-0" strokeWidth={2.4} />
            <span className="font-display text-xl text-kc-beurre leading-none">KC Staff</span>
            {nbARecevoir > 0 && (
              <span className="ml-1 bg-kc-bissap text-white text-xs font-bold rounded-full px-2 py-0.5">
                {nbARecevoir} à lancer
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setActualisation(true);
                void fetchCommandes();
                void fetchProduits();
                void fetchAuditLog();
              }}
              aria-label="Actualiser"
              className="w-11 h-11 rounded-full flex items-center justify-center text-kc-brume hover:bg-white/10"
            >
              <RefreshCw className={`w-5 h-5 ${actualisation ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => void deconnexion()}
              aria-label="Se déconnecter"
              className="w-11 h-11 rounded-full flex items-center justify-center text-kc-brume hover:bg-white/10"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-5">
        <div className="mb-5">
          <PushOptIn cible={{ accessToken: session.access_token }} libelle="Activer les alertes de commande" compact />
        </div>

        {erreur && (
          <div
            role="alert"
            className="mb-5 rounded-2xl bg-kc-bissap/15 border border-kc-bissap/40 text-kc-beurre px-4 py-3 text-sm"
          >
            {erreur}
          </div>
        )}

        {onglet === 'commandes' && (
          <VueCommandes commandes={commandes} loading={loading} nouvelles={nouvelles} onStatut={changerStatut} />
        )}
        {onglet === 'produits' && <GestionProduits produits={produits} onRefresh={fetchProduits} />}
        {onglet === 'historique' && <HistoriqueAudit auditLog={auditLog} commandes={commandes} />}
      </main>

      {/* Navigation au pouce, en bas de l'écran. */}
      <nav
        aria-label="Sections"
        className="fixed bottom-0 inset-x-0 z-30 bg-kc-nuit/95 backdrop-blur-md border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-3xl mx-auto grid grid-cols-3">
          {(
            [
              {
                id: 'commandes',
                libelle: 'Commandes',
                Icone: ClipboardList,
                badge: nbEnCours,
              },
              { id: 'produits', libelle: 'Produits', Icone: Package, badge: 0 },
              {
                id: 'historique',
                libelle: 'Historique',
                Icone: History,
                badge: 0,
              },
            ] as const
          ).map(({ id, libelle, Icone, badge }) => (
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
              {badge > 0 && (
                <span className="absolute top-1.5 left-1/2 ml-2 min-w-5 h-5 px-1 rounded-full bg-kc-bissap text-white text-[11px] leading-5 text-center">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ------------------------------------------------------------------
// Commandes
// ------------------------------------------------------------------
interface VueCommandesProps {
  commandes: Commande[];
  loading: boolean;
  nouvelles: Set<string>;
  onStatut: (id: string, statut: StatutCommande) => Promise<boolean>;
}

function VueCommandes({ commandes, loading, nouvelles, onStatut }: VueCommandesProps) {
  const [filtre, setFiltre] = useState<Filtre>('en_cours');
  const maintenant = useMaintenant();

  const listes = useMemo(() => {
    // En cours : d'abord celles à lancer, puis en préparation, puis en
    // route ; la plus ancienne en premier dans chaque groupe (ordre cuisine).
    const enCours = commandes
      .filter((c) => EN_COURS.includes(c.statut))
      .sort((a, b) => EN_COURS.indexOf(a.statut) - EN_COURS.indexOf(b.statut) || a.created_at.localeCompare(b.created_at));
    return {
      en_cours: enCours,
      livrees: commandes.filter((c) => c.statut === 'livree'),
      annulees: commandes.filter((c) => c.statut === 'annulee'),
    };
  }, [commandes]);

  const chips: Array<{ id: Filtre; libelle: string }> = [
    { id: 'en_cours', libelle: `En cours (${listes.en_cours.length})` },
    { id: 'livrees', libelle: 'Livrées' },
    { id: 'annulees', libelle: 'Annulées' },
  ];

  if (loading) {
    return (
      <div className="py-20 flex justify-center text-kc-brume">
        <Loader2 className="w-7 h-7 animate-spin" aria-label="Chargement des commandes" />
      </div>
    );
  }

  const liste = listes[filtre];

  return (
    <section aria-label="Commandes">
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1">
        {chips.map((c) => (
          <button
            key={c.id}
            onClick={() => setFiltre(c.id)}
            aria-pressed={filtre === c.id}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              filtre === c.id ? 'bg-kc-beurre text-kc-nuit' : 'border border-white/15 text-kc-brume hover:border-white/40'
            }`}
          >
            {c.libelle}
          </button>
        ))}
      </div>

      {liste.length === 0 ? (
        <p className="py-16 text-center text-kc-brume/70">
          {filtre === 'en_cours'
            ? 'Aucune commande en cours. Les nouvelles arrivent ici automatiquement.'
            : 'Rien à afficher pour le moment.'}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {liste.map((cmd) => (
            <li key={cmd.id}>
              <CarteCommande commande={cmd} nouvelle={nouvelles.has(cmd.id)} maintenant={maintenant} onStatut={onStatut} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface CarteCommandeProps {
  commande: Commande;
  nouvelle: boolean;
  maintenant: number;
  onStatut: (id: string, statut: StatutCommande) => Promise<boolean>;
}

function CarteCommande({ commande: cmd, nouvelle, maintenant, onStatut }: CarteCommandeProps) {
  const [enCours, setEnCours] = useState(false);
  const [confirmerAnnulation, setConfirmerAnnulation] = useState(false);
  const suivant = SUIVANT[cmd.statut];
  const precedent = PRECEDENT[cmd.statut];
  const annulable = cmd.statut === 'recue' || cmd.statut === 'en_preparation' || cmd.statut === 'en_livraison';
  const creneau = cmd.creneau_souhaite && cmd.creneau_souhaite !== 'Dès que possible' ? cmd.creneau_souhaite : null;

  const agir = async (statut: StatutCommande) => {
    setEnCours(true);
    await onStatut(cmd.id, statut);
    setEnCours(false);
    setConfirmerAnnulation(false);
  };

  return (
    <article
      className={`rounded-3xl bg-kc-lait text-kc-encre p-4 sm:p-5 ${nouvelle ? 'ring-4 ring-kc-bissap/70' : ''} ${
        cmd.statut === 'annulee' ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${PASTILLE[cmd.statut]}`}>
          {nouvelle ? 'Nouvelle commande' : LIBELLE_STATUT[cmd.statut]}
        </span>
        <span className="text-xs text-kc-encre/60 text-right">
          <span className="font-semibold text-kc-encre/80">{depuis(cmd.created_at, maintenant)}</span> · {heure(cmd.created_at)}
        </span>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-tight">{cmd.client_nom}</h3>
          <p className="text-xs text-kc-encre/50 mt-0.5">n° {numero(cmd.id)}</p>
        </div>
        <p className="prix text-2xl text-kc-indigo shrink-0">{prix(cmd.total)}</p>
      </div>

      <p className="mt-2 text-sm text-kc-encre/80 leading-snug">{cmd.adresse_livraison}</p>
      {creneau && (
        <p className="mt-1.5 inline-flex rounded-full bg-kc-caramel/25 px-2.5 py-0.5 text-xs font-semibold">
          Créneau : {creneau}
        </p>
      )}

      {cmd.commande_items && cmd.commande_items.length > 0 && (
        <ul className="mt-3 rounded-2xl bg-white border border-kc-encre/10 divide-y divide-kc-encre/5">
          {cmd.commande_items.map((it, i) => (
            <li key={it.id ?? i} className="px-3 py-2 text-sm">
              <span className="font-bold">{it.quantite} ×</span> {it.nom_produit}
              {it.extras && it.extras.length > 0 && (
                <span className="block text-xs text-kc-encre/60">+ {it.extras.map((e) => e.nom).join(', ')}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={`tel:${cmd.client_telephone.replace(/\s/g, '')}`}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-kc-encre/15 py-2.5 text-sm font-semibold hover:border-kc-encre/40"
        >
          <Phone className="w-4 h-4" /> Appeler
        </a>
        <a
          href={urlWhatsAppClient(cmd.client_telephone)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-kc-encre/15 py-2.5 text-sm font-semibold hover:border-kc-encre/40"
        >
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </a>
      </div>

      {suivant && (
        <button
          onClick={() => void agir(suivant.statut)}
          disabled={enCours}
          className="mt-3 w-full rounded-full bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold py-3.5 flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
        >
          {enCours && <Loader2 className="w-4 h-4 animate-spin" />}
          {suivant.action}
        </button>
      )}

      {(precedent || annulable) && (
        <div className="mt-2 flex items-center justify-between gap-2 text-sm">
          {precedent && !confirmerAnnulation ? (
            <button
              onClick={() => void agir(precedent)}
              disabled={enCours}
              className="inline-flex items-center gap-1.5 px-2 py-2 text-kc-encre/60 hover:text-kc-encre disabled:opacity-50"
            >
              <Undo2 className="w-4 h-4" /> Étape précédente
            </button>
          ) : (
            <span />
          )}
          {annulable &&
            (confirmerAnnulation ? (
              <span className="flex items-center gap-1">
                <button
                  onClick={() => void agir('annulee')}
                  disabled={enCours}
                  className="px-3 py-2 rounded-full bg-kc-encre text-kc-lait font-semibold disabled:opacity-50"
                >
                  Confirmer l’annulation
                </button>
                <button onClick={() => setConfirmerAnnulation(false)} className="px-2 py-2 text-kc-encre/60">
                  Non
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirmerAnnulation(true)} className="px-2 py-2 text-kc-bissap font-semibold">
                Annuler
              </button>
            ))}
        </div>
      )}
    </article>
  );
}

// ------------------------------------------------------------------
// Historique
// ------------------------------------------------------------------
function HistoriqueAudit({ auditLog, commandes }: { auditLog: LigneAuditLog[]; commandes: Commande[] }) {
  const trouverCommande = (id: string) => commandes.find((c) => c.id === id);
  const libelle = (s: string | null) => (s ? (LIBELLE_STATUT[s as StatutCommande] ?? s) : 'Création');

  if (auditLog.length === 0) {
    return <p className="py-16 text-center text-kc-brume/70">Aucun changement enregistré pour le moment.</p>;
  }

  return (
    <section aria-label="Historique des changements">
      <p className="text-sm text-kc-brume/70 mb-3">
        {auditLog.length} changement{auditLog.length > 1 ? 's' : ''} récent
        {auditLog.length > 1 ? 's' : ''}
      </p>
      <ul className="space-y-2">
        {auditLog.map((ligne) => {
          const commande = trouverCommande(ligne.commande_id);
          return (
            <li key={ligne.id} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-xs text-kc-brume/60">
                <span>
                  n° {numero(ligne.commande_id)}
                  {commande ? ` · ${commande.client_nom}` : ''}
                </span>
                <span>
                  {new Date(ligne.created_at).toLocaleString('fr-FR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              <p className="mt-1 text-sm">
                <span className="text-kc-brume/70">{libelle(ligne.ancien_statut)}</span>
                <span className="mx-2 text-kc-brume/40">→</span>
                <span className="font-semibold text-kc-beurre">{libelle(ligne.nouveau_statut)}</span>
              </p>
              <p className="mt-0.5 text-xs text-kc-brume/50">{ligne.modifie_par_email || 'Système'}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------------
// Produits et stock
// ------------------------------------------------------------------
interface ModifsProduit {
  disponible: boolean;
  stock_gere: boolean;
  stock_quantite: number | null;
}

const RUBRIQUES: Array<{ categorie: CategorieProduit; titre: string }> = [
  { categorie: 'salee', titre: 'Crêpes salées' },
  { categorie: 'sucree', titre: 'Crêpes sucrées' },
  { categorie: 'boisson', titre: 'Boissons' },
];

function GestionProduits({ produits, onRefresh }: { produits: Produit[]; onRefresh: () => void }) {
  const [modifs, setModifs] = useState<Record<string, ModifsProduit>>({});
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const getValeur = (produit: Produit): ModifsProduit =>
    modifs[produit.id] || {
      disponible: produit.disponible,
      stock_gere: produit.stock_gere || false,
      stock_quantite: produit.stock_quantite ?? null,
    };

  const modifier = (produit: Produit, changement: Partial<ModifsProduit>) =>
    setModifs((prev) => ({
      ...prev,
      [produit.id]: { ...getValeur(produit), ...changement },
    }));

  const oublier = (id: string) =>
    setModifs((prev) => {
      const copie = { ...prev };
      delete copie[id];
      return copie;
    });

  const sauvegarder = async (produit: Produit) => {
    const valeurs = modifs[produit.id];
    if (!valeurs) return;
    setSauvegardeEnCours(produit.id);
    setErreur(null);

    const payload = valeurs.stock_gere
      ? {
          disponible: valeurs.disponible,
          stock_gere: true,
          stock_quantite: valeurs.stock_quantite ?? 0,
        }
      : {
          disponible: valeurs.disponible,
          stock_gere: false,
          stock_quantite: null,
        };

    // Verrou optimiste : l'UPDATE ne s'applique que si le stock en base
    // est toujours celui affiché. Sinon une commande passée entre-temps
    // (qui a décrémenté le stock) serait silencieusement écrasée.
    let requete = supabase.from('produits').update(payload).eq('id', produit.id);
    requete =
      produit.stock_quantite == null ? requete.is('stock_quantite', null) : requete.eq('stock_quantite', produit.stock_quantite);
    const { data, error } = await requete.select('id');

    if (error) {
      setErreur(`Enregistrement impossible : ${error.message}`);
    } else if (!data || data.length === 0) {
      setErreur(
        `Le stock de « ${produit.nom} » a changé entre-temps (une commande vient de passer). Valeurs rechargées : vérifiez puis enregistrez à nouveau.`,
      );
      oublier(produit.id);
      onRefresh();
    } else {
      oublier(produit.id);
      onRefresh();
    }
    setSauvegardeEnCours(null);
  };

  return (
    <section aria-label="Produits et stock" className="space-y-6">
      {erreur && (
        <div role="alert" className="rounded-2xl bg-kc-bissap/15 border border-kc-bissap/40 text-kc-beurre px-4 py-3 text-sm">
          {erreur}
        </div>
      )}

      {RUBRIQUES.map((r) => {
        const liste = produits.filter((p) => p.categorie === r.categorie);
        if (liste.length === 0) return null;
        return (
          <div key={r.categorie}>
            <h2 className="font-display text-2xl text-kc-beurre mb-2">{r.titre}</h2>
            <ul className="rounded-3xl bg-kc-lait text-kc-encre divide-y divide-kc-encre/10 overflow-hidden">
              {liste.map((produit) => {
                const v = getValeur(produit);
                const modifie = !!modifs[produit.id];
                const stockBas = v.stock_gere && v.stock_quantite !== null && v.stock_quantite <= 3;
                const detail = ouvert === produit.id;
                return (
                  <li key={produit.id} className="p-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setOuvert(detail ? null : produit.id)}
                        aria-expanded={detail}
                        className="flex-1 min-w-0 text-left"
                      >
                        <span className={`block font-semibold leading-tight ${v.disponible ? '' : 'text-kc-encre/50'}`}>
                          {produit.nom}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-kc-encre/60">
                          <span className="prix">{prix(produit.prix)}</span>
                          {v.stock_gere && (
                            <span className={stockBas ? 'text-kc-bissap font-bold' : ''}>· stock {v.stock_quantite ?? 0}</span>
                          )}
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${detail ? 'rotate-180' : ''}`} />
                        </span>
                      </button>

                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <Interrupteur
                          actif={v.disponible}
                          libelle={`${produit.nom} disponible`}
                          onChange={(disponible) => modifier(produit, { disponible })}
                        />
                        <span className="text-[11px] font-semibold text-kc-encre/55">{v.disponible ? 'En carte' : 'Retiré'}</span>
                      </div>
                    </div>

                    {detail && (
                      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-white border border-kc-encre/10 p-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={v.stock_gere}
                            onChange={(e) =>
                              modifier(produit, {
                                stock_gere: e.target.checked,
                                stock_quantite: e.target.checked ? (v.stock_quantite ?? 0) : v.stock_quantite,
                              })
                            }
                            className="w-5 h-5 accent-kc-indigo"
                          />
                          Suivre le stock
                        </label>
                        {v.stock_gere && (
                          <label className="flex items-center gap-2 text-sm">
                            Quantité
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              value={v.stock_quantite ?? 0}
                              onChange={(e) =>
                                modifier(produit, {
                                  stock_quantite: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                                })
                              }
                              className="w-20 rounded-xl border border-kc-encre/20 px-3 py-2 text-base focus:outline-none focus:border-kc-indigo"
                            />
                          </label>
                        )}
                        <p className="w-full text-xs text-kc-encre/55">
                          Avec le suivi, la carte affiche « épuisé » dès que le stock tombe à 0. Une commande annulée avant la
                          livraison rend son stock.
                        </p>
                      </div>
                    )}

                    {modifie && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => void sauvegarder(produit)}
                          disabled={sauvegardeEnCours === produit.id}
                          className="flex-1 rounded-full bg-kc-indigo text-kc-beurre font-semibold py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {sauvegardeEnCours === produit.id && <Loader2 className="w-4 h-4 animate-spin" />}
                          Enregistrer
                        </button>
                        <button onClick={() => oublier(produit.id)} className="px-4 rounded-full text-sm text-kc-encre/60">
                          Annuler
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function Interrupteur({ actif, libelle, onChange }: { actif: boolean; libelle: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={libelle}
      onClick={() => onChange(!actif)}
      className={`relative w-14 h-8 rounded-full shrink-0 transition-colors ${actif ? 'bg-kc-indigo' : 'bg-kc-encre/20'}`}
    >
      <span
        className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${actif ? 'translate-x-6' : ''}`}
      />
    </button>
  );
}
