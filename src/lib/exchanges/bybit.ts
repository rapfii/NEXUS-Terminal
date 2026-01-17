/**
 * Bybit Exchange Adapter
 * V5 API - Superior for retail positioning and squeeze detection
 */

import { EXCHANGE_CONFIG, CACHE_TTL } from '../config';
import apiClient, { safeParseFloat, buildQueryString } from '../api-client';

const BASE_URL = EXCHANGE_CONFIG.bybit.rest;

// Symbol formatting for Bybit
function formatSymbol(symbol: string): string {
    return symbol.replace('-', '').replace('/', '').toUpperCase();
}

// Response types
interface BybitResponse<T> {
    retCode: number;
    retMsg: string;
    result: T;
    time: number;
}

export const bybitAdapter = {
    name: 'bybit' as const,

    /**
     * Get ticker data for a symbol
     */
    async getTicker(symbol: string, category: 'linear' | 'inverse' | 'spot' = 'linear'): Promise<{
        symbol: string;
        price: number;
        bid: number;
        ask: number;
        volume24h: number;
        change24h: number;
        high24h: number;
        low24h: number;
        fundingRate: number;
        nextFundingTime: number;
        openInterest: number;
        openInterestValue: number;
    } | null> {
        try {
            const formatted = formatSymbol(symbol);
            const url = `${BASE_URL}/v5/market/tickers${buildQueryString({
                category,
                symbol: formatted,
            })}`;

            const data = await apiClient.fetch<BybitResponse<{ list: any[] }>>(
                url, 'bybit', { cacheTtl: CACHE_TTL.ticker }
            );

            if (data.retCode !== 0 || !data.result.list?.[0]) return null;

            const t = data.result.list[0];
            return {
                symbol: t.symbol,
                price: safeParseFloat(t.lastPrice),
                bid: safeParseFloat(t.bid1Price),
                ask: safeParseFloat(t.ask1Price),
                volume24h: safeParseFloat(t.turnover24h),
                change24h: safeParseFloat(t.price24hPcnt) * 100,
                high24h: safeParseFloat(t.highPrice24h),
                low24h: safeParseFloat(t.lowPrice24h),
                fundingRate: safeParseFloat(t.fundingRate),
                nextFundingTime: safeParseFloat(t.nextFundingTime),
                openInterest: safeParseFloat(t.openInterest),
                openInterestValue: safeParseFloat(t.openInterestValue),
            };
        } catch (error) {
            console.error('Bybit getTicker error:', error);
            return null;
        }
    },

    /**
     * Get all linear perpetual tickers
     */
    async getAllTickers(category: 'linear' | 'inverse' | 'spot' = 'linear'): Promise<{
        symbol: string;
        price: number;
        bid: number;
        ask: number;
        volume24h: number;
        change24h: number;
        fundingRate: number;
        openInterest: number;
        openInterestValue: number;
    }[]> {
        try {
            const url = `${BASE_URL}/v5/market/tickers?category=${category}`;
            const data = await apiClient.fetch<BybitResponse<{ list: any[] }>>(
                url, 'bybit', { cacheTtl: CACHE_TTL.ticker }
            );

            if (data.retCode !== 0) return [];

            return data.result.list
                .filter((t: any) => t.symbol?.endsWith('USDT'))
                .map((t: any) => ({
                    symbol: t.symbol,
                    price: safeParseFloat(t.lastPrice),
                    bid: safeParseFloat(t.bid1Price),
                    ask: safeParseFloat(t.ask1Price),
                    volume24h: safeParseFloat(t.turnover24h),
                    change24h: safeParseFloat(t.price24hPcnt) * 100,
                    fundingRate: safeParseFloat(t.fundingRate),
                    openInterest: safeParseFloat(t.openInterest),
                    openInterestValue: safeParseFloat(t.openInterestValue),
                }));
        } catch (error) {
            console.error('Bybit getAllTickers error:', error);
            return [];
        }
    },

    /**
     * Get open interest for a symbol
     */
    async getOpenInterest(
        symbol: string,
        interval: '5min' | '15min' | '30min' | '1h' | '4h' | '1d' = '1h',
        limit: number = 24
    ): Promise<{
        time: number;
        openInterest: number;
    }[]> {
        try {
            const formatted = formatSymbol(symbol);
            const url = `${BASE_URL}/v5/market/open-interest${buildQueryString({
                category: 'linear',
                symbol: formatted,
                intervalTime: interval,
                limit,
            })}`;

            const data = await apiClient.fetch<BybitResponse<{ list: any[] }>>(
                url, 'bybit', { cacheTtl: CACHE_TTL.oi }
            );

            if (data.retCode !== 0) return [];

            return data.result.list.map((d: any) => ({
                time: safeParseFloat(d.timestamp),
                openInterest: safeParseFloat(d.openInterest),
            }));
        } catch (error) {
            console.error('Bybit getOpenInterest error:', error);
            return [];
        }
    },

    /**
     * Get funding rate history
     */
    async getFundingHistory(symbol: string, limit: number = 24): Promise<{
        time: number;
        symbol: string;
        fundingRate: number;
    }[]> {
        try {
            const formatted = formatSymbol(symbol);
            const url = `${BASE_URL}/v5/market/funding/history${buildQueryString({
                category: 'linear',
                symbol: formatted,
                limit,
            })}`;

            const data = await apiClient.fetch<BybitResponse<{ list: any[] }>>(
                url, 'bybit', { cacheTtl: CACHE_TTL.funding }
            );

            if (data.retCode !== 0) return [];

            return data.result.list.map((d: any) => ({
                time: safeParseFloat(d.fundingRateTimestamp),
                symbol: d.symbol,
                fundingRate: safeParseFloat(d.fundingRate),
            }));
        } catch (error) {
            console.error('Bybit getFundingHistory error:', error);
            return [];
        }
    },

    /**
     * Get long/short ratio - CRITICAL for squeeze detection
     */
    async getLongShortRatio(
        symbol: string,
        period: '5min' | '15min' | '30min' | '1h' | '4h' | '1d' = '1h',
        limit: number = 24
    ): Promise<{
        time: number;
        buyRatio: number;
        sellRatio: number;
    }[]> {
        try {
            const formatted = formatSymbol(symbol);
            const url = `${BASE_URL}/v5/market/account-ratio${buildQueryString({
                category: 'linear',
                symbol: formatted,
                period,
                limit,
            })}`;

            const data = await apiClient.fetch<BybitResponse<{ list: any[] }>>(
                url, 'bybit', { cacheTtl: CACHE_TTL.positioning }
            );

            if (data.retCode !== 0) return [];

            return data.result.list.map((d: any) => ({
                time: safeParseFloat(d.timestamp),
                buyRatio: safeParseFloat(d.buyRatio),
                sellRatio: safeParseFloat(d.sellRatio),
            }));
        } catch (error) {
            console.error('Bybit getLongShortRatio error:', error);
            return [];
        }
    },

    /**
     * Get recent public trading history
     */
    async getRecentTrades(symbol: string, limit: number = 60): Promise<{
        id: string;
        price: number;
        size: number;
        side: 'buy' | 'sell';
        time: number;
    }[]> {
        try {
            const formatted = formatSymbol(symbol);
            const url = `${BASE_URL}/v5/market/recent-trade${buildQueryString({
                category: 'linear',
                symbol: formatted,
                limit,
            })}`;

            const data = await apiClient.fetch<BybitResponse<{ list: any[] }>>(
                url, 'bybit', { cacheTtl: 2000 }
            );

            if (data.retCode !== 0) return [];

            return data.result.list.map((t: any) => ({
                id: t.execId,
                price: safeParseFloat(t.price),
                size: safeParseFloat(t.size),
                side: t.side?.toLowerCase() === 'buy' ? 'buy' : 'sell',
                time: safeParseFloat(t.time),
            }));
        } catch (error) {
            console.error('Bybit getRecentTrades error:', error);
            return [];
        }
    },

    /**
     * Get orderbook depth
     */
    async getOrderbook(symbol: string, limit: number = 50): Promise<{
        bids: { price: number; size: number }[];
        asks: { price: number; size: number }[];
        timestamp: number;
    } | null> {
        try {
            const formatted = formatSymbol(symbol);
            const url = `${BASE_URL}/v5/market/orderbook${buildQueryString({
                category: 'linear',
                symbol: formatted,
                limit,
            })}`;

            const data = await apiClient.fetch<BybitResponse<{
                b: [string, string][];
                a: [string, string][];
                ts: number;
            }>>(url, 'bybit', { cacheTtl: 1000 });

            if (data.retCode !== 0) return null;

            return {
                bids: data.result.b.map(([price, size]) => ({
                    price: safeParseFloat(price),
                    size: safeParseFloat(size),
                })),
                asks: data.result.a.map(([price, size]) => ({
                    price: safeParseFloat(price),
                    size: safeParseFloat(size),
                })),
                timestamp: data.result.ts,
            };
        } catch (error) {
            console.error('Bybit getOrderbook error:', error);
            return null;
        }
    },

    /**
     * Get klines/candlesticks
     */
    async getKlines(
        symbol: string,
        interval: '1' | '3' | '5' | '15' | '30' | '60' | '120' | '240' | '360' | '720' | 'D' | 'W' | 'M' = '60',
        limit: number = 200
    ): Promise<{
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
    }[]> {
        try {
            const formatted = formatSymbol(symbol);
            const url = `${BASE_URL}/v5/market/kline${buildQueryString({
                category: 'linear',
                symbol: formatted,
                interval,
                limit,
            })}`;

            const data = await apiClient.fetch<BybitResponse<{ list: string[][] }>>(
                url, 'bybit', { cacheTtl: CACHE_TTL.ticker }
            );

            if (data.retCode !== 0) return [];

            return data.result.list.map((k: string[]) => ({
                time: safeParseFloat(k[0]),
                open: safeParseFloat(k[1]),
                high: safeParseFloat(k[2]),
                low: safeParseFloat(k[3]),
                close: safeParseFloat(k[4]),
                volume: safeParseFloat(k[5]),
            })).reverse(); // Bybit returns newest first
        } catch (error) {
            console.error('Bybit getKlines error:', error);
            return [];
        }
    },

    /**
     * Get instrument info (leverage, lot size, etc.)
     */
    async getInstrumentInfo(symbol?: string): Promise<{
        symbol: string;
        baseCoin: string;
        quoteCoin: string;
        maxLeverage: number;
        minOrderQty: number;
        tickSize: number;
    }[]> {
        try {
            const url = `${BASE_URL}/v5/market/instruments-info${buildQueryString({
                category: 'linear',
                symbol: symbol ? formatSymbol(symbol) : undefined,
            })}`;

            const data = await apiClient.fetch<BybitResponse<{ list: any[] }>>(
                url, 'bybit', { cacheTtl: 300000 } // 5 min cache
            );

            if (data.retCode !== 0) return [];

            return data.result.list.map((i: any) => ({
                symbol: i.symbol,
                baseCoin: i.baseCoin,
                quoteCoin: i.quoteCoin,
                maxLeverage: safeParseFloat(i.leverageFilter?.maxLeverage),
                minOrderQty: safeParseFloat(i.lotSizeFilter?.minOrderQty),
                tickSize: safeParseFloat(i.priceFilter?.tickSize),
            }));
        } catch (error) {
            console.error('Bybit getInstrumentInfo error:', error);
            return [];
        }
    },

    /**
     * Aggregate positioning data for squeeze detection
     */
    async getPositioningSnapshot(symbol: string): Promise<{
        symbol: string;
        exchange: 'bybit';
        openInterest: number;
        openInterestValue: number;
        fundingRate: number;
        buyRatio: number;
        sellRatio: number;
        oiChange1h: number;
        timestamp: number;
    } | null> {
        try {
            const [ticker, lsRatio, oiHistory] = await Promise.all([
                this.getTicker(symbol),
                this.getLongShortRatio(symbol, '1h', 2),
                this.getOpenInterest(symbol, '1h', 2),
            ]);

            if (!ticker) return null;

            // Calculate OI change
            let oiChange1h = 0;
            if (oiHistory.length >= 2) {
                const prev = oiHistory[1]?.openInterest || 0;
                const curr = oiHistory[0]?.openInterest || 0;
                oiChange1h = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
            }

            const latestRatio = lsRatio[0];

            return {
                symbol: ticker.symbol,
                exchange: 'bybit',
                openInterest: ticker.openInterest,
                openInterestValue: ticker.openInterestValue,
                fundingRate: ticker.fundingRate,
                buyRatio: latestRatio?.buyRatio || 0.5,
                sellRatio: latestRatio?.sellRatio || 0.5,
                oiChange1h,
                timestamp: Date.now(),
            };
        } catch (error) {
            console.error('Bybit getPositioningSnapshot error:', error);
            return null;
        }
    },
};

export default bybitAdapter;
