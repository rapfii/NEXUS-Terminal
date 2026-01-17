'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatLargeNumber, formatPrice } from '@/lib/i18n';
import { useLanguageStore, useMarketStore } from '@/stores';
import { Star, X, Plus } from 'lucide-react';
import styles from './Watchlist.module.css';

interface MarketData {
    symbol: string;
    price: number;
    change24h: number;
    volume24h: number;
    bid: number;
    ask: number;
    fundingRate?: number;
}

export function Watchlist() {
    const { locale } = useLanguageStore();
    const {
        watchlist,
        removeFromWatchlist,
        addToWatchlist,
        setSymbol,
        setExchange,
        setMarketType,
        loadWatchlist,
    } = useMarketStore();
    const [marketData, setMarketData] = useState<Map<string, MarketData>>(new Map());
    const [loading, setLoading] = useState(true);
    const [addSymbol, setAddSymbol] = useState('');

    // Load watchlist on mount
    useEffect(() => {
        loadWatchlist();
    }, [loadWatchlist]);

    // Fetch market data for watched symbols
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/markets?type=futures');
                const d = await res.json();
                if (d.data) {
                    const map = new Map<string, MarketData>();
                    (d.data as MarketData[]).forEach(m => {
                        map.set(m.symbol, m);
                    });
                    setMarketData(map);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const iv = setInterval(fetchData, 5000);
        return () => clearInterval(iv);
    }, []);

    // Get data for watched items
    const watchedData = useMemo(() => {
        return watchlist.map(w => {
            const sym = w.symbol.includes('USDT') ? w.symbol : `${w.symbol}USDT`;
            const data = marketData.get(sym);
            return {
                ...w,
                data,
            };
        });
    }, [watchlist, marketData]);

    const handleAdd = () => {
        if (!addSymbol.trim()) return;
        const sym = addSymbol.toUpperCase().replace('USDT', '');
        addToWatchlist({
            exchange: 'binance',
            marketType: 'perpetual',
            symbol: sym,
        });
        setAddSymbol('');
    };

    const handleSelect = (symbol: string) => {
        setExchange('binance');
        setMarketType('perpetual');
        setSymbol(symbol.includes('USDT') ? symbol : `${symbol}USDT`);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span>YOUR WATCHLIST ({watchlist.length})</span>
                <div className={styles.addForm}>
                    <input
                        type="text"
                        placeholder="Add symbol (e.g., BTC)"
                        value={addSymbol}
                        onChange={e => setAddSymbol(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        className={styles.input}
                    />
                    <button onClick={handleAdd} className={styles.addBtn}><Plus size={12} /> ADD</button>
                </div>
            </div>

            {watchlist.length === 0 ? (
                <div className={styles.empty}>
                    <div className={styles.icon}><Star size={48} strokeWidth={1.5} /></div>
                    <h2>Your Watchlist is empty</h2>
                    <p>Add symbols using the input above, or use the star icon in Terminal/Markets.</p>
                    <div className={styles.suggestions}>
                        <span>Quick add:</span>
                        {['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'].map(s => (
                            <button
                                key={s}
                                onClick={() => addToWatchlist({ exchange: 'binance', marketType: 'perpetual', symbol: s })}
                                className={styles.suggBtn}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className={styles.grid}>
                    {loading && watchedData.every(w => !w.data) ? (
                        <div className={styles.loading}>Loading Prices...</div>
                    ) : watchedData.map(w => {
                        const d = w.data;
                        return (
                            <div key={w.symbol} className={styles.card} onClick={() => handleSelect(w.symbol)}>
                                <div className={styles.top}>
                                    <div className={styles.symbol}>{w.symbol}</div>
                                    <button
                                        className={styles.remove}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeFromWatchlist(w);
                                        }}
                                    ><X size={14} /></button>
                                </div>
                                {d ? (
                                    <>
                                        <div className={styles.mid}>
                                            <div className={styles.price}>${formatPrice(d.price, locale)}</div>
                                            <div className={d.change24h >= 0 ? styles.pos : styles.neg}>
                                                {d.change24h >= 0 ? '+' : ''}{d.change24h.toFixed(2)}%
                                            </div>
                                        </div>
                                        <div className={styles.bot}>
                                            <div className={styles.row}>
                                                <span>BID/ASK</span>
                                                <span>{formatPrice(d.bid, locale)} / {formatPrice(d.ask, locale)}</span>
                                            </div>
                                            <div className={styles.row}>
                                                <span>VOLUME</span>
                                                <span>${formatLargeNumber(d.volume24h, locale)}</span>
                                            </div>
                                            {d.fundingRate !== undefined && (
                                                <div className={styles.row}>
                                                    <span>FUNDING</span>
                                                    <span className={(d.fundingRate || 0) > 0 ? styles.pos : (d.fundingRate || 0) < 0 ? styles.neg : ''}>
                                                        {((d.fundingRate || 0) * 100).toFixed(4)}%
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className={styles.noData}>No data available</div>
                                )}
                                <div className={styles.exchange}>
                                    {w.exchange.toUpperCase()} · {w.marketType.toUpperCase()}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
