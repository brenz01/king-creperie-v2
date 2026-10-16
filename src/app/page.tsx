import HeroSection from '@/components/HeroSection';
import MenuSection from '@/components/MenuSection';
import { chargerExtras, chargerProduits } from '@/lib/catalogue';

// ISR : la carte est rendue côté serveur (indexable, affichée sans
// spinner) et régénérée au plus toutes les 60 s. Le stock exact est
// rafraîchi côté client au montage.
export const revalidate = 60;

export default async function HomePage() {
  const [produits, extras] = await Promise.all([chargerProduits(), chargerExtras()]);
  return (
    <>
      <HeroSection />
      <MenuSection produitsInitiaux={produits} extrasInitiaux={extras} />
    </>
  );
}
