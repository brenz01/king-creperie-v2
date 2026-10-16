'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Produit } from '@/types';
import type { Extra } from '@/lib/extras';
import { useCart } from '@/context/CartContext';
import { motion, useDragControls } from 'framer-motion';
import { X, Plus, Minus, Check, Share2 } from 'lucide-react';
import { confirmerAjout } from '@/lib/toast';
import { urlPartage } from '@/lib/whatsapp';
import { lireOrigine, prixF } from '@/lib/produit';
import Image from 'next/image';

interface ProductModalProps {
  produit: Produit;
  extras: readonly Extra[];
  onClose: () => void;
}

// La fiche prolonge la plaque : la crêpe quitte la carte et vient se poser
// sur un morceau de plaque en tête de fiche (mobile) ou à gauche (grand
// écran). Puis extras, quantité, et un seul bouton qui affiche le total.
export default function ProductModal({ produit, extras, onClose }: ProductModalProps) {
  const { addToCart } = useCart();
  const [selection, setSelection] = useState<Extra[]>([]);
  const [quantite, setQuantite] = useState(1);
  const photo = useRef<HTMLDivElement>(null);
  const feuille = useRef<HTMLDivElement>(null);
  const fermer = useRef<HTMLButtonElement>(null);
  // Fermer en tirant la feuille vers le bas, depuis la plaque ou la poignée
  // (pas depuis la liste, qui doit pouvoir défiler).
  const tirer = useDragControls();
  const saisir = (e: React.PointerEvent) => tirer.start(e);

  // Mobile : la photo déborde de l'en-tête sur le contenu. Au défilement,
  // elle se replie (échelle 1 → 0,5) jusqu'à tenir dans le morceau de
  // plaque ; son bas remonte aussi vite que le texte, qui ne passe donc
  // jamais dessous. Variable CSS, aucun rendu React.
  const replier = (e: React.UIEvent<HTMLDivElement>) => {
    const p = Math.min(1, e.currentTarget.scrollTop / 80);
    feuille.current?.style.setProperty('--repli', p.toFixed(3));
  };

  // Transition partagée : la photo part de sa position sur la carte.
  useLayoutEffect(() => {
    const depart = lireOrigine();
    const el = photo.current;
    if (!depart || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const arrivee = el.getBoundingClientRect();
    if (!arrivee.width) return;
    const dx = depart.left + depart.width / 2 - (arrivee.left + arrivee.width / 2);
    const dy = depart.top + depart.height / 2 - (arrivee.top + arrivee.height / 2);
    const s = depart.width / arrivee.width;
    el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(-25deg)` }, { transform: 'none' }], {
      duration: 460,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const avant = document.activeElement as HTMLElement | null;
    fermer.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      avant?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  const basculer = (extra: Extra) =>
    setSelection((prev) => (prev.some((e) => e.id === extra.id) ? prev.filter((e) => e.id !== extra.id) : [...prev, extra]));

  const prixUnitaire = produit.prix + selection.reduce((s, e) => s + e.prix, 0);
  const total = prixUnitaire * quantite;

  const ajouter = () => {
    if (!produit.disponible) return;
    const nomComplet = selection.length > 0 ? `${produit.nom} (${selection.map((s) => s.nom).join(', ')})` : produit.nom;
    addToCart(
      {
        ...produit,
        nom: nomComplet,
        prix: prixUnitaire,
        prixBase: produit.prix,
        extrasChoisis: selection.map((s) => ({ id: s.id, nom: s.nom, prix: s.prix })),
      },
      quantite,
    );
    confirmerAjout(quantite > 1 ? `${quantite} crêpes ajoutées` : 'Crêpe ajoutée');
    onClose();
  };

  // Partage d'une crêpe précise : le lien rouvre directement sa fiche.
  const partager = async () => {
    const lien = `${window.location.origin}/?produit=${produit.id}#carte`;
    const texte = `Celle-là me tente bien chez King Crêperie : ${produit.nom}, ${prixF(produit.prix)}.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: produit.nom, text: texte, url: lien });
      } catch {
        // partage annulé : rien à faire
      }
      return;
    }
    window.open(urlPartage(`${texte} ${lien}`), '_blank', 'noopener');
  };

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-kc-nuit/75 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        ref={feuille}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-produit"
        drag="y"
        dragControls={tirer}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 650) onClose();
        }}
        initial={{ y: 70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 32, stiffness: 340 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-3xl max-h-[calc(100dvh-3rem)] sm:max-h-[min(40rem,calc(100dvh-3rem))] flex flex-col sm:flex-row overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] bg-kc-lait text-kc-encre shadow-[0_-20px_60px_-30px_rgba(0,0,0,0.6)]"
      >
        {/* Le morceau de plaque */}
        <div
          onPointerDown={saisir}
          className="relative shrink-0 h-36 sm:h-auto sm:w-[44%] bg-kc-indigo touch-none sm:touch-auto flex sm:items-center justify-center"
        >
          <span
            aria-hidden
            className="sm:hidden absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1.5 rounded-full bg-kc-beurre/30"
          />
          {/* Repli : origine à 48 px du haut, de sorte qu'à l'échelle 0,5
              le bas de la photo arrive pile au bord de l'en-tête (144 px). */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-20 w-52 h-52 origin-[50%_48px] [scale:calc(1-0.5*var(--repli,0))] sm:static sm:translate-x-0 sm:w-[80%] sm:h-auto sm:aspect-square sm:[scale:1] z-10">
            <div
              ref={photo}
              className="w-full h-full rounded-full bg-kc-nuit p-2.5 shadow-[0_22px_44px_-18px_rgba(0,0,0,0.75)]"
            >
              <div className="relative w-full h-full rounded-full overflow-hidden bg-kc-indigo">
                {produit.image_url && (
                  <Image
                    src={produit.image_url}
                    alt=""
                    fill
                    unoptimized
                    sizes="(min-width: 640px) 320px, 208px"
                    className="object-cover"
                  />
                )}
              </div>
            </div>
          </div>
          <button
            ref={fermer}
            onClick={onClose}
            aria-label="Fermer la fiche"
            className="appui absolute top-3 right-3 w-11 h-11 rounded-full bg-kc-nuit/60 text-kc-beurre flex items-center justify-center z-20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <div onScroll={replier} className="overflow-y-auto overscroll-contain px-6 pt-24 sm:pt-8 pb-4">
            <h3 id="titre-produit" className="text-[1.7rem] leading-tight font-extrabold text-center sm:text-left text-balance">
              {produit.nom}
            </h3>
            {produit.description && (
              <p className="mt-2 text-center sm:text-left text-base text-kc-encre/70 leading-relaxed">{produit.description}</p>
            )}
            <div className="mt-3 flex items-center justify-center sm:justify-between gap-4">
              <span className="prix text-2xl text-kc-bissap">{prixF(produit.prix)}</span>
              <button
                type="button"
                onClick={() => void partager()}
                className="appui inline-flex items-center gap-1.5 text-sm font-semibold text-kc-indigo px-3 py-2 rounded-full hover:bg-kc-indigo/5"
              >
                <Share2 className="w-4 h-4" /> Partager cette crêpe
              </button>
            </div>

            {extras.length > 0 && (
              <fieldset className="mt-6">
                <legend className="text-base font-semibold">
                  Extras <span className="font-normal text-kc-encre/55">(facultatif)</span>
                </legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {extras.map((extra) => {
                    const actif = selection.some((s) => s.id === extra.id);
                    return (
                      <button
                        key={extra.id}
                        type="button"
                        aria-pressed={actif}
                        onClick={() => basculer(extra)}
                        className={`appui inline-flex items-center gap-1.5 pl-3 pr-3.5 py-2.5 rounded-2xl text-sm font-semibold border-2 ${
                          actif
                            ? 'bg-kc-bissap border-kc-bissap text-white'
                            : 'bg-white border-kc-ligne text-kc-encre hover:border-kc-encre/30'
                        }`}
                      >
                        {actif ? <Check className="w-4 h-4" strokeWidth={3} /> : <Plus className="w-4 h-4" />}
                        {extra.nom}
                        <span className={`prix ${actif ? 'text-white/85' : 'text-kc-encre/55'}`}>+{prixF(extra.prix)}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="mt-6 flex items-center justify-between">
              <span className="text-base font-semibold">Quantité</span>
              <div className="flex items-center gap-1 bg-white border border-kc-ligne rounded-full p-1">
                <button
                  type="button"
                  aria-label="Une de moins"
                  onClick={() => setQuantite((q) => Math.max(1, q - 1))}
                  className="appui w-11 h-11 rounded-full hover:bg-kc-encre/5 flex items-center justify-center"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <output className="w-8 text-center prix text-xl" aria-live="polite">
                  {quantite}
                </output>
                <button
                  type="button"
                  aria-label="Une de plus"
                  onClick={() => setQuantite((q) => Math.min(20, q + 1))}
                  className="appui w-11 h-11 rounded-full hover:bg-kc-encre/5 flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-kc-ligne">
            <button
              type="button"
              onClick={ajouter}
              disabled={!produit.disponible}
              className="appui w-full bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold py-4 px-6 rounded-full flex items-center justify-between disabled:opacity-50"
            >
              <span>{produit.disponible ? 'Ajouter au panier' : 'Indisponible'}</span>
              <span className="prix text-xl">{prixF(total)}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
