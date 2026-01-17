'use client';

/**
 * Squeeze Evidence Panel
 * Shows the "WHY" behind squeeze detection
 * Per-exchange breakdown with explicit rule states
 */

import { useState } from 'react';
import styles from './SqueezeEvidence.module.css';
import type { SqueezeSignal, SqueezeComponent } from '@/lib/types-extended';
import { ArrowUp, ArrowDown, Check, X } from 'lucide-react';

interface SqueezeEvidenceProps {
    squeeze: SqueezeSignal;
    onClose?: () => void;
}

interface ExchangeBreakdown {
    exchange: string;
    oiContribution: number;
    fundingRate: number;
    longRatio: number;
    shortRatio: number;
    liquidationDistance: number;
}

// Mock exchange breakdown - would come from real aggregator
const MOCK_BREAKDOWN: ExchangeBreakdown[] = [
    { exchange: 'Binance', oiContribution: 45, fundingRate: 0.00035, longRatio: 58, shortRatio: 42, liquidationDistance: 2.3 },
    { exchange: 'Bybit', oiContribution: 30, fundingRate: 0.00032, longRatio: 56, shortRatio: 44, liquidationDistance: 2.8 },
    { exchange: 'OKX', oiContribution: 25, fundingRate: 0.00028, longRatio: 54, shortRatio: 46, liquidationDistance: 3.1 },
];

