'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLanguageStore } from '@/stores';
import { formatLargeNumber } from '@/lib/i18n';
import { useLiquidations } from '@/hooks';
import type { LiquidationEvent } from '@/lib/websocket';
import {
    TrendingUp,
    TrendingDown,
    Diamond,
    Star,
    Circle,
    ArrowRight,
    ArrowUpRight,
    ArrowDownRight,
    Zap,
    Skull,
    DollarSign
} from 'lucide-react';
import styles from './WarRoom.module.css';

interface IntelligenceData {
    regime: {
        current: string;
        confidence: number;
        score: number;
        drivers: string[];
        isTransitioning: boolean;
    };
    rotation: {
        phase: string;
        confidence: number;
        flowingInto: string[];
        flowingOutOf: string[];
    };
    pressure: {
        btc: {
            trappedSide: string;
            longValueAtRisk: number;
            shortValueAtRisk: number;
            squeezeProbability: number;
            squeezeDirection: string | null;
        } | null;
        eth: {
            trappedSide: string;
            longValueAtRisk: number;
            shortValueAtRisk: number;
            squeezeProbability: number;
            squeezeDirection: string | null;
        } | null;
    };
    topSqueezes: {
        symbol: string;
        type: string;
        strength: string;
        probability: number;
    }[];
    liquidations24h: {
        long: number;
        short: number;
        longValue: number;
        shortValue: number;
        pressure: string;
    };
    stablecoinDelta: {
        total: number;
        change24h: number;
        change7d: number;
        interpretation: string;
    };
    capitalFlow: {
        btcDominanceChange: number;
        ethBtcChange: number;
        defiToAlt: boolean;
        riskAppetite: 'high' | 'medium' | 'low';
    };
    timestamp: number;
}

// Regime colors and icons
const REGIME_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
    RISK_ON: { icon: <TrendingUp size={16} />, color: '#22c55e' },
    RISK_OFF: { icon: <TrendingDown size={16} />, color: '#ef4444' },
    ACCUMULATION: { icon: <Diamond size={16} />, color: '#3b82f6' },
    DISTRIBUTION: { icon: <Diamond size={16} />, color: '#f97316' },
    SPECULATION: { icon: <Star size={16} />, color: '#a855f7' },
    NEUTRAL: { icon: <Circle size={16} />, color: '#facc15' },
};

