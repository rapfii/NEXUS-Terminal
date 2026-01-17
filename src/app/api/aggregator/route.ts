/**
 * Multi-Exchange Aggregator API - All exchanges in one call
 */

import { NextRequest, NextResponse } from 'next/server';

const EXCHANGES = {
    binance: 'https://api.binance.com/api/v3/ticker/24hr',
    bybit: 'https://api.bybit.com/v5/market/tickers',
    okx: 'https://www.okx.com/api/v5/market/ticker',
    kraken: 'https://api.kraken.com/0/public/Ticker',
    kucoin: 'https://api.kucoin.com/api/v1/market/stats',
    coinbase: 'https://api.exchange.coinbase.com/products',
    bitget: 'https://api.bitget.com/api/v2/mix/market/ticker',
    gateio: 'https://api.gateio.ws/api/v4/spot/tickers',
};

interface ExchangeData {
    exchange: string;
    price: number;
    bid: number;
    ask: number;
    volume24h: number;
    change24h: number;
    high24h: number;
    low24h: number;
    timestamp: number;
    status: 'online' | 'offline' | 'error';
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTCUSDT';

    const results: ExchangeData[] = [];

    // Fetch from all exchanges in parallel
    const promises = [
        // Binance
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
            .then(r => r.json())
            .then(d => ({
                exchange: 'binance',
                price: parseFloat(d.lastPrice) || 0,
                bid: parseFloat(d.bidPrice) || 0,
                ask: parseFloat(d.askPrice) || 0,
                volume24h: parseFloat(d.volume) || 0,
                change24h: parseFloat(d.priceChangePercent) || 0,
                high24h: parseFloat(d.highPrice) || 0,
                low24h: parseFloat(d.lowPrice) || 0,
                timestamp: Date.now(),
                status: 'online' as const,
            }))
            .catch(() => ({ exchange: 'binance', price: 0, bid: 0, ask: 0, volume24h: 0, change24h: 0, high24h: 0, low24h: 0, timestamp: Date.now(), status: 'offline' as const })),

        // Bybit
        fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`)
            .then(r => r.json())
            .then(d => {
                const t = d.result?.list?.[0];
                return {
                    exchange: 'bybit',
                    price: parseFloat(t?.lastPrice) || 0,
                    bid: parseFloat(t?.bid1Price) || 0,
                    ask: parseFloat(t?.ask1Price) || 0,
                    volume24h: parseFloat(t?.volume24h) || 0,
                    change24h: parseFloat(t?.price24hPcnt) * 100 || 0,
                    high24h: parseFloat(t?.highPrice24h) || 0,
                    low24h: parseFloat(t?.lowPrice24h) || 0,
                    timestamp: Date.now(),
                    status: 'online' as const,
                };
            })
            .catch(() => ({ exchange: 'bybit', price: 0, bid: 0, ask: 0, volume24h: 0, change24h: 0, high24h: 0, low24h: 0, timestamp: Date.now(), status: 'offline' as const })),

        // OKX
        fetch(`https://www.okx.com/api/v5/market/ticker?instId=${symbol.replace('USDT', '-USDT')}`)
            .then(r => r.json())
            .then(d => {
                const t = d.data?.[0];
                return {
                    exchange: 'okx',
                    price: parseFloat(t?.last) || 0,
                    bid: parseFloat(t?.bidPx) || 0,
                    ask: parseFloat(t?.askPx) || 0,
                    volume24h: parseFloat(t?.vol24h) || 0,
                    change24h: 0,
                    high24h: parseFloat(t?.high24h) || 0,
                    low24h: parseFloat(t?.low24h) || 0,
                    timestamp: Date.now(),
                    status: 'online' as const,
                };
            })
            .catch(() => ({ exchange: 'okx', price: 0, bid: 0, ask: 0, volume24h: 0, change24h: 0, high24h: 0, low24h: 0, timestamp: Date.now(), status: 'offline' as const })),

        // KuCoin
        fetch(`https://api.kucoin.com/api/v1/market/stats?symbol=${symbol.replace('USDT', '-USDT')}`)
            .then(r => r.json())
            .then(d => {
                const t = d.data;
                return {
                    exchange: 'kucoin',
                    price: parseFloat(t?.last) || 0,
                    bid: parseFloat(t?.buy) || 0,
                    ask: parseFloat(t?.sell) || 0,
                    volume24h: parseFloat(t?.vol) || 0,
                    change24h: parseFloat(t?.changeRate) * 100 || 0,
                    high24h: parseFloat(t?.high) || 0,
                    low24h: parseFloat(t?.low) || 0,
                    timestamp: Date.now(),
                    status: 'online' as const,
                };
            })
            .catch(() => ({ exchange: 'kucoin', price: 0, bid: 0, ask: 0, volume24h: 0, change24h: 0, high24h: 0, low24h: 0, timestamp: Date.now(), status: 'offline' as const })),

        // GateIO
        fetch(`https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${symbol.replace('USDT', '_USDT')}`)
            .then(r => r.json())
            .then(d => {
                const t = d?.[0];
                return {
                    exchange: 'gateio',
                    price: parseFloat(t?.last) || 0,
                    bid: parseFloat(t?.highest_bid) || 0,
                    ask: parseFloat(t?.lowest_ask) || 0,
                    volume24h: parseFloat(t?.base_volume) || 0,
                    change24h: parseFloat(t?.change_percentage) || 0,
                    high24h: parseFloat(t?.high_24h) || 0,
                    low24h: parseFloat(t?.low_24h) || 0,
                    timestamp: Date.now(),
                    status: 'online' as const,
                };
            })
            .catch(() => ({ exchange: 'gateio', price: 0, bid: 0, ask: 0, volume24h: 0, change24h: 0, high24h: 0, low24h: 0, timestamp: Date.now(), status: 'offline' as const })),

        // Bitget
        fetch(`https://api.bitget.com/api/v2/spot/market/tickers?symbol=${symbol}`)
            .then(r => r.json())
            .then(d => {
                const t = d.data?.[0];
                return {
                    exchange: 'bitget',
                    price: parseFloat(t?.lastPr) || 0,
                    bid: parseFloat(t?.bidPr) || 0,
                    ask: parseFloat(t?.askPr) || 0,
                    volume24h: parseFloat(t?.baseVolume) || 0,
                    change24h: parseFloat(t?.change24h) * 100 || 0,
                    high24h: parseFloat(t?.high24h) || 0,
                    low24h: parseFloat(t?.low24h) || 0,
                    timestamp: Date.now(),
                    status: 'online' as const,
                };
            })
            .catch(() => ({ exchange: 'bitget', price: 0, bid: 0, ask: 0, volume24h: 0, change24h: 0, high24h: 0, low24h: 0, timestamp: Date.now(), status: 'offline' as const })),
    ];

