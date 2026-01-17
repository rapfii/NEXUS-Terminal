'use client';

import { useState, useEffect } from 'react';
import styles from './Shell.module.css';
import { useMarketStore } from '@/stores';
import { Logo } from '../ui/Logo';

import {
    LayoutDashboard,
    BarChart2,
    Terminal as TerminalIcon,
    Scale,
    Activity,
    Link,
    Newspaper,
    Star
} from 'lucide-react';

// Icons/Labels for tabs
const TABS = [
    { id: 'dashboard', label: 'DASHBOARD', icon: <LayoutDashboard size={14} /> },
    { id: 'markets', label: 'MARKETS', icon: <BarChart2 size={14} /> },
    { id: 'terminal', label: 'TERMINAL', icon: <TerminalIcon size={14} /> },
    { id: 'compare', label: 'COMPARE', icon: <Scale size={14} /> },
    { id: 'derivatives', label: 'DERIVATIVES', icon: <Activity size={14} /> },
    { id: 'yields', label: 'YIELDS', icon: <Activity size={14} /> }, // Re-using Activity or maybe Banknote if imported
    { id: 'onchain', label: 'ON-CHAIN', icon: <Link size={14} /> },
    { id: 'news', label: 'NEWS', icon: <Newspaper size={14} /> },
    { id: 'watchlist', label: 'WATCHLIST', icon: <Star size={14} /> },
];

interface ShellProps {
    children: React.ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export function Shell({ children, activeTab, onTabChange }: ShellProps) {
    const { wsConnected } = useMarketStore();
    const isLive = Object.values(wsConnected).some(Boolean);

    // Keyboard shortcuts for tabs (Alt+1 to Alt+8)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.key >= '1' && e.key <= '8') {
                const idx = parseInt(e.key) - 1;
                if (TABS[idx]) onTabChange(TABS[idx].id);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onTabChange]);

    return (
        <div className={styles.shell}>
            <header className={styles.header}>
                <Logo />

                <nav className={styles.nav}>
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
                            onClick={() => onTabChange(tab.id)}
                        >
                            <span className={styles.icon}>{tab.icon}</span>
                            <span className={styles.label}>{tab.label}</span>
                        </button>
                    ))}
                </nav>

                <div className={styles.status}>
                    <span className={`${styles.dot} ${isLive ? styles.live : ''}`} />
                    {isLive ? 'SYSTEM ONLINE' : 'CONNECTING...'}
                </div>
            </header>

            <main className={styles.main}>
                {children}
            </main>
        </div>
    );
}
