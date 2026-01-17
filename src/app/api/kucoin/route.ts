/**
 * KuCoin API Route - Spot & Futures
 */

import { NextRequest, NextResponse } from 'next/server';

const KUCOIN_BASE = 'https://api.kucoin.com';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTC-USDT';
    const type = searchParams.get('type') || 'ticker';

    try {
        let endpoint = '';

        switch (type) {
            case 'ticker':
                endpoint = `/api/v1/market/orderbook/level1?symbol=${symbol}`;
                break;
            case 'stats':
                endpoint = `/api/v1/market/stats?symbol=${symbol}`;
                break;
            case 'depth':
                endpoint = `/api/v1/market/orderbook/level2_20?symbol=${symbol}`;
                break;
            case 'trades':
                endpoint = `/api/v1/market/histories?symbol=${symbol}`;
                break;
            case 'allTickers':
                endpoint = '/api/v1/market/allTickers';
                break;
            default:
                endpoint = `/api/v1/market/orderbook/level1?symbol=${symbol}`;
        }

        const res = await fetch(`${KUCOIN_BASE}${endpoint}`, { next: { revalidate: 5 } });

        if (!res.ok) throw new Error('KuCoin API error');

        const json = await res.json();

        if (json.code !== '200000') {
            throw new Error(json.msg || 'KuCoin API error');
        }

        const data = json.data;

        let result;
        switch (type) {
            case 'ticker':
                result = {
                    symbol,
                    price: parseFloat(data?.price) || 0,
                    bestBid: parseFloat(data?.bestBid) || 0,
                    bestAsk: parseFloat(data?.bestAsk) || 0,
                    bestBidSize: parseFloat(data?.bestBidSize) || 0,
                    bestAskSize: parseFloat(data?.bestAskSize) || 0,
                    timestamp: data?.time || Date.now(),
                };
                break;
            case 'stats':
                result = {
                    symbol: data?.symbol,
                    price: parseFloat(data?.last) || 0,
                    high24h: parseFloat(data?.high) || 0,
                    low24h: parseFloat(data?.low) || 0,
                    volume24h: parseFloat(data?.vol) || 0,
                    volValue: parseFloat(data?.volValue) || 0,
                    changeRate: parseFloat(data?.changeRate) || 0,
                    changePrice: parseFloat(data?.changePrice) || 0,
                };
                break;
            case 'allTickers':
                result = (data?.ticker || []).slice(0, 50).map((t: {
                    symbol: string;
                    last: string;
                    changeRate: string;
                    vol: string;
                }) => ({
                    symbol: t.symbol,
                    price: parseFloat(t.last) || 0,
                    changeRate: parseFloat(t.changeRate) || 0,
                    volume: parseFloat(t.vol) || 0,
                }));
                break;
            default:
                result = data;
        }

        return NextResponse.json({
            success: true,
            data: result,
            exchange: 'kucoin',
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('KuCoin API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch KuCoin data', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
