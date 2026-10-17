export type CategorieProduit = 'salee' | 'sucree' | 'gaufre' | 'boisson' | 'autre';
export type StatutCommande = 'recue' | 'en_preparation' | 'en_livraison' | 'livree' | 'annulee';

export interface ExtraChoisi {
  id: string;
  nom: string;
  prix: number;
}

export interface Produit {
  id: string;
  nom: string;
  description?: string | null;
  prix: number;
  categorie: CategorieProduit;
  image_url?: string | null;
  disponible: boolean;
  stock_gere?: boolean;
  stock_quantite?: number | null;
  // Champs transitoires côté panier uniquement (jamais en base sur `produits`)
  extrasChoisis?: ExtraChoisi[];
  prixBase?: number;
}

export interface CommandeItem {
  id?: string;
  commande_id?: string;
  produit_id: string;
  nom_produit: string;
  quantite: number;
  prix_unitaire: number;
  extras: ExtraChoisi[];
}

export interface Commande {
  id: string;
  created_at: string;
  client_nom: string;
  client_telephone: string;
  adresse_livraison: string;
  creneau_souhaite?: string | null;
  total: number;
  statut: StatutCommande;
  commande_items?: CommandeItem[];
}

export const LIBELLE_STATUT: Record<StatutCommande, string> = {
  recue: 'Commande reçue',
  en_preparation: 'En préparation',
  en_livraison: 'En livraison',
  livree: 'Livrée',
  annulee: 'Annulée',
};
