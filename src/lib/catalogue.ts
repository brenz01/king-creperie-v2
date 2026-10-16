import { supabase } from '@/lib/supabase';
import type { Produit } from '@/types';
import { EXTRAS_SECOURS, type Extra } from '@/lib/extras';
import type { Boutique } from '@/lib/horaires';

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

// Horaires et pause des commandes. null si la table n'existe pas encore
// (migration non exécutée) : on considère alors la boutique ouverte.
export async function chargerBoutique(): Promise<Boutique | null> {
  const { data, error } = await supabase
    .from('boutique')
    .select('horaires, fermeture_exceptionnelle, message_fermeture')
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) return null;
  return data as Boutique;
}
