/**
 * Funding Rate Widget
 * Current funding rate with countdown and annualized rate
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslation, formatFunding } from '@/lib/i18n';
import type { FundingRate } from '@/lib/types';
import styles from './FundingWidget.module.css';

interface FundingWidgetProps {
    data: FundingRate | null;
}

export default function FundingWidget({ data }: FundingWidgetProps) {
    const { t } = useTranslation();
    const [countdown, setCountdown] = useState('--:--:--');

    // Update countdown timer
    useEffect(() => {
        if (!data?.nextFundingTime) return;

        const updateCountdown = () => {
            const now = Date.now();
            const diff = data.nextFundingTime - now;

            if (diff <= 0) {
                setCountdown('00:00:00');
                return;
            }

            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);

            setCountdown(
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            );
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [data?.nextFundingTime]);

    // Annualized rate (8h funding * 3 * 365)
    const annualized = data ? (data.rate * 3 * 365 * 100).toFixed(2) : '--';
    const rateColor = data && data.rate > 0 ? 'positive' : data && data.rate < 0 ? 'negative' : 'neutral';

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.title}>{t('widgets.funding.title')}</span>
            </div>

            <div className={styles.content}>
                <div className={styles.row}>
                    <span className={styles.label}>{t('widgets.funding.current')}</span>
                    <span className={`${styles.value} ${styles[rateColor]} mono`}>
                        {data ? formatFunding(data.rate) : '--'}
                    </span>
                </div>

                <div className={styles.row}>
                    <span className={styles.label}>{t('widgets.funding.annualized')}</span>
                    <span className={`${styles.value} ${styles[rateColor]} mono`}>
                        {annualized}%
                    </span>
                </div>

                <div className={styles.countdown}>
                    <span className={styles.label}>{t('widgets.funding.countdown')}</span>
                    <span className={`${styles.timer} mono`}>{countdown}</span>
                </div>
            </div>
        </div>
    );
}
