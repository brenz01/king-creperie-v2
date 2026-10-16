'use client';

import { useMemo, useState } from 'react';
import { Phone, MessageCircle, Undo2, Loader2 } from 'lucide-react';
import type { Commande, StatutCommande } from '@/types';
import { urlWhatsAppClient } from '@/lib/whatsapp';
import { EN_COURS, depuis, heure, minutesDepuis, numero, prix, useMaintenant } from './commun';

type Filtre = 'en_cours' | 'livrees' | 'annulees';

// Pastille : la couleur dit quoi faire. Rouge = à lancer, caramel = au
// four, indigo = chez le livreur.
const PASTILLE: Record<StatutCommande, string> = {
  recue: 'bg-kc-bissap text-white',
  en_preparation: 'bg-kc-caramel text-kc-nuit',
  en_livraison: 'bg-kc-indigo text-kc-beurre',
  livree: 'bg-kc-encre/10 text-kc-encre/70',
  annulee: 'bg-kc-encre/10 text-kc-encre/50 line-through',
};

const LIBELLE_COURT: Record<StatutCommande, string> = {
  recue: 'À lancer',
  en_preparation: 'En préparation',
  en_livraison: 'Chez le livreur',
  livree: 'Livrée',
  annulee: 'Annulée',
};

// Un seul geste par étape.
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

// Au-delà de ces durées depuis la commande, l'heure passe en couleur
// d'alerte : le client attend.
const ATTENTE_SURVEILLER = 20;
const ATTENTE_RETARD = 40;

const memeJour = (iso: string, maintenant: number) =>
  new Date(iso).toISOString().slice(0, 10) === new Date(maintenant).toISOString().slice(0, 10);

interface VueCommandesProps {
  commandes: Commande[];
  loading: boolean;
  nouvelles: Set<string>;
  onStatut: (id: string, statut: StatutCommande) => Promise<boolean>;
  bandeaux: React.ReactNode;
}

