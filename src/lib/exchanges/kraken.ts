/**
 * Kraken Exchange Adapter
 * Critical for Western institutional spot flows (BTC/USD, ETH/USD)
 */

import { EXCHANGE_CONFIG, CACHE_TTL } from '../config';
import apiClient, { safeParseFloat } from '../api-client';

const BASE_URL = EXCHANGE_CONFIG.kraken.rest;

// Kraken response wrapper
interface KrakenResponse<T> {
    error: string[];
    result: T;
}

export const krakenAdapter = {
    name: 'kraken' as const,

    /**
     * Get ticker
     */
    async getTicker(pair: string): Promise<{
        pair: string;
        price: number;
        bid: number;
        ask: number;
        volume24h: number;
        high24h: number;
        low24h: number;
        openingPrice: number;
    } | null> {
        try {
            // Kraken format: XBTUSD, ETHUSD
            const kPair = pair.replace('BTC', 'XBT').replace('USDT', 'USD');
            const url = `${BASE_URL}/0/public/Ticker?pair=${kPair}`;

            const data = await apiClient.fetch<KrakenResponse<Record<string, any>>>(
                url, 'kraken', { cacheTtl: CACHE_TTL.ticker }
            );

            if (data.error.length > 0) return null;

            // Result key might be XXBTZUSD
            const key = Object.keys(data.result)[0];
            const t = data.result[key];

            return {
                pair,
                price: safeParseFloat(t.c[0]), // Last trade closed price
                bid: safeParseFloat(t.b[0]),
                ask: safeParseFloat(t.a[0]),
                volume24h: safeParseFloat(t.v[1]), // 24h volume
                high24h: safeParseFloat(t.h[1]),
                low24h: safeParseFloat(t.l[1]),
                openingPrice: safeParseFloat(t.o),
            };
        } catch (error) {
            console.error('Kraken getTicker error:', error);
            return null;
        }
    },

    /**
     * Get orderbook (depth)
     */
    async getOrderbook(pair: string, count: number = 50): Promise<{
        bids: { price: number; size: number }[];
        asks: { price: number; size: number }[];
        timestamp: number;
    } | null> {
        try {
            const kPair = pair.replace('BTC', 'XBT').replace('USDT', 'USD');
            const url = `${BASE_URL}/0/public/Depth?pair=${kPair}&count=${count}`;

            const data = await apiClient.fetch<KrakenResponse<Record<string, any>>>(
                url, 'kraken', { cacheTtl: 1000 }
            );

            if (data.error.length > 0) return null;

            const key = Object.keys(data.result)[0];
            const book = data.result[key];

            return {
                bids: book.bids.map((b: any[]) => ({
                    price: safeParseFloat(b[0]),
                    size: safeParseFloat(b[1]),
                })),
                asks: book.asks.map((a: any[]) => ({
                    price: safeParseFloat(a[0]),
                    size: safeParseFloat(a[1]),
                })),
                timestamp: Date.now(),
            };
        } catch (error) {
            console.error('Kraken getOrderbook error:', error);
            return null;
        }
    },

    /**
     * Get recent trades
     */
    async getRecentTrades(pair: string): Promise<{
        price: number;
        size: number;
        time: number;
        side: 'buy' | 'sell';
        type: 'market' | 'limit';
    }[]> {
        try {
            const kPair = pair.replace('BTC', 'XBT').replace('USDT', 'USD');
            const url = `${BASE_URL}/0/public/Trades?pair=${kPair}`;

            const data = await apiClient.fetch<KrakenResponse<Record<string, any>>>(
                url, 'kraken', { cacheTtl: 2000 }
            );

            if (data.error.length > 0) return [];

            const key = Object.keys(data.result)[0];
            const trades = data.result[key];

            return trades.map((t: any[]) => ({
                price: safeParseFloat(t[0]),
                size: safeParseFloat(t[1]),
                time: t[2],
                side: t[3] === 'b' ? 'buy' : 'sell',
                type: t[4] === 'm' ? 'market' : 'limit',
            }));
        } catch (error) {
            console.error('Kraken getRecentTrades error:', error);
            return [];
        }
    },
};

export default krakenAdapter;
