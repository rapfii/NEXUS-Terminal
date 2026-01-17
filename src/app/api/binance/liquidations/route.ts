/**
 * Binance Liquidations API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { binanceAdapter } from '@/lib/exchanges/binance';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');

    try {
        const data = await binanceAdapter.getLiquidations(symbol, limit);

        return NextResponse.json({
            success: true,
            data,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Binance liquidations API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
