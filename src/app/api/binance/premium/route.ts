/**
 * Binance Premium Index API Route - Basis and funding data
 */

import { NextRequest, NextResponse } from 'next/server';

const FUTURES_BASE = 'https://fapi.binance.com';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTCUSDT';

    try {
        const res = await fetch(
            `${FUTURES_BASE}/fapi/v1/premiumIndex?symbol=${symbol}`,
            { next: { revalidate: 10 } }
        );

        if (!res.ok) {
            throw new Error('Binance API error');
        }

        const data = await res.json();

        return NextResponse.json({
            success: true,
            data: {
                symbol: data.symbol,
                markPrice: parseFloat(data.markPrice),
                indexPrice: parseFloat(data.indexPrice),
                estimatedSettlePrice: parseFloat(data.estimatedSettlePrice),
                lastFundingRate: parseFloat(data.lastFundingRate),
                nextFundingTime: data.nextFundingTime,
                interestRate: parseFloat(data.interestRate),
                time: data.time,
            },
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Binance premium index API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch premium index', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
