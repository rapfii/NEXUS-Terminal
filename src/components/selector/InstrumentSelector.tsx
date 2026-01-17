/**
 * Symbol Selector Component (Simplified)
 * [Spot/Perp] [SYMBOL ▼]
 * No exchange dropdown - shows ALL exchanges
 */

'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useMarketStore } from '@/stores';
import { useTranslation } from '@/lib/i18n';
import styles from './InstrumentSelector.module.css';

const POPULAR_SYMBOLS = [
    'BTCUSDT',
    'ETHUSDT',
    'SOLUSDT',
    'BNBUSDT',
    'XRPUSDT',
    'DOGEUSDT',
    'ADAUSDT',
    'AVAXUSDT',
    'DOTUSDT',
    'MATICUSDT',
    'LINKUSDT',
    'LTCUSDT',
    'UNIUSDT',
    'ATOMUSDT',
    'APTUSDT',
    'ARBUSDT',
    'OPUSDT',
    'NEARUSDT',
    'FILUSDT',
    'INJUSDT',
];

export default function InstrumentSelector() {
    const { t } = useTranslation();
    const { marketType, symbol, setMarketType, setSymbol } = useMarketStore();

    const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
    const [symbolInput, setSymbolInput] = useState(symbol);

    const handleSymbolSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (symbolInput.trim()) {
            setSymbol(symbolInput.toUpperCase());
            setShowSymbolDropdown(false);
        }
    };

    const handleSymbolSelect = (sym: string) => {
        setSymbol(sym);
        setSymbolInput(sym);
        setShowSymbolDropdown(false);
    };

    return (
        <div className={styles.selector}>
            {/* Market Type Toggle */}
            <div className={styles.marketToggle}>
                <button
                    className={`${styles.marketBtn} ${marketType === 'spot' ? styles.active : ''}`}
                    onClick={() => setMarketType('spot')}
                >
                    {t('terminal.spot')}
                </button>
                <button
                    className={`${styles.marketBtn} ${marketType === 'perpetual' ? styles.active : ''}`}
                    onClick={() => setMarketType('perpetual')}
                >
                    {t('terminal.perp')}
                </button>
            </div>

            {/* Symbol Search */}
            <div className={styles.symbolSection}>
                <form onSubmit={handleSymbolSubmit} className={styles.symbolSearch}>
                    <input
                        type="text"
                        value={symbolInput}
                        onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                        onFocus={() => setShowSymbolDropdown(true)}
                        onBlur={() => setTimeout(() => setShowSymbolDropdown(false), 200)}
                        placeholder="BTCUSDT"
                        className={styles.symbolInput}
                    />
                    <button type="submit" className={styles.symbolSubmit}>
                        <ArrowRight size={14} />
                    </button>
                </form>

                {showSymbolDropdown && (
                    <div className={styles.symbolDropdown}>
                        <div className={styles.symbolDropdownHeader}>
                            {t('terminal.popular')}
                        </div>
                        <div className={styles.symbolGrid}>
                            {POPULAR_SYMBOLS.map((sym) => (
                                <button
                                    key={sym}
                                    className={`${styles.symbolItem} ${symbol === sym ? styles.active : ''}`}
                                    onMouseDown={() => handleSymbolSelect(sym)}
                                >
                                    {sym.replace('USDT', '')}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
