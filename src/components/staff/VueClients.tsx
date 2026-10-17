'use client';

import { useMemo, useState } from 'react';
import { MessageCircle, Phone, Search, Star, X } from 'lucide-react';
import { clients as regrouper, cleTelephone, type CommandeResume } from '@/lib/staff/statistiques';
import { urlWhatsAppClient } from '@/lib/whatsapp';
import { Carte, TitreSection, depuis, prix } from './commun';
import InfoBulle from '../ui/InfoBulle';

/** À partir de combien de commandes un client est « fidèle ». */
export const SEUIL_FIDELE = 3;

const normaliser = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Les clients des 90 derniers jours, regroupés par numéro : qui revient,
// combien il dépense, quand il a commandé pour la dernière fois. Un geste
// pour l'appeler ou lui écrire.
export default function VueClients({ historique, maintenant }: { historique: CommandeResume[]; maintenant: number }) {
  const [recherche, setRecherche] = useState('');
  const [fideles, setFideles] = useState(false);
  const tous = useMemo(() => regrouper(historique), [historique]);
  const nbFideles = tous.filter((c) => c.commandes >= SEUIL_FIDELE).length;

  const terme = normaliser(recherche.trim());
  const chiffres = recherche.replace(/\D/g, '');
  const liste = tous.filter(
    (c) =>
      (!fideles || c.commandes >= SEUIL_FIDELE) &&
      (!terme || normaliser(c.nom).includes(terme) || (chiffres.length >= 2 && cleTelephone(c.telephone).includes(chiffres))),
  );

  return (
    <section aria-label="Clients" className="space-y-4">
      <TitreSection aide="Les 90 derniers jours, regroupés par numéro de téléphone.">Clients</TitreSection>

      <div className="grid grid-cols-2 gap-2">
        <Carte className="p-4">
          <p className="text-sm text-kc-sable">Clients</p>
          <p className="prix mt-1 text-2xl text-kc-creme">{tous.length}</p>
        </Carte>
        <Carte className="p-4">
          <p className="text-sm text-kc-sable">Fidèles ({SEUIL_FIDELE} commandes et plus)</p>
          <p className="prix mt-1 text-2xl text-kc-caramel">{nbFideles}</p>
        </Carte>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="block text-sm font-semibold text-kc-creme mb-1.5">Chercher un client</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-kc-sable" aria-hidden />
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Awa, 77 123…"
              className="w-full min-h-12 rounded-xl border border-kc-bord bg-kc-nuit pl-10 pr-4 text-base text-kc-creme placeholder:text-kc-sable/80 focus:outline-none focus:border-amber-500"
            />
          </span>
        </label>
        <button
          type="button"
          aria-pressed={fideles}
          onClick={() => setFideles((f) => !f)}
          className={`appui inline-flex items-center justify-center gap-2 min-h-12 px-4 rounded-xl border text-sm font-semibold ${
            fideles ? 'border-amber-500 bg-amber-500 text-kc-nuit' : 'border-kc-bord text-kc-creme hover:border-kc-sable/60'
          }`}
        >
          <Star className="w-4 h-4" aria-hidden /> Fidèles seulement
        </button>
      </div>

      {liste.length === 0 ? (
        <Carte className="p-6 text-center">
          <p className="font-semibold text-kc-creme">
            {tous.length === 0 ? 'Pas encore de client sur 90 jours' : 'Aucun client ne correspond'}
          </p>
          <p className="mt-1 text-sm text-kc-sable">
            {tous.length === 0
              ? 'Les clients apparaissent ici dès leur première commande.'
              : 'Vérifiez l’orthographe du nom ou cherchez par numéro.'}
          </p>
          {tous.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setRecherche('');
                setFideles(false);
              }}
              className="appui mt-4 min-h-11 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-kc-nuit text-sm font-semibold"
            >
              Effacer les filtres
            </button>
          )}
        </Carte>
      ) : (
        <ul className="rounded-2xl border border-kc-bord bg-kc-carte divide-y divide-kc-bord overflow-hidden">
          {liste.slice(0, 100).map((c) => {
            const fidele = c.commandes >= SEUIL_FIDELE;
            return (
              <li key={cleTelephone(c.telephone)} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold text-kc-creme">
                    <span className="truncate">{c.nom}</span>
                    {fidele && (
                      <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                        <Star className="w-3 h-3" aria-hidden /> Fidèle
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-kc-sable">
                    {c.commandes} commande{c.commandes > 1 ? 's' : ''}, {prix(c.depense)}. Dernière {depuis(c.derniere, maintenant)}.
                  </p>
                </div>
                <div className="flex shrink-0">
                  <InfoBulle libelle="Appeler" cote="gauche" sombre>
                    <a
                      href={`tel:${c.telephone.replace(/\s/g, '')}`}
                      aria-label={`Appeler ${c.nom}`}
                      className="appui w-11 h-11 rounded-full flex items-center justify-center text-kc-sable hover:bg-white/10 hover:text-kc-creme"
                    >
                      <Phone className="w-5 h-5" aria-hidden />
                    </a>
                  </InfoBulle>
                  <InfoBulle libelle="Écrire sur WhatsApp" cote="gauche" sombre>
                    <a
                      href={urlWhatsAppClient(c.telephone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Écrire à ${c.nom} sur WhatsApp`}
                      className="appui w-11 h-11 rounded-full flex items-center justify-center text-emerald-400 hover:bg-white/10"
                    >
                      <MessageCircle className="w-5 h-5" aria-hidden />
                    </a>
                  </InfoBulle>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {recherche && (
        <button
          type="button"
          onClick={() => setRecherche('')}
          className="appui inline-flex items-center gap-1.5 min-h-11 text-sm font-semibold text-kc-sable hover:text-kc-creme"
        >
          <X className="w-4 h-4" aria-hidden /> Effacer la recherche
        </button>
      )}
    </section>
  );
}
