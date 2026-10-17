import type { StatutCommande } from '@/types';

// ------------------------------------------------------------------
// Calculs du tableau de bord (fonctions pures, testées dans
// e2e/statistiques.unit.spec.ts). Heure de Dakar partout.
// ------------------------------------------------------------------

export const FUSEAU = 'Africa/Dakar';

/** Ce dont les statistiques ont besoin d'une commande (sans adresse ni articles). */
export interface CommandeResume {
  id: string;
  created_at: string;
  client_nom: string;
  client_telephone: string;
  total: number;
  statut: StatutCommande;
}

export interface EvenementStatut {
  commande_id: string;
  nouveau_statut: string;
  created_at: string;
}

const formatJour = new Intl.DateTimeFormat('fr-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' });
const formatHeure = new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, hour: '2-digit', hourCycle: 'h23' });

/** Jour calendaire à Dakar, « AAAA-MM-JJ ». */
export const jourDakar = (d: Date | string) => formatJour.format(typeof d === 'string' ? new Date(d) : d);
/** Heure (0-23) à Dakar. */
export const heureDakar = (d: Date | string) =>
  Number(formatHeure.formatToParts(typeof d === 'string' ? new Date(d) : d).find((p) => p.type === 'hour')?.value ?? 0);

const JOUR_MS = 24 * 3600 * 1000;
/** Le même jour, une semaine avant. */
export const memeJourSemaineDerniere = (maintenant: Date) => jourDakar(new Date(maintenant.getTime() - 7 * JOUR_MS));

const compte = (c: CommandeResume) => c.statut !== 'annulee';

export interface BilanJour {
  commandes: number;
  /** Encaissé : commandes livrées. */
  encaisse: number;
  /** En cours : reçues, en préparation, en route. */
  aEncaisser: number;
  panierMoyen: number;
  annulees: number;
}

export function bilanDuJour(commandes: CommandeResume[], jour: string): BilanJour {
  const du = commandes.filter((c) => jourDakar(c.created_at) === jour);
  const valides = du.filter(compte);
  const encaisse = valides.filter((c) => c.statut === 'livree').reduce((s, c) => s + c.total, 0);
  const aEncaisser = valides.filter((c) => c.statut !== 'livree').reduce((s, c) => s + c.total, 0);
  const total = valides.reduce((s, c) => s + c.total, 0);
  return {
    commandes: valides.length,
    encaisse,
    aEncaisser,
    panierMoyen: valides.length ? Math.round(total / valides.length) : 0,
    annulees: du.length - valides.length,
  };
}

/** Écart en pourcentage arrondi, null si la référence est nulle. */
export function ecart(actuel: number, reference: number): number | null {
  if (!reference) return null;
  return Math.round(((actuel - reference) / reference) * 100);
}

/** Commandes (hors annulées) par heure de Dakar pour un jour donné. */
export function commandesParHeure(commandes: CommandeResume[], jour: string): number[] {
  const heures = Array.from({ length: 24 }, () => 0);
  for (const c of commandes) if (compte(c) && jourDakar(c.created_at) === jour) heures[heureDakar(c.created_at)]++;
  return heures;
}

/** Plage d'heures à afficher : de la première à la dernière heure active (au moins 11 h - 23 h). */
export function plageHeures(...series: number[][]): [number, number] {
  let debut = 11;
  let fin = 23;
  for (const s of series)
    s.forEach((n, h) => {
      if (n > 0) {
        debut = Math.min(debut, h);
        fin = Math.max(fin, h);
      }
    });
  return [debut, fin];
}

export interface VitesseService {
  /** Minutes médianes entre l'arrivée et le lancement en cuisine. */
  avantCuisine: number | null;
  /** Minutes médianes en cuisine (lancement → remise au livreur). */
  enCuisine: number | null;
  /** Minutes médianes de livraison (remise → livrée). */
  livraison: number | null;
  /** Minutes médianes de bout en bout (arrivée → livrée). */
  total: number | null;
  /** Nombre de commandes livrées prises en compte. */
  echantillon: number;
}

