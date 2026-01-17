import styles from './TrendRadar.module.css';

interface TrendProps {
    gainers: { symbol: string; change24h: number; price: number; name: string }[];
    losers: { symbol: string; change24h: number; price: number; name: string }[];
}

export function TrendRadar({ gainers, losers }: TrendProps) {
    return (
        <div className={styles.container}>
            <div className={styles.column}>
                <div className={styles.header}>🚀 TOP GAINERS</div>
                <div className={styles.list}>
                    {gainers.slice(0, 5).map((g, i) => (
                        <div key={g.symbol} className={styles.row}>
                            <span className={styles.rank}>{i + 1}</span>
                            <div className={styles.info}>
                                <span className={styles.symbol}>{g.symbol}</span>
                                <span className={styles.price}>${g.price < 1 ? g.price.toFixed(4) : g.price.toFixed(2)}</span>
                            </div>
                            <span className={styles.pos}>+{g.change24h.toFixed(2)}%</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className={styles.column}>
                <div className={styles.header}>🩸 TOP LOSERS</div>
                <div className={styles.list}>
                    {losers.slice(0, 5).map((l, i) => (
                        <div key={l.symbol} className={styles.row}>
                            <span className={styles.rank}>{i + 1}</span>
                            <div className={styles.info}>
                                <span className={styles.symbol}>{l.symbol}</span>
                                <span className={styles.price}>${l.price < 1 ? l.price.toFixed(4) : l.price.toFixed(2)}</span>
                            </div>
                            <span className={styles.neg}>{l.change24h.toFixed(2)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
