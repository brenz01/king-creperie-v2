import type { Metadata, Viewport } from 'next';
import { inter, fraunces } from './fonts';
import SmoothScrollProvider from '@/components/SmoothScrollProvider';
import { CartProvider } from '@/context/CartContext';
import Navbar from '@/components/Navbar';
import FloatingCartBar from '@/components/FloatingCartBar';
import PwaProvider from '@/components/pwa/PwaProvider';
import CommandePanel from '@/components/commande/CommandePanel';
import ToastZone from '@/components/ToastZone';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

const TITRE = 'King Crêperie : crêpes livrées à Dakar';
const DESCRIPTION = 'Crêperie gourmande aux Almadies. Commandez en ligne, livraison à domicile à Dakar et suivi en direct.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITRE, template: '%s | King Crêperie' },
  description: DESCRIPTION,
  applicationName: 'King Crêperie',
  appleWebApp: {
    capable: true,
    title: 'King Crêperie',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'fr_SN',
    siteName: 'King Crêperie',
    title: TITRE,
    description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: TITRE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: '#FBF3E7',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="bg-brand-cream text-brand-chocolate font-sans antialiased selection:bg-amber-600 selection:text-white min-h-screen">
        <PwaProvider>
          <CartProvider>
            <SmoothScrollProvider>
              <Navbar />
              <main>{children}</main>
              <FloatingCartBar />
              <CommandePanel />
              <ToastZone />
            </SmoothScrollProvider>
          </CartProvider>
        </PwaProvider>
      </body>
    </html>
  );
}
