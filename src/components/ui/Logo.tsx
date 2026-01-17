import React from 'react';
import styles from './Logo.module.css';

export function Logo() {
    return (
        <div className={styles.container}>
            <div className={styles.nexusWrapper}>
                <div className={styles.nexus}>NEXUS</div>
                <div className={styles.shine} />
            </div>

            <div className={styles.terminalWrapper}>
                <span className={styles.terminal}>TERMINAL</span>
                <div className={styles.scanLine} />
            </div>
        </div>
    );
}
