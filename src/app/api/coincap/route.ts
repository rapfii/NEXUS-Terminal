/**
 * CoinCap API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { coincapAdapter } from '@/lib/exchanges/coincap';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'assets';
    const id = searchParams.get('id');
    const limit = parseInt(searchParams.get('limit') || '100');

    try {
        let data;

        switch (type) {
            case 'asset':
                if (!id) {
                    return NextResponse.json({ success: false, error: 'Asset ID required' }, { status: 400 });
                }
                data = await coincapAdapter.getAsset(id);
                break;

            case 'history':
                if (!id) {
                    return NextResponse.json({ success: false, error: 'Asset ID required' }, { status: 400 });
                }
                const interval = (searchParams.get('interval') || 'h1') as 'm1' | 'm5' | 'm15' | 'm30' | 'h1' | 'h2' | 'h6' | 'h12' | 'd1';
                data = await coincapAdapter.getHistory(id, interval);
                break;

            case 'exchanges':
                data = await coincapAdapter.getExchanges();
                break;

            case 'global':
                data = await coincapAdapter.getGlobalData();
                break;

            default: // assets
                data = await coincapAdapter.getAssets(limit);
        }

        return NextResponse.json({
            success: true,
            data,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('CoinCap API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch CoinCap data' },
            { status: 500 }
        );
    }
}
