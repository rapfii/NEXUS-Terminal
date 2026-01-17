import styles from './FearGreed.module.css';

interface FearGreedProps {
    value: number;
    classification: string;
}

export function FearGreed({ value, classification }: FearGreedProps) {
    const getColor = (v: number) => {
        if (v <= 25) return styles.extremeFear;
        if (v <= 45) return styles.fear;
        if (v <= 55) return styles.neutral;
        if (v <= 75) return styles.greed;
        return styles.extremeGreed;
    };

    const getEmoji = (v: number) => {
        if (v <= 25) return '😨';
        if (v <= 45) return '😟';
        if (v <= 55) return '😐';
        if (v <= 75) return '😊';
        return '🤑';
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>FEAR & GREED</div>
            <div className={styles.content}>
                <div className={styles.emoji}>{getEmoji(value)}</div>
                <div className={`${styles.value} ${getColor(value)}`}>{value}</div>
                <div className={styles.label}>{classification}</div>
            </div>
            <div className={styles.meter}>
                <div className={styles.fill} style={{ width: `${value}%`, background: `var(--fg-${value <= 25 ? 'ef' : value <= 45 ? 'f' : value <= 55 ? 'n' : value <= 75 ? 'g' : 'eg'})` }} />
            </div>
        </div>
    );
}
