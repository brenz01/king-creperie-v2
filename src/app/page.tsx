import HeroSection from '@/components/HeroSection';
import MenuSection from '@/components/MenuSection';
import { chargerExtras, chargerProduits } from '@/lib/catalogue';

// ISR : la carte est rendue côté serveur (indexable, affichée sans
// spinner) et régénérée au plus toutes les 60 s. Le stock exact est
// rafraîchi côté client au montage.
export const revalidate = 60;

// Catalogue illisible (Supabase injoignable, erreur PostgREST) : on lève
// une erreur au lieu de générer une page sans carte, qui serait mise en
// cache comme une page valide.
// - Régénération ISR : Next.js garde et sert la dernière page valide, puis
//   retente à la requête suivante (docs Next 16, Incremental Static
//   Regeneration, gestion des erreurs).
// - Build : la génération de « / » échoue, donc le build échoue, au lieu
//   de déployer un accueil sans catalogue.
// La cause précise est journalisée juste avant par chargerProduits().
export default async function HomePage() {
  const [produits, extras] = await Promise.all([chargerProduits(), chargerExtras()]);
  if (produits === null) {
    throw new Error(
      'Catalogue indisponible : lecture des produits Supabase en échec, page « / » non générée (voir « Erreur chargement produits »).',
    );
  }
  return (
    <>
      <HeroSection />
      <MenuSection produitsInitiaux={produits} extrasInitiaux={extras} />
    </>
  );
}