    const allResults = await Promise.all(promises);
    results.push(...allResults.filter(r => r.price > 0 || r.status === 'offline'));

    // Calculate arbitrage
    const onlineExchanges = results.filter(r => r.price > 0);
    let arbitrage = null;

    if (onlineExchanges.length >= 2) {
        const maxBid = onlineExchanges.reduce((max, e) => e.bid > max.bid ? e : max);
        const minAsk = onlineExchanges.reduce((min, e) => e.ask < min.ask && e.ask > 0 ? e : min);

        if (maxBid.bid > minAsk.ask && maxBid.exchange !== minAsk.exchange) {
            arbitrage = {
                profit: maxBid.bid - minAsk.ask,
                profitPercent: ((maxBid.bid - minAsk.ask) / minAsk.ask) * 100,
                buyExchange: minAsk.exchange,
                buyPrice: minAsk.ask,
                sellExchange: maxBid.exchange,
                sellPrice: maxBid.bid,
            };
        }
    }

    // Calculate average price
    const avgPrice = onlineExchanges.length > 0
        ? onlineExchanges.reduce((sum, e) => sum + e.price, 0) / onlineExchanges.length
        : 0;

    // Calculate total volume
    const totalVolume = onlineExchanges.reduce((sum, e) => sum + e.volume24h, 0);

    return NextResponse.json({
        success: true,
        data: {
            symbol,
            exchanges: results,
            summary: {
                avgPrice,
                totalVolume,
                onlineCount: onlineExchanges.length,
                totalCount: results.length,
            },
            arbitrage,
        },
        timestamp: Date.now(),
    });
}
