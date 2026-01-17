/**
 * Deribit Options API
 * Returns aggregated options data for BTC and ETH
 */

import { NextRequest, NextResponse } from 'next/server';
import { deribitAdapter } from '@/lib/exchanges/deribit';

// Cache for options data (updates less frequently)
let cachedOptions: {
    data: OptionsResponse | null;
    timestamp: number;
} = { data: null, timestamp: 0 };

const CACHE_TTL = 60000; // 1 minute (options are slower moving)

interface OptionsResponse {
    btc: OptionsData | null;
    eth: OptionsData | null;
    timestamp: number;
}

interface OptionsData {
    currency: string;
    indexPrice: number;

    // Put/Call metrics
    putCallRatio: number;
    totalCallOI: number;
    totalPutOI: number;
    callOIDominance: number;

    // IV metrics
    atmIV: number;
    ivSkew: number;  // Put IV - Call IV (positive = fear)

    // Volume
    totalCallVolume: number;
    totalPutVolume: number;
    volumePutCallRatio: number;

    // Max pain (approximation)
    maxPainStrike: number;

    // Top expiries
    topExpiries: {
        expiry: string;
        callOI: number;
        putOI: number;
        totalVolume: number;
    }[];

    // IV term structure
    ivTermStructure: {
        expiry: string;
        daysToExpiry: number;
        atmIV: number;
    }[];
}

export async function GET(request: NextRequest) {
    const now = Date.now();

    // Return cached data if fresh
    if (cachedOptions.data && now - cachedOptions.timestamp < CACHE_TTL) {
        return NextResponse.json({
            success: true,
            data: cachedOptions.data,
            cached: true,
        });
    }

    try {
        // Fetch options data for BTC and ETH in parallel
        const [btcAggregates, ethAggregates, btcIV, ethIV] = await Promise.allSettled([
            deribitAdapter.getOptionsAggregates('BTC'),
            deribitAdapter.getOptionsAggregates('ETH'),
            deribitAdapter.getIVTermStructure('BTC'),
            deribitAdapter.getIVTermStructure('ETH'),
        ]);

        // Process BTC options
        let btcData: OptionsData | null = null;
        if (btcAggregates.status === 'fulfilled' && btcAggregates.value) {
            const agg = btcAggregates.value;
            const ivData = btcIV.status === 'fulfilled' ? btcIV.value : [];

            btcData = {
                currency: 'BTC',
                indexPrice: agg.indexPrice,
                putCallRatio: agg.putCallRatio,
                totalCallOI: agg.totalCallOI,
                totalPutOI: agg.totalPutOI,
                callOIDominance: agg.totalCallOI / (agg.totalCallOI + agg.totalPutOI) * 100,
                atmIV: agg.atmIV,
                ivSkew: agg.ivSkew,
                totalCallVolume: agg.totalCallVolume,
                totalPutVolume: agg.totalPutVolume,
                volumePutCallRatio: agg.totalPutVolume > 0
                    ? agg.totalCallVolume / agg.totalPutVolume
                    : 0,
                maxPainStrike: agg.maxPainStrike,
                topExpiries: agg.expiryBreakdown.slice(0, 5),
                ivTermStructure: ivData.slice(0, 6).map(iv => ({
                    expiry: iv.expiry,
                    daysToExpiry: iv.daysToExpiry,
                    atmIV: iv.atmIV,
                })),
            };
        }

        // Process ETH options
        let ethData: OptionsData | null = null;
        if (ethAggregates.status === 'fulfilled' && ethAggregates.value) {
            const agg = ethAggregates.value;
            const ivData = ethIV.status === 'fulfilled' ? ethIV.value : [];

            ethData = {
                currency: 'ETH',
                indexPrice: agg.indexPrice,
                putCallRatio: agg.putCallRatio,
                totalCallOI: agg.totalCallOI,
                totalPutOI: agg.totalPutOI,
                callOIDominance: agg.totalCallOI / (agg.totalCallOI + agg.totalPutOI) * 100,
                atmIV: agg.atmIV,
                ivSkew: agg.ivSkew,
                totalCallVolume: agg.totalCallVolume,
                totalPutVolume: agg.totalPutVolume,
                volumePutCallRatio: agg.totalPutVolume > 0
                    ? agg.totalCallVolume / agg.totalPutVolume
                    : 0,
                maxPainStrike: agg.maxPainStrike,
                topExpiries: agg.expiryBreakdown.slice(0, 5),
                ivTermStructure: ivData.slice(0, 6).map(iv => ({
                    expiry: iv.expiry,
                    daysToExpiry: iv.daysToExpiry,
                    atmIV: iv.atmIV,
                })),
            };
        }

        const response: OptionsResponse = {
            btc: btcData,
            eth: ethData,
            timestamp: now,
        };

        // Cache the result
        cachedOptions = { data: response, timestamp: now };

        return NextResponse.json({
            success: true,
            data: response,
            cached: false,
        });

    } catch (error) {
        console.error('Options API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch options data',
            data: null,
        }, { status: 500 });
    }
}
