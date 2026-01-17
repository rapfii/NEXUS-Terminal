/**
 * GateIO Contract Stats API - Liquidation, Long/Short ratio
 */

import { NextRequest, NextResponse } from 'next/server';

const GATEIO_BASE = 'https://api.gateio.ws/api/v4';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const contract = searchParams.get('contract') || 'BTC_USDT';
    const limit = searchParams.get('limit') || '24';

    try {
        const res = await fetch(
            `${GATEIO_BASE}/futures/usdt/contract_stats?contract=${contract}&limit=${limit}`,
            { next: { revalidate: 300 } }
        );

        if (!res.ok) {
            throw new Error('GateIO API error');
        }

        const data = await res.json();

        const stats = (data || []).map((item: {
            time: number;
            lsr_taker: number;
            lsr_account: number;
            long_liq_size: number;
            long_liq_amount: number;
            long_liq_usd: number;
            short_liq_size: number;
            short_liq_amount: number;
            short_liq_usd: number;
            open_interest: number;
            open_interest_usd: number;
            top_lsr_account: number;
            top_lsr_size: number;
        }) => ({
            time: item.time * 1000,
            longShortRatioTaker: item.lsr_taker,
            longShortRatioAccount: item.lsr_account,
            longLiqUsd: item.long_liq_usd,
            shortLiqUsd: item.short_liq_usd,
            openInterest: item.open_interest,
            openInterestUsd: item.open_interest_usd,
            topTradersLongShortRatio: item.top_lsr_account,
        }));

        return NextResponse.json({
            success: true,
            data: stats,
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('GateIO contract stats API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch contract stats', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