export function WarRoom() {
    const { locale } = useLanguageStore();
    const [intelligence, setIntelligence] = useState<IntelligenceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Real-time liquidation stream
    const { liquidations: liveLiqs, stats: liqStats } = useLiquidations(undefined, 30);


    const fetchIntelligence = useCallback(async () => {
        try {
            const res = await fetch('/api/intelligence');
            const data = await res.json();

            if (data.success && data.data) {
                setIntelligence(data.data);
                setError(null);
            } else {
                setError(data.error || 'Failed to fetch intelligence');
            }
        } catch (e) {
            console.error('Intelligence fetch error:', e);
            setError('Connection error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchIntelligence();
        const interval = setInterval(fetchIntelligence, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [fetchIntelligence]);

    if (loading) {
        return (
            <div className={styles.warRoom}>
                <div className={styles.loading}>Loading market intelligence...</div>
            </div>
        );
    }

    if (error || !intelligence) {
        return (
            <div className={styles.warRoom}>
                <div className={styles.noData}>
                    {error || 'No intelligence data available'}
                    <br />
                    <button onClick={fetchIntelligence} style={{ marginTop: '1rem', cursor: 'pointer' }}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const regime = intelligence.regime;
    const regimeConfig = REGIME_CONFIG[regime.current] || REGIME_CONFIG.NEUTRAL;

    const formatValue = (v: number) => formatLargeNumber(v, locale);
    const formatPercent = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

    // Calculate max value for pressure gauge scaling
    const btcMaxRisk = Math.max(
        intelligence.pressure.btc?.longValueAtRisk || 0,
        intelligence.pressure.btc?.shortValueAtRisk || 0,
        1
    );
    const ethMaxRisk = Math.max(
        intelligence.pressure.eth?.longValueAtRisk || 0,
        intelligence.pressure.eth?.shortValueAtRisk || 0,
        1
    );

    return (
        <div className={styles.warRoom}>
            {/* REGIME BANNER */}
            <div
                className={styles.regimeBanner}
                style={{ borderLeftColor: regimeConfig.color }}
            >
                <div className={styles.regimeMain}>
                    <span className={styles.regimeIcon} style={{ color: regimeConfig.color }}>
                        {regimeConfig.icon}
                    </span>
                    <div>
                        <div className={styles.regimeLabel}>MARKET REGIME</div>
                        <div className={styles.regimeValue} style={{ color: regimeConfig.color }}>
                            {regime.current.replace('_', ' ')}
                            <span className={styles.regimeConfidence}>
                                {regime.confidence}% confidence
                            </span>
                        </div>
                    </div>
                    <div className={styles.regimeDrivers}>
                        {regime.drivers.slice(0, 4).map((driver, i) => (
                            <span key={i} className={styles.driver}>{driver}</span>
                        ))}
                    </div>
                </div>
                <div className={styles.regimeMeta}>
                    <div className={styles.stablecoinFlow}>
                        <small>STABLECOIN</small>
                        <span className={intelligence.stablecoinDelta.change24h >= 0 ? styles.pos : styles.neg}>
                            {formatPercent(intelligence.stablecoinDelta.change24h)}
                        </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {intelligence.stablecoinDelta.interpretation}
                    </div>
                </div>
            </div>

            {/* ROTATION STRIP */}
            <div className={styles.rotationStrip}>
                <span className={styles.rotationLabel}>CAPITAL ROTATION</span>
                <span className={styles.rotationArrow}><ArrowRight size={16} /></span>
                <span className={styles.rotationPhase}>
                    {intelligence.rotation.phase.replace(/_/g, ' ')}
                </span>
                <div className={styles.flowSection}>
                    {intelligence.rotation.flowingInto.slice(0, 3).map((item, i) => (
                        <span key={i} className={`${styles.flowItem} ${styles.flowIn}`}>
                            <ArrowUpRight size={14} /> {item}
                        </span>
                    ))}
                    {intelligence.rotation.flowingOutOf.slice(0, 2).map((item, i) => (
                        <span key={i} className={`${styles.flowItem} ${styles.flowOut}`}>
                            <ArrowDownRight size={14} /> {item}
                        </span>
                    ))}
                </div>
            </div>

            {/* PRESSURE SECTION */}
            <div className={styles.pressureSection}>
                {/* BTC Pressure Card */}
                <div className={styles.pressureCard}>
                    <div className={styles.pressureHeader}>
                        <span className={styles.pressureSymbol}>BTC</span>
                        {intelligence.pressure.btc && (
                            <span
                                className={`${styles.pressureStatus} ${intelligence.pressure.btc.trappedSide === 'longs' ? styles.longsTrapped :
                                    intelligence.pressure.btc.trappedSide === 'shorts' ? styles.shortsTrapped :
                                        styles.noneTrapped
                                    }`}
                            >
                                {intelligence.pressure.btc.trappedSide === 'none'
                                    ? 'BALANCED'
                                    : `${intelligence.pressure.btc.trappedSide.toUpperCase()} TRAPPED`}
                            </span>
                        )}
                    </div>

                    {intelligence.pressure.btc ? (
                        <>
                            <div className={styles.pressureGauge}>
                                <div className={styles.gaugeRow}>
                                    <span className={styles.gaugeLabel}>Longs at Risk</span>
                                    <div className={styles.gaugeBar}>
                                        <div
                                            className={`${styles.gaugeFill} ${styles.gaugeFillLong}`}
                                            style={{
                                                width: `${(intelligence.pressure.btc.longValueAtRisk / btcMaxRisk) * 100}%`
                                            }}
                                        />
                                    </div>
                                    <span className={styles.gaugeValue}>
                                        ${formatValue(intelligence.pressure.btc.longValueAtRisk)}
                                    </span>
                                </div>
                                <div className={styles.gaugeRow}>
                                    <span className={styles.gaugeLabel}>Shorts at Risk</span>
                                    <div className={styles.gaugeBar}>
                                        <div
                                            className={`${styles.gaugeFill} ${styles.gaugeFillShort}`}
                                            style={{
                                                width: `${(intelligence.pressure.btc.shortValueAtRisk / btcMaxRisk) * 100}%`
                                            }}
                                        />
                                    </div>
                                    <span className={styles.gaugeValue}>
                                        ${formatValue(intelligence.pressure.btc.shortValueAtRisk)}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.squeezeProb}>
                                <span className={styles.squeezeLabel}>
                                    {intelligence.pressure.btc.squeezeDirection
                                        ? `${intelligence.pressure.btc.squeezeDirection.toUpperCase()} SQUEEZE PROBABILITY`
                                        : 'SQUEEZE PROBABILITY'}
                                </span>
                                <span
                                    className={`${styles.squeezeValue} ${intelligence.pressure.btc.squeezeProbability >= 60 ? styles.squeezeHigh :
                                        intelligence.pressure.btc.squeezeProbability >= 40 ? styles.squeezeMedium :
                                            styles.squeezeLow
                                        }`}
                                >
                                    {intelligence.pressure.btc.squeezeProbability.toFixed(0)}%
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className={styles.noData}>No pressure data</div>
                    )}
                </div>

                {/* ETH Pressure Card */}
                <div className={styles.pressureCard}>
                    <div className={styles.pressureHeader}>
                        <span className={styles.pressureSymbol}>ETH</span>
                        {intelligence.pressure.eth && (
                            <span
                                className={`${styles.pressureStatus} ${intelligence.pressure.eth.trappedSide === 'longs' ? styles.longsTrapped :
                                    intelligence.pressure.eth.trappedSide === 'shorts' ? styles.shortsTrapped :
                                        styles.noneTrapped
                                    }`}
                            >
                                {intelligence.pressure.eth.trappedSide === 'none'
                                    ? 'BALANCED'
                                    : `${intelligence.pressure.eth.trappedSide.toUpperCase()} TRAPPED`}
                            </span>
                        )}
                    </div>

                    {intelligence.pressure.eth ? (
                        <>
                            <div className={styles.pressureGauge}>
                                <div className={styles.gaugeRow}>
                                    <span className={styles.gaugeLabel}>Longs at Risk</span>
                                    <div className={styles.gaugeBar}>
                                        <div
                                            className={`${styles.gaugeFill} ${styles.gaugeFillLong}`}
                                            style={{
                                                width: `${(intelligence.pressure.eth.longValueAtRisk / ethMaxRisk) * 100}%`
                                            }}
                                        />
                                    </div>
                                    <span className={styles.gaugeValue}>
                                        ${formatValue(intelligence.pressure.eth.longValueAtRisk)}
                                    </span>
                                </div>
                                <div className={styles.gaugeRow}>
                                    <span className={styles.gaugeLabel}>Shorts at Risk</span>
                                    <div className={styles.gaugeBar}>
                                        <div
                                            className={`${styles.gaugeFill} ${styles.gaugeFillShort}`}
                                            style={{
                                                width: `${(intelligence.pressure.eth.shortValueAtRisk / ethMaxRisk) * 100}%`
                                            }}
                                        />
                                    </div>
                                    <span className={styles.gaugeValue}>
                                        ${formatValue(intelligence.pressure.eth.shortValueAtRisk)}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.squeezeProb}>
                                <span className={styles.squeezeLabel}>
                                    {intelligence.pressure.eth.squeezeDirection
                                        ? `${intelligence.pressure.eth.squeezeDirection.toUpperCase()} SQUEEZE PROBABILITY`
                                        : 'SQUEEZE PROBABILITY'}
                                </span>
                                <span
                                    className={`${styles.squeezeValue} ${intelligence.pressure.eth.squeezeProbability >= 60 ? styles.squeezeHigh :
                                        intelligence.pressure.eth.squeezeProbability >= 40 ? styles.squeezeMedium :
                                            styles.squeezeLow
                                        }`}
                                >
                                    {intelligence.pressure.eth.squeezeProbability.toFixed(0)}%
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className={styles.noData}>No pressure data</div>
                    )}
                </div>
            </div>

            {/* BOTTOM GRID */}
            <div className={styles.grid}>
                {/* TOP SQUEEZE CANDIDATES */}
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.panelTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Zap size={16} /> SQUEEZE CANDIDATES
                        </div>
                        <small>Real-time detection</small>
                    </div>
                    <div className={styles.panelBody}>
                        {intelligence.topSqueezes.length === 0 ? (
                            <div className={styles.noData}>No active squeeze setups</div>
                        ) : (
                            intelligence.topSqueezes.map((squeeze, i) => (
                                <div key={i} className={styles.squeezeCandidate}>
                                    <span className={styles.squeezeCandidateSymbol}>
                                        {squeeze.symbol.replace('USDT', '')}
                                    </span>
                                    <span
                                        className={`${styles.squeezeCandidateType} ${squeeze.type === 'SHORT_SQUEEZE' ? styles.shortSqueeze : styles.longSqueeze
                                            }`}
                                    >
                                        {squeeze.type.replace('_', ' ')}
                                    </span>
                                    <span className={styles.squeezeCandidateStrength}>
                                        {squeeze.strength}
                                    </span>
                                    <span
                                        className={`${styles.squeezeCandidateProb} ${squeeze.probability >= 60 ? styles.squeezeHigh :
                                            squeeze.probability >= 40 ? styles.squeezeMedium :
                                                styles.squeezeLow
                                            }`}
                                    >
                                        {squeeze.probability.toFixed(0)}%
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* LIQUIDATIONS - LIVE STREAM */}
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.panelTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Skull size={16} /> LIQUIDATIONS LIVE
                        </div>
                        <small style={{ color: liveLiqs.length > 0 ? '#22c55e' : '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {liveLiqs.length > 0 ? <><Circle size={8} fill="currentColor" /> STREAMING</> : <><Circle size={8} /> Waiting...</>}
                        </small>
                    </div>
                    <div className={styles.panelBody}>
                        {/* 1 Minute Stats */}
                        <div className={styles.stableRow}>
                            <span className={styles.stableName}>Longs (1m)</span>
                            <span className={`${styles.stableValue} ${styles.neg}`}>
                                ${formatValue(liqStats.longValue1m)} ({liqStats.longLiqs1m})
                            </span>
                        </div>
                        <div className={styles.stableRow}>
                            <span className={styles.stableName}>Shorts (1m)</span>
                            <span className={`${styles.stableValue} ${styles.pos}`}>
                                ${formatValue(liqStats.shortValue1m)} ({liqStats.shortLiqs1m})
                            </span>
                        </div>

                        {/* Live Feed */}
                        <div style={{
                            marginTop: '8px',
                            paddingTop: '8px',
                            borderTop: '1px solid var(--border)',
                            maxHeight: '120px',
                            overflow: 'hidden'
                        }}>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                RECENT LIQUIDATIONS
                            </div>
                            {liveLiqs.length === 0 ? (
                                <div className={styles.noData}>Waiting for liquidations...</div>
                            ) : (
                                liveLiqs.slice(0, 6).map((liq, i) => (
                                    <div
                                        key={`${liq.timestamp}-${i}`}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            fontSize: '10px',
                                            padding: '2px 0',
                                            opacity: 1 - (i * 0.1),
                                            color: liq.side === 'long' ? '#ef4444' : '#22c55e'
                                        }}
                                    >
                                        <span>{liq.symbol.replace('USDT', '')}</span>
                                        <span>{liq.side.toUpperCase()}</span>
                                        <span>${formatValue(liq.value)}</span>
                                        <span style={{ color: '#888' }}>{liq.exchange}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* 24H Stats from API */}
                        <div className={styles.stableRow} style={{ paddingTop: '8px', borderTop: '1px solid var(--border)', marginTop: '8px' }}>
                            <span className={styles.stableName}>24H Total</span>
                            <span className={styles.stableValue}>
                                ${formatValue(intelligence.liquidations24h.longValue + intelligence.liquidations24h.shortValue)}
                            </span>
                        </div>
                    </div>
                </div>


                {/* STABLECOIN FLOWS */}
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.panelTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <DollarSign size={16} /> STABLECOIN SUPPLY
                        </div>
                        <small>Capital flow indicator</small>
                    </div>
                    <div className={styles.panelBody}>
                        <div className={styles.stableRow}>
                            <span className={styles.stableName}>Total Supply</span>
                            <span className={styles.stableValue}>
                                ${formatValue(intelligence.stablecoinDelta.total)}
                            </span>
                        </div>
                        <div className={styles.stableRow}>
                            <span className={styles.stableName}>24H Change</span>
                            <span className={`${styles.stableChange} ${intelligence.stablecoinDelta.change24h >= 0 ? styles.pos : styles.neg
                                }`}>
                                {formatPercent(intelligence.stablecoinDelta.change24h)}
                            </span>
                        </div>
                        <div className={styles.stableRow}>
                            <span className={styles.stableName}>7D Change</span>
                            <span className={`${styles.stableChange} ${intelligence.stablecoinDelta.change7d >= 0 ? styles.pos : styles.neg
                                }`}>
                                {formatPercent(intelligence.stablecoinDelta.change7d)}
                            </span>
                        </div>
                        <div style={{
                            marginTop: '0.75rem',
                            paddingTop: '0.75rem',
                            borderTop: '1px solid var(--border)',
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)'
                        }}>
                            {intelligence.stablecoinDelta.interpretation}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default WarRoom;
