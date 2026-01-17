/**
 * Derivatives API Route - CoinGecko derivatives data
 */

import { NextRequest, NextResponse } from 'next/server';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

export async function GET(request: NextRequest) {
    try {
        const res = await fetch(`${COINGECKO_BASE}/derivatives`, {
            next: { revalidate: 60 }
        });

        if (!res.ok) {
            throw new Error('CoinGecko API error');
        }

        const data = await res.json();

        const derivatives = (data || []).slice(0, 100).map((d: {
            market: string;
            symbol: string;
            index_id: string;
            price: string;
            price_percentage_change_24h: number;
            contract_type: string;
            index: number;
            basis: number;
            spread: number;
            funding_rate: number;
            open_interest: number;
            volume_24h: number;
        }) => ({
            market: d.market,
            symbol: d.symbol,
            indexId: d.index_id,
            price: parseFloat(d.price) || 0,
            priceChange24h: d.price_percentage_change_24h || 0,
            contractType: d.contract_type,
            index: d.index || 0,
            basis: d.basis || 0,
            spread: d.spread || 0,
            fundingRate: d.funding_rate || 0,
            openInterest: d.open_interest || 0,
            volume24h: d.volume_24h || 0,
        }));

        return NextResponse.json({
            success: true,
            data: derivatives,
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Derivatives API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch derivatives', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
