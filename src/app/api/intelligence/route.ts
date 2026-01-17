/**
 * NEXUS Intelligence API
 * Master endpoint for War Room - aggregates all market intelligence
 */

import { NextRequest, NextResponse } from 'next/server';
import { aggregateDerivatives, aggregateLiquidations, calculateMarketPressure } from '@/lib/data-aggregator';
import { macroAdapter } from '@/lib/exchanges/macro';
import cacheService from '@/lib/cache-service';
import regimeEngine from '@/lib/engines/regime';
import rotationEngine from '@/lib/engines/rotation';
import squeezeEngine from '@/lib/engines/squeeze';

// Track if cache has been seeded
let cacheSeeded = false;

// Cache for expensive calculations
let cachedIntelligence: {
    data: IntelligenceResponse | null;
    timestamp: number;
} = { data: null, timestamp: 0 };

const CACHE_TTL = 30000; // 30 seconds

interface IntelligenceResponse {
    regime: {
        current: string;
        confidence: number;
        score: number;
        drivers: string[];
        isTransitioning: boolean;
    };
    rotation: {
        phase: string;
        confidence: number;
        flowingInto: string[];
        flowingOutOf: string[];
    };
    pressure: {
        btc: {
            trappedSide: string;
            longValueAtRisk: number;
            shortValueAtRisk: number;
            squeezeProbability: number;
            squeezeDirection: string | null;
        } | null;
        eth: {
            trappedSide: string;
            longValueAtRisk: number;
            shortValueAtRisk: number;
            squeezeProbability: number;
            squeezeDirection: string | null;
        } | null;
    };
    topSqueezes: {
        symbol: string;
        type: string;
        strength: string;
        probability: number;
    }[];
    liquidations24h: {
        long: number;
        short: number;
        longValue: number;
        shortValue: number;
        pressure: string;
    };
    stablecoinDelta: {
        total: number;
        change24h: number;
        change7d: number;
        interpretation: string;
    };
    capitalFlow: {
        btcDominanceChange: number;
        ethBtcChange: number;
        defiToAlt: boolean;
        riskAppetite: 'high' | 'medium' | 'low';
    };
    timestamp: number;
}

