'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CATEGORIES_PRODUIT } from '@/lib/categories';
import { compresserPhoto, deposerPhoto, supprimerPhotoStaff } from '@/lib/photoProduit';
import { useFocusPiege } from '@/lib/useFocusPiege';
import type { CategorieProduit, Produit } from '@/types';
import { Interrupteur } from './commun';

const NOM_MAX = 80;
const DESCRIPTION_MAX = 300;
const PRIX_MIN = 50;
const PRIX_MAX = 1_000_000;

type Champ = 'nom' | 'prix' | 'photo';
type Erreurs = Partial<Record<Champ, string>>;

interface FicheProduitProps {
  /** Produit à modifier ; absent pour un ajout. */
  produit?: Produit | null;
  /** Rubrique proposée par défaut pour un ajout. */
  categorieInitiale?: CategorieProduit;
  onFermer: () => void;
  /** Appelé après un enregistrement ou une suppression réussis. */
  onTermine: (message: string) => void;
}

const lirePrix = (v: string) => Number(v.replace(/[\s  ]/g, ''));

function valider(nom: string, prix: string): Erreurs {
  const e: Erreurs = {};
  const n = nom.trim();
  if (n.length < 2) e.nom = 'Donnez un nom au produit (2 caractères au moins).';
  else if (n.length > NOM_MAX) e.nom = `${NOM_MAX} caractères au plus.`;
  const p = lirePrix(prix);
  if (!prix.trim()) e.prix = 'Indiquez le prix en francs CFA.';
  else if (!Number.isInteger(p)) e.prix = 'Un nombre entier, sans virgule (ex. 2 500).';
  else if (p < PRIX_MIN || p > PRIX_MAX) e.prix = `Entre ${PRIX_MIN} et ${PRIX_MAX.toLocaleString('fr-FR')} F.`;
  return e;
}