export default function VueCommandes({ commandes, loading, nouvelles, onStatut, bandeaux }: VueCommandesProps) {
  const [filtre, setFiltre] = useState<Filtre>('en_cours');
  const maintenant = useMaintenant();

  const listes = useMemo(() => {
    // En cours : d'abord celles à lancer, puis au four, puis en route ;
    // la plus ancienne en premier dans chaque groupe (ordre de la cuisine).
    const enCours = commandes
      .filter((c) => EN_COURS.includes(c.statut))
      .sort((a, b) => EN_COURS.indexOf(a.statut) - EN_COURS.indexOf(b.statut) || a.created_at.localeCompare(b.created_at));
    return {
      en_cours: enCours,
      livrees: commandes.filter((c) => c.statut === 'livree' && memeJour(c.created_at, maintenant)),
      annulees: commandes.filter((c) => c.statut === 'annulee' && memeJour(c.created_at, maintenant)),
    };
  }, [commandes, maintenant]);

  const chips: Array<{ id: Filtre; libelle: string }> = [
    { id: 'en_cours', libelle: `En cours · ${listes.en_cours.length}` },
    { id: 'livrees', libelle: `Livrées aujourd’hui · ${listes.livrees.length}` },
    { id: 'annulees', libelle: `Annulées · ${listes.annulees.length}` },
  ];

  const liste = listes[filtre];

  return (
    <section aria-label="Commandes">
      {bandeaux}

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

      {loading ? (
        <div className="py-20 flex justify-center text-kc-brume">
          <Loader2 className="w-7 h-7 animate-spin" aria-label="Chargement des commandes" />
        </div>
      ) : liste.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-kc-beurre font-semibold">
            {filtre === 'en_cours' ? 'Rien à préparer pour l’instant.' : 'Rien à afficher pour aujourd’hui.'}
          </p>
          {filtre === 'en_cours' && (
            <p className="mt-1 text-sm text-kc-brume/70">Les nouvelles commandes apparaissent ici toutes seules.</p>
          )}
        </div>
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
  const active = EN_COURS.includes(cmd.statut);
  const creneau = cmd.creneau_souhaite && cmd.creneau_souhaite !== 'Dès que possible' ? cmd.creneau_souhaite : null;
  const attente = minutesDepuis(cmd.created_at, maintenant);
  const couleurAttente = !active
    ? 'text-kc-encre/60'
    : attente >= ATTENTE_RETARD
      ? 'text-kc-bissap font-bold'
      : attente >= ATTENTE_SURVEILLER
        ? 'text-[#b06a00] font-bold'
        : 'text-kc-encre/70 font-semibold';
  const nbArticles = (cmd.commande_items ?? []).reduce((s, it) => s + it.quantite, 0);

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
          {nouvelle ? 'Nouvelle commande' : LIBELLE_COURT[cmd.statut]}
        </span>
        <span className="text-xs text-right">
          <span className={couleurAttente}>{depuis(cmd.created_at, maintenant)}</span>
          <span className="text-kc-encre/50"> · {heure(cmd.created_at)}</span>
        </span>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-tight">{cmd.client_nom}</h3>
          <p className="text-xs text-kc-encre/50 mt-0.5">
            n° {numero(cmd.id)} · {nbArticles} article{nbArticles > 1 ? 's' : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="prix text-2xl text-kc-indigo leading-none">{prix(cmd.total)}</p>
          {active && <p className="mt-1 text-[11px] text-kc-encre/55">à encaisser</p>}
        </div>
      </div>

      {creneau && <p className="mt-2 inline-flex rounded-full bg-kc-caramel/30 px-3 py-1 text-sm font-bold">Pour : {creneau}</p>}

      {cmd.commande_items && cmd.commande_items.length > 0 && (
        <ul className="mt-3 rounded-2xl bg-white border border-kc-encre/10 divide-y divide-kc-encre/5">
          {cmd.commande_items.map((it, i) => (
            <li key={it.id ?? i} className="px-3 py-2.5 text-[15px] leading-snug">
              <span className="font-bold">{it.quantite} ×</span> {it.nom_produit}
              {it.extras && it.extras.length > 0 && (
                <span className="block text-sm font-semibold text-kc-bissap">+ {it.extras.map((e) => e.nom).join(', ')}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-sm text-kc-encre/80 leading-snug">
        <span className="font-semibold text-kc-encre">Livraison : </span>
        {cmd.adresse_livraison}
      </p>

      {active && (
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
      )}

      {suivant && !confirmerAnnulation && (
        <button
          onClick={() => void agir(suivant.statut)}
          disabled={enCours}
          className="mt-3 w-full rounded-full bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold text-base py-4 flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
        >
          {enCours && <Loader2 className="w-4 h-4 animate-spin" />}
          {suivant.action}
        </button>
      )}

      {confirmerAnnulation ? (
        <div className="mt-3 rounded-2xl bg-kc-encre/5 p-3">
          <p className="text-sm font-semibold">Annuler la commande de {cmd.client_nom} ?</p>
          <p className="text-xs text-kc-encre/60 mt-0.5">Le client le verra sur sa page de suivi. Pensez à le prévenir.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setConfirmerAnnulation(false)}
              className="rounded-full border border-kc-encre/15 py-2.5 text-sm font-semibold"
            >
              Non, garder
            </button>
            <button
              onClick={() => void agir('annulee')}
              disabled={enCours}
              className="rounded-full bg-kc-encre text-kc-lait py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              Oui, annuler
            </button>
          </div>
        </div>
      ) : (
        (precedent || active) && (
          <div className="mt-1 flex items-center justify-between gap-2 text-sm">
            {precedent ? (
              <button
                onClick={() => void agir(precedent)}
                disabled={enCours}
                className="inline-flex items-center gap-1.5 px-2 py-2.5 text-kc-encre/60 hover:text-kc-encre disabled:opacity-50"
              >
                <Undo2 className="w-4 h-4" /> Revenir à : {LIBELLE_COURT[precedent]}
              </button>
            ) : (
              <span />
            )}
            {active && (
              <button onClick={() => setConfirmerAnnulation(true)} className="px-2 py-2.5 text-kc-encre/60 hover:text-kc-bissap">
                Annuler
              </button>
            )}
          </div>
        )
      )}
    </article>
  );
}
