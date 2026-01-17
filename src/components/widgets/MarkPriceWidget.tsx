/**
 * Mark Price Widget
 * Mark, Index, Last prices with basis and premium
 */

'use client';

import { useTranslation, formatPrice, formatPercent } from '@/lib/i18n';
import type { Instrument } from '@/lib/types';
import styles from './MarkPriceWidget.module.css';

interface MarkPriceWidgetProps {
    data: Instrument | null;
}

export default function MarkPriceWidget({ data }: MarkPriceWidgetProps) {
    const { t, locale } = useTranslation();

    // Calculate premium index
    const premiumPercent = data && data.indexPrice > 0
        ? ((data.markPrice - data.indexPrice) / data.indexPrice) * 100
        : 0;

    const premiumColor = premiumPercent > 0.1 ? 'positive' : premiumPercent < -0.1 ? 'negative' : 'neutral';

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.title}>{t('widgets.markPrice.title')}</span>
            </div>

            <div className={styles.content}>
                <div className={styles.prices}>
                    <div className={styles.priceRow}>
                        <span className={styles.label}>{t('widgets.markPrice.mark')}</span>
                        <span className={`${styles.price} mono`}>
                            {data ? formatPrice(data.markPrice, locale) : '--'}
                        </span>
                    </div>

                    <div className={styles.priceRow}>
                        <span className={styles.label}>{t('widgets.markPrice.index')}</span>
                        <span className={`${styles.price} mono`}>
                            {data ? formatPrice(data.indexPrice, locale) : '--'}
                        </span>
                    </div>

                    <div className={styles.priceRow}>
                        <span className={styles.label}>{t('widgets.markPrice.last')}</span>
                        <span className={`${styles.price} mono`}>
                            {data ? formatPrice(data.price, locale) : '--'}
                        </span>
                    </div>
                </div>

                <div className={styles.divider} />

                <div className={styles.metrics}>
                    <div className={styles.metric}>
                        <span className={styles.metricLabel}>{t('widgets.markPrice.basis')}</span>
                        <span className={`${styles.metricValue} mono`}>
                            ${data ? data.basis.toFixed(2) : '--'}
                        </span>
                    </div>

                    <div className={styles.metric}>
                        <span className={styles.metricLabel}>{t('widgets.markPrice.premium')}</span>
                        <span className={`${styles.metricValue} ${styles[premiumColor]} mono`}>
                            {formatPercent(premiumPercent, true)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
