/**
 * Binance Orderbook API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { binanceAdapter, aggregateOrderbook } from '@/lib/exchanges/binance';

declare global {
    var nexusCache: {
        get: (key: string) => unknown | null;
        set: (key: string, data: unknown, ttlKey: string) => void;
    };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const marketType = (searchParams.get('marketType') || 'perpetual') as 'spot' | 'perpetual';
    const aggregate = searchParams.get('aggregate');

    if (!symbol) {
        return NextResponse.json(
            { success: false, error: 'Symbol is required', timestamp: Date.now() },
            { status: 400 }
        );
    }

    try {
        const cacheKey = `binance:orderbook:${symbol}:${marketType}`;
        const cached = global.nexusCache?.get(cacheKey);

        if (cached) {
            return NextResponse.json({
                success: true,
                data: aggregate ? aggregateOrderbook(cached as never, parseFloat(aggregate)) : cached,
                cached: true,
                timestamp: Date.now(),
            });
        }

        const data = await binanceAdapter.getOrderbook(symbol, marketType);

        if (!data) {
            return NextResponse.json(
                { success: false, error: 'Failed to fetch orderbook', timestamp: Date.now() },
                { status: 502 }
            );
        }

        global.nexusCache?.set(cacheKey, data, 'depth');

        return NextResponse.json({
            success: true,
            data: aggregate ? aggregateOrderbook(data, parseFloat(aggregate)) : data,
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Binance orderbook API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