export async function GET(request: NextRequest) {
    const now = Date.now();

    // Seed cache on first request (async, non-blocking for subsequent requests)
    if (!cacheSeeded) {
        cacheSeeded = true;
        cacheService.seedCache().catch(console.error);
    }

    // Return cached data if fresh
    if (cachedIntelligence.data && now - cachedIntelligence.timestamp < CACHE_TTL) {
        return NextResponse.json({
            success: true,
            data: cachedIntelligence.data,
            cached: true,
        });
    }

    try {
        // Fetch all data in parallel
        const [
            btcDerivatives,
            ethDerivatives,
            btcLiquidations,
            btcPressure,
            ethPressure,
            globalData,
            fearGreed,
            stablecoinSupply,
            chainTvl,
        ] = await Promise.allSettled([
            aggregateDerivatives('BTCUSDT'),
            aggregateDerivatives('ETHUSDT'),
            aggregateLiquidations('BTCUSDT'),
            calculateMarketPressure('BTCUSDT'),
            calculateMarketPressure('ETHUSDT'),
            macroAdapter.getGlobalData(),
            macroAdapter.getFearGreedIndex(),
            macroAdapter.getStablecoinSupply(),
            macroAdapter.getChainTVL(),
        ]);

        // Extract values safely
        const btcDeriv = btcDerivatives.status === 'fulfilled' ? btcDerivatives.value : null;
        const ethDeriv = ethDerivatives.status === 'fulfilled' ? ethDerivatives.value : null;
        const btcLiqs = btcLiquidations.status === 'fulfilled' ? btcLiquidations.value : null;
        const btcPress = btcPressure.status === 'fulfilled' ? btcPressure.value : null;
        const ethPress = ethPressure.status === 'fulfilled' ? ethPressure.value : null;
        const global = globalData.status === 'fulfilled' ? globalData.value : null;
        const fng = fearGreed.status === 'fulfilled' ? fearGreed.value : null;
        const stables = stablecoinSupply.status === 'fulfilled' ? stablecoinSupply.value : null;
        const chains = chainTvl.status === 'fulfilled' ? chainTvl.value : null;

        // Record BTC/ETH prices to cache for future delta calculations
        if (btcPress?.currentPrice) {
            cacheService.recordPrice('BTCUSDT', btcPress.currentPrice);
        }
        if (ethPress?.currentPrice) {
            cacheService.recordPrice('ETHUSDT', ethPress.currentPrice);
        }

        // Get price changes from cache (will be 0 until cache populates)
        const btcChange24h = cacheService.getPriceChange('BTCUSDT', cacheService.PERIODS.ONE_DAY);
        const btcChange7d = cacheService.getPriceChange('BTCUSDT', cacheService.PERIODS.SEVEN_DAYS);
        const ethChange24h = cacheService.getPriceChange('ETHUSDT', cacheService.PERIODS.ONE_DAY);

        // Calculate regime with real price changes
        const regimeInput = {
            btcPrice: btcPress?.currentPrice || 0,
            btcChange24h,
            btcChange7d,
            totalOI: (btcDeriv?.totalOIValue || 0) + (ethDeriv?.totalOIValue || 0),
            oiChange24h: btcDeriv?.oiChange24h || 0,
            avgFunding: btcDeriv?.weightedFunding || 0,
            positiveFundingCount: btcDeriv?.fundingBias === 'long_paying' ? 1 : 0,
            negativeFundingCount: btcDeriv?.fundingBias === 'short_paying' ? 1 : 0,
            stablecoinMcap: stables?.total || 0,
            stablecoinChange24h: stables?.change24h || 0,
            stablecoinChange7d: stables?.change7d || 0,
            btcDominance: global?.btcDominance || 50,
            btcDominanceChange24h: 0,
            ethDominance: global?.ethDominance || 18,
            longLiquidations: btcLiqs?.longValue24h || 0,
            shortLiquidations: btcLiqs?.shortValue24h || 0,
            fearGreedValue: fng?.value || 50,
            fearGreedClassification: fng?.classification || 'Neutral',
        };

        const regime = regimeEngine.calculateRegime(regimeInput);

        // Calculate rotation with real price changes
        const solChange24h = cacheService.getPriceChange('SOLUSDT', cacheService.PERIODS.ONE_DAY);
        const rotation = rotationEngine.quickDetectRotation(
            btcChange24h,
            ethChange24h,
            solChange24h,
            0  // BTC dom change - would need historical dominance data
        );

        // Detect top squeezes
        const topSqueezes = await squeezeEngine.detectSqueezeMulti(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);

        // Build stablecoin interpretation
        let stableInterpretation = 'Stable liquidity';
        if (stables) {
            if (stables.change24h > 0.5) {
                stableInterpretation = 'Capital entering crypto (bullish)';
            } else if (stables.change24h < -0.5) {
                stableInterpretation = 'Capital exiting crypto (bearish)';
            } else if (stables.change7d > 2) {
                stableInterpretation = 'Steady inflows over week (accumulation)';
            } else if (stables.change7d < -2) {
                stableInterpretation = 'Steady outflows over week (distribution)';
            }
        }

        // Determine risk appetite from multiple signals
        let riskAppetite: 'high' | 'medium' | 'low' = 'medium';
        if (fng && fng.value >= 70) {
            riskAppetite = 'high';
        } else if (fng && fng.value <= 30) {
            riskAppetite = 'low';
        }
        if (btcDeriv?.fundingHeat === 'extreme') {
            riskAppetite = 'high';
        }

        const intelligence: IntelligenceResponse = {
            regime: {
                current: regime.current,
                confidence: regime.confidence,
                score: regime.score,
                drivers: regime.drivers,
                isTransitioning: regime.isTransitioning,
            },
            rotation: {
                phase: rotation.phase,
                confidence: rotation.confidence,
                flowingInto: rotation.flowingInto,
                flowingOutOf: rotation.flowingOutOf,
            },
            pressure: {
                btc: btcPress ? {
                    trappedSide: btcPress.trappedSide,
                    longValueAtRisk: btcPress.longValueAtRisk,
                    shortValueAtRisk: btcPress.shortValueAtRisk,
                    squeezeProbability: btcPress.squeezeProbability,
                    squeezeDirection: btcPress.squeezeDirection,
                } : null,
                eth: ethPress ? {
                    trappedSide: ethPress.trappedSide,
                    longValueAtRisk: ethPress.longValueAtRisk,
                    shortValueAtRisk: ethPress.shortValueAtRisk,
                    squeezeProbability: ethPress.squeezeProbability,
                    squeezeDirection: ethPress.squeezeDirection,
                } : null,
            },
            topSqueezes: topSqueezes.map(s => ({
                symbol: s.symbol,
                type: s.type,
                strength: s.strength,
                probability: s.probability,
            })),
            liquidations24h: {
                long: btcLiqs?.longLiqs24h || 0,
                short: btcLiqs?.shortLiqs24h || 0,
                longValue: btcLiqs?.longValue24h || 0,
                shortValue: btcLiqs?.shortValue24h || 0,
                pressure: btcLiqs?.pressure || 'balanced',
            },
            stablecoinDelta: {
                total: stables?.total || 0,
                change24h: stables?.change24h || 0,
                change7d: stables?.change7d || 0,
                interpretation: stableInterpretation,
            },
            capitalFlow: {
                btcDominanceChange: 0,
                ethBtcChange: 0,
                defiToAlt: false,
                riskAppetite,
            },
            timestamp: now,
        };

        // Cache the result
        cachedIntelligence = { data: intelligence, timestamp: now };

        return NextResponse.json({
            success: true,
            data: intelligence,
            cached: false,
        });

    } catch (error) {
        console.error('Intelligence API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to generate intelligence',
            data: null,
        }, { status: 500 });
    }
}
