'use client';

import { useState, useEffect } from 'react';
import styles from './L2Board.module.css';
import { Layers, Activity, ShieldAlert, ArrowUpRight } from 'lucide-react';

export default function L2Board() {
    const [activeTab, setActiveTab] = useState<'tvl' | 'activity' | 'risk'>('tvl');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch both TVL and Activity via API to avoid CORS/Client issues
                const [tvlRes, activityRes] = await Promise.all([
                    fetch('/api/l2?type=tvl'),
                    fetch('/api/l2?type=activity')
                ]);

                const tvlJson = await tvlRes.json();
                const activityJson = await activityRes.json();

                setData({
                    tvl: tvlJson.data,
                    activity: activityJson.data
                });
            } catch (err) {
                console.error("Failed to fetch L2 data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className={styles.panel}><div className="p-4 text-xs text-gray-500">Loading L2 Intelligence...</div></div>;
    if (!data) return <div className={styles.panel}><div className="p-4 text-xs text-red-500">L2 Data Unavailable</div></div>;

    const { tvl, activity } = data;

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <div className={styles.title}>
                    <Layers size={16} className={styles.icon} />
                    <span>LAYER 2 PULSE</span>
                </div>
                {activity?.scalingFactor && (
                    <div className="text-xs text-purple-400 font-mono">
                        {activity.scalingFactor.toFixed(1)}x ETH
                    </div>
                )}
            </div>

            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'tvl' ? styles.active : ''}`}
                    onClick={() => setActiveTab('tvl')}
                >
                    TVL & Dominance
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'activity' ? styles.active : ''}`}
                    onClick={() => setActiveTab('activity')}
                >
                    Activity (TPS)
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'risk' ? styles.active : ''}`}
                    onClick={() => setActiveTab('risk')}
                >
                    Risk Stages
                </button>
            </div>

            <div className={styles.content}>
                {/* GLOBAL STATS */}
                <div className={styles.statGrid}>
                    <div className={styles.statCard}>
                        <div className={styles.statLabel}>Total L2 TVL</div>
                        <div className={styles.statValue}>
                            ${(tvl?.totalTvl / 1e9).toFixed(2)}B
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statLabel}>Total TPS</div>
                        <div className={styles.statValue}>
                            {activity?.totalTps.toFixed(1)}
                        </div>
                    </div>
                </div>

                {/* LISTS */}
                <div className={styles.list}>
                    {activeTab === 'tvl' && tvl?.projects.slice(0, 10).map((p: any) => (
                        <div key={p.id} className={styles.item}>
                            <div className={styles.itemInfo}>
                                <div className={styles.itemName}>{p.name}</div>
                                <div className={styles.itemMeta}>
                                    <span>{p.category}</span>
                                    <span style={{ color: p.marketShare > 10 ? '#a855f7' : '' }}>
                                        {p.marketShare.toFixed(1)}% Share
                                    </span>
                                </div>
                            </div>
                            <div className={styles.itemValues}>
                                <span className={styles.primaryValue}>${(p.tvl / 1e9).toFixed(2)}B</span>
                                <span className={`${styles.secondaryValue} ${p.change7d >= 0 ? styles.positive : styles.negative}`}>
                                    {p.change7d >= 0 ? '+' : ''}{p.change7d}%
                                </span>
                            </div>
                        </div>
                    ))}

                    {activeTab === 'activity' && activity?.projects.slice(0, 10).map((p: any) => (
                        <div key={p.id} className={styles.item}>
                            <div className={styles.itemInfo}>
                                <div className={styles.itemName}>{p.name}</div>
                                <div className={styles.itemMeta}>
                                    <Activity size={10} />
                                    <span>Vs ETH</span>
                                </div>
                            </div>
                            <div className={styles.itemValues}>
                                <span className={styles.primaryValue}>{p.tps.toFixed(2)} TPS</span>
                                <span className={styles.secondaryValue}>
                                    Max: {(p.tps * 1.5).toFixed(1)} {/* Mock max for demo */}
                                </span>
                            </div>
                        </div>
                    ))}

                    {activeTab === 'risk' && tvl?.projects.slice(0, 10).map((p: any) => (
                        <div key={p.id} className={`${styles.item} ${styles['stage' + (p.stage === 'Stage 2' ? '2' : p.stage === 'Stage 1' ? '1' : '0')]}`}>
                            <div className={styles.itemInfo}>
                                <div className={styles.itemName}>{p.name}</div>
                                <div className={styles.itemMeta}>
                                    <ShieldAlert size={10} />
                                    <span>{p.provider}</span>
                                </div>
                            </div>
                            <div className={styles.itemValues}>
                                <span className={`${styles.stageTag} ${styles['stage' + (p.stage === 'Stage 2' ? '2' : p.stage === 'Stage 1' ? '1' : '0')]}`}>
                                    {p.stage || 'Stage 0'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
