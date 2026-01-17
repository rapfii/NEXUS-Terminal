/**
 * Live Ticker Bar - Scrolling prices at top
 * Always visible with fallback data
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useTranslation, formatPrice, formatPercent } from '@/lib/i18n';
import styles from './TickerBar.module.css';

interface TickerData {
    symbol: string;
    price: number;
    change24h: number;
}

// Fallback data - will be replaced when API loads
const FALLBACK_TICKERS: TickerData[] = [
    { symbol: 'BTC', price: 96000, change24h: 2.5 },
    { symbol: 'ETH', price: 3400, change24h: 1.8 },
    { symbol: 'SOL', price: 180, change24h: 4.2 },
    { symbol: 'BNB', price: 680, change24h: 0.9 },
    { symbol: 'XRP', price: 2.1, change24h: 3.1 },
    { symbol: 'DOGE', price: 0.35, change24h: -1.2 },
    { symbol: 'ADA', price: 0.95, change24h: 2.1 },
    { symbol: 'AVAX', price: 38, change24h: 1.5 },
    { symbol: 'DOT', price: 7.2, change24h: -0.8 },
    { symbol: 'MATIC', price: 0.48, change24h: 1.1 },
    { symbol: 'LINK', price: 22, change24h: 2.8 },
    { symbol: 'LTC', price: 105, change24h: 0.5 },
];

export function TickerBar() {
    const { locale } = useTranslation();
    // Start with fallback data so ticker is always visible
    const [tickers, setTickers] = useState<TickerData[]>(FALLBACK_TICKERS);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;

        const fetchTickers = async () => {
            try {
                const res = await fetch('/api/macro?type=movers');
                const data = await res.json();

                if (isMounted.current && data.data?.gainers && data.data?.losers) {
                    const all = [...data.data.gainers, ...data.data.losers];
                    const newTickers = all.slice(0, 12).map((t: { symbol: string; price: number; change24h: number }) => ({
                        symbol: t.symbol,
                        price: t.price,
                        change24h: t.change24h,
                    }));

                    if (newTickers.length > 0) {
                        setTickers(newTickers);
                    }
                }
            } catch (e) {
                // Keep using current data on error
                console.error('Ticker fetch error:', e);
            }
        };

        // Fetch immediately
        fetchTickers();

        // Then refresh every 30 seconds
        const interval = setInterval(fetchTickers, 30000);

        return () => {
            isMounted.current = false;
            clearInterval(interval);
        };
    }, []);

    // Duplicate tickers for seamless infinite scroll
    const displayTickers = [...tickers, ...tickers, ...tickers];

    return (
        <div className={styles.tickerBar}>
            <div className={styles.tickerTrack}>
                <div className={styles.tickerContent}>
                    {displayTickers.map((t, i) => (
                        <div key={`${t.symbol}-${i}`} className={styles.tickerItem}>
                            <span className={styles.symbol}>{t.symbol}</span>
                            <span className={styles.price}>${formatPrice(t.price, locale)}</span>
                            <span className={`${styles.change} ${t.change24h >= 0 ? styles.positive : styles.negative}`}>
                                {t.change24h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {formatPercent(Math.abs(t.change24h))}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default TickerBar;
