import type { Metadata } from 'next';

// Espace staff : jamais indexé. (La protection réelle des données
// reste la RLS côté Supabase ; ceci évite juste l'exposition SEO.)
export const metadata: Metadata = {
  title: 'Espace staff',
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
