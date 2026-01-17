/**
 * Coinbase API Route - Spot Data
 */

import { NextRequest, NextResponse } from 'next/server';

const COINBASE_BASE = 'https://api.exchange.coinbase.com';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTC-USD';
    const type = searchParams.get('type') || 'ticker';

    try {
        let endpoint = '';

        switch (type) {
            case 'ticker':
                endpoint = `/products/${symbol}/ticker`;
                break;
            case 'stats':
                endpoint = `/products/${symbol}/stats`;
                break;
            case 'depth':
                endpoint = `/products/${symbol}/book?level=2`;
                break;
            case 'trades':
                endpoint = `/products/${symbol}/trades?limit=50`;
                break;
            case 'products':
                endpoint = '/products';
                break;
            default:
                endpoint = `/products/${symbol}/ticker`;
        }

        const res = await fetch(`${COINBASE_BASE}${endpoint}`, {
            next: { revalidate: 5 },
            headers: { 'User-Agent': 'NEXUS-Terminal/2.0' }
        });

        if (!res.ok) throw new Error('Coinbase API error');

        const data = await res.json();

        let result;
        switch (type) {
            case 'ticker':
                result = {
                    symbol,
                    price: parseFloat(data?.price) || 0,
                    bestBid: parseFloat(data?.bid) || 0,
                    bestAsk: parseFloat(data?.ask) || 0,
                    volume24h: parseFloat(data?.volume) || 0,
                    time: data?.time,
                    tradeId: data?.trade_id,
                    timestamp: Date.now(),
                };
                break;
            case 'stats':
                result = {
                    symbol,
                    open: parseFloat(data?.open) || 0,
                    high: parseFloat(data?.high) || 0,
                    low: parseFloat(data?.low) || 0,
                    last: parseFloat(data?.last) || 0,
                    volume: parseFloat(data?.volume) || 0,
                    volume30d: parseFloat(data?.volume_30day) || 0,
                };
                break;
            case 'depth':
                result = {
                    bids: (data?.bids || []).slice(0, 20).map((b: string[]) => ({
                        price: parseFloat(b[0]),
                        size: parseFloat(b[1]),
                        numOrders: parseInt(b[2]),
                    })),
                    asks: (data?.asks || []).slice(0, 20).map((a: string[]) => ({
                        price: parseFloat(a[0]),
                        size: parseFloat(a[1]),
                        numOrders: parseInt(a[2]),
                    })),
                };
                break;
            case 'products':
                result = (data || []).filter((p: { status: string }) => p.status === 'online')
                    .slice(0, 100)
                    .map((p: { id: string; base_currency: string; quote_currency: string }) => ({
                        id: p.id,
                        base: p.base_currency,
                        quote: p.quote_currency,
                    }));
                break;
            default:
                result = data;
        }

        return NextResponse.json({
            success: true,
            data: result,
            exchange: 'coinbase',
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Coinbase API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch Coinbase data', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
