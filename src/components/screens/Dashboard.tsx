'use client';

import { useEffect, useState, useMemo } from 'react';
import { useMacroStore, useLanguageStore } from '@/stores';
import { formatLargeNumber, formatPercent, formatPrice } from '@/lib/i18n';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    BarChart2,
    Zap,
    Trophy,
    Circle,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react';
import styles from './Dashboard.module.css';

interface MarketTicker {
    symbol: string;
    price: number;
    change24h: number;
    volume24h: number;
    fundingRate?: number;
    openInterest?: number;
    oiChange24h?: number;
    bid: number;
    ask: number;
    spreadBps: number;
}

// Market regime calculation
function calculateMarketRegime(data: {
    btcChange: number;
    ethChange: number;
    avgFunding: number;
    fearGreed: number;
    oiChange: number;
}): { regime: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL'; score: number; signals: string[] } {
    let score = 0;
    const signals: string[] = [];

    // BTC Trend (+/- 2)
    if (data.btcChange > 2) { score += 2; signals.push('BTC trending up'); }
    else if (data.btcChange > 0) { score += 1; }
    else if (data.btcChange < -2) { score -= 2; signals.push('BTC trending down'); }
    else if (data.btcChange < 0) { score -= 1; }

    // ETH relative to BTC (+/- 1)
    const ethRelative = data.ethChange - data.btcChange;
    if (ethRelative > 1) { score += 1; signals.push('ETH outperforming'); }
    else if (ethRelative < -1) { score -= 1; signals.push('ETH underperforming'); }

    // Funding Rate (+/- 2)
    if (data.avgFunding > 0.0003) { score += 1; signals.push('Longs paying heavily'); }
    else if (data.avgFunding > 0.0001) { score += 0.5; }
    else if (data.avgFunding < -0.0001) { score -= 1; signals.push('Shorts paying'); }

    // Fear & Greed (+/- 2)
    if (data.fearGreed >= 70) { score += 2; signals.push('Extreme Greed'); }
    else if (data.fearGreed >= 55) { score += 1; }
    else if (data.fearGreed <= 30) { score -= 2; signals.push('Extreme Fear'); }
    else if (data.fearGreed <= 45) { score -= 1; }

    // OI Change (+/- 1)
    if (data.oiChange > 5) { score += 1; signals.push('OI expanding'); }
    else if (data.oiChange < -5) { score -= 1; signals.push('OI contracting'); }

    const regime = score >= 2 ? 'RISK_ON' : score <= -2 ? 'RISK_OFF' : 'NEUTRAL';
    return { regime, score, signals };
}

