'use client';

/**
 * React hooks for real-time WebSocket streaming data
 * Use these hooks in components to get live updates
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    subscribeBinanceMarkPrice,
    subscribeBinanceAllMarkPrices,
    subscribeBinanceLiquidations,
    subscribeBybitMarkPrice,
    subscribeBybitLiquidations,
    subscribeCriticalStreams,
    type MarkPriceUpdate,
    type LiquidationEvent,
} from '@/lib/websocket';
import type { Trade } from '@/lib/types';

// ============================================
// MARK PRICE / FUNDING HOOK
// ============================================

/**
 * Hook to subscribe to real-time mark price and funding rate for a symbol
 */
export function useMarkPrice(symbol: string) {
    const [data, setData] = useState<MarkPriceUpdate | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!symbol) return;

        setIsConnected(true);
        const unsub = subscribeBinanceMarkPrice(symbol, (update) => {
            setData(update);
        });

        return () => {
            unsub();
            setIsConnected(false);
        };
    }, [symbol]);

    return { data, isConnected };
}

/**
 * Hook to get mark prices for multiple symbols (uses efficient all-symbols stream)
 */
export function useAllMarkPrices(symbols: string[]) {
    const [prices, setPrices] = useState<Map<string, MarkPriceUpdate>>(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const symbolSet = useRef(new Set(symbols.map(s => s.toUpperCase().replace('-', ''))));

    useEffect(() => {
        symbolSet.current = new Set(symbols.map(s => s.toUpperCase().replace('-', '')));
    }, [symbols]);

    useEffect(() => {
        setIsConnected(true);
        const unsub = subscribeBinanceAllMarkPrices((update) => {
            // Only track symbols we care about
            if (symbolSet.current.has(update.symbol)) {
                setPrices(prev => {
                    const next = new Map(prev);
                    next.set(update.symbol, update);
                    return next;
                });
            }
        });

        return () => {
            unsub();
            setIsConnected(false);
        };
    }, []);

    return { prices, isConnected };
}

// ============================================
// LIQUIDATION HOOK
// ============================================

/**
 * Hook to subscribe to real-time liquidation events
 * Keeps a rolling buffer of recent liquidations
 */
export function useLiquidations(symbol?: string, maxItems: number = 50) {
    const [liquidations, setLiquidations] = useState<LiquidationEvent[]>([]);
    const [stats, setStats] = useState({
        longLiqs1m: 0,
        shortLiqs1m: 0,
        longValue1m: 0,
        shortValue1m: 0,
    });

    useEffect(() => {
        const binanceUnsub = subscribeBinanceLiquidations((liq) => {
            setLiquidations(prev => {
                const next = [liq, ...prev].slice(0, maxItems);
                return next;
            });
        }, symbol);

        const bybitUnsub = subscribeBybitLiquidations((liq) => {
            setLiquidations(prev => {
                const next = [liq, ...prev].slice(0, maxItems);
                return next;
            });
        }, symbol);

        return () => {
            binanceUnsub();
            bybitUnsub();
        };
    }, [symbol, maxItems]);

    // Calculate 1-minute stats
    useEffect(() => {
        const interval = setInterval(() => {
            const oneMinAgo = Date.now() - 60_000;
            const recent = liquidations.filter(l => l.timestamp >= oneMinAgo);

            setStats({
                longLiqs1m: recent.filter(l => l.side === 'long').length,
                shortLiqs1m: recent.filter(l => l.side === 'short').length,
                longValue1m: recent.filter(l => l.side === 'long').reduce((sum, l) => sum + l.value, 0),
                shortValue1m: recent.filter(l => l.side === 'short').reduce((sum, l) => sum + l.value, 0),
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [liquidations]);

    return { liquidations, stats };
}

// ============================================
// COMBINED STREAMS HOOK
// ============================================

/**
 * Hook to get all critical streams for a symbol
 * Combines mark price, liquidations, and trades
 */
export function useCriticalStreams(symbol: string) {
    const [markPrice, setMarkPrice] = useState<MarkPriceUpdate | null>(null);
    const [liquidations, setLiquidations] = useState<LiquidationEvent[]>([]);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    const handleMarkPrice = useCallback((update: MarkPriceUpdate) => {
        setMarkPrice(update);
    }, []);

    const handleLiquidation = useCallback((liq: LiquidationEvent) => {
        setLiquidations(prev => [liq, ...prev].slice(0, 50));
    }, []);

    const handleTrade = useCallback((trade: Trade) => {
        setTrades(prev => [trade, ...prev].slice(0, 100));
    }, []);

    useEffect(() => {
        if (!symbol) return;

        setIsConnected(true);
        const unsub = subscribeCriticalStreams(
            symbol,
            handleMarkPrice,
            handleLiquidation,
            handleTrade
        );

        return () => {
            unsub();
            setIsConnected(false);
            setMarkPrice(null);
            setLiquidations([]);
            setTrades([]);
        };
    }, [symbol, handleMarkPrice, handleLiquidation, handleTrade]);

    return { markPrice, liquidations, trades, isConnected };
}

// ============================================
// FUNDING RATE SPECIFIC HOOK
// ============================================

/**
 * Hook specifically for funding rate monitoring
 * Provides funding rate with historical context
 */
export function useFundingRate(symbol: string) {
    const [current, setCurrent] = useState<{
        rate: number;
        nextTime: number;
        exchange: string;
    } | null>(null);

    const [history, setHistory] = useState<{ rate: number; timestamp: number }[]>([]);

    useEffect(() => {
        if (!symbol) return;

        const unsub = subscribeBinanceMarkPrice(symbol, (update) => {
            setCurrent({
                rate: update.fundingRate,
                nextTime: update.nextFundingTime,
                exchange: update.exchange,
            });

            // Track funding rate history (sample every 5 minutes)
            setHistory(prev => {
                const last = prev[prev.length - 1];
                const fiveMinAgo = Date.now() - 5 * 60_000;

                if (!last || last.timestamp < fiveMinAgo) {
                    return [...prev, { rate: update.fundingRate, timestamp: Date.now() }].slice(-24);
                }
                return prev;
            });
        });

        return () => unsub();
    }, [symbol]);

    // Derived metrics
    const isExtreme = current ? Math.abs(current.rate) > 0.0003 : false;
    const isElevated = current ? Math.abs(current.rate) > 0.0001 : false;
    const bias = current
        ? current.rate > 0.0001 ? 'long_paying'
            : current.rate < -0.0001 ? 'short_paying'
                : 'neutral'
        : 'unknown';

    return { current, history, isExtreme, isElevated, bias };
}