// Fiche d'un produit de la carte, en panneau latéral (plein écran sur
// téléphone) : nom, photo, catégorie, prix, description, visibilité.
// Ajout, modification et suppression (avec confirmation nommée).
export default function FicheProduit({ produit, categorieInitiale = 'salee', onFermer, onTermine }: FicheProduitProps) {
  const modif = !!produit;
  const id = useId();
  const panneau = useRef<HTMLDivElement>(null);
  const champNom = useRef<HTMLInputElement>(null);
  const champPrix = useRef<HTMLInputElement>(null);
  const boutonGarder = useRef<HTMLButtonElement>(null);
  useFocusPiege(panneau);

  const [nom, setNom] = useState(produit?.nom ?? '');
  const [categorie, setCategorie] = useState<CategorieProduit>(produit?.categorie ?? categorieInitiale);
  const [prix, setPrix] = useState(produit ? String(produit.prix) : '');
  const [description, setDescription] = useState(produit?.description ?? '');
  const [disponible, setDisponible] = useState(produit?.disponible ?? true);
  // Photo : l'actuelle (URL), une nouvelle (préparée, pas encore envoyée), ou aucune.
  const [photo, setPhoto] = useState<{ apercu: string; nouvelle?: Awaited<ReturnType<typeof compresserPhoto>> } | null>(
    produit?.image_url ? { apercu: produit.image_url } : null,
  );
  const [preparation, setPreparation] = useState(false);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [touches, setTouches] = useState<Partial<Record<Champ, boolean>>>({});
  const [envoi, setEnvoi] = useState<null | 'enregistrement' | 'suppression'>(null);
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);

  // Premier focus sur le nom ; Échap ferme ; défilement de la page bloqué.
  useEffect(() => {
    champNom.current?.focus();
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = avant;
    };
  }, []);
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || envoi) return;
      if (confirmer) setConfirmer(false);
      else onFermer();
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [envoi, confirmer, onFermer]);
  useEffect(() => {
    if (confirmer) boutonGarder.current?.focus();
  }, [confirmer]);
  // Libère l'aperçu local d'une photo remplacée ou abandonnée.
  useEffect(() => {
    const url = photo?.nouvelle ? photo.apercu : null;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo]);

  // Validation au départ du champ ; une erreur s'efface dès la correction.
  const verifier = (champ: Champ, valeurs = { nom, prix }) => {
    const e = valider(valeurs.nom, valeurs.prix);
    setErreurs((avant) => ({ ...avant, [champ]: e[champ as 'nom' | 'prix'] }));
  };
  const surSaisie = (champ: 'nom' | 'prix', valeur: string) => {
    if (champ === 'nom') setNom(valeur);
    else setPrix(valeur.replace(/[^\d\s]/g, ''));
    if (erreurs[champ] && !valider(champ === 'nom' ? valeur : nom, champ === 'prix' ? valeur : prix)[champ]) {
      setErreurs((avant) => ({ ...avant, [champ]: undefined }));
    }
  };

  const choisirPhoto = async (fichier: File | undefined) => {
    if (!fichier) return;
    setPreparation(true);
    setErreurs((e) => ({ ...e, photo: undefined }));
    try {
      const nouvelle = await compresserPhoto(fichier);
      setPhoto({ apercu: URL.createObjectURL(nouvelle.blob), nouvelle });
    } catch (e) {
      setErreurs((avant) => ({ ...avant, photo: e instanceof Error ? e.message : 'Photo illisible. Essayez une autre image.' }));
    } finally {
      setPreparation(false);
    }
  };

  // La page d'accueil est régénérée tout de suite (sinon jusqu'à 60 s).
  const revaliderCarte = async () => {
    const { data } = await supabase.auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) return;
    await fetch('/api/admin/carte', { method: 'POST', headers: { Authorization: `Bearer ${jeton}` } }).catch(() => undefined);
  };

  const messageErreur = (message: string, code?: string) => {
    if (code === '42501' || /row-level security|permission denied/i.test(message)) {
      return 'Votre session n’a pas les droits pour modifier la carte. Reconnectez-vous, puis réessayez.';
    }
    if (code === '23514' || /check constraint/i.test(message)) {
      return 'La base a refusé une valeur (catégorie, prix ou nom). Vérifiez la fiche, puis réessayez.';
    }
    return `L’enregistrement n’a pas abouti (${message}). Vérifiez la connexion, puis réessayez.`;
  };

  const enregistrer = async () => {
    setErreurGlobale(null);
    const e = valider(nom, prix);
    setErreurs((avant) => ({ ...e, photo: avant.photo }));
    setTouches({ nom: true, prix: true });
    if (e.nom) return champNom.current?.focus();
    if (e.prix) return champPrix.current?.focus();
    if (preparation) return;

    setEnvoi('enregistrement');
    let urlDeposee: string | null = null;
    try {
      if (photo?.nouvelle) urlDeposee = await deposerPhoto(photo.nouvelle);
      const image_url = photo ? (urlDeposee ?? photo.apercu) : null;
      const valeurs = {
        nom: nom.trim().replace(/\s+/g, ' '),
        categorie,
        prix: lirePrix(prix),
        description: description.trim() || null,
        disponible,
        image_url,
      };
      const { data, error } = modif
        ? await supabase.from('produits').update(valeurs).eq('id', produit!.id).select('id')
        : await supabase.from('produits').insert(valeurs).select('id');
      if (error || !data || data.length === 0) {
        if (urlDeposee) await supprimerPhotoStaff(urlDeposee);
        setErreurGlobale(
          error ? messageErreur(error.message, error.code) : 'Aucune ligne modifiée : le produit a peut-être été supprimé entre-temps.',
        );
        setEnvoi(null);
        return;
      }
      // L'ancienne photo, si elle a été remplacée ou retirée (seulement
      // celles déposées depuis KC Staff ; les photos d'origine restent).
      if (modif && produit!.image_url && produit!.image_url !== image_url) await supprimerPhotoStaff(produit!.image_url);
      void revaliderCarte();
      onTermine(modif ? `Modifications enregistrées : ${valeurs.nom}.` : `Ajouté à la carte : ${valeurs.nom}.`);
    } catch (err) {
      if (urlDeposee) await supprimerPhotoStaff(urlDeposee);
      setErreurGlobale(err instanceof Error ? err.message : 'L’enregistrement n’a pas abouti. Réessayez.');
      setEnvoi(null);
    }
  };

  const supprimer = async () => {
    if (!produit) return;
    setEnvoi('suppression');
    setErreurGlobale(null);
    const { data, error } = await supabase.from('produits').delete().eq('id', produit.id).select('id');
    if (error || !data || data.length === 0) {
      setErreurGlobale(error ? messageErreur(error.message, error.code) : 'Suppression refusée : le produit est peut-être déjà supprimé.');
      setEnvoi(null);
      setConfirmer(false);
      return;
    }
    await supprimerPhotoStaff(produit.image_url);
    void revaliderCarte();
    onTermine(`Supprimé de la carte : ${produit.nom}.`);
  };

  const occupe = envoi !== null || preparation;
  const erreurVisible = (c: Champ) => (c === 'photo' || touches[c] ? erreurs[c] : undefined);
  const titre = modif ? `Modifier « ${produit!.nom} »` : 'Ajouter un produit';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <div className="absolute inset-0 bg-black/60 animate-[kc-fondu_150ms_ease-out] motion-reduce:animate-none" onClick={() => !occupe && onFermer()} aria-hidden />
      <div
        ref={panneau}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titre`}
        className="relative h-full w-full sm:max-w-[30rem] bg-kc-nuit text-kc-creme sm:border-l border-kc-bord flex flex-col shadow-2xl animate-[kc-panneau_220ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
      >
        <header className="flex items-center gap-3 px-5 py-4 border-b border-kc-bord">
          <h2 id={`${id}-titre`} className="flex-1 min-w-0 font-serif font-semibold text-xl leading-tight truncate">
            {titre}
          </h2>
          <button
            type="button"
            onClick={onFermer}
            disabled={occupe}
            aria-label="Fermer"
            title="Fermer (Échap)"
            className="w-11 h-11 -mr-2 rounded-xl flex items-center justify-center text-kc-sable hover:bg-white/5 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void enregistrer();
          }}
          className="flex-1 min-h-0 flex flex-col"
        >
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {/* Photo */}
            <fieldset>
              <legend className="text-sm font-semibold mb-2">Photo</legend>
              <div className="flex items-center gap-4">
                <div className="relative w-28 h-28 shrink-0 rounded-2xl overflow-hidden bg-kc-carte border border-kc-bord flex items-center justify-center">
                  {photo ? (
                    <Image src={photo.apercu} alt={nom ? `Photo de ${nom}` : 'Photo du produit'} fill unoptimized sizes="112px" className="object-cover" />
                  ) : (
                    <ImagePlus className="w-8 h-8 text-kc-sable/60" aria-hidden />
                  )}
                  {preparation && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-kc-caramel" aria-label="Préparation de la photo" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label
                    className={`inline-flex items-center gap-2 rounded-xl border border-kc-bord px-4 py-2.5 text-sm font-semibold hover:bg-white/5 cursor-pointer focus-within:ring-2 focus-within:ring-amber-500 ${occupe ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <ImagePlus className="w-4 h-4" aria-hidden />
                    {photo ? 'Changer la photo' : 'Choisir une photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={occupe}
                      aria-describedby={`${id}-photo-aide`}
                      onChange={(e) => {
                        void choisirPhoto(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {photo && (
                    <button
                      type="button"
                      onClick={() => setPhoto(null)}
                      disabled={occupe}
                      className="block text-sm font-semibold text-kc-sable underline underline-offset-4 hover:text-kc-creme disabled:opacity-50"
                    >
                      Retirer la photo
                    </button>
                  )}
                </div>
              </div>
              <p id={`${id}-photo-aide`} className="mt-2 text-xs text-kc-sable/80">
                Photo du téléphone ou de l’ordinateur : elle est réduite automatiquement pour la carte.
              </p>
              {erreurVisible('photo') && (
                <p role="alert" className="mt-2 text-sm text-rose-300">
                  {erreurs.photo}
                </p>
              )}
            </fieldset>

            {/* Nom */}
            <div>
              <label htmlFor={`${id}-nom`} className="block text-sm font-semibold mb-2">
                Nom
              </label>
              <input
                ref={champNom}
                id={`${id}-nom`}
                type="text"
                value={nom}
                maxLength={NOM_MAX}
                autoComplete="off"
                enterKeyHint="next"
                onChange={(e) => surSaisie('nom', e.target.value)}
                onBlur={() => {
                  setTouches((t) => ({ ...t, nom: true }));
                  verifier('nom');
                }}
                aria-invalid={!!erreurVisible('nom')}
                aria-describedby={erreurVisible('nom') ? `${id}-nom-erreur` : undefined}
                className="w-full rounded-xl bg-kc-carte border border-kc-bord px-4 py-3 text-base placeholder:text-kc-sable/50 focus:outline-none focus:ring-2 focus:ring-amber-500 aria-[invalid=true]:border-rose-400"
                placeholder="ex. Gaufre Nutella"
              />
              {erreurVisible('nom') && (
                <p id={`${id}-nom-erreur`} className="mt-2 text-sm text-rose-300">
                  {erreurs.nom}
                </p>
              )}
            </div>

            {/* Catégorie */}
            <fieldset>
              <legend className="text-sm font-semibold mb-2">Catégorie</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES_PRODUIT.map((c) => (
                  <label key={c.id} className="cursor-pointer">
                    <input
                      type="radio"
                      name={`${id}-categorie`}
                      value={c.id}
                      checked={categorie === c.id}
                      onChange={() => setCategorie(c.id)}
                      className="peer sr-only"
                    />
                    <span className="inline-flex items-center rounded-full border border-kc-bord px-4 py-2 text-sm font-semibold text-kc-sable peer-checked:bg-amber-500 peer-checked:border-amber-500 peer-checked:text-kc-nuit peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500">
                      {c.rubrique}
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-kc-sable/80">
                {CATEGORIES_PRODUIT.find((c) => c.id === categorie)?.personnalisable
                  ? 'Les clients pourront y ajouter des extras (Nutella, chantilly…).'
                  : 'Ajout direct au panier, sans extras.'}
              </p>
            </fieldset>

            {/* Prix */}
            <div>
              <label htmlFor={`${id}-prix`} className="block text-sm font-semibold mb-2">
                Prix
              </label>
              <div className="relative">
                <input
                  ref={champPrix}
                  id={`${id}-prix`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={prix}
                  onChange={(e) => surSaisie('prix', e.target.value)}
                  onBlur={() => {
                    setTouches((t) => ({ ...t, prix: true }));
                    verifier('prix');
                  }}
                  aria-invalid={!!erreurVisible('prix')}
                  aria-describedby={erreurVisible('prix') ? `${id}-prix-erreur` : `${id}-prix-aide`}
                  className="w-full rounded-xl bg-kc-carte border border-kc-bord pl-4 pr-20 py-3 text-base tabular-nums placeholder:text-kc-sable/50 focus:outline-none focus:ring-2 focus:ring-amber-500 aria-[invalid=true]:border-rose-400"
                  placeholder="ex. 2500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-kc-sable" aria-hidden>
                  F CFA
                </span>
              </div>
              {erreurVisible('prix') ? (
                <p id={`${id}-prix-erreur`} className="mt-2 text-sm text-rose-300">
                  {erreurs.prix}
                </p>
              ) : (
                <p id={`${id}-prix-aide`} className="mt-2 text-xs text-kc-sable/80">
                  Prix de base ; les extras s’ajoutent au choix du client.
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor={`${id}-description`} className="block text-sm font-semibold mb-2">
                Description <span className="font-normal text-kc-sable">(facultatif)</span>
              </label>
              <textarea
                id={`${id}-description`}
                value={description}
                maxLength={DESCRIPTION_MAX}
                rows={3}
                onChange={(e) => setDescription(e.target.value)}
                aria-describedby={`${id}-description-compte`}
                className="w-full rounded-xl bg-kc-carte border border-kc-bord px-4 py-3 text-base leading-relaxed placeholder:text-kc-sable/50 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
                placeholder="ex. Pâte croustillante, Nutella fondant, éclats de noisette."
              />
              <p id={`${id}-description-compte`} className="mt-1 text-right text-xs text-kc-sable/70 tabular-nums">
                {description.length} / {DESCRIPTION_MAX}
              </p>
            </div>

            {/* Visibilité */}
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-kc-carte border border-kc-bord px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Visible sur la carte</p>
                <p className="text-xs text-kc-sable/80 mt-0.5">
                  {disponible ? 'Les clients peuvent le commander.' : 'Masqué comme « épuisé » pour les clients.'}
                </p>
              </div>
              <Interrupteur actif={disponible} libelle="Visible sur la carte" onChange={setDisponible} desactive={occupe} />
            </div>

            {modif && (
              <div className="border-t border-kc-bord pt-5">
                {!confirmer ? (
                  <button
                    type="button"
                    onClick={() => setConfirmer(true)}
                    disabled={occupe}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-rose-300 hover:text-rose-200 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden /> Supprimer ce produit
                  </button>
                ) : (
                  <div role="alertdialog" aria-labelledby={`${id}-suppr`} className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 space-y-3">
                    <p id={`${id}-suppr`} className="text-sm leading-relaxed">
                      <span className="font-semibold">Supprimer « {produit!.nom} » de la carte ?</span> Il disparaît pour les clients. Les
                      commandes passées gardent son nom et son prix.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        ref={boutonGarder}
                        type="button"
                        onClick={() => setConfirmer(false)}
                        disabled={occupe}
                        className="rounded-xl border border-kc-bord px-4 py-2.5 text-sm font-semibold hover:bg-white/5"
                      >
                        Garder le produit
                      </button>
                      <button
                        type="button"
                        onClick={() => void supprimer()}
                        disabled={occupe}
                        className="inline-flex items-center gap-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                      >
                        {envoi === 'suppression' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
                        Supprimer « {produit!.nom} »
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <footer className="border-t border-kc-bord px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3 bg-kc-nuit">
            {erreurGlobale && (
              <p role="alert" className="rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 text-sm">
                {erreurGlobale}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onFermer}
                disabled={occupe}
                className="rounded-xl border border-kc-bord px-5 py-3 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={envoi !== null}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-kc-nuit font-semibold py-3 text-sm disabled:opacity-60"
              >
                {envoi === 'enregistrement' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
                {modif ? 'Enregistrer les modifications' : 'Ajouter à la carte'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
