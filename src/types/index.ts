export type CategorieProduit = 'salee' | 'sucree' | 'boisson';
export type StatutCommande = 'recue' | 'en_preparation' | 'en_livraison' | 'livree' | 'annulee';

export interface ExtraChoisi {
  id: string;
  nom: string;
  prix: number;
}

export interface Produit {
  id: string;
  nom: string;
  description?: string;
  prix: number;
  categorie: CategorieProduit;
  image_url?: string;
  disponible: boolean;
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
  extras: ExtraChoisi[]; // obligatoire, tableau vide si aucun extra
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