/**
 * CoinPaprika API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { coinpaprikaAdapter } from '@/lib/exchanges/coinpaprika';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'tickers';
    const coinId = searchParams.get('coinId');
    const limit = parseInt(searchParams.get('limit') || '100');

    try {
        let data;

        switch (type) {
            case 'global':
                data = await coinpaprikaAdapter.getGlobal();
                break;

            case 'ohlc':
                if (!coinId) {
                    return NextResponse.json({ success: false, error: 'coinId required' }, { status: 400 });
                }
                data = await coinpaprikaAdapter.getOHLC(coinId);
                break;

            case 'events':
                if (!coinId) {
                    return NextResponse.json({ success: false, error: 'coinId required' }, { status: 400 });
                }
                data = await coinpaprikaAdapter.getEvents(coinId);
                break;

            case 'exchanges':
                data = await coinpaprikaAdapter.getExchanges();
                break;

            default: // tickers
                data = await coinpaprikaAdapter.getTickers(limit);
        }

        return NextResponse.json({
            success: true,
            data,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('CoinPaprika API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch CoinPaprika data' },
            { status: 500 }
        );
    }
}
