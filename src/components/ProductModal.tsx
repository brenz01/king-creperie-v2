'use client';

import { useEffect, useRef, useState } from 'react';
import type { Produit } from '@/types';
import type { Extra } from '@/lib/extras';
import { useCart } from '@/context/CartContext';
import { motion } from 'framer-motion';
import { X, Plus, Minus, Check, Share2 } from 'lucide-react';
import Image from 'next/image';
import { confirmerAjout } from '@/lib/toast';
import { urlPartage } from '@/lib/whatsapp';
import { prixF } from '@/lib/produit';
import { useFocusPiege } from '@/lib/useFocusPiege';
import InfoBulle from './ui/InfoBulle';

interface ProductModalProps {
  produit: Produit;
  extras: readonly Extra[];
  onClose: () => void;
}

// Fiche produit : feuille qui monte du bas sur téléphone, fenêtre centrée
// sur ordinateur, sur un voile cacao flouté. Extras, quantité, et un seul
// bouton qui affiche le total.
export default function ProductModal({ produit, extras, onClose }: ProductModalProps) {
  const { addToCart } = useCart();
  const [selection, setSelection] = useState<Extra[]>([]);
  const [quantite, setQuantite] = useState(1);
  const fermer = useRef<HTMLButtonElement>(null);
  const fenetre = useRef<HTMLDivElement>(null);
  useFocusPiege(fenetre);

  // Échap pour fermer, page derrière figée, focus rendu en sortant.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    fermer.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
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
      className="kc-fondu fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-950/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        ref={fenetre}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-produit"
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[90dvh] overflow-y-auto overscroll-contain shadow-2xl flex flex-col"
      >
        <div className="relative h-52 w-full bg-stone-100 shrink-0">
          {produit.image_url && (
            <Image src={produit.image_url} alt={produit.nom} fill unoptimized sizes="512px" className="object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
          <span className="absolute top-3 right-3">
            <InfoBulle libelle="Fermer la fiche" cote="gauche">
              <button
                ref={fermer}
                onClick={onClose}
                aria-label="Fermer la fiche"
                className="appui w-11 h-11 bg-white border border-stone-900/10 rounded-full text-stone-800 flex items-center justify-center shadow-[0_4px_12px_-4px_rgba(0,0,0,0.25)]"
              >
                <X className="w-5 h-5" />
              </button>
            </InfoBulle>
          </span>
        </div>

        <div className="p-6 space-y-6 flex-1">
          <div>
            <div className="flex items-start justify-between gap-4">
              <h3 id="titre-produit" className="font-serif text-2xl font-semibold text-stone-900 leading-tight">
                {produit.nom}
              </h3>
              <span className="prix text-xl text-amber-800 shrink-0 pt-0.5">{prixF(produit.prix)}</span>
            </div>
            {produit.description && <p className="text-base text-stone-600 mt-2 leading-relaxed">{produit.description}</p>}
            <button
              type="button"
              onClick={() => void partager()}
              className="appui mt-3 inline-flex items-center gap-1.5 min-h-11 text-sm font-semibold text-stone-700 hover:text-amber-800 border border-stone-200 hover:border-amber-700 px-3.5 rounded-lg transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" /> Partager cette crêpe
            </button>
          </div>

          {extras.length > 0 && (
            <fieldset>
              <legend className="block text-base font-semibold text-stone-900 mb-3">
                Extras gourmands <span className="font-normal text-stone-600">(facultatif)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {extras.map((extra) => {
                  const actif = selection.some((s) => s.id === extra.id);
                  return (
                    <button
                      key={extra.id}
                      type="button"
                      aria-pressed={actif}
                      onClick={() => basculer(extra)}
                      className={`appui flex items-center gap-2 px-3.5 min-h-11 rounded-lg text-sm font-semibold transition-colors ${
                        actif ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {actif && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      <span>{extra.nom}</span>
                      <span className={actif ? 'text-stone-300' : 'text-stone-600'}>+{prixF(extra.prix)}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-stone-200">
            <span className="text-sm font-semibold text-stone-700">Quantité</span>
            <div className="flex items-center gap-3 bg-stone-100 p-1 rounded-lg">
              <button
                type="button"
                aria-label="Une de moins"
                onClick={() => setQuantite((q) => Math.max(1, q - 1))}
                className="appui w-11 h-11 rounded-md bg-white text-stone-800 flex items-center justify-center border border-stone-200 hover:bg-stone-50"
              >
                <Minus className="w-4 h-4" />
              </button>
              <output className="w-6 text-center font-semibold text-stone-900 tabular-nums" aria-live="polite">
                {quantite}
              </output>
              <button
                type="button"
                aria-label="Une de plus"
                onClick={() => setQuantite((q) => Math.min(20, q + 1))}
                className="appui w-11 h-11 rounded-md bg-white text-stone-800 flex items-center justify-center border border-stone-200 hover:bg-stone-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 p-6 bg-stone-50 border-t border-stone-200 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={ajouter}
            disabled={!produit.disponible}
            className="appui w-full bg-stone-900 hover:bg-amber-700 text-white font-semibold py-4 rounded-xl flex items-center justify-between px-6 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{produit.disponible ? 'Ajouter au panier' : 'Indisponible'}</span>
            <motion.span
              key={total}
              initial={{ opacity: 0.4, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="prix bg-white/15 px-3 py-1 rounded-lg text-sm"
            >
              {prixF(total)}
            </motion.span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
