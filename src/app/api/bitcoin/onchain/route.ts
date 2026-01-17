/**
 * Bitcoin On-Chain API Route
 * Combines Blockchain.info and Mempool.space data
 */

import { NextRequest, NextResponse } from 'next/server';
import { bitcoinOnchainAdapter } from '@/lib/onchain/bitcoin';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'summary';

    try {
        let data;

        switch (type) {
            case 'stats':
                data = await bitcoinOnchainAdapter.getStats();
                break;

            case 'fees':
                data = await bitcoinOnchainAdapter.getRecommendedFees();
                break;

            case 'mempool':
                data = await bitcoinOnchainAdapter.getMempoolInfo();
                break;

            case 'blocks':
                const count = parseInt(searchParams.get('count') || '10');
                data = await bitcoinOnchainAdapter.getRecentBlocks(count);
                break;

            case 'difficulty':
                data = await bitcoinOnchainAdapter.getDifficultyAdjustment();
                break;

            default: // summary
                data = await bitcoinOnchainAdapter.getSummary();
        }

        return NextResponse.json({
            success: true,
            data,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Bitcoin OnChain API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch Bitcoin on-chain data' },
            { status: 500 }
        );
    }
}
