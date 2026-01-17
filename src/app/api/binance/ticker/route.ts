/**
 * Binance Ticker API Route
 * Proxies requests to Binance and caches responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { binanceAdapter } from '@/lib/exchanges/binance';
import type { MarketType } from '@/lib/types';

// Access global cache from server.js
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
        // Check cache first
        const cacheKey = `binance:${marketType}:${symbol}`;
        const cached = global.nexusCache?.get(cacheKey);

        if (cached) {
            return NextResponse.json({
                success: true,
                data: cached,
                cached: true,
                timestamp: Date.now(),
            });
        }

        // Fetch fresh data
        const data = await binanceAdapter.getInstrument(symbol, marketType);

        if (!data) {
            return NextResponse.json(
                { success: false, error: 'Failed to fetch data', timestamp: Date.now() },
                { status: 502 }
            );
        }

        // Cache the result
        global.nexusCache?.set(cacheKey, data, 'ticker');

        return NextResponse.json({
            success: true,
            data,
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Binance ticker API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
