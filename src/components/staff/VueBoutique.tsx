'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Loader2, LogOut } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { afficherToast } from '@/lib/toast';
import { rafraichirBoutique } from '@/lib/useBoutique';
import { JOURS, ORDRE_JOURS, SchemaHoraires, etatBoutique, formatHeure, type Boutique, type Horaires } from '@/lib/horaires';
import { LIBELLE_STATUT, type Commande, type StatutCommande } from '@/types';
import PushOptIn from '@/components/pwa/PushOptIn';
import { Carte, Interrupteur, TitreSection, numero, prix } from './commun';

export interface LigneAuditLog {
  id: string;
  commande_id: string;
  ancien_statut: string | null;
  nouveau_statut: string;
  modifie_par_email: string | null;
  created_at: string;
}

interface VueBoutiqueProps {
  boutique: Boutique | null;
  boutiqueAbsente: boolean;
  maintenant: number;
  commandes: Commande[];
  auditLog: LigneAuditLog[];
  session: Session;
  onBoutique: (b: Boutique) => void;
  onDeconnexion: () => void;
}

export default function VueBoutique(props: VueBoutiqueProps) {
  const { boutique, boutiqueAbsente, maintenant, commandes, auditLog, session } = props;
  return (
    <div className="space-y-9">
      {boutiqueAbsente ? (
        <Carte className="p-5">
          <p className="font-semibold">Horaires pas encore activés</p>
          <p className="mt-1 text-sm text-kc-encre/70">
            Exécutez la migration <code className="font-mono text-xs">20261016150000_boutique_horaires.sql</code> dans le SQL
            Editor de Supabase, puis rechargez cette page.
          </p>
        </Carte>
      ) : boutique ? (
        <>
          <EtatEtPause boutique={boutique} maintenant={maintenant} onBoutique={props.onBoutique} />
          <BilanDuJour commandes={commandes} maintenant={maintenant} />
          <EditeurHoraires boutique={boutique} onBoutique={props.onBoutique} />
        </>
      ) : (
        <div className="py-10 flex justify-center text-kc-brume">
          <Loader2 className="w-6 h-6 animate-spin" aria-label="Chargement" />
        </div>
      )}

      {boutiqueAbsente && <BilanDuJour commandes={commandes} maintenant={maintenant} />}

      <section>
        <TitreSection aide="Pour être prévenu à chaque nouvelle commande, même téléphone verrouillé.">Alertes</TitreSection>
        <PushOptIn cible={{ accessToken: session.access_token }} libelle="Activer les alertes de commande" compact />
      </section>

      <Journal auditLog={auditLog} commandes={commandes} />

      <section className="border-t border-white/10 pt-6 flex items-center justify-between gap-3">
        <p className="text-sm text-kc-brume/70 min-w-0 truncate">Connecté : {session.user.email}</p>
        <button
          onClick={props.onDeconnexion}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-kc-brume hover:border-white/40 shrink-0"
        >
          <LogOut className="w-4 h-4" /> Se déconnecter
        </button>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------
// Ouvert / fermé + pause manuelle
// ------------------------------------------------------------------
function EtatEtPause({
  boutique,
  maintenant,
  onBoutique,
}: {
  boutique: Boutique;
  maintenant: number;
  onBoutique: (b: Boutique) => void;
}) {
  const [message, setMessage] = useState(boutique.message_fermeture ?? '');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const etat = etatBoutique(boutique, new Date(maintenant));

  const enregistrer = async (changement: Partial<Boutique>, toast: string) => {
    setOccupe(true);
    setErreur(null);
    const { data, error } = await supabase
      .from('boutique')
      .update(changement)
      .eq('id', 1)
      .select('horaires, fermeture_exceptionnelle, message_fermeture');
    setOccupe(false);
    if (error || !data || data.length === 0) {
      setErreur('Modification non enregistrée. Vérifiez la connexion et réessayez.');
      return;
    }
    onBoutique(data[0] as Boutique);
    void rafraichirBoutique();
    afficherToast(toast);
  };

  return (
    <section>
      <TitreSection>Boutique</TitreSection>
      <Carte className="p-5">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full shrink-0 ${etat.ouvert ? 'bg-emerald-500' : 'bg-kc-bissap'}`} aria-hidden />
          <div className="min-w-0">
            <p className="text-xl font-bold leading-tight">
              {etat.ouvert ? 'Ouvert' : etat.enPause ? 'En pause' : 'Fermé'}
              {etat.ouvert && etat.fermeA && <span className="font-semibold text-kc-encre/60"> jusqu’à {etat.fermeA}</span>}
            </p>
            <p className="text-sm text-kc-encre/65 mt-0.5">
              {etat.ouvert
                ? 'Les clients peuvent commander.'
                : etat.enPause
                  ? 'Les clients ne peuvent pas commander.'
                  : etat.prochaineOuverture
                    ? `Les clients ne peuvent pas commander. Ouverture ${etat.prochaineOuverture}.`
                    : 'Les clients ne peuvent pas commander.'}
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-kc-encre/10 pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Mettre les commandes en pause</p>
              <p className="text-sm text-kc-encre/60">
                Trop de monde, plus de pâte, coupure… Un geste, et on reprend quand on veut.
              </p>
            </div>
            {occupe ? (
              <Loader2 className="w-6 h-6 animate-spin text-kc-indigo shrink-0" />
            ) : (
              <Interrupteur
                actif={boutique.fermeture_exceptionnelle}
                libelle="Mettre les commandes en pause"
                onChange={(pause) =>
                  void enregistrer(
                    {
                      fermeture_exceptionnelle: pause,
                      message_fermeture: pause ? message.trim() || null : boutique.message_fermeture,
                    },
                    pause ? 'Commandes en pause.' : 'Commandes reprises.',
                  )
                }
              />
            )}
          </div>

          {boutique.fermeture_exceptionnelle && (
            <div className="mt-4">
              <label htmlFor="message-pause" className="text-sm font-semibold">
                Message aux clients <span className="font-normal text-kc-encre/50">(facultatif)</span>
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="message-pause"
                  maxLength={160}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ex. : Fermé ce soir, on rouvre demain à 17 h."
                  className="flex-1 min-w-0 rounded-2xl border border-kc-encre/15 bg-white px-4 py-3 text-base focus:outline-none focus:border-kc-indigo"
                />
                <button
                  onClick={() => void enregistrer({ message_fermeture: message.trim() || null }, 'Message enregistré.')}
                  disabled={occupe || message.trim() === (boutique.message_fermeture ?? '')}
                  className="rounded-full bg-kc-indigo text-kc-beurre font-semibold px-4 text-sm disabled:opacity-40"
                >
                  OK
                </button>
              </div>
            </div>
          )}
          {erreur && <p className="mt-3 text-sm font-semibold text-kc-bissap">{erreur}</p>}
        </div>
      </Carte>
    </section>
  );
}

// ------------------------------------------------------------------
// Bilan du jour (pour le gérant)
// ------------------------------------------------------------------
function BilanDuJour({ commandes, maintenant }: { commandes: Commande[]; maintenant: number }) {
  const bilan = useMemo(() => {
    const jour = new Date(maintenant).toISOString().slice(0, 10);
    // Dakar = UTC : la date UTC est la date locale.
    const duJour = commandes.filter((c) => new Date(c.created_at).toISOString().slice(0, 10) === jour);
    const valides = duJour.filter((c) => c.statut !== 'annulee');
    const livrees = duJour.filter((c) => c.statut === 'livree');
    const encaisse = livrees.reduce((s, c) => s + c.total, 0);
    const attendu = valides.filter((c) => c.statut !== 'livree').reduce((s, c) => s + c.total, 0);
    const ventes = new Map<string, number>();
    for (const c of valides)
      for (const it of c.commande_items ?? []) ventes.set(it.nom_produit, (ventes.get(it.nom_produit) ?? 0) + it.quantite);
    const top = [...ventes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return {
      nb: valides.length,
      annulees: duJour.length - valides.length,
      encaisse,
      attendu,
      panierMoyen: valides.length ? Math.round(valides.reduce((s, c) => s + c.total, 0) / valides.length) : 0,
      top,
    };
  }, [commandes, maintenant]);

  return (
    <section>
      <TitreSection aide="Heure de Dakar. Les annulées ne sont pas comptées.">Aujourd’hui</TitreSection>
      <div className="grid grid-cols-2 gap-2">
        <Tuile valeur={String(bilan.nb)} libelle={`commande${bilan.nb > 1 ? 's' : ''}`} />
        <Tuile valeur={prix(bilan.encaisse)} libelle="encaissés (livrées)" />
        <Tuile valeur={prix(bilan.attendu)} libelle="à encaisser (en cours)" />
        <Tuile valeur={bilan.nb ? prix(bilan.panierMoyen) : '–'} libelle="panier moyen" />
      </div>
      <Carte className="mt-2 p-4">
        <p className="text-sm font-semibold">Les plus demandées</p>
        {bilan.top.length === 0 ? (
          <p className="mt-1 text-sm text-kc-encre/60">Pas encore de commande aujourd’hui.</p>
        ) : (
          <ol className="mt-2 space-y-1.5">
            {bilan.top.map(([nom, q], i) => (
              <li key={nom} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-bold text-kc-indigo">{i + 1}.</span> {nom}
                </span>
                <span className="font-semibold shrink-0">× {q}</span>
              </li>
            ))}
          </ol>
        )}
        {bilan.annulees > 0 && (
          <p className="mt-3 text-xs text-kc-encre/55">
            {bilan.annulees} commande{bilan.annulees > 1 ? 's' : ''} annulée{bilan.annulees > 1 ? 's' : ''} aujourd’hui.
          </p>
        )}
      </Carte>
    </section>
  );
}

function Tuile({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <Carte className="p-4">
      <p className="prix text-2xl leading-none text-kc-indigo">{valeur}</p>
      <p className="mt-1.5 text-xs font-semibold text-kc-encre/60">{libelle}</p>
    </Carte>
  );
}

// ------------------------------------------------------------------
// Horaires
// ------------------------------------------------------------------
// L'input « time » ne connaît pas 24:00 : minuit s'affiche 00:00 et se
// réenregistre en 24:00 quand c'est une heure de fermeture.
const versChamp = (h: string) => (h === '24:00' ? '00:00' : h);
const depuisChampFerme = (h: string) => (h === '00:00' ? '24:00' : h);

function EditeurHoraires({ boutique, onBoutique }: { boutique: Boutique; onBoutique: (b: Boutique) => void }) {
  const [brouillon, setBrouillon] = useState<Horaires>(boutique.horaires);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const modifie = JSON.stringify(brouillon) !== JSON.stringify(boutique.horaires);

  const plage = (j: number) => brouillon[String(j)]?.[0] ?? null;
  const changer = (j: number, p: { ouvre: string; ferme: string } | null) =>
    setBrouillon((prev) => ({ ...prev, [String(j)]: p ? [p, ...(prev[String(j)]?.slice(1) ?? [])] : [] }));

  const copierPartout = (j: number) => {
    const p = brouillon[String(j)] ?? [];
    setBrouillon(Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), p.map((x) => ({ ...x }))])));
  };

  const enregistrer = async () => {
    setErreur(null);
    const parse = SchemaHoraires.safeParse(brouillon);
    if (!parse.success) {
      setErreur('Une heure n’est pas valide : l’ouverture et la fermeture doivent être différentes.');
      return;
    }
    setOccupe(true);
    const { data, error } = await supabase
      .from('boutique')
      .update({ horaires: parse.data })
      .eq('id', 1)
      .select('horaires, fermeture_exceptionnelle, message_fermeture');
    setOccupe(false);
    if (error || !data || data.length === 0) {
      setErreur('Horaires non enregistrés. Vérifiez la connexion et réessayez.');
      return;
    }
    onBoutique(data[0] as Boutique);
    void rafraichirBoutique();
    afficherToast('Horaires enregistrés. Le site est à jour.');
  };

  return (
    <section>
      <TitreSection aide="En dehors de ces heures, le site affiche « fermé » et n’accepte pas de commande. Fermeture après minuit possible (ex. 18:00 → 01:00).">
        Horaires d’ouverture
      </TitreSection>
      <Carte className="divide-y divide-kc-encre/10">
        {ORDRE_JOURS.map((j) => {
          const p = plage(j);
          const toute = p?.ouvre === '00:00' && p?.ferme === '24:00';
          return (
            <div key={j} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className={`font-semibold ${p ? '' : 'text-kc-encre/45'}`}>{JOURS[j]}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-kc-encre/55">{p ? 'Ouvert' : 'Fermé'}</span>
                  <Interrupteur
                    actif={!!p}
                    libelle={`Ouvert le ${JOURS[j].toLowerCase()}`}
                    onChange={(o) => changer(j, o ? { ouvre: '17:00', ferme: '23:00' } : null)}
                  />
                </div>
              </div>
              {p && (
                <div className="mt-2.5 flex items-center gap-2 text-sm">
                  <input
                    type="time"
                    step={900}
                    aria-label={`Ouverture le ${JOURS[j].toLowerCase()}`}
                    value={versChamp(p.ouvre)}
                    onChange={(e) => e.target.value && changer(j, { ouvre: e.target.value, ferme: p.ferme })}
                    className="rounded-xl border border-kc-encre/15 bg-white px-3 py-2 text-base font-semibold"
                  />
                  <span className="text-kc-encre/50">à</span>
                  <input
                    type="time"
                    step={900}
                    aria-label={`Fermeture le ${JOURS[j].toLowerCase()}`}
                    value={versChamp(p.ferme)}
                    onChange={(e) => e.target.value && changer(j, { ouvre: p.ouvre, ferme: depuisChampFerme(e.target.value) })}
                    className="rounded-xl border border-kc-encre/15 bg-white px-3 py-2 text-base font-semibold"
                  />
                  {toute && <span className="text-xs text-kc-encre/55">toute la journée</span>}
                </div>
              )}
              {j === 1 && (
                <button onClick={() => copierPartout(1)} className="mt-2 text-sm font-semibold text-kc-indigo py-1">
                  Mêmes horaires tous les jours
                </button>
              )}
            </div>
          );
        })}
      </Carte>

      {erreur && <p className="mt-3 text-sm font-semibold text-kc-bissap">{erreur}</p>}

      {modifie && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => void enregistrer()}
            disabled={occupe}
            className="flex-1 rounded-full bg-kc-caramel hover:bg-kc-beurre text-kc-nuit font-semibold py-3.5 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {occupe && <Loader2 className="w-4 h-4 animate-spin" />}
            Enregistrer les horaires
          </button>
          <button
            onClick={() => setBrouillon(boutique.horaires)}
            className="rounded-full border border-white/15 px-5 text-sm font-semibold text-kc-brume"
          >
            Annuler
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-kc-brume/60">
        Résumé :{' '}
        {ORDRE_JOURS.map((j) => {
          const p = plage(j);
          return `${JOURS[j].slice(0, 3)}. ${p ? (p.ouvre === '00:00' && p.ferme === '24:00' ? '24 h/24' : `${formatHeure(p.ouvre)}–${formatHeure(p.ferme)}`) : 'fermé'}`;
        }).join(' · ')}
      </p>
    </section>
  );
}

// ------------------------------------------------------------------
// Journal des changements (qui a fait quoi)
// ------------------------------------------------------------------
function Journal({ auditLog, commandes }: { auditLog: LigneAuditLog[]; commandes: Commande[] }) {
  const [ouvert, setOuvert] = useState(false);
  const libelle = (s: string | null) => (s ? (LIBELLE_STATUT[s as StatutCommande] ?? s) : 'Création');
  const client = (id: string) => commandes.find((c) => c.id === id)?.client_nom;

  return (
    <section>
      <button
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="block font-display text-2xl text-kc-beurre leading-tight">Journal</span>
          <span className="block mt-1 text-sm text-kc-brume/70">Qui a changé quelle commande, et quand.</span>
        </span>
        <ChevronDown className={`w-5 h-5 text-kc-brume transition-transform ${ouvert ? 'rotate-180' : ''}`} />
      </button>
      {ouvert &&
        (auditLog.length === 0 ? (
          <p className="mt-3 text-sm text-kc-brume/70">Aucun changement enregistré.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {auditLog.slice(0, 50).map((l) => (
              <li key={l.id} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-xs text-kc-brume/60">
                  <span className="truncate">
                    n° {numero(l.commande_id)}
                    {client(l.commande_id) ? ` · ${client(l.commande_id)}` : ''}
                  </span>
                  <span className="shrink-0">
                    {new Date(l.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <p className="mt-1 text-sm">
                  <span className="text-kc-brume/70">{libelle(l.ancien_statut)}</span>
                  <span className="mx-2 text-kc-brume/40">→</span>
                  <span className="font-semibold text-kc-beurre">{libelle(l.nouveau_statut)}</span>
                </p>
                <p className="mt-0.5 text-xs text-kc-brume/50">{l.modifie_par_email || 'Système'}</p>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
