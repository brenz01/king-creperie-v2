'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronDown, ImageOff, Loader2, Pencil, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { afficherToast } from '@/lib/toast';
import { CATEGORIES_PRODUIT } from '@/lib/categories';
import type { CategorieProduit, Produit } from '@/types';
import { Interrupteur, TitreSection, prix } from './commun';
import FicheProduit from './FicheProduit';

type Fiche = { produit: Produit | null; categorie?: CategorieProduit };

const epuise = (p: Produit) => p.stock_gere === true && (p.stock_quantite ?? 0) <= 0;

interface VueCarteProps {
  produits: Produit[];
  onRefresh: () => void;
}

// La carte côté staff : un interrupteur par produit, enregistré tout de
// suite (un geste = c'est fait). Le stock chiffré est rangé dans le
// détail, pour ceux qui veulent le suivre. Chaque produit s'ajoute, se
// modifie (nom, photo, prix, catégorie, description) ou se supprime depuis
// sa fiche, en panneau latéral.
export default function VueCarte({ produits, onRefresh }: VueCarteProps) {
  const [occupe, setOccupe] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [stock, setStock] = useState<Record<string, { gere: boolean; quantite: number }>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [fiche, setFiche] = useState<Fiche | null>(null);

  const retires = produits.filter((p) => !p.disponible || epuise(p));

  const basculer = async (p: Produit, disponible: boolean) => {
    setOccupe(p.id);
    setErreur(null);
    const { data, error } = await supabase.from('produits').update({ disponible }).eq('id', p.id).select('id');
    setOccupe(null);
    if (error || !data || data.length === 0) {
      setErreur(`« ${p.nom} » n’a pas pu être modifié. Vérifiez la connexion et réessayez.`);
      return;
    }
    afficherToast(disponible ? `${p.nom} est de retour sur la carte.` : `${p.nom} est retiré de la carte.`);
    onRefresh();
  };

  const enregistrerStock = async (p: Produit) => {
    const v = stock[p.id];
    if (!v) return;
    setOccupe(p.id);
    setErreur(null);
    const payload = v.gere ? { stock_gere: true, stock_quantite: v.quantite } : { stock_gere: false, stock_quantite: null };
    // Verrou optimiste : n'écrase pas un stock modifié entre-temps par une commande.
    let requete = supabase.from('produits').update(payload).eq('id', p.id);
    requete = p.stock_quantite == null ? requete.is('stock_quantite', null) : requete.eq('stock_quantite', p.stock_quantite);
    const { data, error } = await requete.select('id');
    setOccupe(null);
    if (error) {
      setErreur(`Stock non enregistré : ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      setErreur(
        `Une commande vient de modifier le stock de « ${p.nom} ». Valeur rechargée : vérifiez puis enregistrez à nouveau.`,
      );
    } else {
      afficherToast(`Stock de ${p.nom} enregistré.`);
    }
    setStock((prev) => {
      const copie = { ...prev };
      delete copie[p.id];
      return copie;
    });
    onRefresh();
  };

  return (
    <section aria-label="Carte" className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TitreSection aide="Ajoutez, modifiez ou supprimez vos produits. L’interrupteur retire un produit d’un geste : les clients le voient aussitôt comme épuisé.">
          La carte
        </TitreSection>
        <button
          type="button"
          onClick={() => setFiche({ produit: null })}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-kc-nuit font-semibold px-4 py-3 text-sm shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden /> Ajouter un produit
        </button>
      </div>

      {produits.length === 0 && (
        <div className="rounded-2xl bg-kc-carte border border-kc-bord px-5 py-8 text-center">
          <p className="font-semibold text-kc-creme">La carte est vide.</p>
          <p className="mt-1 text-sm text-kc-sable">Ajoutez une première crêpe, une gaufre ou une boisson : elle apparaît aussitôt chez les clients.</p>
        </div>
      )}

      {retires.length > 0 && (
        <p className="-mt-4 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-kc-sable">
          <span className="font-semibold text-kc-creme">
            {retires.length} produit{retires.length > 1 ? 's' : ''} hors carte :
          </span>{' '}
          {retires.map((p) => p.nom).join(', ')}.
        </p>
      )}

      {erreur && (
        <div role="alert" className="rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 text-sm">
          {erreur}
        </div>
      )}

      {CATEGORIES_PRODUIT.map((r) => {
        const liste = produits.filter((p) => p.categorie === r.id);
        if (liste.length === 0) return null;
        return (
          <div key={r.id}>
            <h3 className="text-sm font-semibold text-kc-sable/80 mb-2 px-1">{r.rubrique}</h3>
            <ul className="rounded-2xl bg-kc-carte border border-kc-bord text-kc-creme divide-y divide-kc-creme/10 overflow-hidden">
              {liste.map((p) => {
                const dispo = p.disponible && !epuise(p);
                const detail = ouvert === p.id;
                const v = stock[p.id] ?? { gere: !!p.stock_gere, quantite: p.stock_quantite ?? 0 };
                const stockBas = p.stock_gere && (p.stock_quantite ?? 0) > 0 && (p.stock_quantite ?? 0) <= 3;
                return (
                  <li key={p.id} className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-kc-nuit border border-kc-bord flex items-center justify-center">
                        {p.image_url ? (
                          <Image
                            src={p.image_url}
                            alt=""
                            fill
                            unoptimized
                            sizes="48px"
                            className={`object-cover ${dispo ? '' : 'grayscale opacity-70'}`}
                          />
                        ) : (
                          <ImageOff className="w-5 h-5 text-kc-sable/50" aria-label="Sans photo" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setOuvert(detail ? null : p.id)}
                        aria-expanded={detail}
                        className="flex-1 min-w-0 text-left"
                      >
                        <span className={`block font-semibold leading-tight ${dispo ? '' : 'text-kc-creme/75'}`}>{p.nom}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-kc-creme/75">
                          <span className="prix">{prix(p.prix)}</span>
                          {epuise(p) && <span className="font-semibold text-rose-400">Stock à 0</span>}
                          {stockBas && <span className="font-semibold text-[#f59e0b]">Plus que {p.stock_quantite}</span>}
                          {p.stock_gere && !epuise(p) && !stockBas && <span>Stock : {p.stock_quantite}</span>}
                          <span className="inline-flex items-center gap-0.5 text-kc-caramel font-semibold">
                            Stock <ChevronDown className={`w-3.5 h-3.5 transition-transform ${detail ? 'rotate-180' : ''}`} />
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFiche({ produit: p })}
                        aria-label={`Modifier ${p.nom}`}
                        title={`Modifier ${p.nom}`}
                        className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-kc-sable hover:text-kc-creme hover:bg-white/5"
                      >
                        <Pencil className="w-4 h-4" aria-hidden />
                      </button>

                      <div className="flex flex-col items-center gap-1 shrink-0 w-16">
                        {occupe === p.id ? (
                          <Loader2 className="w-6 h-6 animate-spin my-1 text-kc-caramel" />
                        ) : (
                          <Interrupteur
                            actif={p.disponible}
                            libelle={`${p.nom} sur la carte`}
                            onChange={(d) => void basculer(p, d)}
                          />
                        )}
                        <span
                          className={`text-xs font-semibold ${
                            !p.disponible ? 'text-kc-creme/75' : epuise(p) ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {!p.disponible ? 'Retiré' : epuise(p) ? 'Épuisé' : 'En carte'}
                        </span>
                      </div>
                    </div>

                    {detail && (
                      <div className="mt-3 rounded-2xl bg-kc-nuit border border-kc-bord p-3 space-y-3">
                        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
                          Compter les portions restantes
                          <Interrupteur
                            actif={v.gere}
                            libelle="Compter les portions restantes"
                            onChange={(gere) => setStock((prev) => ({ ...prev, [p.id]: { ...v, gere } }))}
                          />
                        </label>
                        {v.gere && (
                          <div className="flex items-center gap-3">
                            <span className="text-sm">Portions restantes</span>
                            <div className="flex items-center rounded-xl border border-kc-bord">
                              <button
                                type="button"
                                aria-label="Une de moins"
                                onClick={() =>
                                  setStock((prev) => ({ ...prev, [p.id]: { ...v, quantite: Math.max(0, v.quantite - 1) } }))
                                }
                                className="w-11 h-11 text-lg font-semibold"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                aria-label="Portions restantes"
                                value={v.quantite}
                                onChange={(e) =>
                                  setStock((prev) => ({
                                    ...prev,
                                    [p.id]: { ...v, quantite: Math.max(0, Math.floor(Number(e.target.value) || 0)) },
                                  }))
                                }
                                className="w-14 text-center text-base font-semibold bg-transparent focus:outline-none"
                              />
                              <button
                                type="button"
                                aria-label="Une de plus"
                                onClick={() => setStock((prev) => ({ ...prev, [p.id]: { ...v, quantite: v.quantite + 1 } }))}
                                className="w-11 h-11 text-lg font-semibold"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-kc-creme/75 leading-relaxed">
                          {v.gere
                            ? 'Chaque commande retire des portions. À 0, la carte affiche « épuisé » toute seule. Une commande annulée avant la livraison les rend.'
                            : 'Sans comptage, le produit reste en carte tant que l’interrupteur est sur « En carte ».'}
                        </p>
                        {stock[p.id] && (
                          <button
                            onClick={() => void enregistrerStock(p)}
                            disabled={occupe === p.id}
                            className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-kc-nuit font-semibold py-3 text-sm disabled:opacity-60"
                          >
                            Enregistrer le stock
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {fiche && (
        <FicheProduit
          produit={fiche.produit}
          categorieInitiale={fiche.categorie}
          onFermer={() => setFiche(null)}
          onTermine={(message) => {
            setFiche(null);
            afficherToast(message);
            onRefresh();
          }}
        />
      )}
    </section>
  );
}
