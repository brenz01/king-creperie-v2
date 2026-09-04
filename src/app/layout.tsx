import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import SmoothScrollProvider from '@/components/SmoothScrollProvider';
import { CartProvider } from '@/context/CartContext';
import Navbar from '@/components/Navbar';
import FloatingCartBar from '@/components/FloatingCartBar';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-serif' });

export const metadata: Metadata = {
  title: 'King Crêperie 👑 | Les meilleures crêpes de Dakar',
  description: 'Crêperie gourmande aux Almadies. Livraison à domicile et commandes en ligne.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`scroll-smooth ${inter.variable} ${playfair.variable}`}>
      <body className="bg-brand-cream text-brand-chocolate font-sans antialiased selection:bg-amber-500 selection:text-white min-h-screen">
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