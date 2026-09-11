import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import SmoothScrollProvider from '@/components/SmoothScrollProvider';
import { CartProvider } from '@/context/CartContext';
import Navbar from '@/components/Navbar';
import FloatingCartBar from '@/components/FloatingCartBar';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'King Crêperie 👑 | Les meilleures crêpes de Dakar',
  description: 'Crêperie gourmande aux Almadies. Livraison à domicile et commandes en ligne.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`scroll-smooth ${inter.variable} ${fraunces.variable}`}>
      <body className="bg-brand-cream text-brand-chocolate font-sans antialiased selection:bg-amber-600 selection:text-white min-h-screen">
        <CartProvider>
          <SmoothScrollProvider>
            <Navbar />
            <main>{children}</main>
            <FloatingCartBar />
          </SmoothScrollProvider>
        </CartProvider>
      </body>
    </html>
  );
}