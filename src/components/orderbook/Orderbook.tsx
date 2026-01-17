/**
 * Orderbook Component
 * Aggregated depth visualization with walls and imbalance
 */

'use client';

import { useMemo } from 'react';
import { useTranslation, formatPrice } from '@/lib/i18n';
import type { Orderbook as OrderbookType, OrderbookLevel } from '@/lib/types';
import styles from './Orderbook.module.css';

interface OrderbookProps {
    data: OrderbookType | null;
    maxLevels?: number;
}

export default function Orderbook({ data, maxLevels = 15 }: OrderbookProps) {
    const { t, locale } = useTranslation();

    // Calculate max cumulative for depth bars
    const { maxBidTotal, maxAskTotal, wallThreshold } = useMemo(() => {
        if (!data) return { maxBidTotal: 0, maxAskTotal: 0, wallThreshold: 0 };

        const maxBid = data.bids[maxLevels - 1]?.total || 0;
        const maxAsk = data.asks[maxLevels - 1]?.total || 0;

        // Wall threshold: orders > 3x average size
        const allSizes = [...data.bids, ...data.asks].map((l) => l.size);
        const avgSize = allSizes.reduce((a, b) => a + b, 0) / allSizes.length;

        return {
            maxBidTotal: maxBid,
            maxAskTotal: maxAsk,
            wallThreshold: avgSize * 3,
        };
    }, [data, maxLevels]);

    // Calculate imbalance indicator
    const imbalancePercent = data ? (data.imbalance * 100).toFixed(1) : '0';
    const imbalanceColor = data && data.imbalance > 0 ? 'positive' : data && data.imbalance < 0 ? 'negative' : 'neutral';

    if (!data) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <span className={styles.title}>{t('terminal.orderbook')}</span>
                </div>
                <div className={styles.loading}>
                    <div className="skeleton" style={{ width: '100%', height: '300px' }} />
                </div>
            </div>
        );
    }

    const renderLevel = (level: OrderbookLevel, side: 'bid' | 'ask', maxTotal: number) => {
        const depthPercent = maxTotal > 0 ? (level.total / maxTotal) * 100 : 0;
        const isWall = level.size > wallThreshold;

        return (
            <div
                key={`${side}-${level.price}`}
                className={`${styles.level} ${styles[side]} ${isWall ? styles.wall : ''}`}
            >
                <div
                    className={styles.depthBar}
                    style={{ width: `${Math.min(depthPercent, 100)}%` }}
                />
                <span className={`${styles.price} mono`}>
                    {formatPrice(level.price, locale)}
                </span>
                <span className={`${styles.size} mono`}>
                    {level.size.toFixed(4)}
                </span>
                <span className={`${styles.total} mono`}>
                    {level.total.toFixed(2)}
                </span>
            </div>
        );
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.title}>{t('terminal.orderbook')}</span>
                <div className={styles.stats}>
                    <span className={styles.spread}>
                        {t('terminal.spread')}: <span className="mono">{formatPrice(data.spread, locale)}</span>
                        <span className={styles.spreadBps}>({data.spreadBps.toFixed(1)} bps)</span>
                    </span>
                </div>
            </div>

            {/* Imbalance Indicator */}
            <div className={styles.imbalance}>
                <div className={styles.imbalanceBar}>
                    <div
                        className={styles.imbalanceFill}
                        style={{
                            width: `${50 + data.imbalance * 50}%`,
                            background: data.imbalance > 0 ? 'var(--bid)' : 'var(--ask)',
                        }}
                    />
                </div>
                <span className={`${styles.imbalanceValue} ${imbalanceColor}`}>
                    {data.imbalance > 0 ? '+' : ''}{imbalancePercent}%
                </span>
            </div>

            {/* Column Headers */}
            <div className={styles.columns}>
                <span>{t('terminal.price')}</span>
                <span>{t('terminal.size')}</span>
                <span>{t('terminal.total')}</span>
            </div>

            {/* Asks (reversed - highest at top) */}
            <div className={styles.asks}>
                {data.asks.slice(0, maxLevels).reverse().map((level) =>
                    renderLevel(level, 'ask', maxAskTotal)
                )}
            </div>

            {/* Spread Divider */}
            <div className={styles.spreadDivider}>
                <span className={`${styles.currentPrice} mono`}>
                    {formatPrice((data.bids[0]?.price || 0 + data.asks[0]?.price || 0) / 2, locale)}
                </span>
            </div>

            {/* Bids */}
            <div className={styles.bids}>
                {data.bids.slice(0, maxLevels).map((level) =>
                    renderLevel(level, 'bid', maxBidTotal)
                )}
            </div>
        </div>
    );
}