const mediane = (valeurs: number[]): number | null => {
  if (valeurs.length === 0) return null;
  const v = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return Math.round(v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2);
};

/**
 * Vitesse du service à partir du journal des statuts. Médiane plutôt que
 * moyenne : une commande oubliée une heure ne fausse pas le chiffre.
 * Seules les commandes livrées avec un journal complet comptent.
 */
export function vitesseService(commandes: CommandeResume[], journal: EvenementStatut[]): VitesseService {
  const premier = new Map<string, Partial<Record<string, number>>>();
  for (const e of journal) {
    const t = new Date(e.created_at).getTime();
    const etapes = premier.get(e.commande_id) ?? {};
    if (etapes[e.nouveau_statut] === undefined || t < etapes[e.nouveau_statut]!) etapes[e.nouveau_statut] = t;
    premier.set(e.commande_id, etapes);
  }
  const avant: number[] = [];
  const cuisine: number[] = [];
  const route: number[] = [];
  const total: number[] = [];
  for (const c of commandes) {
    if (c.statut !== 'livree') continue;
    const e = premier.get(c.id);
    if (!e || e.en_preparation === undefined || e.en_livraison === undefined || e.livree === undefined) continue;
    const recue = new Date(c.created_at).getTime();
    const min = (a: number, b: number) => (b - a) / 60000;
    if (e.en_preparation < recue || e.en_livraison < e.en_preparation || e.livree < e.en_livraison) continue;
    avant.push(min(recue, e.en_preparation));
    cuisine.push(min(e.en_preparation, e.en_livraison));
    route.push(min(e.en_livraison, e.livree));
    total.push(min(recue, e.livree));
  }
  return {
    avantCuisine: mediane(avant),
    enCuisine: mediane(cuisine),
    livraison: mediane(route),
    total: mediane(total),
    echantillon: total.length,
  };
}

/** Numéro normalisé : les 9 derniers chiffres (« +221 77 … » = « 77 … »). */
export const cleTelephone = (t: string) => t.replace(/\D/g, '').slice(-9);

export interface Client {
  telephone: string;
  nom: string;
  commandes: number;
  depense: number;
  derniere: string;
  premiere: string;
}

/** Clients regroupés par numéro, du plus gros total dépensé au plus petit. */
export function clients(commandes: CommandeResume[]): Client[] {
  const parNumero = new Map<string, Client>();
  for (const c of commandes) {
    if (!compte(c)) continue;
    const cle = cleTelephone(c.client_telephone);
    if (cle.length < 9) continue;
    const existant = parNumero.get(cle);
    if (!existant) {
      parNumero.set(cle, {
        telephone: c.client_telephone,
        nom: c.client_nom,
        commandes: 1,
        depense: c.total,
        derniere: c.created_at,
        premiere: c.created_at,
      });
      continue;
    }
    existant.commandes++;
    existant.depense += c.total;
    if (c.created_at > existant.derniere) {
      existant.derniere = c.created_at;
      existant.nom = c.client_nom; // le nom le plus récent
      existant.telephone = c.client_telephone;
    }
    if (c.created_at < existant.premiere) existant.premiere = c.created_at;
  }
  return [...parNumero.values()].sort((a, b) => b.depense - a.depense || b.commandes - a.commandes);
}

/** Échappe une valeur pour un CSV (séparateur « ; », lisible par Excel en français). */
const champCsv = (v: string | number) => {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCsv(commandes: CommandeResume[]): string {
  const entete = ['Date', 'Heure', 'Commande', 'Client', 'Téléphone', 'Statut', 'Total (F)'];
  const lignes = [...commandes]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((c) => [
      jourDakar(c.created_at),
      `${String(heureDakar(c.created_at)).padStart(2, '0')}:${new Date(c.created_at).toISOString().slice(14, 16)}`,
      c.id.slice(0, 8).toUpperCase(),
      c.client_nom,
      c.client_telephone,
      c.statut,
      c.total,
    ]);
  // BOM : Excel lit l'UTF-8 (accents) correctement.
  return '﻿' + [entete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
}
