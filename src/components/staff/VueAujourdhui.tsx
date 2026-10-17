'use client';

import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Download, MessageCircle, Minus, Timer } from 'lucide-react';
import type { Commande } from '@/types';
import {
  bilanDuJour,
  commandesParHeure,
  ecart,
  exportCsv,
  jourDakar,
  memeJourSemaineDerniere,
  plageHeures,
  vitesseService,
  type CommandeResume,
  type EvenementStatut,
} from '@/lib/staff/statistiques';
import { urlPartage } from '@/lib/whatsapp';
import { Carte, EN_COURS, minutesDepuis, prix } from './commun';
import GraphiqueHeures from './GraphiqueHeures';

/** Au-delà, une commande en cours est « en retard » (même seuil que la liste). */
export const RETARD_MIN = 40;

const dateLongue = (d: Date) =>
  d.toLocaleDateString('fr-FR', { timeZone: 'Africa/Dakar', weekday: 'long', day: 'numeric', month: 'long' });
const jourCourt = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'Africa/Dakar', weekday: 'long' });

interface VueAujourdhuiProps {
  historique: CommandeResume[];
  /** Commandes récentes avec leurs articles (pour les plus demandées). */
  commandes: Commande[];
  journal: EvenementStatut[];
  maintenant: number;
  chargement: boolean;
  onVoirCommandes: () => void;
}

