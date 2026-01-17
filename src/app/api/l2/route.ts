/**
 * L2BEAT API Route
 * Layer 2 TVL data
 */

import { NextRequest, NextResponse } from 'next/server';
import { l2beatAdapter } from '@/lib/onchain/l2beat';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    try {
        let data;
        if (type === 'activity') {
            data = await l2beatAdapter.getActivity();
        } else {
            data = await l2beatAdapter.getTvl();
        }

        return NextResponse.json({
            success: true,
            data,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('L2BEAT API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch L2 data' },
            { status: 500 }
        );
    }
}
