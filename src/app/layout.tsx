import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'NEXUS Terminal | Crypto Market Intelligence',
    description: 'Professional, real-time, multi-exchange crypto market terminal for serious traders and analysts.',
    keywords: ['crypto', 'trading', 'terminal', 'bitcoin', 'ethereum', 'market data', 'orderbook'],
    authors: [{ name: 'NEXUS Terminal' }],
    openGraph: {
        title: 'NEXUS Terminal',
        description: 'Bloomberg-grade crypto market intelligence terminal',
        type: 'website',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