// Écran d'accueil du gérant : ce qu'il faut faire maintenant, puis les
// chiffres du jour comparés à la semaine dernière. Le détail reste dans
// les autres écrans.
export default function VueAujourdhui(props: VueAujourdhuiProps) {
  const { historique, commandes, journal, maintenant, chargement } = props;
  const date = useMemo(() => new Date(maintenant), [maintenant]);
  const jour = jourDakar(date);
  const jourRef = memeJourSemaineDerniere(date);

  const stats = useMemo(() => {
    const bilan = bilanDuJour(historique, jour);
    const ref = bilanDuJour(historique, jourRef);
    const parHeure = commandesParHeure(historique, jour);
    const parHeureRef = commandesParHeure(historique, jourRef);
    // Vitesse : les 7 derniers jours, assez de commandes pour une médiane fiable.
    const depuis7j = new Date(date.getTime() - 7 * 24 * 3600 * 1000).toISOString();
    const vitesse = vitesseService(
      historique.filter((c) => c.created_at >= depuis7j),
      journal,
    );
    const ventes = new Map<string, number>();
    for (const c of commandes)
      if (c.statut !== 'annulee' && jourDakar(c.created_at) === jour)
        for (const it of c.commande_items ?? []) ventes.set(it.nom_produit, (ventes.get(it.nom_produit) ?? 0) + it.quantite);
    const top = [...ventes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { bilan, ref, parHeure, parHeureRef, plage: plageHeures(parHeure, parHeureRef), vitesse, top };
  }, [historique, commandes, journal, jour, jourRef, date]);

  const enCours = commandes.filter((c) => EN_COURS.includes(c.statut));
  const aLancer = enCours.filter((c) => c.statut === 'recue').length;
  const enRetard = enCours.filter((c) => minutesDepuis(c.created_at, maintenant) >= RETARD_MIN).length;
  const { bilan, ref, vitesse, top } = stats;
  const nomRef = jourCourt(new Date(date.getTime() - 7 * 24 * 3600 * 1000));

  if (chargement || !maintenant) {
    return (
      <div role="status" aria-label="Chargement des chiffres" className="space-y-4">
        <div className="h-8 w-56 rounded bg-white/10" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-2xl border border-kc-bord bg-kc-carte motion-safe:animate-pulse" />
          ))}
        </div>
        <div className="h-56 rounded-2xl border border-kc-bord bg-kc-carte" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-kc-creme first-letter:uppercase">{dateLongue(date)}</h1>
        <p className="mt-1 text-sm text-kc-sable">Comparé au même jour la semaine dernière ({nomRef}).</p>
      </header>

      {/* À faire maintenant : seulement s'il y a quelque chose à faire. */}
      {(aLancer > 0 || enRetard > 0) && (
        <button
          type="button"
          onClick={props.onVoirCommandes}
          className="kc-apparait appui w-full flex items-center justify-between gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 min-h-16 text-left"
        >
          <span>
            <span className="block font-semibold text-kc-creme">
              {aLancer > 0 && `${aLancer} commande${aLancer > 1 ? 's' : ''} à lancer`}
              {aLancer > 0 && enRetard > 0 && ', '}
              {enRetard > 0 && `${enRetard} en retard`}
            </span>
            <span className="block text-sm text-kc-sable">Ouvrir la liste des commandes</span>
          </span>
          <ArrowRight className="w-5 h-5 text-rose-300 shrink-0" aria-hidden />
        </button>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Indicateur
          libelle="Encaissé"
          valeur={prix(bilan.encaisse)}
          detail={bilan.aEncaisser > 0 ? `+ ${prix(bilan.aEncaisser)} en cours` : 'Commandes livrées'}
          variation={ecart(bilan.encaisse, ref.encaisse)}
        />
        <Indicateur
          libelle="Commandes"
          valeur={String(bilan.commandes)}
          detail={`${ref.commandes} ${nomRef} dernier`}
          variation={ecart(bilan.commandes, ref.commandes)}
        />
        <Indicateur
          libelle="Panier moyen"
          valeur={bilan.commandes ? prix(bilan.panierMoyen) : '–'}
          detail={ref.commandes ? `${prix(ref.panierMoyen)} ${nomRef} dernier` : 'Pas de comparaison'}
          variation={bilan.commandes ? ecart(bilan.panierMoyen, ref.panierMoyen) : null}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <Carte className="p-4 sm:p-5">
          <h2 className="font-semibold text-kc-creme">Commandes par heure</h2>
          <div className="mt-3">
            <GraphiqueHeures aujourdhui={stats.parHeure} semaineDerniere={stats.parHeureRef} plage={stats.plage} />
          </div>
        </Carte>

        <div className="space-y-5">
          <Carte className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-semibold text-kc-creme">
              <Timer className="w-4 h-4 text-kc-caramel" aria-hidden /> Vitesse du service
            </h2>
            {vitesse.total === null ? (
              <p className="mt-2 text-sm text-kc-sable">
                Le temps s’affichera après les premières commandes livrées : il se calcule à partir des changements de statut.
              </p>
            ) : (
              <>
                <p className="mt-2">
                  <span className="prix text-3xl text-kc-caramel">{vitesse.total} min</span>
                  <span className="block text-sm text-kc-sable">de la commande à la livraison (médiane, 7 jours)</span>
                </p>
                <ol className="mt-4 space-y-2 text-sm">
                  <Etape libelle="Avant d’être lancée" minutes={vitesse.avantCuisine} total={vitesse.total} alerte={10} />
                  <Etape libelle="En cuisine" minutes={vitesse.enCuisine} total={vitesse.total} alerte={20} />
                  <Etape libelle="Livraison" minutes={vitesse.livraison} total={vitesse.total} alerte={30} />
                </ol>
                <p className="mt-3 text-xs text-kc-sable">Sur {vitesse.echantillon} commande{vitesse.echantillon > 1 ? 's' : ''} livrée{vitesse.echantillon > 1 ? 's' : ''}.</p>
              </>
            )}
          </Carte>

          <Carte className="p-4 sm:p-5">
            <h2 className="font-semibold text-kc-creme">Les plus demandées aujourd’hui</h2>
            {top.length === 0 ? (
              <p className="mt-2 text-sm text-kc-sable">Pas encore de commande aujourd’hui.</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {top.map(([nom, q], i) => (
                  <li key={nom} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold text-kc-caramel">{i + 1}.</span> {nom}
                    </span>
                    <span className="font-semibold shrink-0 tabular-nums">× {q}</span>
                  </li>
                ))}
              </ol>
            )}
          </Carte>
        </div>
      </div>

      <Partage historique={historique} jour={jour} date={date} stats={stats} nomRef={nomRef} />
    </div>
  );
}

function Indicateur({
  libelle,
  valeur,
  detail,
  variation,
}: {
  libelle: string;
  valeur: string;
  detail: string;
  variation: number | null;
}) {
  const Icone = variation === null || variation === 0 ? Minus : variation > 0 ? ArrowUpRight : ArrowDownRight;
  const couleur = variation === null || variation === 0 ? 'text-kc-sable' : variation > 0 ? 'text-emerald-400' : 'text-rose-300';
  return (
    <Carte className="kc-apparait p-3 sm:p-4 min-w-0">
      <p className="text-xs sm:text-sm text-kc-sable truncate">{libelle}</p>
      <p className="prix mt-1 text-lg sm:text-2xl leading-tight text-kc-creme whitespace-nowrap">{valeur}</p>
      <p className={`mt-1.5 flex items-center gap-1 text-xs font-semibold ${couleur}`}>
        <Icone className="w-3.5 h-3.5 shrink-0" aria-hidden />
        {variation === null ? detail : `${variation > 0 ? '+' : ''}${variation} %`}
      </p>
      {variation !== null && <p className="hidden sm:block text-xs text-kc-sable">{detail}</p>}
    </Carte>
  );
}

function Etape({ libelle, minutes, total, alerte }: { libelle: string; minutes: number | null; total: number; alerte: number }) {
  const lent = minutes !== null && minutes > alerte;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-kc-sable">{libelle}</span>
        <span className={`font-semibold tabular-nums ${lent ? 'text-rose-300' : 'text-kc-creme'}`}>
          {minutes ?? '–'} min{lent && <span className="sr-only"> (plus long que d’habitude)</span>}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden" aria-hidden>
        <div
          className={`h-full rounded-full origin-left ${lent ? 'bg-rose-400' : 'bg-amber-500'}`}
          style={{ transform: `scaleX(${Math.min(1, (minutes ?? 0) / Math.max(total, 1))})` }}
        />
      </div>
    </li>
  );
}

