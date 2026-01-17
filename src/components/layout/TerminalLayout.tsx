/**
 * Terminal Layout - Main application shell
 * Bloomberg/Quantum Terminal Style - Pro Mode Only
 * Operational header with data health indicators
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMarketStore, useLanguageStore } from '@/stores';
import { useTranslation } from '@/lib/i18n';
import { InstrumentSelector } from '@/components/selector';
import { TickerBar } from '@/components/ticker';
import { DataHealthPanel } from '@/components/widgets';
import styles from './TerminalLayout.module.css';

interface TerminalLayoutProps {
    children: React.ReactNode;
}

export default function TerminalLayout({ children }: TerminalLayoutProps) {
    const pathname = usePathname();
    const { wsConnected, loadWatchlist } = useMarketStore();
    const { locale, setLocale } = useLanguageStore();
    const { t } = useTranslation();
    const [showHealthPanel, setShowHealthPanel] = useState(false);

    // Load saved preferences on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedLocale = localStorage.getItem('nexus-locale') as 'en' | 'id';
            if (savedLocale) setLocale(savedLocale);
            loadWatchlist();
        }
    }, [setLocale, loadWatchlist]);

    const navItems = [
        { href: '/warroom', label: 'War Room', icon: '⚔' },
        { href: '/', label: t('nav.dashboard'), icon: '◐' },
        { href: '/terminal', label: t('nav.terminal'), icon: '▣' },
        { href: '/matrix', label: t('nav.matrix'), icon: '⋮⋮⋮' },
    ];

    return (
        <div className={styles.layout}>
            {/* Scrolling Ticker Bar */}
            <TickerBar />

            {/* Header - Compact Operational Style */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    {/* Minimal Logo */}
                    <Link href="/" className={styles.logo}>
                        <span className={styles.logoIcon}>◈</span>
                        <span className={styles.logoText}>NXS</span>
                    </Link>

                    <nav className={styles.nav}>
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
                            >
                                <span className={styles.navIcon}>{item.icon}</span>
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                <div className={styles.headerCenter}>
                    <InstrumentSelector />
                </div>

                <div className={styles.headerRight}>
                    {/* Data Health Panel - Compact Mode */}
                    <DataHealthPanel
                        compact
                        onExpand={() => setShowHealthPanel(!showHealthPanel)}
                    />

                    {/* Language Switcher */}
                    <div className={styles.langSwitcher}>
                        <button
                            className={`${styles.langBtn} ${locale === 'en' ? styles.active : ''}`}
                            onClick={() => setLocale('en')}
                        >
                            EN
                        </button>
                        <button
                            className={`${styles.langBtn} ${locale === 'id' ? styles.active : ''}`}
                            onClick={() => setLocale('id')}
                        >
                            ID
                        </button>
                    </div>
                </div>
            </header>

            {/* Expanded Health Panel (overlay) */}
            {showHealthPanel && (
                <div className={styles.healthPanelOverlay}>
                    <DataHealthPanel />
                    <button
                        className={styles.healthPanelClose}
                        onClick={() => setShowHealthPanel(false)}
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Main Content */}
            <main className={styles.main}>{children}</main>

            {/* Footer - Minimal */}
            <footer className={styles.footer}>
                <span>{t('footer.source')}</span>
                <span className={styles.footerDivider}>•</span>
                <span>{t('footer.dataDelay')}</span>
            </footer>
        </div>
    );
}

