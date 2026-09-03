export type CategorieProduit = 'salee' | 'sucree' | 'boisson';
export type StatutCommande = 'recue' | 'en_preparation' | 'en_livraison' | 'livree' | 'annulee';

export interface Produit {
  id: string;
  nom: string;
  description?: string;
  prix: number;
  categorie: CategorieProduit;
  image_url?: string;
  disponible: boolean;
}

export interface CommandeItem {
  id?: string;
  commande_id?: string;
  produit_id: string;
  nom_produit: string;
  quantite: number;
  prix_unitaire: number;
}

export interface Commande {
  id: string;
  created_at: string;
  client_nom: string;
  client_telephone: string;
  adresse_livraison: string;
  creneau_souhaite?: string;
  total: number;
  statut: StatutCommande;
  commande_items?: CommandeItem[];
}