'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatLargeNumber, formatPrice } from '@/lib/i18n';
import { useLanguageStore } from '@/stores';
import {
    Target,
    Flame,
    BarChart2,
    ChevronUp,
    ChevronDown,
    Circle,
    TrendingUp,
    TrendingDown
} from 'lucide-react';
import styles from './Derivatives.module.css';

interface FuturesTicker {
    symbol: string;
    price: number;
    markPrice: number;
    indexPrice: number;
    fundingRate: number;
    volume24h: number;
    change24h: number;
    spreadBps: number;
    openInterest?: number;
    oiChange24h?: number;
}

interface SqueezeSignal {
    symbol: string;
    type: 'LONG_SQUEEZE' | 'SHORT_SQUEEZE';
    strength: 'LOADING' | 'IMMINENT';
    funding: number;
    change24h: number;
    reason: string;
}

// Options data from Deribit
interface OptionsData {
    currency: string;
    indexPrice: number;
    putCallRatio: number;
    totalCallOI: number;
    totalPutOI: number;
    callOIDominance: number;
    atmIV: number;
    ivSkew: number;
    totalCallVolume: number;
    totalPutVolume: number;
    maxPainStrike: number;
}

function detectSqueezes(markets: FuturesTicker[]): SqueezeSignal[] {
    const signals: SqueezeSignal[] = [];

    for (const m of markets) {
        const fr = m.fundingRate || 0;
        const change = m.change24h;

        // Short squeeze: Negative funding (shorts paying) + sideways/up price
        if (fr < -0.0002 && change > -1) {
            signals.push({
                symbol: m.symbol,
                type: 'SHORT_SQUEEZE',
                strength: fr < -0.0005 ? 'IMMINENT' : 'LOADING',
                funding: fr,
                change24h: change,
                reason: `Shorts paying ${(Math.abs(fr) * 100).toFixed(3)}% while price stable`,
            });
        }

        // Long squeeze: High positive funding + sideways/down price
        if (fr > 0.0003 && change < 2) {
            signals.push({
                symbol: m.symbol,
                type: 'LONG_SQUEEZE',
                strength: fr > 0.0006 ? 'IMMINENT' : 'LOADING',
                funding: fr,
                change24h: change,
                reason: `Longs paying ${(fr * 100).toFixed(3)}% while price stalls`,
            });
        }
    }

    // Sort by strength and funding magnitude
    return signals.sort((a, b) => {
        if (a.strength !== b.strength) return a.strength === 'IMMINENT' ? -1 : 1;
        return Math.abs(b.funding) - Math.abs(a.funding);
    }).slice(0, 8);
}

type SortKey = 'symbol' | 'price' | 'fundingRate' | 'volume24h' | 'change24h' | 'openInterest';

