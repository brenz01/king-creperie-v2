'use client';

import { supabase } from '@/lib/supabase';
import { genererUuid } from '@/lib/uuid';

// Photos des produits : bucket public « produits » de Supabase Storage.
// Le dépôt, le remplacement et la suppression sont réservés au staff
// (policies de la migration 20261017200000_gestion_carte.sql).
export const BUCKET_PHOTOS = 'produits';
const COTE_MAX = 1200; // px, côté le plus long : net sur la fiche, léger sur mobile
const QUALITE = 0.82;
export const POIDS_MAX = 5 * 1024 * 1024; // limite du bucket
const PREFIXE = 'carte/'; // photos déposées depuis KC Staff

/**
 * Réduit une photo (souvent 4 à 12 Mo sortie de téléphone) en WebP de
 * 1 200 px au plus, ce qui donne quelques centaines de Ko. Orientation
 * EXIF respectée. Repli en JPEG si le navigateur ne sait pas encoder le WebP.
 */
export async function compresserPhoto(fichier: File): Promise<{ blob: Blob; type: string; extension: string }> {
  if (!fichier.type.startsWith('image/')) throw new Error('Ce fichier n’est pas une image.');
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Cet appareil ne sait pas lire cette photo. Choisissez une image JPG ou PNG.');
  }
  const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const l = Math.round(image.width * echelle);
  const h = Math.round(image.height * echelle);
  const toile = document.createElement('canvas');
  toile.width = l;
  toile.height = h;
  const ctx = toile.getContext('2d');
  if (!ctx) throw new Error('Impossible de préparer la photo sur cet appareil.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, l, h);
  image.close();

  const encoder = (type: string) => new Promise<Blob | null>((ok) => toile.toBlob(ok, type, QUALITE));
  let blob = await encoder('image/webp');
  let type = 'image/webp';
  if (!blob || blob.type !== 'image/webp') {
    blob = await encoder('image/jpeg');
    type = 'image/jpeg';
  }
  if (!blob) throw new Error('Impossible de préparer la photo sur cet appareil.');
  if (blob.size > POIDS_MAX) throw new Error('Photo trop lourde, même réduite. Essayez une autre image.');
  return { blob, type, extension: type === 'image/webp' ? 'webp' : 'jpg' };
}

/** Dépose la photo et renvoie son adresse publique. */
export async function deposerPhoto(photo: { blob: Blob; type: string; extension: string }): Promise<string> {
  const chemin = `${PREFIXE}${genererUuid()}.${photo.extension}`;
  const { error } = await supabase.storage.from(BUCKET_PHOTOS).upload(chemin, await photo.blob.arrayBuffer(), {
    contentType: photo.type,
    cacheControl: '31536000', // nom unique par dépôt : mise en cache sans risque
    upsert: false,
  });
  if (error) throw new Error(`La photo n’a pas pu être envoyée (${error.message}).`);
  return supabase.storage.from(BUCKET_PHOTOS).getPublicUrl(chemin).data.publicUrl;
}

/**
 * Chemin dans le bucket d'une photo déposée depuis KC Staff, sinon null.
 * Les photos d'origine (déposées à la main dans Supabase) ne sont jamais
 * supprimées automatiquement.
 */
export function cheminPhotoStaff(url: string | null | undefined): string | null {
  if (!url) return null;
  const marque = `/storage/v1/object/public/${BUCKET_PHOTOS}/`;
  const i = url.indexOf(marque);
  if (i < 0) return null;
  const chemin = decodeURIComponent(url.slice(i + marque.length).split('?')[0]);
  return chemin.startsWith(PREFIXE) ? chemin : null;
}

/** Supprime une photo déposée depuis KC Staff (sans effet sur les autres). Ne lève jamais. */
export async function supprimerPhotoStaff(url: string | null | undefined): Promise<void> {
  const chemin = cheminPhotoStaff(url);
  if (!chemin) return;
  await supabase.storage.from(BUCKET_PHOTOS).remove([chemin]).catch(() => undefined);
}
