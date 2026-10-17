'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Phone, MessageCircle, Undo2, Loader2, Printer } from 'lucide-react';
import InfoBulle from '../ui/InfoBulle';
import type { Commande, StatutCommande } from '@/types';
import { urlWhatsAppClient } from '@/lib/whatsapp';
import { EN_COURS, depuis, heure, minutesDepuis, numero, prix, useMaintenant } from './commun';

type Filtre = 'en_cours' | 'livrees' | 'annulees';

// Bord gauche de la carte : l'étape se lit d'un coup d'œil, même de loin.
const BORD: Record<StatutCommande, string> = {
  recue: 'border-l-rose-600',
  en_preparation: 'border-l-amber-500',
  en_livraison: 'border-l-kc-creme',
  livree: 'border-l-kc-ok',
  annulee: 'border-l-kc-creme/30',
};

const POINT: Record<StatutCommande, string> = {
  recue: 'bg-rose-500',
  en_preparation: 'bg-amber-500',
  en_livraison: 'bg-kc-creme',
  livree: 'bg-kc-ok',
  annulee: 'bg-kc-sable/40',
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
  onImprimer: (commande: Commande) => void;
}

export default function VueCommandes({ commandes, loading, nouvelles, onStatut, bandeaux, onImprimer }: VueCommandesProps) {
  const [filtre, setFiltre] = useState<Filtre>('en_cours');
  // Une seule commande dépliée à la fois.
  const [ouverte, setOuverte] = useState<string | null>(null);
  const basculer = (id: string) => setOuverte((o) => (o === id ? null : id));
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
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              filtre === c.id ? 'bg-amber-500 text-kc-nuit' : 'border border-kc-bord text-kc-sable hover:border-kc-sable/60'
            }`}
          >
            {c.libelle}
          </button>
        ))}
      </div>

      {loading ? (
        // Squelette : la forme des cartes de commande arrive avant elles.
        <div role="status" aria-label="Chargement des commandes" className="mt-4 space-y-3 lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-kc-bord bg-kc-carte p-5">
              <div className="h-6 w-24 rounded-full bg-white/10 motion-safe:animate-pulse" />
              <div className="mt-4 h-5 w-40 rounded bg-white/10" />
              <div className="mt-3 h-16 rounded-xl bg-white/5" />
              <div className="mt-3 h-14 rounded-xl bg-white/10" />
            </div>
          ))}
        </div>
      ) : liste.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-kc-creme font-semibold">
            {filtre === 'en_cours' ? 'Rien à préparer pour l’instant.' : 'Rien à afficher pour aujourd’hui.'}
          </p>
          {filtre === 'en_cours' ? (
            <p className="mt-1 text-sm text-kc-sable">Les nouvelles commandes apparaissent ici toutes seules, avec le son si vous l’activez.</p>
          ) : (
            <button
              type="button"
              onClick={() => setFiltre('en_cours')}
              className="appui mt-4 min-h-11 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-kc-nuit text-sm font-semibold"
            >
              Voir les commandes en cours
            </button>
          )}
        </div>
      ) : filtre === 'en_cours' ? (
        // Groupées par étape : empilées sur téléphone, en colonnes sur
        // grand écran. La plus ancienne en haut de chaque groupe.
        <div className="mt-4 flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:gap-4 lg:items-start">
          {EN_COURS.map((statut) => {
            const groupe = liste.filter((c) => c.statut === statut);
            return (
              <section
                key={statut}
                aria-label={`${LIBELLE_COURT[statut]} : ${groupe.length}`}
                className={groupe.length === 0 ? 'hidden lg:block' : ''}
              >
                <h3 className="flex items-center gap-2 mb-2.5 text-sm font-semibold text-kc-sable">
                  <span className={`w-2.5 h-2.5 rounded-full ${POINT[statut]}`} aria-hidden />
                  {LIBELLE_COURT[statut]}
                  <span className="tabular-nums text-kc-sable/80">{groupe.length}</span>
                </h3>
                {groupe.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/15 py-8 text-center text-sm text-kc-sable/80">
                    Rien ici
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {groupe.map((cmd) => (
                      <li key={cmd.id}>
                        <CarteCommande
                          commande={cmd}
                          nouvelle={nouvelles.has(cmd.id)}
                          maintenant={maintenant}
                          ouverte={ouverte === cmd.id}
                          onBasculer={() => basculer(cmd.id)}
                          onStatut={onStatut}
                          onImprimer={onImprimer}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <ul className="mt-4 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {liste.map((cmd) => (
            <li key={cmd.id}>
              <CarteCommande
                commande={cmd}
                nouvelle={nouvelles.has(cmd.id)}
                maintenant={maintenant}
                ouverte={ouverte === cmd.id}
                onBasculer={() => basculer(cmd.id)}
                onStatut={onStatut}
                onImprimer={onImprimer}
              />
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
  ouverte: boolean;
  onBasculer: () => void;
  onStatut: (id: string, statut: StatutCommande) => Promise<boolean>;
  onImprimer: (commande: Commande) => void;
}

// Une commande, repliée par défaut : le nom, l'attente, le total et ce
// qu'il y a à préparer, sur une ligne. Toucher la carte la déplie (une
// seule à la fois) : articles et extras, adresse, appel, ticket, actions.
function CarteCommande({ commande: cmd, nouvelle, maintenant, ouverte, onBasculer, onStatut, onImprimer }: CarteCommandeProps) {
  const [enCours, setEnCours] = useState(false);
  const [confirmerAnnulation, setConfirmerAnnulation] = useState(false);
  const suivant = SUIVANT[cmd.statut];
  const precedent = PRECEDENT[cmd.statut];
  const active = EN_COURS.includes(cmd.statut);
  const creneau = cmd.creneau_souhaite && cmd.creneau_souhaite !== 'Dès que possible' ? cmd.creneau_souhaite : null;
  const attente = minutesDepuis(cmd.created_at, maintenant);
  const couleurAttente = !active
    ? 'text-kc-creme/75'
    : attente >= ATTENTE_RETARD
      ? 'text-rose-400 font-semibold'
      : attente >= ATTENTE_SURVEILLER
        ? 'text-[#f59e0b] font-semibold'
        : 'text-kc-creme/75';
  const items = cmd.commande_items ?? [];
  const nbArticles = items.reduce((s, it) => s + it.quantite, 0);
  const resume = items.map((it) => `${it.quantite} × ${it.nom_produit}`).join(', ');
  const idDetail = `detail-${cmd.id}`;

  const agir = async (statut: StatutCommande) => {
    setEnCours(true);
    await onStatut(cmd.id, statut);
    setEnCours(false);
    setConfirmerAnnulation(false);
  };

  return (
    // key = statut : la carte rejoue une entrée courte quand elle change
    // d'étape (et de colonne) ; une nouvelle commande reçoit un halo.
    <article
      key={cmd.statut}
      aria-label={`Commande de ${cmd.client_nom}`}
      className={`kc-apparait rounded-2xl border-l-[6px] ${BORD[cmd.statut]} bg-kc-carte border border-kc-bord text-kc-creme transition-colors ${
        ouverte ? 'border-kc-sable/40' : 'hover:border-kc-sable/40'
      } ${nouvelle ? 'kc-surligne ring-4 ring-amber-600/70' : ''} ${cmd.statut === 'annulee' ? 'opacity-70' : ''}`}
    >
      {/* En-tête repliable : tout le résumé est une seule cible. */}
      <button
        type="button"
        onClick={onBasculer}
        aria-expanded={ouverte}
        aria-controls={idDetail}
        className="w-full text-left px-4 pt-3.5 pb-3 rounded-2xl focus-visible:outline-offset-[-3px]"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="font-semibold text-base leading-tight truncate">{cmd.client_nom}</span>
              {nouvelle && (
                <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">Nouvelle</span>
              )}
            </span>
            <span className="mt-0.5 block text-xs">
              <span className="text-kc-creme/75">{LIBELLE_COURT[cmd.statut]}, </span>
              <span className={couleurAttente}>{depuis(cmd.created_at, maintenant)}</span>
            </span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <span className="prix text-lg text-kc-caramel leading-none">{prix(cmd.total)}</span>
            <ChevronDown
              className={`w-5 h-5 text-kc-sable transition-transform duration-200 ${ouverte ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </span>
        </span>
        {!ouverte && (
          <span className="mt-2 flex items-center gap-2 text-sm text-kc-creme/80">
            <span className="truncate">{resume || `${nbArticles} article${nbArticles > 1 ? 's' : ''}`}</span>
            {creneau && (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                {creneau}
              </span>
            )}
          </span>
        )}
      </button>

      {ouverte && (
        <div id={idDetail} className="kc-fondu px-4 pb-4">
          <div className="flex items-center justify-between gap-3 text-xs text-kc-creme/75">
            <span>
              n° {numero(cmd.id)}, à {heure(cmd.created_at)}, {nbArticles} article{nbArticles > 1 ? 's' : ''}
            </span>
            <InfoBulle libelle="Imprimer le ticket" cote="basDroite" sombre>
              <button
                type="button"
                onClick={() => onImprimer(cmd)}
                aria-label={`Imprimer le ticket de ${cmd.client_nom}`}
                className="appui -mr-2 w-11 h-11 rounded-full flex items-center justify-center text-kc-sable hover:bg-white/10 hover:text-kc-creme"
              >
                <Printer className="w-4.5 h-4.5" aria-hidden />
              </button>
            </InfoBulle>
          </div>

          {creneau && (
            <p className="mt-1 inline-flex rounded-full bg-amber-500/15 text-amber-300 px-3 py-1 text-sm font-semibold">
              Pour : {creneau}
            </p>
          )}

          {items.length > 0 && (
            <ul className="mt-2 rounded-xl bg-kc-nuit border border-kc-bord divide-y divide-kc-bord">
              {items.map((it, i) => (
                <li key={it.id ?? i} className="px-3 py-2.5 text-[15px] leading-snug">
                  <span className="font-semibold">{it.quantite} ×</span> {it.nom_produit}
                  {it.extras && it.extras.length > 0 && (
                    <span className="block text-sm font-semibold text-amber-400">+ {it.extras.map((e) => e.nom).join(', ')}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-sm text-kc-creme/80 leading-snug">
            <span className="font-semibold text-kc-creme">Livraison : </span>
            {cmd.adresse_livraison}
          </p>

          {active && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href={`tel:${cmd.client_telephone.replace(/\s/g, '')}`}
                className="appui inline-flex items-center justify-center gap-2 min-h-11 rounded-xl border border-kc-bord text-sm font-semibold hover:border-kc-sable/60"
              >
                <Phone className="w-4 h-4" aria-hidden /> Appeler
              </a>
              <a
                href={urlWhatsAppClient(cmd.client_telephone)}
                target="_blank"
                rel="noopener noreferrer"
                className="appui inline-flex items-center justify-center gap-2 min-h-11 rounded-xl border border-kc-bord text-sm font-semibold hover:border-kc-sable/60"
              >
                <MessageCircle className="w-4 h-4" aria-hidden /> WhatsApp
              </a>
            </div>
          )}

          {suivant && !confirmerAnnulation && (
            <button
              onClick={() => void agir(suivant.statut)}
              aria-busy={enCours}
              className="appui mt-3 w-full min-h-14 rounded-xl bg-amber-500 hover:bg-amber-400 text-kc-nuit font-semibold text-base flex items-center justify-center gap-2 aria-busy:opacity-70"
            >
              {enCours && <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden />}
              {suivant.action}
            </button>
          )}

          {confirmerAnnulation ? (
            <ConfirmerAnnulation
              nom={cmd.client_nom}
              enCours={enCours}
              onGarder={() => setConfirmerAnnulation(false)}
              onAnnuler={() => void agir('annulee')}
            />
          ) : (
            (precedent || active) && (
              <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                {precedent ? (
                  <button
                    onClick={() => void agir(precedent)}
                    disabled={enCours}
                    className="inline-flex items-center gap-1.5 px-2 min-h-11 text-kc-creme/75 hover:text-kc-creme disabled:opacity-50"
                  >
                    <Undo2 className="w-4 h-4" aria-hidden /> Revenir à : {LIBELLE_COURT[precedent]}
                  </button>
                ) : (
                  <span />
                )}
                {active && (
                  <button onClick={() => setConfirmerAnnulation(true)} className="px-2 min-h-11 text-kc-creme/75 hover:text-rose-300">
                    Annuler
                  </button>
                )}
              </div>
            )
          )}
        </div>
      )}
    </article>
  );
}

// Confirmation d'annulation dans la carte : nomme le client, verbe
// destructif en rouge, « Garder » reçoit le focus, Échap referme.
function ConfirmerAnnulation({
  nom,
  enCours,
  onGarder,
  onAnnuler,
}: {
  nom: string;
  enCours: boolean;
  onGarder: () => void;
  onAnnuler: () => void;
}) {
  const garder = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    garder.current?.focus();
  }, []);
  return (
    <div
      role="alertdialog"
      aria-labelledby="titre-annulation"
      aria-describedby="aide-annulation"
      onKeyDown={(e) => e.key === 'Escape' && onGarder()}
      className="kc-fondu mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3"
    >
      <p id="titre-annulation" className="text-sm font-semibold">
        Annuler la commande de {nom} ?
      </p>
      <p id="aide-annulation" className="text-xs text-kc-creme/80 mt-0.5">
        Le client le verra sur sa page de suivi. Pensez à le prévenir.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button ref={garder} onClick={onGarder} className="appui min-h-11 rounded-xl border border-kc-bord text-sm font-semibold">
          Garder la commande
        </button>
        <button
          onClick={onAnnuler}
          aria-busy={enCours}
          className="appui min-h-11 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold aria-busy:opacity-70"
        >
          Annuler la commande
        </button>
      </div>
    </div>
  );
}