export function Dashboard() {
    const { locale } = useLanguageStore();
    const { globalData, fearGreed, setGlobalData, setFearGreed } = useMacroStore();
    const [loading, setLoading] = useState(true);
    const [markets, setMarkets] = useState<MarketTicker[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [macroRes, marketsRes] = await Promise.allSettled([
                    fetch('/api/macro?type=all'),
                    fetch('/api/markets?type=futures'),
                ]);

                if (macroRes.status === 'fulfilled') {
                    const d = await macroRes.value.json();
                    if (d.data) {
                        setGlobalData(d.data.global);
                        setFearGreed(d.data.fearGreed);
                    }
                }

                if (marketsRes.status === 'fulfilled') {
                    const d = await marketsRes.value.json();
                    if (d.data) setMarkets(d.data);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const iv = setInterval(fetchData, 15000);
        return () => clearInterval(iv);
    }, [setGlobalData, setFearGreed]);

    // Computed stats from actual exchange data
    const stats = useMemo(() => {
        const totalVolume = markets.reduce((acc, m) => acc + m.volume24h, 0);
        const btcMarket = markets.find(m => m.symbol === 'BTCUSDT');
        const ethMarket = markets.find(m => m.symbol === 'ETHUSDT');
        const avgFunding = markets.length
            ? markets.reduce((acc, m) => acc + (m.fundingRate || 0), 0) / markets.length
            : 0;
        const positiveFunding = markets.filter(m => (m.fundingRate || 0) > 0.0001).length;
        const negativeFunding = markets.filter(m => (m.fundingRate || 0) < -0.0001).length;

        // Calculate OI change (mocked until API supports it)
        const totalOI = markets.reduce((acc, m) => acc + (m.openInterest || 0), 0);
        const oiChange = 0; // Will be calculated when API supports it

        return {
            totalVolume,
            totalOI,
            btcPrice: btcMarket?.price || 0,
            btcChange: btcMarket?.change24h || 0,
            btcFunding: btcMarket?.fundingRate || 0,
            ethPrice: ethMarket?.price || 0,
            ethChange: ethMarket?.change24h || 0,
            ethFunding: ethMarket?.fundingRate || 0,
            avgFunding,
            positiveFunding,
            negativeFunding,
            oiChange,
            marketCount: markets.length,
        };
    }, [markets]);

    // Calculate Market Regime
    const regime = useMemo(() => calculateMarketRegime({
        btcChange: stats.btcChange,
        ethChange: stats.ethChange,
        avgFunding: stats.avgFunding,
        fearGreed: fearGreed?.value || 50,
        oiChange: stats.oiChange,
    }), [stats, fearGreed]);

    // Derivatives heat (overcrowded signal)
    const derivativesHeat = useMemo(() => {
        const extremeFunding = markets.filter(m => Math.abs(m.fundingRate || 0) > 0.0003).length;
        const ratio = markets.length > 0 ? extremeFunding / markets.length : 0;
        if (ratio > 0.3) return { level: 'OVERHEATED', color: '#ef4444' };
        if (ratio > 0.15) return { level: 'ELEVATED', color: '#f59e0b' };
        return { level: 'NORMAL', color: '#22c55e' };
    }, [markets]);

    // Top movers by different metrics
    const topByVolume = [...markets].sort((a, b) => b.volume24h - a.volume24h).slice(0, 8);
    const extremeFunding = [...markets]
        .filter(m => Math.abs(m.fundingRate || 0) > 0.0001)
        .sort((a, b) => Math.abs(b.fundingRate || 0) - Math.abs(a.fundingRate || 0))
        .slice(0, 8);
    const topGainers = [...markets].sort((a, b) => b.change24h - a.change24h).slice(0, 6);
    const topLosers = [...markets].sort((a, b) => a.change24h - b.change24h).slice(0, 6);

    // Fear & Greed styling
    const fgValue = fearGreed?.value || 50;
    const fgColor = fgValue <= 25 ? '#ef4444' : fgValue <= 45 ? '#f97316' : fgValue <= 55 ? '#facc15' : fgValue <= 75 ? '#a3e635' : '#22c55e';

    // Regime styling
    const regimeColor = regime.regime === 'RISK_ON' ? '#22c55e' : regime.regime === 'RISK_OFF' ? '#ef4444' : '#facc15';
    const regimeIcon = regime.regime === 'RISK_ON' ? <TrendingUp size={18} /> : regime.regime === 'RISK_OFF' ? <TrendingDown size={18} /> : <Minus size={18} />;

    return (
        <div className={styles.dashboard}>
            {/* MARKET REGIME BANNER - The 10-second market snapshot */}
            <div className={styles.regimeBanner}>
                <div className={styles.regimeMain}>
                    <span className={styles.regimeIcon} style={{ color: regimeColor }}>{regimeIcon}</span>
                    <span className={styles.regimeLabel}>MARKET REGIME</span>
                    <span className={styles.regimeValue} style={{ color: regimeColor }}>
                        {regime.regime.replace('_', ' ')}
                    </span>
                    <span className={styles.regimeScore}>Score: {regime.score.toFixed(1)}</span>
                </div>
                <div className={styles.regimeSignals}>
                    {regime.signals.slice(0, 4).map((s, i) => (
                        <span key={i} className={styles.signal}>{s}</span>
                    ))}
                </div>
            </div>

            {/* TOP ROW: Key Indicators */}
            <div className={styles.topRow}>
                {/* BTC Trend Card */}
                <div className={styles.trendCard}>
                    <div className={styles.trendHeader}>
                        <span className={styles.trendSymbol}>BTC</span>
                        <div className={`${styles.trendBadge} ${stats.btcChange >= 0 ? styles.bullish : styles.bearish}`}>
                            {stats.btcChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            {stats.btcChange >= 0 ? 'BULLISH' : 'BEARISH'}
                        </div>
                    </div>
                    <div className={styles.trendPrice}>${formatPrice(stats.btcPrice, locale)}</div>
                    <div className={styles.trendMeta}>
                        <div className={styles.metaItem}>
                            <small>24H</small>
                            <span className={stats.btcChange >= 0 ? styles.pos : styles.neg}>
                                {stats.btcChange >= 0 ? '+' : ''}{stats.btcChange.toFixed(2)}%
                            </span>
                        </div>
                        <div className={styles.metaItem}>
                            <small>FUNDING</small>
                            <span className={stats.btcFunding >= 0 ? styles.pos : styles.neg}>
                                {(stats.btcFunding * 100).toFixed(4)}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* ETH Trend Card */}
                <div className={styles.trendCard}>
                    <div className={styles.trendHeader}>
                        <span className={styles.trendSymbol}>ETH</span>
                        <div className={`${styles.trendBadge} ${stats.ethChange >= 0 ? styles.bullish : styles.bearish}`}>
                            {stats.ethChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            {stats.ethChange >= 0 ? 'BULLISH' : 'BEARISH'}
                        </div>
                    </div>
                    <div className={styles.trendPrice}>${formatPrice(stats.ethPrice, locale)}</div>
                    <div className={styles.trendMeta}>
                        <div className={styles.metaItem}>
                            <small>24H</small>
                            <span className={stats.ethChange >= 0 ? styles.pos : styles.neg}>
                                {stats.ethChange >= 0 ? '+' : ''}{stats.ethChange.toFixed(2)}%
                            </span>
                        </div>
                        <div className={styles.metaItem}>
                            <small>FUNDING</small>
                            <span className={stats.ethFunding >= 0 ? styles.pos : styles.neg}>
                                {(stats.ethFunding * 100).toFixed(4)}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Fear & Greed */}
                <div className={styles.fgCard} style={{ borderColor: fgColor }}>
                    <div className={styles.fgHeader}>FEAR & GREED</div>
                    <div className={styles.fgValue} style={{ color: fgColor }}>{fgValue}</div>
                    <div className={styles.fgLabel}>{fearGreed?.classification || 'Neutral'}</div>
                </div>

                {/* Derivatives Heat */}
                <div className={styles.heatCard} style={{ borderColor: derivativesHeat.color }}>
                    <div className={styles.heatHeader}>DERIVATIVES HEAT</div>
                    <div className={styles.heatValue} style={{ color: derivativesHeat.color }}>
                        {derivativesHeat.level}
                    </div>
                    <div className={styles.heatMeta}>
                        <small>Avg Funding</small>
                        <span className={stats.avgFunding >= 0 ? styles.pos : styles.neg}>
                            {(stats.avgFunding * 100).toFixed(4)}%
                        </span>
                    </div>
                </div>

                {/* Volume & Liquidity */}
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>FUTURES VOLUME 24H</div>
                    <div className={styles.statValue}>${formatLargeNumber(stats.totalVolume, locale)}</div>
                    <div className={styles.statSub}>{stats.marketCount} markets active</div>
                </div>
            </div>

            {/* MAIN GRID */}
            <div className={styles.grid}>
                {/* TOP VOLUME - Where liquidity is */}
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.panelTitle}>
                            <BarChart2 size={16} className={styles.icon} />
                            LIQUIDITY HOTSPOTS
                        </div>
                        <small>By 24H Volume</small>
                    </div>
                    <div className={styles.panelBody}>
                        {loading ? <div className={styles.loading}>Loading...</div> : topByVolume.map((m, i) => (
                            <div key={m.symbol} className={styles.mRow}>
                                <span className={styles.rank}>{i + 1}</span>
                                <span className={styles.symbol}>{m.symbol.replace('USDT', '')}</span>
                                <span className={styles.vol}>${formatLargeNumber(m.volume24h, locale)}</span>
                                <span className={m.change24h >= 0 ? styles.pos : styles.neg}>
                                    {m.change24h >= 0 ? '+' : ''}{m.change24h.toFixed(2)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* EXTREME FUNDING - Where pain is brewing */}
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.panelTitle}>
                            <Zap size={16} className={styles.icon} />
                            CROWDED TRADES
                        </div>
                        <small>Extreme Funding</small>
                    </div>
                    <div className={styles.panelBody}>
                        {loading ? <div className={styles.loading}>Loading...</div> : extremeFunding.map((m, i) => {
                            const fr = m.fundingRate || 0;
                            const isLongCrowded = fr > 0.0001;
                            return (
                                <div key={m.symbol} className={styles.mRow}>
                                    <span className={styles.rank}>{i + 1}</span>
                                    <span className={styles.symbol}>{m.symbol.replace('USDT', '')}</span>
                                    <span className={isLongCrowded ? styles.longCrowded : styles.shortCrowded}>
                                        {isLongCrowded ? 'LONG' : 'SHORT'}
                                    </span>
                                    <span className={fr >= 0 ? styles.pos : styles.neg}>
                                        {(fr * 100).toFixed(4)}%
                                    </span>
                                    <span className={styles.apr}>
                                        {(fr * 100 * 3 * 365).toFixed(0)}% APR
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* GAINERS vs LOSERS - Who's winning */}
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.panelTitle}>
                            <Trophy size={16} className={styles.icon} />
                            WINNERS & LOSERS
                        </div>
                        <small>24H Performance</small>
                    </div>
                    <div className={styles.splitBody}>
                        <div className={styles.splitCol}>
                            <div className={styles.splitHeader}>
                                <TrendingUp size={14} /> GAINERS
                            </div>
                            {topGainers.map((m, i) => (
                                <div key={m.symbol} className={styles.mRowSmall}>
                                    <span className={styles.symbol}>{m.symbol.replace('USDT', '')}</span>
                                    <span className={styles.pos}>+{m.change24h.toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                        <div className={styles.splitCol}>
                            <div className={`${styles.splitHeader} ${styles.neg}`}>
                                <TrendingDown size={14} /> LOSERS
                            </div>
                            {topLosers.map((m, i) => (
                                <div key={m.symbol} className={styles.mRowSmall}>
                                    <span className={styles.symbol}>{m.symbol.replace('USDT', '')}</span>
                                    <span className={styles.neg}>{m.change24h.toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* FUNDING DISTRIBUTION - Market bias */}
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.panelTitle}>
                            <TrendingUp size={16} className={styles.icon} />
                            MARKET BIAS
                        </div>
                        <small>Funding Distribution</small>
                    </div>
                    <div className={styles.biasBody}>
                        <div className={styles.biasBar}>
                            <div
                                className={styles.biasFill}
                                style={{
                                    width: `${(stats.positiveFunding / (stats.positiveFunding + stats.negativeFunding + 0.01)) * 100}%`,
                                    background: 'var(--positive)'
                                }}
                            />
                        </div>
                        <div className={styles.biasLabels}>
                            <span className={styles.pos}>{stats.positiveFunding} LONG PAYING</span>
                            <span className={styles.neg}>{stats.negativeFunding} SHORT PAYING</span>
                        </div>
                        <div className={styles.biasConclusion}>
                            {stats.positiveFunding > stats.negativeFunding * 1.5 ? (
                                <>
                                    <Circle size={14} fill="#ef4444" stroke="none" />
                                    <span>Market is long-biased (potential correction)</span>
                                </>
                            ) : stats.negativeFunding > stats.positiveFunding * 1.5 ? (
                                <>
                                    <Circle size={14} fill="#22c55e" stroke="none" />
                                    <span>Market is short-biased (potential squeeze)</span>
                                </>
                            ) : (
                                <>
                                    <Circle size={14} fill="#9ca3af" stroke="none" />
                                    <span>Balanced positioning</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
