import { formatLargeNumber, formatPercent } from '@/lib/i18n';
import styles from './GlobalMetrics.module.css';

interface GlobalMetricsProps {
    data: {
        totalMarketCap: number;
        totalVolume24h: number;
        btcDominance: number;
        ethDominance: number;
        marketCapChange24h: number;
        activeCryptos: number;
        markets: number;
    };
    locale: 'en' | 'id';
}

export function GlobalMetrics({ data, locale }: GlobalMetricsProps) {
    return (
        <div className={styles.container}>
            <div className={styles.item}>
                <span className={styles.label}>MARKET CAP</span>
                <span className={styles.value}>${formatLargeNumber(data.totalMarketCap, locale)}</span>
                <span className={`${styles.change} ${data.marketCapChange24h >= 0 ? styles.pos : styles.neg}`}>
                    {data.marketCapChange24h >= 0 ? '+' : ''}{data.marketCapChange24h.toFixed(2)}%
                </span>
            </div>
            <div className={styles.item}>
                <span className={styles.label}>24H VOLUME</span>
                <span className={styles.value}>${formatLargeNumber(data.totalVolume24h, locale)}</span>
            </div>
            <div className={styles.item}>
                <span className={styles.label}>BTC DOM</span>
                <span className={styles.value}>{formatPercent(data.btcDominance)}</span>
            </div>
            <div className={styles.item}>
                <span className={styles.label}>ETH DOM</span>
                <span className={styles.value}>{formatPercent(data.ethDominance)}</span>
            </div>
        </div>
    );
}
