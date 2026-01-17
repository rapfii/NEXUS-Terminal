/**
 * Binance Exchange Adapter
 * REST API wrapper for Binance spot and futures data
 */

import { Instrument, Orderbook, OrderbookLevel, Kline, FundingRate, OpenInterest, MarketType } from '../types';

const SPOT_BASE = 'https://api.binance.com/api/v3';
const FUTURES_BASE = 'https://fapi.binance.com/fapi/v1';
const FUTURES_DATA = 'https://fapi.binance.com/futures/data';

// Helper to format symbol for Binance (e.g., BTC-USDT -> BTCUSDT)
function formatSymbol(symbol: string): string {
    return symbol.replace('-', '').toUpperCase();
}

// Parse Binance depth response into normalized orderbook
function parseOrderbook(data: { bids: string[][]; asks: string[][] }, symbol: string, marketType: MarketType): Orderbook {
    let bidTotal = 0;
    let askTotal = 0;

    const bids: OrderbookLevel[] = data.bids.slice(0, 25).map(([price, size]) => {
        bidTotal += parseFloat(size);
        return {
            price: parseFloat(price),
            size: parseFloat(size),
            total: bidTotal,
        };
    });

    const asks: OrderbookLevel[] = data.asks.slice(0, 25).map(([price, size]) => {
        askTotal += parseFloat(size);
        return {
            price: parseFloat(price),
            size: parseFloat(size),
            total: askTotal,
        };
    });

    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spread = bestAsk - bestBid;
    const spreadBps = bestBid > 0 ? (spread / bestBid) * 10000 : 0;

    // Calculate imbalance: positive = more bids, negative = more asks
    const imbalance = bidTotal + askTotal > 0
        ? (bidTotal - askTotal) / (bidTotal + askTotal)
        : 0;

    return {
        exchange: 'binance',
        marketType,
        symbol,
        bids,
        asks,
        spread,
        spreadBps,
        imbalance,
        timestamp: Date.now(),
    };
}

// Aggregate orderbook levels by price buckets
export function aggregateOrderbook(orderbook: Orderbook, bucketSize: number): Orderbook {
    const aggregateLevels = (levels: OrderbookLevel[], isAsk: boolean): OrderbookLevel[] => {
        const buckets = new Map<number, number>();

        levels.forEach(({ price, size }) => {
            const bucket = isAsk
                ? Math.ceil(price / bucketSize) * bucketSize
                : Math.floor(price / bucketSize) * bucketSize;
            buckets.set(bucket, (buckets.get(bucket) || 0) + size);
        });

        let total = 0;
        const sortedBuckets = Array.from(buckets.entries())
            .sort((a, b) => isAsk ? a[0] - b[0] : b[0] - a[0]);

        return sortedBuckets.map(([price, size]) => {
            total += size;
            return { price, size, total };
        });
    };

    return {
        ...orderbook,
        bids: aggregateLevels(orderbook.bids, false),
        asks: aggregateLevels(orderbook.asks, true),
    };
}

// Parse klines into standard format
function parseKlines(data: (string | number)[][]): Kline[] {
    return data.map((k) => ({
        time: k[0] as number,
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
    }));
}

