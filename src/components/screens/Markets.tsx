'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatLargeNumber, formatPrice } from '@/lib/i18n';
import { useLanguageStore, useMarketStore } from '@/stores';
import {
    Circle,
    Zap,
    BarChart2,
    TrendingUp,
    TrendingDown,
    Minus,
    ChevronUp,
    ChevronDown,
    Flame
} from 'lucide-react';
import styles from './Markets.module.css';

interface Ticker {
    symbol: string;
    price: number;
    bid: number;
    ask: number;
    spread: number;
    spreadBps: number;
    volume24h: number;
    change24h: number;
    fundingRate?: number;
    markPrice?: number;
}

type SortKey = 'symbol' | 'price' | 'change24h' | 'volume24h' | 'spreadBps' | 'fundingRate' | 'relativeStrength';
type SmartFilter = 'all' | 'accumulated' | 'distributed' | 'squeeze_candidates' | 'volume_surge';

export function Markets() {
    const { locale } = useLanguageStore();
    const { setSymbol, setExchange, setMarketType } = useMarketStore();
    const [tickers, setTickers] = useState<Ticker[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [marketMode, setMarketMode] = useState<'futures' | 'spot'>('futures');
    const [sort, setSort] = useState<{ col: SortKey; asc: boolean }>({ col: 'volume24h', asc: false });
    const [smartFilter, setSmartFilter] = useState<SmartFilter>('all');

    useEffect(() => {
        const fetchMarkets = async () => {
            try {
                const res = await fetch(`/api/markets?type=${marketMode}`);
                const d = await res.json();
                if (d.data) setTickers(d.data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchMarkets();
        const iv = setInterval(fetchMarkets, 5000);
        return () => clearInterval(iv);
    }, [marketMode]);

    // Calculate BTC benchmark for relative strength
    const btcChange = useMemo(() => {
        const btc = tickers.find(t => t.symbol === 'BTCUSDT');
        return btc?.change24h || 0;
    }, [tickers]);

    // Enhanced tickers with relative strength
    const enhancedTickers = useMemo(() => {
        const avgVolume = tickers.reduce((acc, t) => acc + t.volume24h, 0) / (tickers.length || 1);

        return tickers.map(t => ({
            ...t,
            relativeStrength: t.change24h - btcChange,
            volumeRatio: t.volume24h / avgVolume,
            isAccumulated: (t.change24h - btcChange) > 2 && t.volume24h > avgVolume,
            isDistributed: (t.change24h - btcChange) < -2 && t.volume24h > avgVolume,
            isSqueezeCandidate: marketMode === 'futures' && (
                ((t.fundingRate || 0) > 0.0003 && t.change24h < 0) || // Longs paying but price down
                ((t.fundingRate || 0) < -0.0002 && t.change24h > 0)   // Shorts paying but price up
            ),
            isVolumeSurge: t.volume24h > avgVolume * 3,
        }));
    }, [tickers, btcChange, marketMode]);

    // Calculate Max Values for Heat Bars
    const maxVals = useMemo(() => {
        return {
            vol: Math.max(...enhancedTickers.map(t => t.volume24h), 1),
            funding: Math.max(...enhancedTickers.map(t => Math.abs(t.fundingRate || 0)), 0.0001),
            rel: Math.max(...enhancedTickers.map(t => Math.abs(t.relativeStrength)), 1),
        };
    }, [enhancedTickers]);

    // Apply smart filters
    const filtered = useMemo(() => {
        let items = enhancedTickers.filter(x =>
            x.symbol.toLowerCase().includes(search.toLowerCase())
        );

        switch (smartFilter) {
            case 'accumulated': items = items.filter(x => x.isAccumulated); break;
            case 'distributed': items = items.filter(x => x.isDistributed); break;
            case 'squeeze_candidates': items = items.filter(x => x.isSqueezeCandidate); break;
            case 'volume_surge': items = items.filter(x => x.isVolumeSurge); break;
        }

        items.sort((a, b) => {
            const vA = a[sort.col as keyof typeof a] ?? 0;
            const vB = b[sort.col as keyof typeof b] ?? 0;
            if (typeof vA === 'string' && typeof vB === 'string') {
                return sort.asc ? vA.localeCompare(vB) : vB.localeCompare(vA);
            }
            return sort.asc ? (vA as number) - (vB as number) : (vB as number) - (vA as number);
        });

        return items;
    }, [enhancedTickers, search, sort, smartFilter]);

    const handleSort = (col: SortKey) => {
        setSort(p => ({ col, asc: p.col === col ? !p.asc : false }));
    };

    const handleSelect = (symbol: string) => {
        setExchange('binance');
        setMarketType(marketMode === 'futures' ? 'perpetual' : 'spot');
        setSymbol(symbol);
    };

    // Stats
    const stats = useMemo(() => ({
        total: tickers.length,
        outperforming: enhancedTickers.filter(t => t.relativeStrength > 0).length,
        underperforming: enhancedTickers.filter(t => t.relativeStrength < 0).length,
        accumulated: enhancedTickers.filter(t => t.isAccumulated).length,
        distributed: enhancedTickers.filter(t => t.isDistributed).length,
        squeezeCandidates: enhancedTickers.filter(t => t.isSqueezeCandidate).length,
        volumeSurge: enhancedTickers.filter(t => t.isVolumeSurge).length,
    }), [tickers, enhancedTickers]);

    return (
        <div className={styles.container}>
            {/* CONTROLS */}
            <div className={styles.controls}>
                <div className={styles.tabs}>
                    <button className={`${styles.tab} ${marketMode === 'futures' ? styles.active : ''}`} onClick={() => setMarketMode('futures')}>FUTURES</button>
                    <button className={`${styles.tab} ${marketMode === 'spot' ? styles.active : ''}`} onClick={() => setMarketMode('spot')}>SPOT</button>
                </div>
                <div className={styles.smartFilters}>
                    <button className={`${styles.smartBtn} ${smartFilter === 'all' ? styles.active : ''}`} onClick={() => setSmartFilter('all')}>ALL ({stats.total})</button>
                    <button className={`${styles.smartBtn} ${styles.accBtn} ${smartFilter === 'accumulated' ? styles.active : ''}`} onClick={() => setSmartFilter('accumulated')}><Circle size={10} fill="currentColor" /> ACC ({stats.accumulated})</button>
                    <button className={`${styles.smartBtn} ${styles.distBtn} ${smartFilter === 'distributed' ? styles.active : ''}`} onClick={() => setSmartFilter('distributed')}><Circle size={10} fill="currentColor" /> DIST ({stats.distributed})</button>
                    {marketMode === 'futures' && (
                        <button className={`${styles.smartBtn} ${styles.squeezeBtn} ${smartFilter === 'squeeze_candidates' ? styles.active : ''}`} onClick={() => setSmartFilter('squeeze_candidates')}><Zap size={10} fill="currentColor" /> SQZ ({stats.squeezeCandidates})</button>
                    )}
                    <button className={`${styles.smartBtn} ${styles.volBtn} ${smartFilter === 'volume_surge' ? styles.active : ''}`} onClick={() => setSmartFilter('volume_surge')}><BarChart2 size={12} /> VOL ({stats.volumeSurge})</button>
                </div>
                <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className={styles.search} />
                <div className={styles.benchmark}>BTC: <span className={btcChange >= 0 ? styles.pos : styles.neg}>{btcChange >= 0 ? '+' : ''}{btcChange.toFixed(2)}%</span></div>
            </div>

            {/* ROTATION SUMMARY */}
            <div className={styles.rotationBar}>
                <div className={styles.rotationItem}><span className={styles.rotationLabel}>OUTPERFORMING</span><span className={styles.pos}>{stats.outperforming}</span></div>
                <div className={styles.rotationItem}><span className={styles.rotationLabel}>UNDERPERFORMING</span><span className={styles.neg}>{stats.underperforming}</span></div>
                <div className={styles.rotationMeter}>
                    <div className={styles.rotationFill} style={{ width: `${(stats.outperforming / (stats.total || 1)) * 100}%` }} />
                </div>
                <span className={styles.rotationConclusion}>
                    {stats.outperforming > stats.underperforming * 1.3 ? <><TrendingUp size={14} /> ALTS LEADING</> : stats.underperforming > stats.outperforming * 1.3 ? <><TrendingDown size={14} /> BTC LEADING</> : <><Minus size={14} /> BALANCED</>}
                </span>
            </div>

            {/* TABLE */}
            <div className={styles.tableRef}>
                <div className={styles.header}>
                    <div className={styles.cell} onClick={() => handleSort('symbol')}>SYMBOL {sort.col === 'symbol' && (sort.asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                    <div className={styles.cell} onClick={() => handleSort('price')}>PRICE {sort.col === 'price' && (sort.asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                    <div className={styles.cell}>BID/ASK</div>
                    <div className={styles.cell} onClick={() => handleSort('spreadBps')}>SPREAD {sort.col === 'spreadBps' && (sort.asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                    {marketMode === 'futures' && <div className={styles.cell} onClick={() => handleSort('fundingRate')}>FUNDING {sort.col === 'fundingRate' && (sort.asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>}
                    <div className={styles.cell} onClick={() => handleSort('change24h')}>24H % {sort.col === 'change24h' && (sort.asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                    <div className={styles.cell} onClick={() => handleSort('relativeStrength')}>vs BTC {sort.col === 'relativeStrength' && (sort.asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                    <div className={styles.cell} onClick={() => handleSort('volume24h')}>VOLUME {sort.col === 'volume24h' && (sort.asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                    <div className={styles.cell}>SIGNAL</div>
                </div>
                <div className={styles.body}>
                    {loading ? <div className={styles.loading}>Scanning Markets...</div> : filtered.map(t => (
                        <div key={t.symbol} className={`${styles.row} ${t.isAccumulated ? styles.accRow : ''} ${t.isDistributed ? styles.distRow : ''}`} onClick={() => handleSelect(t.symbol)}>
                            <div className={styles.cell}><b>{t.symbol.replace('USDT', '')}</b><small>/USDT</small></div>
                            <div className={styles.cell}><span className={styles.priceSecondary}>${formatPrice(t.price, locale)}</span></div>
                            <div className={styles.cell}><span className={styles.bidask}><span className={styles.bid}>{formatPrice(t.bid, locale)}</span><span className={styles.divider}>/</span><span className={styles.ask}>{formatPrice(t.ask, locale)}</span></span></div>
                            <div className={styles.cell}><span className={styles.dim}>{t.spreadBps.toFixed(2)} bps</span></div>
                            {marketMode === 'futures' && (
                                <div className={styles.cell} style={{
                                    background: `linear-gradient(90deg, ${t.fundingRate! > 0 ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 81, 73, 0.15)'} ${(Math.abs(t.fundingRate || 0) / maxVals.funding) * 100}%, transparent 0%)`
                                }}>
                                    <span className={(t.fundingRate || 0) > 0.0001 ? styles.pos : (t.fundingRate || 0) < -0.0001 ? styles.neg : styles.neu}>{((t.fundingRate || 0) * 100).toFixed(4)}%</span>
                                </div>
                            )}
                            <div className={styles.cell}><span className={t.change24h >= 0 ? styles.pos : styles.neg}>{t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(2)}%</span></div>
                            <div className={styles.cell} style={{
                                background: `linear-gradient(90deg, ${t.relativeStrength > 0 ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 81, 73, 0.15)'} ${(Math.abs(t.relativeStrength) / maxVals.rel) * 100}%, transparent 0%)`
                            }}>
                                <span className={`${styles.relStrength} ${t.relativeStrength > 0 ? styles.pos : t.relativeStrength < 0 ? styles.neg : ''}`}>{t.relativeStrength > 0 ? '+' : ''}{t.relativeStrength.toFixed(2)}%</span>
                            </div>
                            <div className={styles.cell} style={{
                                background: `linear-gradient(90deg, rgba(230, 237, 243, 0.05) ${(t.volume24h / maxVals.vol) * 100}%, transparent 0%)`
                            }}>
                                <span>${formatLargeNumber(t.volume24h, locale)}</span>
                                {t.isVolumeSurge && <span className={styles.surgeBadge}><Flame size={12} fill="currentColor" /></span>}
                            </div>
                            <div className={styles.cell}>
                                {t.isAccumulated && <span className={styles.signalAcc}>ACC</span>}
                                {t.isDistributed && <span className={styles.signalDist}>DIST</span>}
                                {t.isSqueezeCandidate && <span className={styles.signalSqueeze}>SQZ</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
