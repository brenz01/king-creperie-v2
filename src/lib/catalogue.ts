import { supabase } from '@/lib/supabase';
import type { Produit } from '@/types';
import { EXTRAS_SECOURS, type Extra } from '@/lib/extras';

// Lecture publique du catalogue (clé anon, RLS : produits/extras
// lisibles par tous). Utilisée côté serveur (rendu initial, SEO) et
// côté client (rafraîchissement silencieux du stock).
export async function chargerProduits(): Promise<Produit[] | null> {
  const { data, error } = await supabase
    .from('produits')
    .select('id, nom, description, prix, categorie, image_url, disponible, stock_gere, stock_quantite')
    .order('categorie', { ascending: true })
    .order('nom', { ascending: true });
  if (error) {
    console.error('Erreur chargement produits:', error.message);
    return null;
  }
  return data as Produit[];
}

export async function chargerExtras(): Promise<Extra[]> {
  const { data, error } = await supabase
    .from('extras')
    .select('id, nom, prix')
    .eq('actif', true)
    .order('prix', { ascending: true });
  if (error || !data || data.length === 0) return [...EXTRAS_SECOURS];
  return data as Extra[];
}
