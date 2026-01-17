'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './DataHealthPanel.module.css';
import {
    Wifi,
    WifiOff,
    Loader2,
    Circle
} from 'lucide-react';
import type {
    DataMeta,
    DataSource,
    DataSLA,
    SourceHealth,
} from '@/lib/types/data-health';

// ============================================
// TYPES
// ============================================

interface ConnectionStatus {
    exchange: DataSource;
    status: 'connected' | 'connecting' | 'disconnected';
    latency: number;
    lastUpdate: number;
}

interface DataHealthPanelProps {
    /** Show compact mode (header bar) or full panel */
    compact?: boolean;
    /** Callback when panel is clicked in compact mode */
    onExpand?: () => void;
}

// ============================================
// MOCK DATA (will be replaced with real telemetry)
// ============================================

const INITIAL_CONNECTIONS: ConnectionStatus[] = [
    { exchange: 'binance', status: 'connected', latency: 0, lastUpdate: Date.now() },
    { exchange: 'bybit', status: 'connecting', latency: 0, lastUpdate: Date.now() },
    { exchange: 'okx', status: 'disconnected', latency: 0, lastUpdate: Date.now() },
];

// ============================================
// COMPONENT
// ============================================

export default function DataHealthPanel({ compact = false, onExpand }: DataHealthPanelProps) {
    const [connections, setConnections] = useState<ConnectionStatus[]>(INITIAL_CONNECTIONS);
    const [lastDataUpdate, setLastDataUpdate] = useState<number>(Date.now());
    const [overallHealth, setOverallHealth] = useState<'healthy' | 'degraded' | 'critical'>('healthy');

    // Simulate connection status updates (replace with real WebSocket status)
    useEffect(() => {
        const interval = setInterval(() => {
            setConnections(prev => prev.map(conn => ({
                ...conn,
                // Simulate random latency updates
                latency: conn.status === 'connected'
                    ? Math.floor(Math.random() * 20) + 5
                    : 0,
                lastUpdate: conn.status === 'connected' ? Date.now() : conn.lastUpdate,
            })));
            setLastDataUpdate(Date.now());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Calculate overall health
    useEffect(() => {
        const connectedCount = connections.filter(c => c.status === 'connected').length;
        const total = connections.length;

        if (connectedCount === total) {
            setOverallHealth('healthy');
        } else if (connectedCount >= total / 2) {
            setOverallHealth('degraded');
        } else {
            setOverallHealth('critical');
        }
    }, [connections]);

    const formatLatency = (ms: number) => {
        if (ms === 0) return '—';
        return `${ms}ms`;
    };

    const formatAge = (timestamp: number) => {
        const age = Date.now() - timestamp;
        if (age < 1000) return 'now';
        if (age < 60000) return `${Math.floor(age / 1000)}s`;
        return `${Math.floor(age / 60000)}m`;
    };

    const getStatusIcon = (status: 'connected' | 'connecting' | 'disconnected') => {
        switch (status) {
            case 'connected': return <Wifi size={14} />;
            case 'connecting': return <Loader2 size={14} className={styles.spin} />;
            case 'disconnected': return <WifiOff size={14} />;
        }
    };

    const getStatusClass = (status: 'connected' | 'connecting' | 'disconnected') => {
        switch (status) {
            case 'connected': return styles.connected;
            case 'connecting': return styles.connecting;
            case 'disconnected': return styles.disconnected;
        }
    };

    const getLatencyClass = (latency: number) => {
        if (latency === 0) return styles.latencyNone;
        if (latency < 50) return styles.latencyGood;
        if (latency < 200) return styles.latencyWarn;
        return styles.latencyBad;
    };

    // ============================================
    // COMPACT MODE (Header Bar)
    // ============================================
    if (compact) {
        return (
            <div
                className={styles.compactBar}
                onClick={onExpand}
                role="button"
                tabIndex={0}
            >
                {/* Overall Health Indicator */}
                <div className={`${styles.healthBadge} ${styles[overallHealth]}`}>
                    <Circle size={8} fill="currentColor" />
                    <span className={styles.healthLabel}>
                        {overallHealth === 'healthy' ? 'LIVE' : overallHealth.toUpperCase()}
                    </span>
                </div>

                {/* Connection Status Pills */}
                <div className={styles.connectionPills}>
                    {connections.slice(0, 3).map(conn => (
                        <div
                            key={conn.exchange}
                            className={`${styles.pill} ${getStatusClass(conn.status)}`}
                            title={`${conn.exchange}: ${conn.status} (${formatLatency(conn.latency)})`}
                        >
                            <span className={styles.pillIcon}>{getStatusIcon(conn.status)}</span>
                            <span className={styles.pillName}>{conn.exchange.slice(0, 3).toUpperCase()}</span>
                            {conn.status === 'connected' && (
                                <span className={`${styles.pillLatency} ${getLatencyClass(conn.latency)}`}>
                                    {formatLatency(conn.latency)}
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {/* Last Update */}
                <div className={styles.lastUpdate}>
                    <span className={styles.updateLabel}>Last:</span>
                    <span className={styles.updateValue}>{formatAge(lastDataUpdate)}</span>
                </div>
            </div>
        );
    }

    // ============================================
    // FULL PANEL MODE
    // ============================================
    return (
        <div className={styles.panel}>
            <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>Data Health</h3>
                <div className={`${styles.healthBadge} ${styles[overallHealth]}`}>
                    <Circle size={8} fill="currentColor" />
                    <span className={styles.healthLabel}>{overallHealth.toUpperCase()}</span>
                </div>
            </div>

            {/* Connection Status Grid */}
            <div className={styles.connectionGrid}>
                {connections.map(conn => (
                    <div key={conn.exchange} className={styles.connectionCard}>
                        <div className={styles.connectionHeader}>
                            <span className={`${styles.statusDot} ${getStatusClass(conn.status)}`}>
                                {getStatusIcon(conn.status)}
                            </span>
                            <span className={styles.exchangeName}>
                                {conn.exchange.charAt(0).toUpperCase() + conn.exchange.slice(1)}
                            </span>
                        </div>

                        <div className={styles.connectionMetrics}>
                            <div className={styles.metric}>
                                <span className={styles.metricLabel}>Latency</span>
                                <span className={`${styles.metricValue} ${getLatencyClass(conn.latency)}`}>
                                    {formatLatency(conn.latency)}
                                </span>
                            </div>
                            <div className={styles.metric}>
                                <span className={styles.metricLabel}>Last</span>
                                <span className={styles.metricValue}>
                                    {formatAge(conn.lastUpdate)}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* SLA Status */}
            <div className={styles.slaSection}>
                <h4 className={styles.slaTitle}>Data SLAs</h4>
                <div className={styles.slaGrid}>
                    <div className={styles.slaItem}>
                        <span className={styles.slaType}>REAL-TIME</span>
                        <span className={`${styles.slaStatus} ${styles.slaGood}`}><Circle size={8} fill="currentColor" /></span>
                        <span className={styles.slaDesc}>Orderbook, Trades</span>
                    </div>
                    <div className={styles.slaItem}>
                        <span className={styles.slaType}>NEAR-RT</span>
                        <span className={`${styles.slaStatus} ${styles.slaGood}`}><Circle size={8} fill="currentColor" /></span>
                        <span className={styles.slaDesc}>Funding, OI</span>
                    </div>
                    <div className={styles.slaItem}>
                        <span className={styles.slaType}>BATCHED</span>
                        <span className={`${styles.slaStatus} ${styles.slaGood}`}><Circle size={8} fill="currentColor" /></span>
                        <span className={styles.slaDesc}>TVL, Macro</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