export const binanceAdapter = {
    name: 'binance' as const,

    /**
     * Get instrument data for a symbol
     */
    async getInstrument(symbol: string, marketType: MarketType = 'perpetual'): Promise<Instrument | null> {
        try {
            const formatted = formatSymbol(symbol);
            const base = marketType === 'spot' ? SPOT_BASE : FUTURES_BASE;

            const res = await fetch(`${base}/ticker/24hr?symbol=${formatted}`);
            if (!res.ok) return null;

            const data = await res.json();

            // For perpetual, also get mark/index price
            let markPrice = parseFloat(data.lastPrice);
            let indexPrice = parseFloat(data.lastPrice);
            let fundingRate = 0;
            let nextFundingTime = 0;
            let openInterest = 0;

            if (marketType === 'perpetual') {
                try {
                    const premiumRes = await fetch(`${FUTURES_BASE}/premiumIndex?symbol=${formatted}`);
                    if (premiumRes.ok) {
                        const premium = await premiumRes.json();
                        markPrice = parseFloat(premium.markPrice);
                        indexPrice = parseFloat(premium.indexPrice);
                        fundingRate = parseFloat(premium.lastFundingRate || '0');
                        nextFundingTime = premium.nextFundingTime || 0;
                    }

                    const oiRes = await fetch(`${FUTURES_BASE}/openInterest?symbol=${formatted}`);
                    if (oiRes.ok) {
                        const oi = await oiRes.json();
                        openInterest = parseFloat(oi.openInterest);
                    }
                } catch {
                    // Silent fail for optional data
                }
            }

            const price = parseFloat(data.lastPrice);
            const bestBid = parseFloat(data.bidPrice);
            const bestAsk = parseFloat(data.askPrice);
            const spread = bestAsk - bestBid;
            const spreadBps = bestBid > 0 ? (spread / bestBid) * 10000 : 0;
            const basis = markPrice - indexPrice;
            const premiumIndex = indexPrice > 0 ? (basis / indexPrice) * 100 : 0;

            return {
                exchange: 'binance',
                marketType,
                symbol,
                contractId: marketType === 'perpetual' ? formatted : null,
                price,
                bestBid,
                bestAsk,
                spread,
                spreadBps,
                markPrice,
                indexPrice,
                basis,
                premiumIndex,
                fundingRate,
                nextFundingTime,
                openInterest,
                openInterestValue: openInterest * price,
                volume24h: parseFloat(data.quoteVolume),
                quoteVolume24h: parseFloat(data.quoteVolume),
                liquidationVolume24h: 0,
                timestamp: Date.now(),
            };
        } catch (error) {
            console.error('Binance getInstrument error:', error);
            return null;
        }
    },

    /**
     * Get orderbook depth
     */
    async getOrderbook(symbol: string, marketType: MarketType = 'perpetual', limit = 100): Promise<Orderbook | null> {
        try {
            const formatted = formatSymbol(symbol);
            const base = marketType === 'spot' ? SPOT_BASE : FUTURES_BASE;
            const res = await fetch(`${base}/depth?symbol=${formatted}&limit=${limit}`);
            if (!res.ok) return null;

            const data = await res.json();
            return parseOrderbook(data, symbol, marketType);
        } catch (error) {
            console.error('Binance getOrderbook error:', error);
            return null;
        }
    },

    /**
     * Get klines/candlestick data
     */
    async getKlines(symbol: string, interval = '1h', marketType: MarketType = 'perpetual', limit = 500): Promise<Kline[]> {
        try {
            const formatted = formatSymbol(symbol);
            const base = marketType === 'spot' ? SPOT_BASE : FUTURES_BASE;
            const res = await fetch(
                `${base}/klines?symbol=${formatted}&interval=${interval}&limit=${limit}`
            );
            if (!res.ok) return [];

            const data = await res.json();
            return parseKlines(data);
        } catch (error) {
            console.error('Binance getKlines error:', error);
            return [];
        }
    },

    /**
     * Get funding rate for futures
     */
    async getFunding(symbol: string): Promise<FundingRate | null> {
        try {
            const formatted = formatSymbol(symbol);
            const res = await fetch(`${FUTURES_BASE}/fundingRate?symbol=${formatted}&limit=1`);
            if (!res.ok) return null;

            const data = await res.json();
            if (!data.length) return null;

            const latest = data[0];
            return {
                exchange: 'binance',
                symbol,
                rate: parseFloat(latest.fundingRate),
                nextFundingTime: latest.fundingTime,
                timestamp: Date.now(),
            };
        } catch (error) {
            console.error('Binance getFunding error:', error);
            return null;
        }
    },

    /**
     * Get open interest
     */
    async getOpenInterest(symbol: string): Promise<OpenInterest | null> {
        try {
            const formatted = formatSymbol(symbol);
            const res = await fetch(`${FUTURES_BASE}/openInterest?symbol=${formatted}`);
            if (!res.ok) return null;

            const data = await res.json();

            // Get current price for value calculation
            const priceRes = await fetch(`${FUTURES_BASE}/ticker/price?symbol=${formatted}`);
            const priceData = priceRes.ok ? await priceRes.json() : { price: '0' };
            const price = parseFloat(priceData.price) || 0;
            const oi = parseFloat(data.openInterest);

            return {
                exchange: 'binance',
                symbol,
                openInterest: oi,
                openInterestValue: oi * price,
                timestamp: Date.now(),
            };
        } catch (error) {
            console.error('Binance getOpenInterest error:', error);
            return null;
        }
    },

    /**
     * Get open interest history (for OI change tracking)
     */
    async getOpenInterestHistory(
        symbol: string,
        period: '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d' = '1h',
        limit: number = 24
    ): Promise<{ time: number; oi: number; oiValue: number }[]> {
        try {
            const formatted = formatSymbol(symbol);
            const res = await fetch(
                `${FUTURES_DATA}/openInterestHist?symbol=${formatted}&period=${period}&limit=${limit}`
            );
            if (!res.ok) return [];

            const data = await res.json();
            return data.map((d: { timestamp: number; sumOpenInterest: string; sumOpenInterestValue: string }) => ({
                time: d.timestamp,
                oi: parseFloat(d.sumOpenInterest),
                oiValue: parseFloat(d.sumOpenInterestValue),
            }));
        } catch (error) {
            console.error('Binance getOpenInterestHistory error:', error);
            return [];
        }
    },

    /**
     * Get recent liquidations (forced orders)
     */
    async getLiquidations(symbol?: string, limit: number = 100): Promise<{
        symbol: string;
        side: 'long' | 'short';
        price: number;
        quantity: number;
        value: number;
        timestamp: number;
    }[]> {
        try {
            const params = new URLSearchParams({ limit: String(limit) });
            if (symbol) params.append('symbol', formatSymbol(symbol));

            const res = await fetch(`${FUTURES_BASE}/allForceOrders?${params}`);
            if (!res.ok) return [];

            const data = await res.json();
            return data.map((liq: {
                symbol: string;
                side: string;
                price: string;
                origQty: string;
                time: number;
            }) => ({
                symbol: liq.symbol,
                side: liq.side === 'SELL' ? 'long' : 'short', // SELL = long liquidation
                price: parseFloat(liq.price),
                quantity: parseFloat(liq.origQty),
                value: parseFloat(liq.price) * parseFloat(liq.origQty),
                timestamp: liq.time,
            }));
        } catch (error) {
            console.error('Binance getLiquidations error:', error);
            return [];
        }
    },

    /**
     * Get long/short ratio (top traders)
     */
    async getTopTraderLongShortRatio(
        symbol: string,
        period: '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d' = '1h',
        limit: number = 24
    ): Promise<{
        time: number;
        longRatio: number;
        shortRatio: number;
        longShortRatio: number;
    }[]> {
        try {
            const formatted = formatSymbol(symbol);
            const res = await fetch(
                `${FUTURES_DATA}/topLongShortPositionRatio?symbol=${formatted}&period=${period}&limit=${limit}`
            );
            if (!res.ok) return [];

            const data = await res.json();
            return data.map((d: {
                timestamp: number;
                longAccount: string;
                shortAccount: string;
                longShortRatio: string
            }) => ({
                time: d.timestamp,
                longRatio: parseFloat(d.longAccount),
                shortRatio: parseFloat(d.shortAccount),
                longShortRatio: parseFloat(d.longShortRatio),
            }));
        } catch (error) {
            console.error('Binance getTopTraderLongShortRatio error:', error);
            return [];
        }
    },

    /**
     * Get global long/short account ratio
     */
    async getGlobalLongShortRatio(
        symbol: string,
        period: '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d' = '1h',
        limit: number = 24
    ): Promise<{
        time: number;
        longAccountRatio: number;
        shortAccountRatio: number;
    }[]> {
        try {
            const formatted = formatSymbol(symbol);
            const res = await fetch(
                `${FUTURES_DATA}/globalLongShortAccountRatio?symbol=${formatted}&period=${period}&limit=${limit}`
            );
            if (!res.ok) return [];

            const data = await res.json();
            return data.map((d: { timestamp: number; longAccount: string; shortAccount: string }) => ({
                time: d.timestamp,
                longAccountRatio: parseFloat(d.longAccount),
                shortAccountRatio: parseFloat(d.shortAccount),
            }));
        } catch (error) {
            console.error('Binance getGlobalLongShortRatio error:', error);
            return [];
        }
    },

    /**
     * Get taker buy/sell volume ratio
     */
    async getTakerBuySellRatio(
        symbol: string,
        period: '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d' = '1h',
        limit: number = 24
    ): Promise<{
        time: number;
        buySellRatio: number;
        buyVolume: number;
        sellVolume: number;
    }[]> {
        try {
            const formatted = formatSymbol(symbol);
            const res = await fetch(
                `${FUTURES_DATA}/takerlongshortRatio?symbol=${formatted}&period=${period}&limit=${limit}`
            );
            if (!res.ok) return [];

            const data = await res.json();
            return data.map((d: {
                timestamp: number;
                buySellRatio: string;
                buyVol: string;
                sellVol: string
            }) => ({
                time: d.timestamp,
                buySellRatio: parseFloat(d.buySellRatio),
                buyVolume: parseFloat(d.buyVol),
                sellVolume: parseFloat(d.sellVol),
            }));
        } catch (error) {
            console.error('Binance getTakerBuySellRatio error:', error);
            return [];
        }
    },

    /**
     * Get all futures tickers (for bulk data)
     */
    async getAllFuturesTickers(): Promise<{
        symbol: string;
        price: number;
        change24h: number;
        volume24h: number;
        high24h: number;
        low24h: number;
    }[]> {
        try {
            const res = await fetch(`${FUTURES_BASE}/ticker/24hr`);
            if (!res.ok) return [];

            const data = await res.json();
            return data
                .filter((t: { symbol: string }) => t.symbol.endsWith('USDT'))
                .map((t: {
                    symbol: string;
                    lastPrice: string;
                    priceChangePercent: string;
                    quoteVolume: string;
                    highPrice: string;
                    lowPrice: string;
                }) => ({
                    symbol: t.symbol,
                    price: parseFloat(t.lastPrice),
                    change24h: parseFloat(t.priceChangePercent),
                    volume24h: parseFloat(t.quoteVolume),
                    high24h: parseFloat(t.highPrice),
                    low24h: parseFloat(t.lowPrice),
                }));
        } catch (error) {
            console.error('Binance getAllFuturesTickers error:', error);
            return [];
        }
    },

    /**
     * Get all funding rates
     */
    async getAllFundingRates(): Promise<{
        symbol: string;
        fundingRate: number;
        fundingTime: number;
        markPrice: number;
        indexPrice: number;
    }[]> {
        try {
            const res = await fetch(`${FUTURES_BASE}/premiumIndex`);
            if (!res.ok) return [];

            const data = await res.json();
            return data
                .filter((p: { symbol: string }) => p.symbol.endsWith('USDT'))
                .map((p: {
                    symbol: string;
                    lastFundingRate: string;
                    nextFundingTime: number;
                    markPrice: string;
                    indexPrice: string;
                }) => ({
                    symbol: p.symbol,
                    fundingRate: parseFloat(p.lastFundingRate || '0'),
                    fundingTime: p.nextFundingTime,
                    markPrice: parseFloat(p.markPrice),
                    indexPrice: parseFloat(p.indexPrice),
                }));
        } catch (error) {
            console.error('Binance getAllFundingRates error:', error);
            return [];
        }
    },
};

export default binanceAdapter;