// Bilan du soir sur WhatsApp et export des ventes pour la comptabilité.
function Partage({
  historique,
  jour,
  date,
  stats,
  nomRef,
}: {
  historique: CommandeResume[];
  jour: string;
  date: Date;
  stats: {
    bilan: ReturnType<typeof bilanDuJour>;
    ref: ReturnType<typeof bilanDuJour>;
    vitesse: ReturnType<typeof vitesseService>;
    top: Array<[string, number]>;
  };
  nomRef: string;
}) {
  const [periode, setPeriode] = useState<1 | 7 | 30 | 90>(7);
  const { bilan, ref, vitesse, top } = stats;

  const texteBilan = [
    `Bilan King Crêperie, ${dateLongue(date)}`,
    `Commandes : ${bilan.commandes} (${nomRef} dernier : ${ref.commandes})`,
    `Encaissé : ${prix(bilan.encaisse)}${bilan.aEncaisser ? `, encore ${prix(bilan.aEncaisser)} en cours` : ''}`,
    bilan.commandes ? `Panier moyen : ${prix(bilan.panierMoyen)}` : null,
    top.length ? `Les plus demandées : ${top.map(([n, q]) => `${n} × ${q}`).join(', ')}` : null,
    vitesse.total !== null ? `Commande → livraison : ${vitesse.total} min (médiane 7 jours)` : null,
    bilan.annulees ? `Annulées : ${bilan.annulees}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const exporter = () => {
    const debut = periode === 1 ? jour : jourDakar(new Date(date.getTime() - (periode - 1) * 24 * 3600 * 1000));
    const choix = historique.filter((c) => jourDakar(c.created_at) >= debut);
    const blob = new Blob([exportCsv(choix)], { type: 'text/csv;charset=utf-8' });
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(blob);
    lien.download = `king-creperie-ventes-${debut}-au-${jour}.csv`;
    lien.click();
    URL.revokeObjectURL(lien.href);
  };

  return (
    <Carte className="p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <a
        href={urlPartage(texteBilan)}
        target="_blank"
        rel="noopener noreferrer"
        className="appui inline-flex items-center justify-center gap-2 min-h-12 px-5 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white font-semibold"
      >
        <MessageCircle className="w-5 h-5" aria-hidden /> Envoyer le bilan sur WhatsApp
      </a>
      <div className="flex items-end gap-2">
        <label className="flex-1 sm:flex-none">
          <span className="block text-xs font-semibold text-kc-sable mb-1">Période des ventes</span>
          <select
            value={periode}
            onChange={(e) => setPeriode(Number(e.target.value) as 1 | 7 | 30 | 90)}
            className="w-full min-h-12 rounded-xl border border-kc-bord bg-kc-nuit px-3 text-sm font-semibold text-kc-creme focus:outline-none focus:border-amber-500"
          >
            <option value={1}>Aujourd’hui</option>
            <option value={7}>7 derniers jours</option>
            <option value={30}>30 derniers jours</option>
            <option value={90}>90 derniers jours</option>
          </select>
        </label>
        <button
          type="button"
          onClick={exporter}
          className="appui inline-flex items-center gap-2 min-h-12 px-4 rounded-xl border border-kc-bord text-sm font-semibold text-kc-creme hover:border-kc-sable/60"
        >
          <Download className="w-4 h-4" aria-hidden /> Exporter en CSV
        </button>
      </div>
    </Carte>
  );
}
