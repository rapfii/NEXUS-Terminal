/**
 * Binance Open Interest History API Route
 */

import { NextRequest, NextResponse } from 'next/server';

const FUTURES_BASE = 'https://fapi.binance.com';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTCUSDT';
    const period = searchParams.get('period') || '5m'; // 5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d
    const limit = searchParams.get('limit') || '50';

    try {
        const res = await fetch(
            `${FUTURES_BASE}/futures/data/openInterestHist?symbol=${symbol}&period=${period}&limit=${limit}`,
            { next: { revalidate: 60 } }
        );

        if (!res.ok) {
            throw new Error('Binance API error');
        }

        const data = await res.json();

        const history = (data || []).map((item: {
            symbol: string;
            sumOpenInterest: string;
            sumOpenInterestValue: string;
            timestamp: number;
        }) => ({
            symbol: item.symbol,
            openInterest: parseFloat(item.sumOpenInterest),
            openInterestValue: parseFloat(item.sumOpenInterestValue),
            timestamp: item.timestamp,
        }));

        return NextResponse.json({
            success: true,
            data: history,
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Binance OI history API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch OI history', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
