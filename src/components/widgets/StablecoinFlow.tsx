'use client';

/**
 * Stablecoin Flow Panel
 * Shows stablecoin supply momentum and exchange inflows
 * Phase 5: On-chain integration
 */

import { useState, useEffect } from 'react';
import styles from './StablecoinFlow.module.css';
import { formatLargeNumber } from '@/lib/i18n';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface StablecoinData {
    symbol: string;
    supply: number;
    change24h: number;
    change7d: number;
    change30d: number;
    exchangeInflow24h: number;
    dominance: number;
}

interface ChainFlow {
    chain: string;
    inflow24h: number;
    outflow24h: number;
    netFlow: number;
}

// Mock data - would come from Glassnode/CryptoQuant APIs
const MOCK_STABLECOINS: StablecoinData[] = [
    { symbol: 'USDT', supply: 118_000_000_000, change24h: 0.12, change7d: 0.8, change30d: 2.1, exchangeInflow24h: 245_000_000, dominance: 69.2 },
    { symbol: 'USDC', supply: 33_500_000_000, change24h: -0.05, change7d: -0.3, change30d: -1.2, exchangeInflow24h: 89_000_000, dominance: 19.6 },
    { symbol: 'DAI', supply: 5_200_000_000, change24h: 0.02, change7d: 0.1, change30d: -0.5, exchangeInflow24h: 12_000_000, dominance: 3.1 },
    { symbol: 'FDUSD', supply: 3_100_000_000, change24h: 0.8, change7d: 2.5, change30d: 15.3, exchangeInflow24h: 156_000_000, dominance: 1.8 },
];

const MOCK_CHAINS: ChainFlow[] = [
    { chain: 'Ethereum', inflow24h: 320_000_000, outflow24h: 280_000_000, netFlow: 40_000_000 },
    { chain: 'Tron', inflow24h: 180_000_000, outflow24h: 195_000_000, netFlow: -15_000_000 },
    { chain: 'BSC', inflow24h: 45_000_000, outflow24h: 52_000_000, netFlow: -7_000_000 },
    { chain: 'Arbitrum', inflow24h: 28_000_000, outflow24h: 18_000_000, netFlow: 10_000_000 },
    { chain: 'Solana', inflow24h: 22_000_000, outflow24h: 25_000_000, netFlow: -3_000_000 },
];

export default function StablecoinFlow() {
    const [stablecoins, setStablecoins] = useState<StablecoinData[]>(MOCK_STABLECOINS);
    const [chains, setChains] = useState<ChainFlow[]>(MOCK_CHAINS);
    const [loading, setLoading] = useState(false);

    // Calculate totals
    const totalSupply = stablecoins.reduce((sum, s) => sum + s.supply, 0);
    const totalInflow = stablecoins.reduce((sum, s) => sum + s.exchangeInflow24h, 0);
    const netMinting = stablecoins.reduce((sum, s) => sum + (s.supply * s.change24h / 100), 0);
    const netChainFlow = chains.reduce((sum, c) => sum + c.netFlow, 0);

    // Calculate hourly rate
    const inflowPerHour = totalInflow / 24;

    return (
        <div className={styles.panel}>
            {/* Header Stats */}
            <div className={styles.header}>
                <h3 className={styles.title}>Stablecoin Flows</h3>
                <div className={styles.headerStats}>
                    <div className={styles.headerStat}>
                        <span className={styles.statValue}>${formatLargeNumber(inflowPerHour, 'en')}</span>
                        <span className={styles.statLabel}>USD/hr inflow</span>
                    </div>
                    <div className={`${styles.headerStat} ${netMinting >= 0 ? styles.pos : styles.neg}`}>
                        <span className={styles.statValue}>
                            {netMinting >= 0 ? '+' : ''}{formatLargeNumber(netMinting, 'en')}
                        </span>
                        <span className={styles.statLabel}>Net mint 24h</span>
                    </div>
                </div>
            </div>

            {/* Stablecoin Table */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>Supply Momentum</div>
                <div className={styles.table}>
                    <div className={styles.tableHeader}>
                        <span>Token</span>
                        <span>Supply</span>
                        <span>24h</span>
                        <span>7d</span>
                        <span>Ex. Inflow</span>
                    </div>
                    {stablecoins.map(stable => (
                        <div key={stable.symbol} className={styles.tableRow}>
                            <span className={styles.symbol}>
                                {stable.symbol}
                                <span className={styles.dominance}>{stable.dominance.toFixed(1)}%</span>
                            </span>
                            <span className={styles.mono}>${formatLargeNumber(stable.supply, 'en')}</span>
                            <span className={stable.change24h >= 0 ? styles.pos : styles.neg}>
                                {stable.change24h >= 0 ? '+' : ''}{stable.change24h.toFixed(2)}%
                            </span>
                            <span className={stable.change7d >= 0 ? styles.pos : styles.neg}>
                                {stable.change7d >= 0 ? '+' : ''}{stable.change7d.toFixed(2)}%
                            </span>
                            <span className={styles.mono}>${formatLargeNumber(stable.exchangeInflow24h, 'en')}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chain Flows */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>Chain → Exchange Flows</div>
                <div className={styles.chainGrid}>
                    {chains.map(chain => (
                        <div key={chain.chain} className={styles.chainCard}>
                            <div className={styles.chainName}>{chain.chain}</div>
                            <div className={styles.flowBar}>
                                <div
                                    className={`${styles.flowIn}`}
                                    style={{ width: `${(chain.inflow24h / (chain.inflow24h + chain.outflow24h)) * 100}%` }}
                                />
                                <div
                                    className={`${styles.flowOut}`}
                                    style={{ width: `${(chain.outflow24h / (chain.inflow24h + chain.outflow24h)) * 100}%` }}
                                />
                            </div>
                            <div className={styles.chainStats}>
                                <span className={styles.pos}><ArrowUp size={10} /> ${formatLargeNumber(chain.inflow24h, 'en')}</span>
                                <span className={styles.neg}><ArrowDown size={10} /> ${formatLargeNumber(chain.outflow24h, 'en')}</span>
                                <span className={`${styles.netFlow} ${chain.netFlow >= 0 ? styles.pos : styles.neg}`}>
                                    NET: {chain.netFlow >= 0 ? '+' : ''}{formatLargeNumber(chain.netFlow, 'en')}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Data Attribution */}
            <div className={styles.attribution}>
                <span className={styles.mock}>SIMULATED DATA</span>
                <span>Real data requires Glassnode/CryptoQuant API</span>
            </div>
        </div>
    );
}
