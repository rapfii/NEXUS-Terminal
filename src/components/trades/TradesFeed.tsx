/**
 * Trades Feed Component
 * Real-time trade stream with size highlighting
 */

'use client';

import { useMemo } from 'react';
import { useTranslation, formatPrice, formatTime } from '@/lib/i18n';
import type { Trade } from '@/lib/types';
import styles from './TradesFeed.module.css';

interface TradesFeedProps {
    trades: Trade[];
    maxTrades?: number;
}

export default function TradesFeed({ trades, maxTrades = 50 }: TradesFeedProps) {
    const { t, locale } = useTranslation();

    // Calculate size thresholds for highlighting
    const sizeThresholds = useMemo(() => {
        if (trades.length < 5) return { large: Infinity, medium: Infinity };

        const sizes = trades.map((t) => t.size).sort((a, b) => a - b);
        const p75 = sizes[Math.floor(sizes.length * 0.75)];
        const p90 = sizes[Math.floor(sizes.length * 0.90)];

        return { medium: p75, large: p90 };
    }, [trades]);

    const getSizeClass = (size: number): string => {
        if (size >= sizeThresholds.large) return styles.large;
        if (size >= sizeThresholds.medium) return styles.medium;
        return '';
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.title}>{t('terminal.trades')}</span>
                {trades.length > 0 && (
                    <span className="live-indicator">
                        <span className="live-dot" />
                        {t('common.live')}
                    </span>
                )}
            </div>

            <div className={styles.columns}>
                <span>{t('terminal.price')}</span>
                <span>{t('terminal.size')}</span>
                <span>{t('terminal.time')}</span>
            </div>

            <div className={styles.trades}>
                {trades.length === 0 ? (
                    <div className={styles.empty}>
                        {t('common.noData')}
                    </div>
                ) : (
                    trades.slice(0, maxTrades).map((trade) => (
                        <div
                            key={trade.id}
                            className={`${styles.trade} ${styles[trade.side]} ${getSizeClass(trade.size)}`}
                        >
                            <span className={`${styles.price} mono`}>
                                {formatPrice(trade.price, locale)}
                            </span>
                            <span className={`${styles.size} mono`}>
                                {trade.size.toFixed(4)}
                            </span>
                            <span className={`${styles.time} mono`}>
                                {formatTime(trade.timestamp, locale)}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