export default function SqueezeEvidence({ squeeze, onClose }: SqueezeEvidenceProps) {
    const [activeTab, setActiveTab] = useState<'rules' | 'exchanges' | 'cascade'>('rules');

    const getComponentStatus = (component: SqueezeComponent) => {
        if (!component.active) return 'inactive';
        if (component.contribution > 0.8) return 'strong';
        if (component.contribution > 0.5) return 'active';
        return 'weak';
    };

    const formatValue = (component: SqueezeComponent) => {
        const val = component.value;
        if (component.name.includes('Funding')) return `${(val * 100).toFixed(4)}%`;
        if (component.name.includes('Ratio') || component.name.includes('Imbalance')) return `${(val * 100).toFixed(1)}%`;
        if (component.name.includes('OI') || component.name.includes('Open Interest')) return `${(val * 100).toFixed(2)}%`;
        return val.toFixed(2);
    };

    const formatThreshold = (component: SqueezeComponent) => {
        const val = component.threshold;
        if (component.name.includes('Funding')) return `>${(val * 100).toFixed(3)}%`;
        if (component.name.includes('Imbalance')) return `>${(val * 100).toFixed(0)}%`;
        if (component.name.includes('OI')) return `>${(val * 100).toFixed(1)}%`;
        return `>${val.toFixed(2)}`;
    };

    return (
        <div className={styles.panel}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.title}>
                    <span className={squeeze.type === 'LONG_SQUEEZE' ? styles.longIcon : styles.shortIcon}>
                        {squeeze.type === 'LONG_SQUEEZE' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                    </span>
                    <span>{squeeze.symbol}</span>
                    <span className={`${styles.strength} ${styles[squeeze.strength.toLowerCase()]}`}>
                        {squeeze.strength}
                    </span>
                </div>
                <div className={styles.probability}>
                    <span className={styles.probValue}>{squeeze.probability.toFixed(0)}%</span>
                    <span className={styles.probLabel}>PROBABILITY</span>
                </div>
                {onClose && (
                    <button className={styles.closeBtn} onClick={onClose}>×</button>
                )}
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'rules' ? styles.active : ''}`}
                    onClick={() => setActiveTab('rules')}
                >
                    Rule States
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'exchanges' ? styles.active : ''}`}
                    onClick={() => setActiveTab('exchanges')}
                >
                    By Exchange
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'cascade' ? styles.active : ''}`}
                    onClick={() => setActiveTab('cascade')}
                >
                    Cascade Risk
                </button>
            </div>

            {/* Content */}
            <div className={styles.content}>
                {activeTab === 'rules' && (
                    <div className={styles.rulesPanel}>
                        <p className={styles.rulesExplain}>
                            Squeeze requires multiple conditions. Each rule shows current value vs threshold.
                        </p>
                        <div className={styles.rulesList}>
                            {Object.entries(squeeze.components).map(([key, component]) => (
                                <div
                                    key={key}
                                    className={`${styles.rule} ${styles[getComponentStatus(component)]}`}
                                >
                                    <div className={styles.ruleIcon}>
                                        {component.active ? <Check size={14} /> : <X size={14} />}
                                    </div>
                                    <div className={styles.ruleInfo}>
                                        <div className={styles.ruleName}>{component.name}</div>
                                        <div className={styles.ruleValues}>
                                            <span className={styles.currentValue}>{formatValue(component)}</span>
                                            <span className={styles.threshold}>{formatThreshold(component)}</span>
                                        </div>
                                    </div>
                                    <div className={styles.contributeBar}>
                                        <div
                                            className={styles.contributeFill}
                                            style={{ width: `${component.contribution * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'exchanges' && (
                    <div className={styles.exchangesPanel}>
                        <p className={styles.rulesExplain}>
                            Per-exchange contribution to squeeze conditions.
                        </p>
                        <div className={styles.exchangeGrid}>
                            {MOCK_BREAKDOWN.map(ex => (
                                <div key={ex.exchange} className={styles.exchangeCard}>
                                    <div className={styles.exchangeHeader}>
                                        <span className={styles.exchangeName}>{ex.exchange}</span>
                                        <span className={styles.oiShare}>{ex.oiContribution}% OI</span>
                                    </div>
                                    <div className={styles.exchangeMetrics}>
                                        <div className={styles.metric}>
                                            <span className={styles.metricLabel}>Funding</span>
                                            <span className={`${styles.metricValue} ${ex.fundingRate > 0.0003 ? styles.extreme : ''}`}>
                                                {(ex.fundingRate * 100).toFixed(3)}%
                                            </span>
                                        </div>
                                        <div className={styles.metric}>
                                            <span className={styles.metricLabel}>Long/Short</span>
                                            <span className={styles.metricValue}>
                                                {ex.longRatio}/{ex.shortRatio}
                                            </span>
                                        </div>
                                        <div className={styles.metric}>
                                            <span className={styles.metricLabel}>Liq Distance</span>
                                            <span className={`${styles.metricValue} ${ex.liquidationDistance < 3 ? styles.danger : ''}`}>
                                                {ex.liquidationDistance}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'cascade' && (
                    <div className={styles.cascadePanel}>
                        <p className={styles.rulesExplain}>
                            Estimated liquidation cascade risk if price moves against trapped positions.
                        </p>
                        <div className={styles.cascadeVisual}>
                            <div className={styles.cascadeHeader}>
                                <span>TRIGGER ZONE</span>
                                <span className={styles.triggerRange}>
                                    ${squeeze.triggerZone.low.toFixed(2)} - ${squeeze.triggerZone.high.toFixed(2)}
                                </span>
                            </div>
                            <div className={styles.cascadeMeter}>
                                <div className={styles.cascadeZone} style={{ left: '30%', width: '20%' }}>
                                    <span>L1</span>
                                </div>
                                <div className={styles.cascadeZone} style={{ left: '50%', width: '25%' }}>
                                    <span>L2</span>
                                </div>
                                <div className={styles.cascadeZone} style={{ left: '75%', width: '20%' }}>
                                    <span>L3</span>
                                </div>
                            </div>
                            <div className={styles.cascadeStats}>
                                <div className={styles.cascadeStat}>
                                    <span className={styles.statLabel}>Nearest Liq Price</span>
                                    <span className={styles.statValue}>
                                        ${squeeze.nearestLiquidationPrice.toFixed(2)}
                                    </span>
                                </div>
                                <div className={styles.cascadeStat}>
                                    <span className={styles.statLabel}>Est. Liq Value</span>
                                    <span className={styles.statValue}>
                                        ${(squeeze.estimatedLiquidationValue / 1e6).toFixed(2)}M
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
