/**
 * Stablecoin Flows API Route (Simulated)
 * Simulates exchange inflows/outflows for USDT/USDC based on market data
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        // Mock data generation logic
        // In a real app, this would query CryptoQuant or Glassnode

        const flows = [];
        const now = Date.now();
        const hour = 3600 * 1000;

        // Generate 24 hours of data
        for (let i = 24; i >= 0; i--) {
            const time = now - (i * hour);
            const volatility = Math.random() * 0.5 + 0.5;

            // Randomize flows but keep them somewhat realistic
            const usdtInflow = Math.random() * 100_000_000 * volatility + 50_000_000;
            const usdtOutflow = Math.random() * 90_000_000 * volatility + 45_000_000;
            const usdcInflow = Math.random() * 50_000_000 * volatility + 20_000_000;
            const usdcOutflow = Math.random() * 45_000_000 * volatility + 15_000_000;

            // Net flow
            const netFlow = (usdtInflow + usdcInflow) - (usdtOutflow + usdcOutflow);

            flows.push({
                time,
                usdtInflow,
                usdtOutflow,
                usdcInflow,
                usdcOutflow,
                netFlow
            });
        }

        return NextResponse.json({
            success: true,
            data: flows,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Stablecoin flows API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
