/**
 * Deribit Exchange Adapter
 * The options exchange - Critical for real intelligence
 * Provides IV, skew, put/call ratio, strike OI, max pain
 */

import { EXCHANGE_CONFIG, CACHE_TTL } from '../config';
import apiClient, { safeParseFloat } from '../api-client';

const BASE_URL = EXCHANGE_CONFIG.deribit.rest;

// Deribit response wrapper
interface DeribitResponse<T> {
    jsonrpc: string;
    id: number;
    result: T;
    usIn: number;
    usOut: number;
    usDiff: number;
}

export const deribitAdapter = {
    name: 'deribit' as const,

    /**
     * Get index price
     */
    async getIndexPrice(currency: 'BTC' | 'ETH' = 'BTC'): Promise<{
        indexPrice: number;
        estimatedDeliveryPrice: number;
    } | null> {
        try {
            const url = `${BASE_URL}/public/get_index_price?index_name=${currency.toLowerCase()}_usd`;
            const data = await apiClient.fetch<DeribitResponse<{
                index_price: number;
                estimated_delivery_price: number;
            }>>(url, 'deribit', { cacheTtl: 2000 });

            return {
                indexPrice: data.result.index_price,
                estimatedDeliveryPrice: data.result.estimated_delivery_price,
            };
        } catch (error) {
            console.error('Deribit getIndexPrice error:', error);
            return null;
        }
    },

    /**
     * Get all instruments (options + futures)
     */
    async getInstruments(
        currency: 'BTC' | 'ETH' = 'BTC',
        kind: 'future' | 'option' | 'spot' = 'option',
        expired: boolean = false
    ): Promise<{
        instrumentName: string;
        kind: string;
        baseCurrency: string;
        quoteCurrency: string;
        strike: number | null;
        optionType: 'call' | 'put' | null;
        expirationTimestamp: number;
        isActive: boolean;
        minTradeAmount: number;
        tickSize: number;
    }[]> {
        try {
            const url = `${BASE_URL}/public/get_instruments?currency=${currency}&kind=${kind}&expired=${expired}`;
            const data = await apiClient.fetch<DeribitResponse<any[]>>(
                url, 'deribit', { cacheTtl: 300000 } // 5 min cache
            );

            return data.result.map((i: any) => ({
                instrumentName: i.instrument_name,
                kind: i.kind,
                baseCurrency: i.base_currency,
                quoteCurrency: i.quote_currency,
                strike: i.strike || null,
                optionType: i.option_type || null,
                expirationTimestamp: i.expiration_timestamp,
                isActive: i.is_active,
                minTradeAmount: i.min_trade_amount,
                tickSize: i.tick_size,
            }));
        } catch (error) {
            console.error('Deribit getInstruments error:', error);
            return [];
        }
    },

    /**
     * Get ticker for a specific instrument
     */
    async getTicker(instrumentName: string): Promise<{
        instrumentName: string;
        markPrice: number;
        indexPrice: number;
        bestBid: number;
        bestAsk: number;
        last: number;
        volume24h: number;
        openInterest: number;
        markIv: number;
        bidIv: number;
        askIv: number;
        delta: number;
        gamma: number;
        theta: number;
        vega: number;
        fundingRate8h: number;
        currentFunding: number;
        timestamp: number;
    } | null> {
        try {
            const url = `${BASE_URL}/public/ticker?instrument_name=${instrumentName}`;
            const data = await apiClient.fetch<DeribitResponse<any>>(
                url, 'deribit', { cacheTtl: CACHE_TTL.ticker }
            );

            const t = data.result;
            return {
                instrumentName: t.instrument_name,
                markPrice: safeParseFloat(t.mark_price),
                indexPrice: safeParseFloat(t.index_price),
                bestBid: safeParseFloat(t.best_bid_price),
                bestAsk: safeParseFloat(t.best_ask_price),
                last: safeParseFloat(t.last_price),
                volume24h: safeParseFloat(t.stats?.volume),
                openInterest: safeParseFloat(t.open_interest),
                markIv: safeParseFloat(t.mark_iv),
                bidIv: safeParseFloat(t.bid_iv),
                askIv: safeParseFloat(t.ask_iv),
                delta: safeParseFloat(t.greeks?.delta),
                gamma: safeParseFloat(t.greeks?.gamma),
                theta: safeParseFloat(t.greeks?.theta),
                vega: safeParseFloat(t.greeks?.vega),
                fundingRate8h: safeParseFloat(t.funding_8h),
                currentFunding: safeParseFloat(t.current_funding),
                timestamp: t.timestamp,
            };
        } catch (error) {
            console.error('Deribit getTicker error:', error);
            return null;
        }
    },

    /**
     * Get book summary for all options of a currency
     */
    async getBookSummaryByCurrency(
        currency: 'BTC' | 'ETH' = 'BTC',
        kind: 'future' | 'option' = 'option'
    ): Promise<{
        instrumentName: string;
        baseCurrency: string;
        markPrice: number;
        markIv: number;
        bidPrice: number;
        askPrice: number;
        openInterest: number;
        volume24h: number;
        underlyingIndex: string;
        underlyingPrice: number;
    }[]> {
        try {
            const url = `${BASE_URL}/public/get_book_summary_by_currency?currency=${currency}&kind=${kind}`;
            const data = await apiClient.fetch<DeribitResponse<any[]>>(
                url, 'deribit', { cacheTtl: CACHE_TTL.options }
            );

            return data.result.map((b: any) => ({
                instrumentName: b.instrument_name,
                baseCurrency: b.base_currency,
                markPrice: safeParseFloat(b.mark_price),
                markIv: safeParseFloat(b.mark_iv),
                bidPrice: safeParseFloat(b.bid_price),
                askPrice: safeParseFloat(b.ask_price),
                openInterest: safeParseFloat(b.open_interest),
                volume24h: safeParseFloat(b.volume),
                underlyingIndex: b.underlying_index,
                underlyingPrice: safeParseFloat(b.underlying_price),
            }));
        } catch (error) {
            console.error('Deribit getBookSummaryByCurrency error:', error);
            return [];
        }
    },

    /**
     * Get perpetual ticker (BTC-PERPETUAL, ETH-PERPETUAL)
     */
    async getPerpetualTicker(currency: 'BTC' | 'ETH' = 'BTC'): Promise<{
        instrumentName: string;
        markPrice: number;
        indexPrice: number;
        fundingRate: number;
        funding8h: number;
        openInterest: number;
        volume24h: number;
        change24h: number;
        bestBid: number;
        bestAsk: number;
    } | null> {
        try {
            const instrumentName = `${currency}-PERPETUAL`;
            const ticker = await this.getTicker(instrumentName);

            if (!ticker) return null;

            return {
                instrumentName: ticker.instrumentName,
                markPrice: ticker.markPrice,
                indexPrice: ticker.indexPrice,
                fundingRate: ticker.currentFunding,
                funding8h: ticker.fundingRate8h,
                openInterest: ticker.openInterest,
                volume24h: ticker.volume24h,
                change24h: 0, // Need to calculate from stats
                bestBid: ticker.bestBid,
                bestAsk: ticker.bestAsk,
            };
        } catch (error) {
            console.error('Deribit getPerpetualTicker error:', error);
            return null;
        }
    },

    /**
     * Get historical volatility
     */
    async getHistoricalVolatility(currency: 'BTC' | 'ETH' = 'BTC'): Promise<{
        timestamp: number;
        value: number;
    }[]> {
        try {
            const url = `${BASE_URL}/public/get_historical_volatility?currency=${currency}`;
            const data = await apiClient.fetch<DeribitResponse<[number, number][]>>(
                url, 'deribit', { cacheTtl: CACHE_TTL.options }
            );

            return data.result.map(([timestamp, value]) => ({
                timestamp,
                value,
            }));
        } catch (error) {
            console.error('Deribit getHistoricalVolatility error:', error);
            return [];
        }
    },

    /**
     * Parse option instrument name
     */
    parseOptionName(instrumentName: string): {
        currency: string;
        expiry: string;
        strike: number;
        type: 'call' | 'put';
    } | null {
        // Format: BTC-31JAN26-100000-C
        const parts = instrumentName.split('-');
        if (parts.length !== 4) return null;

        return {
            currency: parts[0],
            expiry: parts[1],
            strike: safeParseFloat(parts[2]),
            type: parts[3] === 'C' ? 'call' : 'put',
        };
    },

    /**
     * Get complete options chain with greeks
     */
    async getOptionsChain(currency: 'BTC' | 'ETH' = 'BTC'): Promise<{
        instrumentName: string;
        strike: number;
        expiry: string;
        type: 'call' | 'put';
        markPrice: number;
        markIv: number;
        bidPrice: number;
        askPrice: number;
        openInterest: number;
        volume24h: number;
        delta: number;
        gamma: number;
        theta: number;
        vega: number;
        underlyingPrice: number;
    }[]> {
        try {
            const summary = await this.getBookSummaryByCurrency(currency, 'option');

            const chain = summary.map(opt => {
                const parsed = this.parseOptionName(opt.instrumentName);
                if (!parsed) return null;

                return {
                    instrumentName: opt.instrumentName,
                    strike: parsed.strike,
                    expiry: parsed.expiry,
                    type: parsed.type,
                    markPrice: opt.markPrice,
                    markIv: opt.markIv,
                    bidPrice: opt.bidPrice,
                    askPrice: opt.askPrice,
                    openInterest: opt.openInterest,
                    volume24h: opt.volume24h,
                    delta: 0, // Need individual ticker call for greeks
                    gamma: 0,
                    theta: 0,
                    vega: 0,
                    underlyingPrice: opt.underlyingPrice,
                };
            }).filter((o): o is NonNullable<typeof o> => o !== null);

            return chain;
        } catch (error) {
            console.error('Deribit getOptionsChain error:', error);
            return [];
        }
    },

    /**
     * Get options aggregates (what traders actually need)
     */
    async getOptionsAggregates(currency: 'BTC' | 'ETH' = 'BTC'): Promise<{
        currency: string;
        indexPrice: number;

        // Put/Call metrics
        totalCallOI: number;
        totalPutOI: number;
        putCallRatio: number;

        // IV metrics
        atmIV: number;
        avgCallIV: number;
        avgPutIV: number;
        ivSkew: number;

        // Max pain
        maxPainStrike: number;

        // Volume
        totalCallVolume: number;
        totalPutVolume: number;

        // Expiries
        expiryBreakdown: {
            expiry: string;
            callOI: number;
            putOI: number;
            totalVolume: number;
        }[];
    } | null> {
        try {
            const [chain, indexData] = await Promise.all([
                this.getOptionsChain(currency),
                this.getIndexPrice(currency),
            ]);

            if (chain.length === 0 || !indexData) return null;

            const indexPrice = indexData.indexPrice;
            const calls = chain.filter(o => o.type === 'call');
            const puts = chain.filter(o => o.type === 'put');

            // OI totals
            const totalCallOI = calls.reduce((sum, o) => sum + o.openInterest, 0);
            const totalPutOI = puts.reduce((sum, o) => sum + o.openInterest, 0);
            const putCallRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;

            // IV metrics
            // Find ATM options (closest to index price)
            const sortedByStrikeDistance = [...chain].sort(
                (a, b) => Math.abs(a.strike - indexPrice) - Math.abs(b.strike - indexPrice)
            );
            const atmOptions = sortedByStrikeDistance.slice(0, 4);
            const atmIV = atmOptions.length > 0
                ? atmOptions.reduce((sum, o) => sum + o.markIv, 0) / atmOptions.length
                : 0;

            const avgCallIV = calls.length > 0
                ? calls.reduce((sum, o) => sum + o.markIv, 0) / calls.length
                : 0;
            const avgPutIV = puts.length > 0
                ? puts.reduce((sum, o) => sum + o.markIv, 0) / puts.length
                : 0;

            // IV Skew: OTM puts IV vs OTM calls IV
            const otmPuts = puts.filter(p => p.strike < indexPrice);
            const otmCalls = calls.filter(c => c.strike > indexPrice);
            const otmPutIV = otmPuts.length > 0
                ? otmPuts.reduce((sum, o) => sum + o.markIv, 0) / otmPuts.length
                : 0;
            const otmCallIV = otmCalls.length > 0
                ? otmCalls.reduce((sum, o) => sum + o.markIv, 0) / otmCalls.length
                : 0;
            const ivSkew = otmPutIV - otmCallIV; // Positive = fear (puts more expensive)

            // Max pain calculation
            const strikeMap = new Map<number, { callOI: number; putOI: number }>();
            for (const opt of chain) {
                if (!strikeMap.has(opt.strike)) {
                    strikeMap.set(opt.strike, { callOI: 0, putOI: 0 });
                }
                const data = strikeMap.get(opt.strike)!;
                if (opt.type === 'call') {
                    data.callOI += opt.openInterest;
                } else {
                    data.putOI += opt.openInterest;
                }
            }

            let maxPainStrike = indexPrice;
            let maxPainValue = 0;

            for (const [strike] of strikeMap) {
                let pain = 0;
                for (const [s, data] of strikeMap) {
                    pain += data.callOI * Math.max(0, strike - s);
                    pain += data.putOI * Math.max(0, s - strike);
                }
                if (pain > maxPainValue) {
                    maxPainValue = pain;
                    maxPainStrike = strike;
                }
            }

            // Volume
            const totalCallVolume = calls.reduce((sum, o) => sum + o.volume24h, 0);
            const totalPutVolume = puts.reduce((sum, o) => sum + o.volume24h, 0);

            // Expiry breakdown
            const expiryMap = new Map<string, { callOI: number; putOI: number; volume: number }>();
            for (const opt of chain) {
                if (!expiryMap.has(opt.expiry)) {
                    expiryMap.set(opt.expiry, { callOI: 0, putOI: 0, volume: 0 });
                }
                const data = expiryMap.get(opt.expiry)!;
                if (opt.type === 'call') {
                    data.callOI += opt.openInterest;
                } else {
                    data.putOI += opt.openInterest;
                }
                data.volume += opt.volume24h;
            }

            const expiryBreakdown = Array.from(expiryMap.entries()).map(([expiry, data]) => ({
                expiry,
                callOI: data.callOI,
                putOI: data.putOI,
                totalVolume: data.volume,
            }));

            return {
                currency,
                indexPrice,
                totalCallOI,
                totalPutOI,
                putCallRatio,
                atmIV,
                avgCallIV,
                avgPutIV,
                ivSkew,
                maxPainStrike,
                totalCallVolume,
                totalPutVolume,
                expiryBreakdown,
            };
        } catch (error) {
            console.error('Deribit getOptionsAggregates error:', error);
            return null;
        }
    },

    /**
     * Get IV term structure (IV by expiry)
     */
    async getIVTermStructure(currency: 'BTC' | 'ETH' = 'BTC'): Promise<{
        expiry: string;
        daysToExpiry: number;
        atmIV: number;
        callIV: number;
        putIV: number;
    }[]> {
        try {
            const [chain, indexData] = await Promise.all([
                this.getOptionsChain(currency),
                this.getIndexPrice(currency),
            ]);

            if (chain.length === 0 || !indexData) return [];

            const indexPrice = indexData.indexPrice;

            // Group by expiry
            const expiryMap = new Map<string, { calls: typeof chain; puts: typeof chain }>();
            for (const opt of chain) {
                if (!expiryMap.has(opt.expiry)) {
                    expiryMap.set(opt.expiry, { calls: [], puts: [] });
                }
                if (opt.type === 'call') {
                    expiryMap.get(opt.expiry)!.calls.push(opt);
                } else {
                    expiryMap.get(opt.expiry)!.puts.push(opt);
                }
            }

            const result = Array.from(expiryMap.entries()).map(([expiry, data]) => {
                // Find ATM for this expiry
                const allOpts = [...data.calls, ...data.puts];
                const atmOpt = allOpts.reduce((closest, opt) =>
                    Math.abs(opt.strike - indexPrice) < Math.abs(closest.strike - indexPrice)
                        ? opt : closest
                );

                // Parse expiry to get days
                const daysToExpiry = this.parseExpiryDays(expiry);

                const avgCallIV = data.calls.length > 0
                    ? data.calls.reduce((sum, o) => sum + o.markIv, 0) / data.calls.length
                    : 0;
                const avgPutIV = data.puts.length > 0
                    ? data.puts.reduce((sum, o) => sum + o.markIv, 0) / data.puts.length
                    : 0;

                return {
                    expiry,
                    daysToExpiry,
                    atmIV: atmOpt.markIv,
                    callIV: avgCallIV,
                    putIV: avgPutIV,
                };
            });

            return result.sort((a, b) => a.daysToExpiry - b.daysToExpiry);
        } catch (error) {
            console.error('Deribit getIVTermStructure error:', error);
            return [];
        }
    },

    /**
     * Parse expiry string to days until expiry
     */
    parseExpiryDays(expiry: string): number {
        // Format: 31JAN26
        const months: Record<string, number> = {
            JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
            JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
        };

        const day = parseInt(expiry.slice(0, 2));
        const month = months[expiry.slice(2, 5)] || 0;
        const year = 2000 + parseInt(expiry.slice(5));

        const expiryDate = new Date(year, month, day);
        const now = new Date();
        const diff = expiryDate.getTime() - now.getTime();

        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    },
};

export default deribitAdapter;
