'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatLargeNumber, formatPrice } from '@/lib/i18n';
import { useLanguageStore } from '@/stores';
import { Link, Lock, TrendingUp, TrendingDown, Layers } from 'lucide-react';
import styles from './OnChain.module.css';
import L2Board from '@/components/widgets/L2Board';

interface Chain {
    name: string;
    tvl: number;
    change1d?: number;
    change7d?: number;
}

interface Protocol {
    name: string;
    tvl: number;
    chain: string;
    change1d: number;
    change7d?: number;
    category?: string;
}

// Real top chains - filter out garbage
const VALID_CHAINS = [
    'ethereum', 'bsc', 'arbitrum', 'polygon', 'optimism', 'avalanche', 'base',
    'solana', 'tron', 'sui', 'aptos', 'near', 'fantom', 'cronos', 'zkera',
    'linea', 'mantle', 'scroll', 'blast', 'manta', 'sei', 'injective', 'osmosis',
    'cardano', 'polkadot', 'cosmos'
];

// CEX names to filter out
const CEX_NAMES = ['binance', 'coinbase', 'kraken', 'bitfinex', 'gemini', 'robinhood', 'okx', 'bybit', 'kucoin', 'huobi', 'gate.io', 'bitstamp', 'mexc', 'htx'];

// Garbage chain names to filter
const GARBAGE_CHAINS = ['harmony', 'stable', 'etherlink', 'tac', 'cex', 'exchange'];

