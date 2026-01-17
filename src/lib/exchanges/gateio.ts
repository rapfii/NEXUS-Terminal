/**
 * GateIO Exchange Adapter
 * REST API wrapper for GateIO V4 spot and futures
 */

import { Instrument, Orderbook, OrderbookLevel, Kline, FundingRate, OpenInterest, MarketType } from '../types';

const SPOT_BASE = 'https://api.gateio.ws/api/v4/spot';
const FUTURES_BASE = 'https://api.gateio.ws/api/v4/futures/usdt';

function formatSymbol(symbol: string, forFutures = false): string {
    const clean = symbol.replace('-', '_').toUpperCase();
    return forFutures ? clean : clean;
}

function parseOrderbook(data: { bids: string[][]; asks: string[][] }, symbol: string, marketType: MarketType): Orderbook {
    let bidTotal = 0;
    let askTotal = 0;

    const bids: OrderbookLevel[] = (data.bids || []).slice(0, 25).map(([price, size]) => {
        bidTotal += parseFloat(size);
        return { price: parseFloat(price), size: parseFloat(size), total: bidTotal };
    });

    const asks: OrderbookLevel[] = (data.asks || []).slice(0, 25).map(([price, size]) => {
        askTotal += parseFloat(size);
        return { price: parseFloat(price), size: parseFloat(size), total: askTotal };
    });

    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spread = bestAsk - bestBid;
    const spreadBps = bestBid > 0 ? (spread / bestBid) * 10000 : 0;
    const imbalance = bidTotal + askTotal > 0 ? (bidTotal - askTotal) / (bidTotal + askTotal) : 0;

    return {
        exchange: 'gateio',
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

export const gateioAdapter = {
    name: 'gateio' as const,

    async getInstrument(symbol: string, marketType: MarketType = 'perpetual'): Promise<Instrument | null> {
        try {
            if (marketType === 'spot') {
                const formatted = formatSymbol(symbol);
                const res = await fetch(`${SPOT_BASE}/tickers?currency_pair=${formatted}`);
                if (!res.ok) return null;

                const data = await res.json();
                if (!data.length) return null;

                const t = data[0];
                const price = parseFloat(t.last);
                const bestBid = parseFloat(t.highest_bid || '0');
                const bestAsk = parseFloat(t.lowest_ask || '0');
                const spread = bestAsk - bestBid;
                const spreadBps = bestBid > 0 ? (spread / bestBid) * 10000 : 0;

                return {
                    exchange: 'gateio',
                    marketType,
                    symbol,
                    contractId: null,
                    price,
                    bestBid,
                    bestAsk,
                    spread,
                    spreadBps,
                    markPrice: price,
                    indexPrice: price,
                    basis: 0,
                    premiumIndex: 0,
                    fundingRate: 0,
                    nextFundingTime: 0,
                    openInterest: 0,
                    openInterestValue: 0,
                    volume24h: parseFloat(t.quote_volume || '0'),
                    quoteVolume24h: parseFloat(t.quote_volume || '0'),
                    liquidationVolume24h: 0,
                    timestamp: Date.now(),
                };
            } else {
                // Futures
                const contractName = symbol.replace('-', '_').toUpperCase();
                const res = await fetch(`${FUTURES_BASE}/tickers?contract=${contractName}`);
                if (!res.ok) return null;

                const data = await res.json();
                if (!data.length) return null;

                const t = data[0];
                const price = parseFloat(t.last);
                const bestBid = parseFloat(t.highest_bid || '0');
                const bestAsk = parseFloat(t.lowest_ask || '0');
                const spread = bestAsk - bestBid;
                const spreadBps = bestBid > 0 ? (spread / bestBid) * 10000 : 0;
                const markPrice = parseFloat(t.mark_price || t.last);
                const indexPrice = parseFloat(t.index_price || t.last);
                const basis = markPrice - indexPrice;
                const premiumIndex = indexPrice > 0 ? (basis / indexPrice) * 100 : 0;

                return {
                    exchange: 'gateio',
                    marketType,
                    symbol,
                    contractId: contractName,
                    price,
                    bestBid,
                    bestAsk,
                    spread,
                    spreadBps,
                    markPrice,
                    indexPrice,
                    basis,
                    premiumIndex,
                    fundingRate: parseFloat(t.funding_rate || '0'),
                    nextFundingTime: parseInt(t.funding_next_apply || '0') * 1000,
                    openInterest: parseFloat(t.total_size || '0'),
                    openInterestValue: parseFloat(t.total_size || '0') * price,
                    volume24h: parseFloat(t.volume_24h_quote || '0'),
                    quoteVolume24h: parseFloat(t.volume_24h_quote || '0'),
                    liquidationVolume24h: 0,
                    timestamp: Date.now(),
                };
            }
        } catch (error) {
            console.error('GateIO getInstrument error:', error);
            return null;
        }
    },

    async getOrderbook(symbol: string, marketType: MarketType = 'perpetual'): Promise<Orderbook | null> {
        try {
            const formatted = formatSymbol(symbol, marketType === 'perpetual');
            const base = marketType === 'spot' ? SPOT_BASE : FUTURES_BASE;
            const param = marketType === 'spot' ? 'currency_pair' : 'contract';
            const res = await fetch(`${base}/order_book?${param}=${formatted}`);
            if (!res.ok) return null;

            const data = await res.json();
            return parseOrderbook(data, symbol, marketType);
        } catch (error) {
            console.error('GateIO getOrderbook error:', error);
            return null;
        }
    },

    async getKlines(symbol: string, interval = '1h', marketType: MarketType = 'perpetual', limit = 500): Promise<Kline[]> {
        try {
            const formatted = formatSymbol(symbol, marketType === 'perpetual');

            if (marketType === 'spot') {
                const res = await fetch(`${SPOT_BASE}/candlesticks?currency_pair=${formatted}&interval=${interval}&limit=${limit}`);
                if (!res.ok) return [];

                const data = await res.json();
                return data.map((k: string[]) => ({
                    time: parseInt(k[0]) * 1000,
                    open: parseFloat(k[5]),
                    high: parseFloat(k[3]),
                    low: parseFloat(k[4]),
                    close: parseFloat(k[2]),
                    volume: parseFloat(k[1]),
                }));
            } else {
                const res = await fetch(`${FUTURES_BASE}/candlesticks?contract=${formatted}&interval=${interval}&limit=${limit}`);
                if (!res.ok) return [];

                const data = await res.json();
                return data.map((k: { t: number; o: string; h: string; l: string; c: string; v: number }) => ({
                    time: k.t * 1000,
                    open: parseFloat(k.o),
                    high: parseFloat(k.h),
                    low: parseFloat(k.l),
                    close: parseFloat(k.c),
                    volume: k.v,
                }));
            }
        } catch (error) {
            console.error('GateIO getKlines error:', error);
            return [];
        }
    },

    async getFunding(symbol: string): Promise<FundingRate | null> {
        try {
            const contractName = symbol.replace('-', '_').toUpperCase();
            const res = await fetch(`${FUTURES_BASE}/tickers?contract=${contractName}`);
            if (!res.ok) return null;

            const data = await res.json();
            if (!data.length) return null;

            const t = data[0];
            return {
                exchange: 'gateio',
                symbol,
                rate: parseFloat(t.funding_rate || '0'),
                nextFundingTime: parseInt(t.funding_next_apply || '0') * 1000,
                timestamp: Date.now(),
            };
        } catch (error) {
            console.error('GateIO getFunding error:', error);
            return null;
        }
    },

    async getOpenInterest(symbol: string): Promise<OpenInterest | null> {
        try {
            const contractName = symbol.replace('-', '_').toUpperCase();
            const res = await fetch(`${FUTURES_BASE}/tickers?contract=${contractName}`);
            if (!res.ok) return null;

            const data = await res.json();
            if (!data.length) return null;

            const t = data[0];
            const oi = parseFloat(t.total_size || '0');
            return {
                exchange: 'gateio',
                symbol,
                openInterest: oi,
                openInterestValue: oi * parseFloat(t.last || '0'),
                timestamp: Date.now(),
            };
        } catch (error) {
            console.error('GateIO getOpenInterest error:', error);
            return null;
        }
    },
};

export default gateioAdapter;
