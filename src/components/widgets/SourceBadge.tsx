'use client';

import { useState, useEffect } from 'react';
import { Zap, Clock, Database, Circle } from 'lucide-react';
import styles from './SourceBadge.module.css';
import type { DataMeta, DataSLA } from '@/lib/types/data-health';
import { formatAge } from '@/lib/types/data-health';

// ============================================
// TYPES
// ============================================

interface SourceBadgeProps {
    /** Data metadata */
    meta?: DataMeta | null;
    /** Compact mode (just icon + age) */
    compact?: boolean;
    /** Position of badge */
    position?: 'top-right' | 'bottom-right' | 'inline';
}

// ============================================
// COMPONENT
// ============================================

/**
 * Source attribution badge for widgets
 * Shows source, freshness, and stale status
 */
export default function SourceBadge({
    meta,
    compact = false,
    position = 'top-right'
}: SourceBadgeProps) {
    const [age, setAge] = useState<string>('—');

    // Update age display every second
    useEffect(() => {
        if (!meta) return;

        const updateAge = () => {
            setAge(formatAge(meta.dataTimestamp));
        };

        updateAge();
        const interval = setInterval(updateAge, 1000);
        return () => clearInterval(interval);
    }, [meta]);

    if (!meta) {
        return (
            <div className={`${styles.badge} ${styles.noData} ${styles[position]}`}>
                <span className={styles.icon}><Circle size={10} /></span>
                {!compact && <span className={styles.text}>No data</span>}
            </div>
        );
    }

    const getSLAIcon = (sla: DataSLA) => {
        switch (sla) {
            case 'REAL_TIME': return <Zap size={10} fill="currentColor" />;
            case 'NEAR_REAL_TIME': return <Clock size={10} />;
            case 'BATCHED': return <Database size={10} />;
        }
    };

    const getStatusClass = () => {
        if (meta.isMock) return styles.mock;
        if (meta.stale) return styles.stale;
        if (meta.confidence > 0.8) return styles.fresh;
        if (meta.confidence > 0.5) return styles.ok;
        return styles.warning;
    };

    const getSourceLabel = (source: string) => {
        const labels: Record<string, string> = {
            binance: 'BIN',
            bybit: 'BYB',
            okx: 'OKX',
            deribit: 'DRB',
            kraken: 'KRK',
            coinbase: 'CB',
            kucoin: 'KUC',
            gateio: 'GIO',
            coingecko: 'CG',
            aggregated: 'AGG',
            mock: 'MOCK',
        };
        return labels[source] || source.toUpperCase().slice(0, 3);
    };

    return (
        <div
            className={`${styles.badge} ${getStatusClass()} ${styles[position]}`}
            title={`Source: ${meta.source}${meta.sources ? ` (${meta.sources.join(', ')})` : ''}\nLatency: ${meta.latency}ms\nConfidence: ${Math.round(meta.confidence * 100)}%\nSLA: ${meta.sla}`}
        >
            {/* Status indicator */}
            <span className={styles.statusDot} />

            {/* SLA icon */}
            <span className={styles.slaIcon}>{getSLAIcon(meta.sla)}</span>

            {!compact && (
                <>
                    {/* Source */}
                    <span className={styles.source}>{getSourceLabel(meta.source)}</span>

                    {/* Separator */}
                    <span className={styles.sep}>·</span>
                </>
            )}

            {/* Age */}
            <span className={styles.age}>{age}</span>

            {/* Stale/Mock warning */}
            {meta.stale && <span className={styles.staleTag}>STALE</span>}
            {meta.isMock && <span className={styles.mockTag}>MOCK</span>}
        </div>
    );
}

// ============================================
// WRAPPER COMPONENT
// ============================================

interface WithSourceBadgeProps {
    meta?: DataMeta | null;
    children: React.ReactNode;
    compact?: boolean;
}

/**
 * Wrapper that adds source badge to any widget
 */
export function WidgetWithSource({ meta, children, compact = false }: WithSourceBadgeProps) {
    return (
        <div className={styles.wrapper}>
            {children}
            <SourceBadge meta={meta} compact={compact} />
        </div>
    );
}
