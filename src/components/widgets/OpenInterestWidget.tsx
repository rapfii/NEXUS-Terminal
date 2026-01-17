/**
 * Open Interest Widget
 * Current OI and 24h change
 */

'use client';

import { useTranslation, formatLargeNumber, formatPercent } from '@/lib/i18n';
import type { OpenInterest } from '@/lib/types';
import styles from './OpenInterestWidget.module.css';

interface OpenInterestWidgetProps {
    data: OpenInterest | null;
    change24h?: number;
}

export default function OpenInterestWidget({ data, change24h = 0 }: OpenInterestWidgetProps) {
    const { t, locale } = useTranslation();

    const changeColor = change24h > 0 ? 'positive' : change24h < 0 ? 'negative' : 'neutral';

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.title}>{t('widgets.openInterest.title')}</span>
            </div>

            <div className={styles.content}>
                <div className={styles.main}>
                    <span className={`${styles.value} mono`}>
                        {data ? formatLargeNumber(data.openInterest, locale) : '--'}
                    </span>
                    <span className={styles.unit}>contracts</span>
                </div>

                <div className={styles.row}>
                    <span className={styles.label}>{t('widgets.openInterest.value')}</span>
                    <span className={`${styles.valueSmall} mono`}>
                        ${data ? formatLargeNumber(data.openInterestValue, locale) : '--'}
                    </span>
                </div>

                <div className={styles.row}>
                    <span className={styles.label}>{t('widgets.openInterest.change24h')}</span>
                    <span className={`${styles.change} ${styles[changeColor]} mono`}>
                        {formatPercent(change24h)}
                    </span>
                </div>
            </div>
        </div>
    );
}
