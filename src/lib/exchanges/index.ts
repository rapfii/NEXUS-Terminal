/**
 * Exchange Adapters Index
 */

export { binanceAdapter } from './binance';
export { bybitAdapter } from './bybit';
export { gateioAdapter } from './gateio';
export { macroAdapter } from './macro';

import { binanceAdapter } from './binance';
import { bybitAdapter } from './bybit';
import { gateioAdapter } from './gateio';
import type { Exchange, MarketType, Instrument, Orderbook, Kline, FundingRate, OpenInterest } from '../types';

// Type for exchange adapter methods - made more flexible with optional methods
interface ExchangeAdapter {
    name: Exchange;
    getInstrument?(symbol: string, marketType?: MarketType): Promise<Instrument | null>;
    getTicker?(symbol: string, category?: string): Promise<unknown>;
    getOrderbook?(symbol: string, marketType?: MarketType | string, limit?: number): Promise<Orderbook | null>;
    getKlines?(symbol: string, interval?: string, marketType?: MarketType | string, limit?: number): Promise<Kline[]>;
    getFunding?(symbol: string): Promise<FundingRate | null>;
    getOpenInterest?(symbol: string): Promise<OpenInterest | null>;
}

// Map of exchange adapters - using Partial since not all exchanges have adapters yet
export const adapters: Partial<Record<Exchange, ExchangeAdapter>> = {
    binance: binanceAdapter as unknown as ExchangeAdapter,
    bybit: bybitAdapter as unknown as ExchangeAdapter,
    gateio: gateioAdapter as unknown as ExchangeAdapter,
};


/**
 * Get adapter by exchange name
 */
export function getAdapter(exchange: Exchange): ExchangeAdapter | undefined {
    return adapters[exchange];
}

/**
 * Get instrument data from all exchanges in parallel
 * Note: Bybit uses getTicker instead of getInstrument
 */
export async function getMultiExchangeInstruments(
    symbol: string,
    marketType: MarketType = 'perpetual'
): Promise<Partial<Record<Exchange, Instrument | null>>> {
    const [binance, bybitTicker, gateio] = await Promise.all([
        binanceAdapter.getInstrument(symbol, marketType),
        bybitAdapter.getTicker(symbol),
        gateioAdapter.getInstrument(symbol, marketType),
    ]);

    // Convert bybit ticker to instrument format if available
    const bybit: Instrument | null = bybitTicker ? {
        exchange: 'bybit',
        marketType: 'perpetual',
        symbol,
        contractId: symbol,
        price: bybitTicker.price,
        bestBid: bybitTicker.bid,
        bestAsk: bybitTicker.ask,
        spread: bybitTicker.ask - bybitTicker.bid,
        spreadBps: bybitTicker.bid > 0 ? ((bybitTicker.ask - bybitTicker.bid) / bybitTicker.bid) * 10000 : 0,
        markPrice: bybitTicker.price,
        indexPrice: bybitTicker.price,
        basis: 0,
        premiumIndex: 0,
        fundingRate: bybitTicker.fundingRate,
        nextFundingTime: bybitTicker.nextFundingTime,
        openInterest: bybitTicker.openInterest,
        openInterestValue: bybitTicker.openInterestValue,
        volume24h: bybitTicker.volume24h,
        quoteVolume24h: bybitTicker.volume24h * bybitTicker.price,
        liquidationVolume24h: 0,
        timestamp: Date.now(),
    } : null;

    return { binance, bybit, gateio } as Partial<Record<Exchange, Instrument | null>>;
}

/**
 * Get orderbooks from all exchanges
 */
export async function getMultiExchangeOrderbooks(
    symbol: string,
    marketType: MarketType = 'perpetual'
): Promise<Partial<Record<Exchange, Orderbook | null>>> {
    const [binance, bybitOb, gateio] = await Promise.all([
        binanceAdapter.getOrderbook(symbol, marketType),
        bybitAdapter.getOrderbook(symbol),
        gateioAdapter.getOrderbook(symbol, marketType),
    ]);

    // Convert bybit orderbook to standard format
    const bybit: Orderbook | null = bybitOb ? {
        exchange: 'bybit',
        marketType: 'perpetual',
        symbol,
        bids: bybitOb.bids.map((b, i, arr) => ({
            price: b.price,
            size: b.size,
            total: arr.slice(0, i + 1).reduce((sum, l) => sum + l.size, 0),
        })),
        asks: bybitOb.asks.map((a, i, arr) => ({
            price: a.price,
            size: a.size,
            total: arr.slice(0, i + 1).reduce((sum, l) => sum + l.size, 0),
        })),
        spread: bybitOb.asks[0]?.price && bybitOb.bids[0]?.price
            ? bybitOb.asks[0].price - bybitOb.bids[0].price
            : 0,
        spreadBps: bybitOb.asks[0]?.price && bybitOb.bids[0]?.price
            ? ((bybitOb.asks[0].price - bybitOb.bids[0].price) / bybitOb.bids[0].price) * 10000
            : 0,
        imbalance: 0,
        timestamp: bybitOb.timestamp,
    } : null;

    return { binance, bybit, gateio } as Partial<Record<Exchange, Orderbook | null>>;
}

/**
 * Find arbitrage: max(bestBid) - min(bestAsk)
 */
export function findArbitrage(data: Record<Exchange, Instrument | null>): {
    maxBid: { exchange: Exchange; price: number } | null;
    minAsk: { exchange: Exchange; price: number } | null;
    gap: number;
    gapPercent: number;
} {
    let maxBid: { exchange: Exchange; price: number } | null = null;
    let minAsk: { exchange: Exchange; price: number } | null = null;
    let totalPrice = 0;
    let count = 0;

    for (const [exchange, instrument] of Object.entries(data)) {
        if (!instrument) continue;

        count++;
        totalPrice += instrument.price;

        if (instrument.bestBid > 0 && (!maxBid || instrument.bestBid > maxBid.price)) {
            maxBid = { exchange: exchange as Exchange, price: instrument.bestBid };
        }
        if (instrument.bestAsk > 0 && (!minAsk || instrument.bestAsk < minAsk.price)) {
            minAsk = { exchange: exchange as Exchange, price: instrument.bestAsk };
        }
    }

    const gap = maxBid && minAsk ? maxBid.price - minAsk.price : 0;
    const avgPrice = count > 0 ? totalPrice / count : 1;
    const gapPercent = avgPrice > 0 ? (gap / avgPrice) * 100 : 0;

    return { maxBid, minAsk, gap, gapPercent };
}
