'use client';

import { useState, useEffect } from 'react';
import styles from './Yields.module.css';
import { Percent, Banknote, TrendingUp, DollarSign, Filter } from 'lucide-react';

export default function Yields() {
    const [view, setView] = useState<'yields' | 'fees'>('yields');
    const [yieldsData, setYieldsData] = useState<any[]>([]);
    const [feesData, setFeesData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch via API to offload heavy processing to server
                const [yieldsRes, feesRes] = await Promise.all([
                    fetch('/api/defi?type=yields'),
                    fetch('/api/defi?type=fees')
                ]);

                const yieldsJson = await yieldsRes.json();
                const feesJson = await feesRes.json();

                if (yieldsJson.success) setYieldsData(yieldsJson.data || []);
                if (feesJson.success) setFeesData(feesJson.data || []);
            } catch (err) {
                console.error("Failed to fetch Yields data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading DeFi Intelligence...</div>;

    const topApy = yieldsData.length > 0 ? Math.max(...yieldsData.map(y => y.apy)) : 0;
    const totalFees24h = feesData.reduce((sum, p) => sum + p.total24h, 0);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.title}>
                    <Banknote size={28} className={styles.titleIcon} />
                    <span>DEFI CAPTURE</span>
                </div>
                <div className={styles.controls}>
                    <button
                        className={`${styles.controlBtn} ${view === 'yields' ? styles.active : ''}`}
                        onClick={() => setView('yields')}
                    >
                        YIELD HUNTER
                    </button>
                    <button
                        className={`${styles.controlBtn} ${view === 'fees' ? styles.active : ''}`}
                        onClick={() => setView('fees')}
                    >
                        PROTOCOL REVENUE
                    </button>
                </div>
            </div>

            {/* Overview Metrics */}
            <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                    <div className={styles.metricLabel}>Top Available APY</div>
                    <div className={`${styles.metricValue} text-green-500`}>
                        {topApy.toFixed(2)}%
                    </div>
                </div>
                <div className={styles.metricCard}>
                    <div className={styles.metricLabel}>Total Fees (24h)</div>
                    <div className={`${styles.metricValue} text-purple-500`}>
                        ${(totalFees24h / 1e6).toFixed(2)}M
                    </div>
                </div>
                <div className={styles.metricCard}>
                    <div className={styles.metricLabel}>Opportunities Found</div>
                    <div className={styles.metricValue}>
                        {yieldsData.length}
                    </div>
                </div>
                <div className={styles.metricCard}>
                    <div className={styles.metricLabel}>Fee Generators</div>
                    <div className={styles.metricValue}>
                        {feesData.length}
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT TABLE */}
            <div className={styles.tableContainer}>
                <div className={styles.tableHeader}>
                    <div className={styles.tableTitle}>
                        {view === 'yields' ? 'Top Risk-Adjusted Yields' : 'Protocol Earnings Leaderboard'}
                    </div>
                    {/* Add filters here if needed */}
                </div>

                <table className={styles.table}>
                    <thead>
                        {view === 'yields' ? (
                            <tr>
                                <th>Project</th>
                                <th>Chain</th>
                                <th>Pool/Symbol</th>
                                <th>TVL (USD)</th>
                                <th>APY</th>
                                <th>Type</th>
                            </tr>
                        ) : (
                            <tr>
                                <th>Protocol</th>
                                <th>Category</th>
                                <th>Fees (24h)</th>
                                <th>Revenue (24h)</th>
                                <th>Change (7d)</th>
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {view === 'yields' ? (
                            yieldsData.map((row, i) => (
                                <tr key={i}>
                                    <td>
                                        <div className={styles.projectCell}>
                                            {row.project}
                                        </div>
                                    </td>
                                    <td><span className={styles.chainBadge}>{row.chain}</span></td>
                                    <td>{row.symbol}</td>
                                    <td className={styles.tvlValue}>${(row.tvlUsd / 1e6).toFixed(2)}M</td>
                                    <td className={styles.apyValue}>{row.apy.toFixed(2)}%</td>
                                    <td>
                                        {row.stablecoin ? (
                                            <span className={styles.stablecoinBadge}>Stable</span>
                                        ) : (
                                            <span className="text-xs text-gray-500">Volatile</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            feesData.map((row, i) => (
                                <tr key={i}>
                                    <td>
                                        <div className={styles.projectCell}>
                                            {row.name}
                                        </div>
                                    </td>
                                    <td><span className={styles.chainBadge}>{row.category}</span></td>
                                    <td className={styles.feesValue}>${row.total24h.toLocaleString()}</td>
                                    <td className={styles.revenueValue}>${row.revenue24h.toLocaleString()}</td>
                                    <td>
                                        <span className={row.change7d >= 0 ? "text-green-500" : "text-red-500"}>
                                            {row.change7d.toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
