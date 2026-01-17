/**
 * Macro Data API Route
 * CoinGecko global data, Fear & Greed, DefiLlama TVL
 */

import { NextRequest, NextResponse } from 'next/server';
import { macroAdapter } from '@/lib/exchanges/macro';

declare global {
    var nexusCache: {
        get: (key: string) => unknown | null;
        set: (key: string, data: unknown, ttlKey: string) => void;
    };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    try {
        const cacheKey = `macro:${type}`;
        const cached = global.nexusCache?.get(cacheKey);

        if (cached) {
            return NextResponse.json({
                success: true,
                data: cached,
                cached: true,
                timestamp: Date.now(),
            });
        }

        let data;

        switch (type) {
            case 'global':
                data = await macroAdapter.getGlobalData();
                break;
            case 'feargreed':
                data = await macroAdapter.getFearGreedIndex();
                break;
            case 'tvl':
                data = await macroAdapter.getDefiTVL();
                break;
            case 'movers':
                data = await macroAdapter.getTopMovers();
                break;
            case 'all':
            default:
                const [global, fearGreed, tvl, movers] = await Promise.all([
                    macroAdapter.getGlobalData(),
                    macroAdapter.getFearGreedIndex(),
                    macroAdapter.getDefiTVL(),
                    macroAdapter.getTopMovers(),
                ]);
                data = { global, fearGreed, tvl, movers };
        }

        if (!data) {
            return NextResponse.json(
                { success: false, error: 'Failed to fetch macro data', timestamp: Date.now() },
                { status: 502 }
            );
        }

        global.nexusCache?.set(cacheKey, data, 'macro');

        return NextResponse.json({
            success: true,
            data,
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Macro API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
