/**
 * Bybit Ticker API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { bybitAdapter } from '@/lib/exchanges/bybit';
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
    const marketType = (searchParams.get('marketType') || 'perpetual') as MarketType;

    try {
        const cacheKey = `bybit:${marketType}:${symbol}`;
        const cached = global.nexusCache?.get(cacheKey);

        if (cached) {
            return NextResponse.json({
                success: true,
                data: cached,
                cached: true,
                timestamp: Date.now(),
            });
        }

        const data = await bybitAdapter.getTicker(symbol);

        if (!data) {
            return NextResponse.json(
                { success: false, error: 'Failed to fetch data', timestamp: Date.now() },
                { status: 502 }
            );
        }

        global.nexusCache?.set(cacheKey, data, 'ticker');

        return NextResponse.json({
            success: true,
            data,
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Bybit ticker API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
