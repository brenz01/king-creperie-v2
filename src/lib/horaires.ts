import { z } from 'zod';

// ------------------------------------------------------------------
// Horaires d'ouverture. Dakar est à UTC+0 toute l'année (pas d'heure
// d'été) : on calcule quand même via le fuseau Africa/Dakar pour ne
// dépendre ni du fuseau du serveur ni de celui du téléphone.
// ------------------------------------------------------------------

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

export const SchemaPlage = z
  .object({
    ouvre: z.string().regex(HEURE),
    ferme: z.string().regex(HEURE),
  })
  .refine((p) => p.ouvre !== p.ferme, 'L’heure d’ouverture et de fermeture doivent être différentes.');
export type Plage = z.infer<typeof SchemaPlage>;

// Clés '0' (dimanche) à '6' (samedi). Tableau vide = fermé ce jour-là.
export const SchemaHoraires = z.record(z.enum(['0', '1', '2', '3', '4', '5', '6']), z.array(SchemaPlage).max(2));
export type Horaires = Partial<Record<string, Plage[]>>;

export interface Boutique {
  horaires: Horaires;
  fermeture_exceptionnelle: boolean;
  message_fermeture: string | null;
}

export const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const;
// Ordre d'affichage : la semaine commence le lundi.
export const ORDRE_JOURS = [1, 2, 3, 4, 5, 6, 0] as const;

const enMinutes = (h: string) => {
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + mm;
};

// « 17 h », « 17 h 30 », « minuit »
export function formatHeure(h: string): string {
  if (h === '24:00' || h === '00:00') return 'minuit';
  const [hh, mm] = h.split(':');
  return `${Number(hh)} h${mm === '00' ? '' : ` ${mm}`}`;
}

export const toujoursOuvert = (p: Plage) => p.ouvre === '00:00' && p.ferme === '24:00';

function maintenantDakar(date: Date): { jour: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Dakar',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  const jour = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(v('weekday'));
  return { jour, minutes: Number(v('hour')) * 60 + Number(v('minute')) };
}

export interface EtatBoutique {
  ouvert: boolean;
  /** Pause décidée par le gérant (prime sur les horaires). */
  enPause: boolean;
  /** « jusqu'à 23 h », ou null si ouvert sans fin aujourd'hui. */
  fermeA: string | null;
  /** « aujourd'hui à 17 h », « demain à 17 h », « lundi à 17 h », ou null. */
  prochaineOuverture: string | null;
  message: string | null;
}

export function etatBoutique(b: Boutique, date: Date = new Date()): EtatBoutique {
  const { jour, minutes } = maintenantDakar(date);
  const plages = (j: number) => b.horaires[String(((j % 7) + 7) % 7)] ?? [];

  // Plage en cours : celle du jour, ou celle de la veille qui déborde après minuit.
  let fermeA: string | null = null;
  let ouvertHoraires = false;
  for (const p of plages(jour)) {
    const o = enMinutes(p.ouvre);
    const f = enMinutes(p.ferme);
    if (f > o ? minutes >= o && minutes < f : minutes >= o) {
      ouvertHoraires = true;
      fermeA = toujoursOuvert(p) ? null : formatHeure(p.ferme);
    }
  }
  if (!ouvertHoraires) {
    for (const p of plages(jour - 1)) {
      const o = enMinutes(p.ouvre);
      const f = enMinutes(p.ferme);
      if (f < o && minutes < f) {
        ouvertHoraires = true;
        fermeA = formatHeure(p.ferme);
      }
    }
  }

  // Prochaine ouverture (sur 7 jours).
  let prochaineOuverture: string | null = null;
  for (let d = 0; d < 8 && !prochaineOuverture; d++) {
    const debuts = plages(jour + d)
      .map((p) => enMinutes(p.ouvre))
      .filter((o) => d > 0 || o > minutes)
      .sort((a, z) => a - z);
    if (debuts.length > 0) {
      const h = `${String(Math.floor(debuts[0] / 60)).padStart(2, '0')}:${String(debuts[0] % 60).padStart(2, '0')}`;
      const quand = d === 0 ? 'aujourd’hui' : d === 1 ? 'demain' : JOURS[(jour + d) % 7].toLowerCase();
      prochaineOuverture = `${quand} à ${formatHeure(h)}`;
    }
  }

  const enPause = b.fermeture_exceptionnelle;
  return {
    ouvert: ouvertHoraires && !enPause,
    enPause,
    fermeA: enPause ? null : fermeA,
    prochaineOuverture: enPause ? null : prochaineOuverture,
    message: enPause ? b.message_fermeture?.trim() || null : null,
  };
}

// Phrase affichée au client quand la commande est impossible.
export function phraseFermeture(e: EtatBoutique): string {
  if (e.enPause) return e.message ?? 'Nous ne prenons pas de commandes pour le moment. Revenez un peu plus tard.';
  return e.prochaineOuverture ? `Nous sommes fermés. Ouverture ${e.prochaineOuverture}.` : 'Nous sommes fermés pour le moment.';
}
