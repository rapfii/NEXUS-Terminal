/**
 * DefiLlama Extended API Route
 * Bridges, Stablecoins, Yields
 */

import { NextRequest, NextResponse } from 'next/server';
import { defillamaExtendedAdapter } from '@/lib/onchain/defillama-extended';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'summary';
    const limit = parseInt(searchParams.get('limit') || '50');

    try {
        let data;

        switch (type) {
            case 'bridges':
                data = await defillamaExtendedAdapter.getBridges();
                break;

            case 'bridge-volume':
                data = await defillamaExtendedAdapter.getBridgeVolumeByChain();
                break;

            case 'stablecoins':
                data = await defillamaExtendedAdapter.getStablecoins();
                break;

            case 'stablecoins-by-chain':
                data = await defillamaExtendedAdapter.getStablecoinsByChain();
                break;

            case 'yields':
                data = await defillamaExtendedAdapter.getTopYields(limit);
                break;

            default: // summary
                data = await defillamaExtendedAdapter.getSummary();
        }

        return NextResponse.json({
            success: true,
            data,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('DefiLlama Extended API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch DeFi data' },
            { status: 500 }
        );
    }
}
