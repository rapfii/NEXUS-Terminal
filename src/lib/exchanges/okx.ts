/**
 * OKX Exchange Adapter
 * V5 API - Institutional derivatives + OPTIONS support
 */

import { EXCHANGE_CONFIG, CACHE_TTL } from '../config';
import apiClient, { safeParseFloat, buildQueryString } from '../api-client';

const BASE_URL = EXCHANGE_CONFIG.okx.rest;

// Symbol formatting for OKX
function formatSymbol(symbol: string, instType: 'SPOT' | 'SWAP' | 'FUTURES' | 'OPTION' = 'SWAP'): string {
    const base = symbol.replace('USDT', '').replace('-', '');
    if (instType === 'SPOT') return `${base}-USDT`;
    if (instType === 'SWAP') return `${base}-USDT-SWAP`;
    return `${base}-USDT`;
}

// OKX response wrapper
interface OKXResponse<T> {
    code: string;
    msg: string;
    data: T;
}

export const okxAdapter = {
    name: 'okx' as const,

    /**
     * Get ticker data
     */
    async getTicker(symbol: string, instType: 'SPOT' | 'SWAP' = 'SWAP'): Promise<{
        symbol: string;
        instType: string;
        price: number;
        bid: number;
        ask: number;
        volume24h: number;
        volCcy24h: number;
        change24h: number;
        high24h: number;
        low24h: number;
        timestamp: number;
    } | null> {
        try {
            const instId = formatSymbol(symbol, instType);
            const url = `${BASE_URL}/api/v5/market/ticker?instId=${instId}`;

            const data = await apiClient.fetch<OKXResponse<any[]>>(
                url, 'okx', { cacheTtl: CACHE_TTL.ticker }
            );

            if (data.code !== '0' || !data.data?.[0]) return null;

            const t = data.data[0];
            return {
                symbol: t.instId,
                instType: t.instType,
                price: safeParseFloat(t.last),
                bid: safeParseFloat(t.bidPx),
                ask: safeParseFloat(t.askPx),
                volume24h: safeParseFloat(t.vol24h),
                volCcy24h: safeParseFloat(t.volCcy24h),
                change24h: safeParseFloat(t.sodUtc0) > 0
                    ? ((safeParseFloat(t.last) - safeParseFloat(t.sodUtc0)) / safeParseFloat(t.sodUtc0)) * 100
                    : 0,
                high24h: safeParseFloat(t.high24h),
                low24h: safeParseFloat(t.low24h),
                timestamp: safeParseFloat(t.ts),
            };
        } catch (error) {
            console.error('OKX getTicker error:', error);
            return null;
        }
    },

    /**
     * Get all swap tickers
     */
    async getAllSwapTickers(): Promise<{
        symbol: string;
        price: number;
        bid: number;
        ask: number;
        volume24h: number;
        change24h: number;
    }[]> {
        try {
            const url = `${BASE_URL}/api/v5/market/tickers?instType=SWAP`;
            const data = await apiClient.fetch<OKXResponse<any[]>>(
                url, 'okx', { cacheTtl: CACHE_TTL.ticker }
            );

            if (data.code !== '0') return [];

            return data.data
                .filter((t: any) => t.instId?.includes('-USDT-'))
                .map((t: any) => ({
                    symbol: t.instId,
                    price: safeParseFloat(t.last),
                    bid: safeParseFloat(t.bidPx),
                    ask: safeParseFloat(t.askPx),
                    volume24h: safeParseFloat(t.volCcy24h),
                    change24h: safeParseFloat(t.sodUtc0) > 0
                        ? ((safeParseFloat(t.last) - safeParseFloat(t.sodUtc0)) / safeParseFloat(t.sodUtc0)) * 100
                        : 0,
                }));
        } catch (error) {
            console.error('OKX getAllSwapTickers error:', error);
            return [];
        }
    },

    /**
     * Get open interest
     */
    async getOpenInterest(symbol: string, instType: 'SWAP' | 'FUTURES' | 'OPTION' = 'SWAP'): Promise<{
        instType: string;
        instId: string;
        oi: number;
        oiCcy: number;
        timestamp: number;
    } | null> {
        try {
            const instId = formatSymbol(symbol, instType);
            const url = `${BASE_URL}/api/v5/public/open-interest?instType=${instType}&instId=${instId}`;

            const data = await apiClient.fetch<OKXResponse<any[]>>(
                url, 'okx', { cacheTtl: CACHE_TTL.oi }
            );

            if (data.code !== '0' || !data.data?.[0]) return null;

            const oi = data.data[0];
            return {
                instType: oi.instType,
                instId: oi.instId,
                oi: safeParseFloat(oi.oi),
                oiCcy: safeParseFloat(oi.oiCcy),
                timestamp: safeParseFloat(oi.ts),
            };
        } catch (error) {
            console.error('OKX getOpenInterest error:', error);
            return null;
        }
    },

    /**
     * Get open interest for underlying (aggregated)
     */
    async getOpenInterestByUnderlying(underlying: string = 'BTC'): Promise<{
        instType: string;
        instId: string;
        oi: number;
        oiCcy: number;
    }[]> {
        try {
            const url = `${BASE_URL}/api/v5/public/open-interest?instType=SWAP&uly=${underlying}-USDT`;
            const data = await apiClient.fetch<OKXResponse<any[]>>(
                url, 'okx', { cacheTtl: CACHE_TTL.oi }
            );

            if (data.code !== '0') return [];

            return data.data.map((oi: any) => ({
                instType: oi.instType,
                instId: oi.instId,
                oi: safeParseFloat(oi.oi),
                oiCcy: safeParseFloat(oi.oiCcy),
            }));
        } catch (error) {
            console.error('OKX getOpenInterestByUnderlying error:', error);
            return [];
        }
    },

    /**
     * Get funding rate
     */
    async getFundingRate(symbol: string): Promise<{
        instId: string;
        fundingRate: number;
        nextFundingRate: number;
        fundingTime: number;
        nextFundingTime: number;
    } | null> {
        try {
            const instId = formatSymbol(symbol, 'SWAP');
            const url = `${BASE_URL}/api/v5/public/funding-rate?instId=${instId}`;

            const data = await apiClient.fetch<OKXResponse<any[]>>(
                url, 'okx', { cacheTtl: CACHE_TTL.funding }
            );

            if (data.code !== '0' || !data.data?.[0]) return null;

            const f = data.data[0];
            return {
                instId: f.instId,
                fundingRate: safeParseFloat(f.fundingRate),
                nextFundingRate: safeParseFloat(f.nextFundingRate),
                fundingTime: safeParseFloat(f.fundingTime),
                nextFundingTime: safeParseFloat(f.nextFundingTime),
            };
        } catch (error) {
            console.error('OKX getFundingRate error:', error);
            return null;
        }
    },

    /**
     * Get funding rate history
     */
    async getFundingHistory(symbol: string, limit: number = 24): Promise<{
        instId: string;
        fundingRate: number;
        realizedRate: number;
        fundingTime: number;
    }[]> {
        try {
            const instId = formatSymbol(symbol, 'SWAP');
            const url = `${BASE_URL}/api/v5/public/funding-rate-history${buildQueryString({
                instId,
                limit,
            })}`;

            const data = await apiClient.fetch<OKXResponse<any[]>>(
                url, 'okx', { cacheTtl: CACHE_TTL.funding }
            );

            if (data.code !== '0') return [];

            return data.data.map((f: any) => ({
                instId: f.instId,
                fundingRate: safeParseFloat(f.fundingRate),
                realizedRate: safeParseFloat(f.realizedRate),
                fundingTime: safeParseFloat(f.fundingTime),
            }));
        } catch (error) {
            console.error('OKX getFundingHistory error:', error);
            return [];
        }
    },

    /**
     * Get liquidation orders - CRITICAL for squeeze detection
     */
    async getLiquidations(instType: 'SWAP' | 'FUTURES' = 'SWAP', underlying?: string): Promise<{
        instId: string;
        side: 'long' | 'short';
        price: number;
        sz: number;
        ts: number;
    }[]> {
        try {
            const params: Record<string, string> = { instType };
            if (underlying) params.uly = `${underlying}-USDT`;

            const url = `${BASE_URL}/api/v5/public/liquidation-orders${buildQueryString(params)}`;
            const data = await apiClient.fetch<OKXResponse<any[]>>(
                url, 'okx', { cacheTtl: CACHE_TTL.liquidations }
            );

            if (data.code !== '0') return [];

            const liquidations: any[] = [];
            for (const item of data.data) {
                if (item.details && Array.isArray(item.details)) {
                    for (const detail of item.details) {
                        liquidations.push({
                            instId: item.instId,
                            side: detail.side === 'sell' ? 'long' : 'short',
                            price: safeParseFloat(detail.bkPx),
                            sz: safeParseFloat(detail.sz),
                            ts: safeParseFloat(detail.ts),
                        });
                    }
                }
            }

            return liquidations;
        } catch (error) {
            console.error('OKX getLiquidations error:', error);
            return [];
        }
    },

    /**
     * Get mark price
     */
    async getMarkPrice(symbol: string, instType: 'SWAP' | 'FUTURES' = 'SWAP'): Promise<{
        instId: string;
        instType: string;
        markPx: number;
        timestamp: number;
    } | null> {
        try {
            const instId = formatSymbol(symbol, instType);
            const url = `${BASE_URL}/api/v5/public/mark-price?instType=${instType}&instId=${instId}`;

            const data = await apiClient.fetch<OKXResponse<any[]>>(
                url, 'okx', { cacheTtl: 2000 }
            );

            if (data.code !== '0' || !data.data?.[0]) return null;

            const m = data.data[0];
            return {
                instId: m.instId,
                instType: m.instType,
                markPx: safeParseFloat(m.markPx),
                timestamp: safeParseFloat(m.ts),
            };
        } catch (error) {
            console.error('OKX getMarkPrice error:', error);
            return null;
        }
    },

    // ============================================
    // OPTIONS DATA - What makes OKX special
    // ============================================

    /**
     * Get options summary
     */
    async getOptionsSummary(underlying: 'BTC' | 'ETH' = 'BTC'): Promise<{
        underlying: string;
        expiry: string;
        callOI: number;
        putOI: number;
        callVol: number;
        putVol: number;
    }[]> {
        try {
            const url = `${BASE_URL}/api/v5/public/opt-summary?uly=${underlying}-USD`;
            const data = await apiClient.fetch<OKXResponse<any[]>>(
                url, 'okx', { cacheTtl: CACHE_TTL.options }
            );

            if (data.code !== '0') return [];

            // Group by expiry
            const summaryMap = new Map<string, any>();

            for (const opt of data.data) {
                const expiry = opt.instId.split('-')[2]; // Extract expiry from instId
                if (!summaryMap.has(expiry)) {
                    summaryMap.set(expiry, {
                        underlying,
                        expiry,
                        callOI: 0,
                        putOI: 0,
                        callVol: 0,
                        putVol: 0,
                    });
                }

                const summary = summaryMap.get(expiry);
                const isCall = opt.instId.endsWith('-C');

                if (isCall) {
                    summary.callOI += safeParseFloat(opt.oi);
                    summary.callVol += safeParseFloat(opt.vol24h);
                } else {
                    summary.putOI += safeParseFloat(opt.oi);
                    summary.putVol += safeParseFloat(opt.vol24h);
                }
            }

            return Array.from(summaryMap.values());
        } catch (error) {
            console.error('OKX getOptionsSummary error:', error);
            return [];
        }
    },

    /**
     * Get options tickers (for IV, greeks)
     */
    async getOptionsTickers(underlying: 'BTC' | 'ETH' = 'BTC'): Promise<{
        instId: string;
        strike: number;
        expiry: string;
        type: 'call' | 'put';
        last: number;
        bid: number;
        ask: number;
        vol24h: number;
        oi: number;
        delta: number;
        gamma: number;
        theta: number;
        vega: number;
        markVol: number; // IV
    }[]> {
        try {
            const url = `${BASE_URL}/api/v5/market/tickers?instType=OPTION&uly=${underlying}-USD`;
            const data = await apiClient.fetch<OKXResponse<any[]>>(
                url, 'okx', { cacheTtl: CACHE_TTL.options }
            );

            if (data.code !== '0') return [];

            return data.data.map((opt: any) => {
                const parts = opt.instId.split('-');
                const strike = safeParseFloat(parts[3]);
                const expiry = parts[2];
                const type = parts[4] === 'C' ? 'call' : 'put';

                return {
                    instId: opt.instId,
                    strike,
                    expiry,
                    type,
                    last: safeParseFloat(opt.last),
                    bid: safeParseFloat(opt.bidPx),
                    ask: safeParseFloat(opt.askPx),
                    vol24h: safeParseFloat(opt.vol24h),
                    oi: safeParseFloat(opt.oi),
                    delta: safeParseFloat(opt.delta),
                    gamma: safeParseFloat(opt.gamma),
                    theta: safeParseFloat(opt.theta),
                    vega: safeParseFloat(opt.vega),
                    markVol: safeParseFloat(opt.markVol),
                };
            });
        } catch (error) {
            console.error('OKX getOptionsTickers error:', error);
            return [];
        }
    },

    /**
     * Get options open interest by strike
     */
    async getOptionsOpenInterest(underlying: 'BTC' | 'ETH' = 'BTC'): Promise<{
        instId: string;
        oi: number;
        oiCcy: number;
    }[]> {
        try {
            const url = `${BASE_URL}/api/v5/public/open-interest?instType=OPTION&uly=${underlying}-USD`;
            const data = await apiClient.fetch<OKXResponse<any[]>>(
                url, 'okx', { cacheTtl: CACHE_TTL.options }
            );

            if (data.code !== '0') return [];

            return data.data.map((oi: any) => ({
                instId: oi.instId,
                oi: safeParseFloat(oi.oi),
                oiCcy: safeParseFloat(oi.oiCcy),
            }));
        } catch (error) {
            console.error('OKX getOptionsOpenInterest error:', error);
            return [];
        }
    },

    /**
     * Calculate max pain from options OI
     */
    async calculateMaxPain(underlying: 'BTC' | 'ETH' = 'BTC', expiryFilter?: string): Promise<{
        maxPainStrike: number;
        strikeData: { strike: number; callOI: number; putOI: number; totalPain: number }[];
    } | null> {
        try {
            const options = await this.getOptionsTickers(underlying);
            if (options.length === 0) return null;

            // Filter by expiry if specified
            const filtered = expiryFilter
                ? options.filter(o => o.expiry === expiryFilter)
                : options;

            // Group by strike
            const strikeMap = new Map<number, { callOI: number; putOI: number }>();

            for (const opt of filtered) {
                if (!strikeMap.has(opt.strike)) {
                    strikeMap.set(opt.strike, { callOI: 0, putOI: 0 });
                }
                const data = strikeMap.get(opt.strike)!;
                if (opt.type === 'call') {
                    data.callOI += opt.oi;
                } else {
                    data.putOI += opt.oi;
                }
            }

            const strikes = Array.from(strikeMap.keys()).sort((a, b) => a - b);

            // Calculate pain at each strike
            const strikeData = strikes.map(strike => {
                const data = strikeMap.get(strike)!;

                // Pain = sum of (OI * max(0, price - strike)) for calls
                //      + sum of (OI * max(0, strike - price)) for puts
                let totalPain = 0;

                for (const [s, d] of strikeMap.entries()) {
                    // Call pain: call holders lose if price < strike
                    totalPain += d.callOI * Math.max(0, strike - s);
                    // Put pain: put holders lose if price > strike
                    totalPain += d.putOI * Math.max(0, s - strike);
                }

                return {
                    strike,
                    callOI: data.callOI,
                    putOI: data.putOI,
                    totalPain,
                };
            });

            // Max pain is where total pain is highest
            const maxPainStrike = strikeData.reduce(
                (max, curr) => curr.totalPain > max.totalPain ? curr : max,
                strikeData[0]
            );

            return {
                maxPainStrike: maxPainStrike?.strike || 0,
                strikeData,
            };
        } catch (error) {
            console.error('OKX calculateMaxPain error:', error);
            return null;
        }
    },

    /**
     * Get aggregated options data for dashboard
     */
    async getOptionsAggregates(underlying: 'BTC' | 'ETH' = 'BTC'): Promise<{
        underlying: string;
        totalCallOI: number;
        totalPutOI: number;
        putCallRatio: number;
        avgCallIV: number;
        avgPutIV: number;
        maxPainStrike: number;
    } | null> {
        try {
            const [options, maxPain] = await Promise.all([
                this.getOptionsTickers(underlying),
                this.calculateMaxPain(underlying),
            ]);

            if (options.length === 0) return null;

            const calls = options.filter(o => o.type === 'call');
            const puts = options.filter(o => o.type === 'put');

            const totalCallOI = calls.reduce((sum, o) => sum + o.oi, 0);
            const totalPutOI = puts.reduce((sum, o) => sum + o.oi, 0);

            const avgCallIV = calls.length > 0
                ? calls.reduce((sum, o) => sum + o.markVol, 0) / calls.length
                : 0;
            const avgPutIV = puts.length > 0
                ? puts.reduce((sum, o) => sum + o.markVol, 0) / puts.length
                : 0;

            return {
                underlying,
                totalCallOI,
                totalPutOI,
                putCallRatio: totalCallOI > 0 ? totalPutOI / totalCallOI : 0,
                avgCallIV,
                avgPutIV,
                maxPainStrike: maxPain?.maxPainStrike || 0,
            };
        } catch (error) {
            console.error('OKX getOptionsAggregates error:', error);
            return null;
        }
    },
};

export default okxAdapter;
