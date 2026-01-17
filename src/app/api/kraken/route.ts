/**
 * Kraken API Route - Spot Data
 */

import { NextRequest, NextResponse } from 'next/server';

const KRAKEN_BASE = 'https://api.kraken.com/0/public';

// Kraken uses different pair names
const SYMBOL_MAP: Record<string, string> = {
    'BTCUSDT': 'XXBTZUSD',
    'ETHUSDT': 'XETHZUSD',
    'SOLUSDT': 'SOLUSD',
    'XRPUSDT': 'XXRPZUSD',
    'DOGEUSDT': 'XDGUSD',
    'ADAUSDT': 'ADAUSD',
};

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTCUSDT';
    const type = searchParams.get('type') || 'ticker';

    const krakenPair = SYMBOL_MAP[symbol] || symbol;

    try {
        let endpoint = '';

        switch (type) {
            case 'ticker':
                endpoint = `/Ticker?pair=${krakenPair}`;
                break;
            case 'depth':
                endpoint = `/Depth?pair=${krakenPair}&count=20`;
                break;
            case 'trades':
                endpoint = `/Trades?pair=${krakenPair}`;
                break;
            case 'ohlc':
                endpoint = `/OHLC?pair=${krakenPair}&interval=60`;
                break;
            default:
                endpoint = `/Ticker?pair=${krakenPair}`;
        }

        const res = await fetch(`${KRAKEN_BASE}${endpoint}`, { next: { revalidate: 5 } });

        if (!res.ok) throw new Error('Kraken API error');

        const json = await res.json();

        if (json.error && json.error.length > 0) {
            throw new Error(json.error[0]);
        }

        const resultKey = Object.keys(json.result || {})[0];
        const data = json.result?.[resultKey];

        let result;
        switch (type) {
            case 'ticker':
                result = {
                    symbol,
                    price: parseFloat(data?.c?.[0]) || 0,
                    bestBid: parseFloat(data?.b?.[0]) || 0,
                    bestAsk: parseFloat(data?.a?.[0]) || 0,
                    high24h: parseFloat(data?.h?.[1]) || 0,
                    low24h: parseFloat(data?.l?.[1]) || 0,
                    volume24h: parseFloat(data?.v?.[1]) || 0,
                    vwap: parseFloat(data?.p?.[1]) || 0,
                    trades24h: parseInt(data?.t?.[1]) || 0,
                    timestamp: Date.now(),
                };
                break;
            case 'depth':
                result = {
                    bids: (data?.bids || []).map((b: string[]) => ({
                        price: parseFloat(b[0]),
                        size: parseFloat(b[1]),
                    })),
                    asks: (data?.asks || []).map((a: string[]) => ({
                        price: parseFloat(a[0]),
                        size: parseFloat(a[1]),
                    })),
                };
                break;
            default:
                result = data;
        }

        return NextResponse.json({
            success: true,
            data: result,
            exchange: 'kraken',
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Kraken API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch Kraken data', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
