/**
 * Binance Klines API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { binanceAdapter } from '@/lib/exchanges/binance';
import type { MarketType } from '@/lib/types';

declare global {
    var nexusCache: {
        get: (key: string) => unknown | null;
        set: (key: string, data: unknown, ttlKey: string) => void;
    };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTCUSDT';
    const interval = searchParams.get('interval') || '1h';
    const marketType = (searchParams.get('marketType') || 'perpetual') as MarketType;
    const limit = parseInt(searchParams.get('limit') || '500');

    try {
        const cacheKey = `binance:klines:${marketType}:${symbol}:${interval}`;
        const cached = global.nexusCache?.get(cacheKey);

        if (cached) {
            return NextResponse.json({
                success: true,
                data: cached,
                cached: true,
                timestamp: Date.now(),
            });
        }

        const data = await binanceAdapter.getKlines(symbol, interval, marketType, limit);

        if (!data.length) {
            return NextResponse.json(
                { success: false, error: 'Failed to fetch klines', timestamp: Date.now() },
                { status: 502 }
            );
        }

        global.nexusCache?.set(cacheKey, data, 'klines');

        return NextResponse.json({
            success: true,
            data,
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Binance klines API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
