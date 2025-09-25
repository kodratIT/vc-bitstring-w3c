import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/app/components/Navbar';

export const metadata: Metadata = {
  title: 'VC Bitstring Status List Simulator',
  description:
    'Demo Next.js yang memvisualisasikan penerbitan, validasi, dan pencabutan Verifiable Credential dengan Status List Bitstring.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-900 text-slate-200">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