export function Derivatives() {
    const { locale } = useLanguageStore();
    const [data, setData] = useState<FuturesTicker[]>([]);
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState<{ col: SortKey; asc: boolean }>({ col: 'volume24h', asc: false });
    const [filter, setFilter] = useState('');
    const [fundingView, setFundingView] = useState<'all' | 'long_paying' | 'short_paying' | 'extreme'>('all');

    // Options data state
    const [optionsData, setOptionsData] = useState<{ btc: OptionsData | null; eth: OptionsData | null } | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/markets?type=futures');
                const d = await res.json();
                if (d.data) setData(d.data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const iv = setInterval(fetchData, 10000);
        return () => clearInterval(iv);
    }, []);

    // Fetch options data
    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const res = await fetch('/api/deribit/options');
                const d = await res.json();
                if (d.success && d.data) {
                    setOptionsData(d.data);
                }
            } catch (e) {
                console.error('Options fetch error:', e);
            }
        };

        fetchOptions();
        const iv = setInterval(fetchOptions, 60000); // Options update slower
        return () => clearInterval(iv);
    }, []);

    const filtered = useMemo(() => {
        let items = data.filter(d =>
            d.symbol.toLowerCase().includes(filter.toLowerCase())
        );

        // Funding filter
        if (fundingView === 'long_paying') {
            items = items.filter(d => (d.fundingRate || 0) > 0.0001);
        } else if (fundingView === 'short_paying') {
            items = items.filter(d => (d.fundingRate || 0) < -0.0001);
        } else if (fundingView === 'extreme') {
            items = items.filter(d => Math.abs(d.fundingRate || 0) > 0.0003);
        }

        items.sort((a, b) => {
            const vA = a[sort.col] ?? 0;
            const vB = b[sort.col] ?? 0;
            if (typeof vA === 'string' && typeof vB === 'string') {
                return sort.asc ? vA.localeCompare(vB) : vB.localeCompare(vA);
            }
            return sort.asc ? (vA as number) - (vB as number) : (vB as number) - (vA as number);
        });
        return items;
    }, [data, sort, filter, fundingView]);

    const handleSort = (col: SortKey) => {
        setSort(p => ({ col, asc: p.col === col ? !p.asc : false }));
    };

    // Stats
    const stats = useMemo(() => {
        const totalVol = data.reduce((acc, d) => acc + d.volume24h, 0);
        const avgFunding = data.length ? data.reduce((acc, d) => acc + (d.fundingRate || 0), 0) / data.length : 0;
        const positiveFunding = data.filter(d => (d.fundingRate || 0) > 0.0001).length;
        const negativeFunding = data.filter(d => (d.fundingRate || 0) < -0.0001).length;
        const extremeFunding = data.filter(d => Math.abs(d.fundingRate || 0) > 0.0003).length;

        // Market bias calculation
        const netBias = positiveFunding - negativeFunding;
        const biasLabel = netBias > 10 ? 'LONG HEAVY' : netBias < -10 ? 'SHORT HEAVY' : 'BALANCED';

        return { totalVol, avgFunding, positiveFunding, negativeFunding, extremeFunding, biasLabel };
    }, [data]);

    // Squeeze detection
    const squeezes = useMemo(() => detectSqueezes(data), [data]);

    // Funding heatmap data (top 20 by volume)
    const heatmapData = useMemo(() => {
        return [...data]
            .sort((a, b) => b.volume24h - a.volume24h)
            .slice(0, 20)
            .map(d => ({
                symbol: d.symbol.replace('USDT', ''),
                funding: d.fundingRate || 0,
                change: d.change24h,
            }));
    }, [data]);

    return (
        <div className={styles.container}>
            {/* SQUEEZE DETECTOR - The hero feature */}
            {squeezes.length > 0 && (
                <div className={styles.squeezePanel}>
                    <div className={styles.squeezePanelHeader}>
                        <div className={styles.panelTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Target size={18} /> SQUEEZE DETECTOR
                        </div>
                        <span className={styles.squeezeCount}>{squeezes.length} signals</span>
                    </div>
                    <div className={styles.squeezeGrid}>
                        {squeezes.map((s, i) => (
                            <div
                                key={s.symbol}
                                className={`${styles.squeezeCard} ${s.type === 'SHORT_SQUEEZE' ? styles.shortSqueeze : styles.longSqueeze}`}
                            >
                                <div className={styles.squeezeHeader}>
                                    <span className={styles.squeezeSymbol}>{s.symbol.replace('USDT', '')}</span>
                                    <span className={`${styles.squeezeBadge} ${s.strength === 'IMMINENT' ? styles.imminent : styles.loading}`}>
                                        {s.strength}
                                    </span>
                                </div>
                                <div className={styles.squeezeType}>
                                    {s.type === 'SHORT_SQUEEZE' ? (
                                        <><TrendingUp size={14} className={styles.icon} /> SHORT SQUEEZE</>
                                    ) : (
                                        <><TrendingDown size={14} className={styles.icon} /> LONG SQUEEZE</>
                                    )}
                                </div>
                                <div className={styles.squeezeReason}>{s.reason}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* FUNDING HEATMAP */}
            <div className={styles.heatmapPanel}>
                <div className={styles.heatmapHeader}>
                    <div className={styles.panelTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Flame size={18} /> FUNDING HEATMAP
                    </div>
                    <div className={styles.heatmapLegend}>
                        <span className={styles.legendShort}>SHORT PAY</span>
                        <span className={styles.legendNeutral}>NEUTRAL</span>
                        <span className={styles.legendLong}>LONG PAY</span>
                    </div>
                </div>
                <div className={styles.heatmapGrid}>
                    {heatmapData.map(d => {
                        const intensity = Math.min(Math.abs(d.funding) * 1000, 1);
                        const bgColor = d.funding > 0
                            ? `rgba(74, 222, 128, ${intensity * 0.3})`
                            : d.funding < 0
                                ? `rgba(248, 81, 73, ${intensity * 0.3})`
                                : 'var(--bg-tertiary)';
                        return (
                            <div
                                key={d.symbol}
                                className={styles.heatmapCell}
                                style={{ background: bgColor }}
                                title={`${d.symbol}: ${(d.funding * 100).toFixed(4)}%`}
                            >
                                <span className={styles.heatmapSymbol}>{d.symbol}</span>
                                <span className={styles.heatmapValue}>{(d.funding * 100).toFixed(3)}%</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* OPTIONS FLOW - Deribit Data */}
            <div className={styles.optionsPanel}>
                <div className={styles.optionsPanelHeader}>
                    <div className={styles.panelTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BarChart2 size={18} /> OPTIONS FLOW
                    </div>
                    <span className={styles.optionsSource}>via Deribit</span>
                </div>
                <div className={styles.optionsGrid}>
                    {/* BTC Options */}
                    <div className={styles.optionsCard}>
                        <div className={styles.optionsCardHeader}>BTC</div>
                        {optionsData?.btc ? (
                            <>
                                <div className={styles.optionsRow}>
                                    <span>ATM IV (25Δ)</span>
                                    <span className={styles.optionsValue}>
                                        {(optionsData.btc.atmIV * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <div className={styles.optionsRow}>
                                    <span>Put/Call Ratio</span>
                                    <span className={`${styles.optionsValue} ${optionsData.btc.putCallRatio > 1 ? styles.neg : styles.pos}`}>
                                        {optionsData.btc.putCallRatio.toFixed(2)}
                                    </span>
                                </div>
                                <div className={styles.optionsRow}>
                                    <span>IV Skew</span>
                                    <span className={`${styles.optionsValue} ${optionsData.btc.ivSkew > 0 ? styles.neg : styles.pos}`}>
                                        {optionsData.btc.ivSkew > 0 ? '+' : ''}{(optionsData.btc.ivSkew * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <div className={styles.optionsRow}>
                                    <span>Max Pain</span>
                                    <span className={styles.optionsValue}>
                                        ${formatLargeNumber(optionsData.btc.maxPainStrike, locale)}
                                    </span>
                                </div>
                                <div className={styles.optionsRow}>
                                    <span>Call OI</span>
                                    <span className={styles.optionsValue}>
                                        ${formatLargeNumber(optionsData.btc.totalCallOI, locale)}
                                    </span>
                                </div>
                                <div className={styles.optionsRow}>
                                    <span>Put OI</span>
                                    <span className={styles.optionsValue}>
                                        ${formatLargeNumber(optionsData.btc.totalPutOI, locale)}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className={styles.optionsLoading}>Loading...</div>
                        )}
                    </div>

                    {/* ETH Options */}
                    <div className={styles.optionsCard}>
                        <div className={styles.optionsCardHeader}>ETH</div>
                        {optionsData?.eth ? (
                            <>
                                <div className={styles.optionsRow}>
                                    <span>ATM IV (25Δ)</span>
                                    <span className={styles.optionsValue}>
                                        {(optionsData.eth.atmIV * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <div className={styles.optionsRow}>
                                    <span>Put/Call Ratio</span>
                                    <span className={`${styles.optionsValue} ${optionsData.eth.putCallRatio > 1 ? styles.neg : styles.pos}`}>
                                        {optionsData.eth.putCallRatio.toFixed(2)}
                                    </span>
                                </div>
                                <div className={styles.optionsRow}>
                                    <span>IV Skew</span>
                                    <span className={`${styles.optionsValue} ${optionsData.eth.ivSkew > 0 ? styles.neg : styles.pos}`}>
                                        {optionsData.eth.ivSkew > 0 ? '+' : ''}{(optionsData.eth.ivSkew * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <div className={styles.optionsRow}>
                                    <span>Max Pain</span>
                                    <span className={styles.optionsValue}>
                                        ${formatLargeNumber(optionsData.eth.maxPainStrike, locale)}
                                    </span>
                                </div>
                                <div className={styles.optionsRow}>
                                    <span>Call OI</span>
                                    <span className={styles.optionsValue}>
                                        ${formatLargeNumber(optionsData.eth.totalCallOI, locale)}
                                    </span>
                                </div>
                                <div className={styles.optionsRow}>
                                    <span>Put OI</span>
                                    <span className={styles.optionsValue}>
                                        ${formatLargeNumber(optionsData.eth.totalPutOI, locale)}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className={styles.optionsLoading}>Loading...</div>
                        )}
                    </div>
                </div>
            </div>

            {/* STATS BAR */}
            <div className={styles.statsBar}>
                <div className={styles.stat}>
                    <span className={styles.label}>24H FUTURES VOLUME</span>
                    <span className={styles.value}>${formatLargeNumber(stats.totalVol, locale)}</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.label}>AVG FUNDING (8h)</span>
                    <span className={`${styles.value} ${stats.avgFunding >= 0 ? styles.pos : styles.neg}`}>
                        {(stats.avgFunding * 100).toFixed(4)}%
                    </span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.label}>MARKET BIAS</span>
                    <span className={styles.value}>{stats.biasLabel}</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.label}>EXTREME FUNDING</span>
                    <span className={`${styles.value} ${styles.warning}`}>{stats.extremeFunding} MARKETS</span>
                </div>

                {/* Filters */}
                <div className={styles.filters}>
                    <button
                        className={`${styles.filterBtn} ${fundingView === 'all' ? styles.active : ''}`}
                        onClick={() => setFundingView('all')}
                    >ALL ({data.length})</button>
                    <button
                        className={`${styles.filterBtn} ${styles.posBtn} ${fundingView === 'long_paying' ? styles.active : ''}`}
                        onClick={() => setFundingView('long_paying')}
                    >LONG PAY ({stats.positiveFunding})</button>
                    <button
                        className={`${styles.filterBtn} ${styles.negBtn} ${fundingView === 'short_paying' ? styles.active : ''}`}
                        onClick={() => setFundingView('short_paying')}
                    >SHORT PAY ({stats.negativeFunding})</button>
                    <button
                        className={`${styles.filterBtn} ${styles.warnBtn} ${fundingView === 'extreme' ? styles.active : ''}`}
                        onClick={() => setFundingView('extreme')}
                    >EXTREME ({stats.extremeFunding})</button>
                </div>

                <input
                    type="text"
                    placeholder="Filter..."
                    className={styles.search}
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                />
            </div>

            {/* DATA TABLE */}
            <div className={styles.tableRef}>
                <div className={styles.header}>
                    <div className={styles.cell} onClick={() => handleSort('symbol')}>
                        SYMBOL {sort.col === 'symbol' && (sort.asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                    <div className={styles.cell} onClick={() => handleSort('price')}>
                        PRICE {sort.col === 'price' && (sort.asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                    <div className={styles.cell}>MARK / INDEX</div>
                    <div className={styles.cell} onClick={() => handleSort('fundingRate')}>
                        FUNDING {sort.col === 'fundingRate' && (sort.asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                    <div className={styles.cell}>APR</div>
                    <div className={styles.cell} onClick={() => handleSort('change24h')}>
                        24H % {sort.col === 'change24h' && (sort.asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                    <div className={styles.cell} onClick={() => handleSort('volume24h')}>
                        VOLUME {sort.col === 'volume24h' && (sort.asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                    <div className={styles.cell}>SIGNAL</div>
                </div>
                <div className={styles.body}>
                    {loading ? (
                        <div className={styles.loading}>Loading Derivatives Data...</div>
                    ) : filtered.map((d) => {
                        const fr = d.fundingRate || 0;
                        const apr = fr * 100 * 3 * 365;
                        const isExtreme = Math.abs(fr) > 0.0003;
                        const squeeze = squeezes.find(s => s.symbol === d.symbol);

                        return (
                            <div key={d.symbol} className={`${styles.row} ${isExtreme ? styles.extremeRow : ''}`}>
                                <div className={styles.cell}>
                                    <b>{d.symbol.replace('USDT', '')}</b><small>/USDT</small>
                                </div>
                                <div className={styles.cell}>
                                    <span className={styles.mono}>${formatPrice(d.price, locale)}</span>
                                </div>
                                <div className={styles.cell}>
                                    <span className={styles.dim}>
                                        {formatPrice(d.markPrice, locale)} / {formatPrice(d.indexPrice, locale)}
                                    </span>
                                </div>
                                <div className={styles.cell}>
                                    <span className={`${styles.funding} ${fr > 0.0001 ? styles.pos : fr < -0.0001 ? styles.neg : styles.neu}`}>
                                        {(fr * 100).toFixed(4)}%
                                    </span>
                                </div>
                                <div className={styles.cell}>
                                    <span className={apr > 50 ? styles.hotApr : styles.dim}>
                                        {apr.toFixed(0)}%
                                    </span>
                                </div>
                                <div className={styles.cell}>
                                    <span className={d.change24h >= 0 ? styles.pos : styles.neg}>
                                        {d.change24h >= 0 ? '+' : ''}{d.change24h.toFixed(2)}%
                                    </span>
                                </div>
                                <div className={styles.cell}>
                                    <span>${formatLargeNumber(d.volume24h, locale)}</span>
                                </div>
                                <div className={styles.cell}>
                                    {squeeze && (
                                        <span className={`${styles.signalBadge} ${squeeze.type === 'SHORT_SQUEEZE' ? styles.shortSignal : styles.longSignal}`}>
                                            {squeeze.type === 'SHORT_SQUEEZE' ? <Circle size={10} fill="currentColor" /> : <Circle size={10} fill="currentColor" />} {squeeze.strength}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
