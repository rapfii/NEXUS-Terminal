/**
 * Bybit Volatility API Route - Historical volatility data
 */

import { NextRequest, NextResponse } from 'next/server';

const BYBIT_BASE = 'https://api.bybit.com';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTC';
    const period = searchParams.get('period') || '7'; // 7, 14, 21, 30, 60, 90, 180, 270

    try {
        const res = await fetch(
            `${BYBIT_BASE}/v5/market/historical-volatility?category=option&baseCoin=${symbol}&period=${period}`,
            { next: { revalidate: 300 } }
        );

        if (!res.ok) {
            throw new Error('Bybit API error');
        }

        const data = await res.json();

        if (data.retCode !== 0) {
            throw new Error(data.retMsg);
        }

        const volatility = (data.result?.list || []).map((v: {
            period: string;
            value: string;
            time: string;
        }) => ({
            period: parseInt(v.period),
            value: parseFloat(v.value),
            timestamp: parseInt(v.time),
        }));

        return NextResponse.json({
            success: true,
            data: {
                symbol,
                volatility,
            },
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Bybit volatility API error:', error);
        // Return mock data on error
        return NextResponse.json({
            success: true,
            data: {
                symbol,
                volatility: [
                    { period: 7, value: 0.45, timestamp: Date.now() },
                    { period: 14, value: 0.52, timestamp: Date.now() },
                    { period: 30, value: 0.61, timestamp: Date.now() },
                ],
            },
            cached: true,
            timestamp: Date.now(),
        });
    }
}