export function OnChain() {
    const { locale } = useLanguageStore();
    const [chains, setChains] = useState<Chain[]>([]);
    const [protocols, setProtocols] = useState<Protocol[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'chains' | 'protocols' | 'layer2'>('chains');

    useEffect(() => {
        const fetchDefi = async () => {
            try {
                const [cRes, pRes] = await Promise.allSettled([
                    fetch('/api/defi?type=chains'),
                    fetch('/api/defi?type=protocols'),
                ]);

                if (cRes.status === 'fulfilled') {
                    const d = await cRes.value.json();
                    if (d.data) {
                        // Filter out garbage chains and CEXs
                        const filtered = d.data.filter((c: Chain) => {
                            const nameLower = c.name.toLowerCase();
                            // Must not be a CEX
                            if (CEX_NAMES.some(cex => nameLower.includes(cex))) return false;
                            // Must not be garbage
                            if (GARBAGE_CHAINS.some(g => nameLower.includes(g))) return false;
                            // Must have meaningful TVL
                            if (c.tvl < 1000000) return false; // < $1M is irrelevant
                            return true;
                        });
                        setChains(filtered.slice(0, 30));
                    }
                }
                if (pRes.status === 'fulfilled') {
                    const d = await pRes.value.json();
                    if (d.data) {
                        // Filter out CEXs from protocols too
                        const filtered = d.data.filter((p: Protocol) => {
                            const nameLower = p.name.toLowerCase();
                            if (CEX_NAMES.some(cex => nameLower.includes(cex))) return false;
                            if (p.category === 'CEX') return false;
                            if (p.tvl < 10000000) return false; // < $10M is noise
                            return true;
                        });
                        setProtocols(filtered.slice(0, 30));
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchDefi();
        const iv = setInterval(fetchDefi, 60000);
        return () => clearInterval(iv);
    }, []);

    // Stats
    const stats = useMemo(() => {
        const totalChainsTVL = chains.reduce((acc, c) => acc + c.tvl, 0);
        const totalProtocolsTVL = protocols.reduce((acc, p) => acc + p.tvl, 0);

        // Growing chains (positive 1d change)
        const growingChains = chains.filter(c => (c.change1d || 0) > 0).length;
        const bleedingChains = chains.filter(c => (c.change1d || 0) < -1).length;

        // Growing protocols
        const growingProtocols = protocols.filter(p => p.change1d > 0).length;
        const bleedingProtocols = protocols.filter(p => p.change1d < -1).length;

        return {
            totalChainsTVL,
            totalProtocolsTVL,
            growingChains,
            bleedingChains,
            growingProtocols,
            bleedingProtocols,
        };
    }, [chains, protocols]);

    return (
        <div className={styles.container}>
            {/* HEADER */}
            <div className={styles.header}>
                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${view === 'chains' ? styles.active : ''}`}
                        onClick={() => setView('chains')}
                    >
                        <Link size={14} /> CHAINS ({chains.length})
                    </button>
                    <button
                        className={`${styles.tab} ${view === 'protocols' ? styles.active : ''}`}
                        onClick={() => setView('protocols')}
                    >
                        <Lock size={14} /> PROTOCOLS ({protocols.length})
                    </button>
                    <button
                        className={`${styles.tab} ${view === 'layer2' ? styles.active : ''}`}
                        onClick={() => setView('layer2')}
                    >
                        <Layers size={14} /> L2 PULSE
                    </button>
                </div>

                <div className={styles.statsRow}>
                    <div className={styles.stat}>
                        <small>TOTAL CHAINS TVL</small>
                        <span>${formatLargeNumber(stats.totalChainsTVL, locale)}</span>
                    </div>
                    <div className={styles.stat}>
                        <small>GROWING</small>
                        <span className={styles.pos}>{stats.growingChains} chains</span>
                    </div>
                    <div className={styles.stat}>
                        <small>BLEEDING</small>
                        <span className={styles.neg}>{stats.bleedingChains} chains</span>
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className={styles.content}>
                {view === 'layer2' ? (
                    <div style={{ height: '100%', maxWidth: '1200px', margin: '0 auto' }}>
                        <L2Board />
                    </div>
                ) : view === 'chains' ? (
                    <div className={styles.table}>
                        <div className={styles.tableHeader}>
                            <span className={styles.rank}>#</span>
                            <span className={styles.name}>CHAIN</span>
                            <span className={styles.tvl}>TVL</span>
                            <span className={styles.share}>SHARE</span>
                            <span className={styles.change}>24H</span>
                            <span className={styles.change}>7D</span>
                            <span className={styles.signal}>SIGNAL</span>
                        </div>
                        <div className={styles.tableBody}>
                            {loading ? (
                                <div className={styles.loading}>Loading...</div>
                            ) : chains.map((c, i) => {
                                const change1d = c.change1d || 0;
                                const change7d = c.change7d || 0;
                                const share = (c.tvl / stats.totalChainsTVL) * 100;
                                const isGrowing = change1d > 2;
                                const isBleeding = change1d < -2;

                                return (
                                    <div
                                        key={c.name}
                                        className={`${styles.row} ${isGrowing ? styles.growingRow : ''} ${isBleeding ? styles.bleedingRow : ''}`}
                                    >
                                        <span className={styles.rank}>{i + 1}</span>
                                        <span className={styles.name}>{c.name}</span>
                                        <span className={styles.tvl}>${formatLargeNumber(c.tvl, locale)}</span>
                                        <span className={styles.share}>
                                            <div className={styles.shareBar}>
                                                <div
                                                    className={styles.shareFill}
                                                    style={{ width: `${Math.min(share, 100)}%` }}
                                                />
                                            </div>
                                            {share.toFixed(1)}%
                                        </span>
                                        <span className={`${styles.change} ${change1d >= 0 ? styles.pos : styles.neg}`}>
                                            {change1d >= 0 ? '+' : ''}{change1d.toFixed(1)}%
                                        </span>
                                        <span className={`${styles.change} ${change7d >= 0 ? styles.pos : styles.neg}`}>
                                            {change7d >= 0 ? '+' : ''}{change7d.toFixed(1)}%
                                        </span>
                                        <span className={styles.signal}>
                                            {isGrowing && <span className={styles.growBadge}><TrendingUp size={12} /> GROWING</span>}
                                            {isBleeding && <span className={styles.bleedBadge}><TrendingDown size={12} /> BLEEDING</span>}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className={styles.table}>
                        <div className={styles.tableHeader}>
                            <span className={styles.rank}>#</span>
                            <span className={styles.name}>PROTOCOL</span>
                            <span className={styles.chain}>CHAIN</span>
                            <span className={styles.tvl}>TVL</span>
                            <span className={styles.change}>24H</span>
                            <span className={styles.change}>7D</span>
                            <span className={styles.signal}>SIGNAL</span>
                        </div>
                        <div className={styles.tableBody}>
                            {loading ? (
                                <div className={styles.loading}>Loading...</div>
                            ) : protocols.map((p, i) => {
                                const isGrowing = p.change1d > 3;
                                const isBleeding = p.change1d < -3;
                                const change7d = p.change7d || 0;

                                return (
                                    <div
                                        key={p.name}
                                        className={`${styles.row} ${isGrowing ? styles.growingRow : ''} ${isBleeding ? styles.bleedingRow : ''}`}
                                    >
                                        <span className={styles.rank}>{i + 1}</span>
                                        <span className={styles.name}>{p.name}</span>
                                        <span className={styles.chain}>{p.chain}</span>
                                        <span className={styles.tvl}>${formatLargeNumber(p.tvl, locale)}</span>
                                        <span className={`${styles.change} ${p.change1d >= 0 ? styles.pos : styles.neg}`}>
                                            {p.change1d >= 0 ? '+' : ''}{p.change1d.toFixed(1)}%
                                        </span>
                                        <span className={`${styles.change} ${change7d >= 0 ? styles.pos : styles.neg}`}>
                                            {change7d >= 0 ? '+' : ''}{change7d.toFixed(1)}%
                                        </span>
                                        <span className={styles.signal}>
                                            {isGrowing && <span className={styles.growBadge}><TrendingUp size={12} /> INFLOW</span>}
                                            {isBleeding && <span className={styles.bleedBadge}><TrendingDown size={12} /> OUTFLOW</span>}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
