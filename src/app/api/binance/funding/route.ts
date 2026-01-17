/**
 * Binance Funding Rate API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { binanceAdapter } from '@/lib/exchanges/binance';

declare global {
    var nexusCache: {
        get: (key: string) => unknown | null;
        set: (key: string, data: unknown, ttlKey: string) => void;
    };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json(
            { success: false, error: 'Symbol is required', timestamp: Date.now() },
            { status: 400 }
        );
    }

    try {
        const cacheKey = `binance:funding:${symbol}`;
        const cached = global.nexusCache?.get(cacheKey);

        if (cached) {
            return NextResponse.json({
                success: true,
                data: cached,
                cached: true,
                timestamp: Date.now(),
            });
        }

        const data = await binanceAdapter.getFunding(symbol);

        global.nexusCache?.set(cacheKey, data, 'funding');

        return NextResponse.json({
            success: true,
            data,
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Binance funding API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
