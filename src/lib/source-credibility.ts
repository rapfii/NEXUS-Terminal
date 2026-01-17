/**
 * Source Credibility System
 * Maps news sources to credibility tiers and calculates weighted impact scores
 * Phase 6: Narrative Engine 2.0
 */

// ============================================
// SOURCE TIERS
// ============================================

/**
 * Tier 1: Institutional/Major outlets with editorial standards
 * Tier 2: Reputable crypto-native outlets
 * Tier 3: General crypto news, aggregators
 * Tier 4: Unknown/unverified sources
 */
export type SourceTier = 1 | 2 | 3 | 4;

export interface SourceCredibility {
    tier: SourceTier;
    weight: number;        // 0-1 multiplier for impact
    name: string;
    verified: boolean;
}

/**
 * Known source credibility map
 * Tier 1 sources have highest weight
 */
export const SOURCE_CREDIBILITY: Record<string, SourceCredibility> = {
    // Tier 1 - Major institutional outlets
    'bloomberg.com': { tier: 1, weight: 1.0, name: 'Bloomberg', verified: true },
    'reuters.com': { tier: 1, weight: 1.0, name: 'Reuters', verified: true },
    'wsj.com': { tier: 1, weight: 0.95, name: 'Wall Street Journal', verified: true },
    'ft.com': { tier: 1, weight: 0.95, name: 'Financial Times', verified: true },
    'cnbc.com': { tier: 1, weight: 0.9, name: 'CNBC', verified: true },

    // Tier 2 - Reputable crypto-native
    'coindesk.com': { tier: 2, weight: 0.85, name: 'CoinDesk', verified: true },
    'theblock.co': { tier: 2, weight: 0.85, name: 'The Block', verified: true },
    'decrypt.co': { tier: 2, weight: 0.8, name: 'Decrypt', verified: true },
    'blockworks.co': { tier: 2, weight: 0.8, name: 'Blockworks', verified: true },
    'defiant.io': { tier: 2, weight: 0.75, name: 'The Defiant', verified: true },

    // Tier 3 - General crypto news
    'cointelegraph.com': { tier: 3, weight: 0.6, name: 'Cointelegraph', verified: true },
    'cryptoslate.com': { tier: 3, weight: 0.55, name: 'CryptoSlate', verified: true },
    'bitcoinist.com': { tier: 3, weight: 0.5, name: 'Bitcoinist', verified: true },
    'newsbtc.com': { tier: 3, weight: 0.5, name: 'NewsBTC', verified: true },
    'cryptonews.com': { tier: 3, weight: 0.5, name: 'Crypto News', verified: true },
    'u.today': { tier: 3, weight: 0.45, name: 'U.Today', verified: true },
    'ambcrypto.com': { tier: 3, weight: 0.45, name: 'AMBCrypto', verified: true },
    'coingape.com': { tier: 3, weight: 0.4, name: 'CoinGape', verified: true },

    // Aggregators / Social
    'twitter.com': { tier: 3, weight: 0.4, name: 'Twitter/X', verified: false },
    'x.com': { tier: 3, weight: 0.4, name: 'Twitter/X', verified: false },
    'reddit.com': { tier: 3, weight: 0.3, name: 'Reddit', verified: false },
};

// ============================================
// CREDIBILITY FUNCTIONS
// ============================================

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./, '');
    } catch {
        return 'unknown';
    }
}

/**
 * Get source credibility for a URL
 */
export function getSourceCredibility(url: string): SourceCredibility {
    const domain = extractDomain(url);

    // Check exact match
    if (SOURCE_CREDIBILITY[domain]) {
        return SOURCE_CREDIBILITY[domain];
    }

    // Check partial matches (subdomains)
    for (const [key, value] of Object.entries(SOURCE_CREDIBILITY)) {
        if (domain.endsWith(key)) {
            return value;
        }
    }

    // Unknown source - Tier 4
    return {
        tier: 4,
        weight: 0.2,
        name: domain,
        verified: false,
    };
}

/**
 * Get tier display class
 */
export function getTierClass(tier: SourceTier): string {
    switch (tier) {
        case 1: return 'tier1';
        case 2: return 'tier2';
        case 3: return 'tier3';
        case 4: return 'tier4';
    }
}

/**
 * Get tier label
 */
export function getTierLabel(tier: SourceTier): string {
    switch (tier) {
        case 1: return 'INSTITUTIONAL';
        case 2: return 'REPUTABLE';
        case 3: return 'GENERAL';
        case 4: return 'UNVERIFIED';
    }
}

// ============================================
// SENTIMENT SCORING
// ============================================

/**
 * Sentiment score with confidence
 */
export interface SentimentScore {
    score: number;          // -100 to +100
    confidence: number;     // 0-1
    label: 'bullish' | 'bearish' | 'neutral';
}

/**
 * Convert qualitative sentiment to numeric score
 */
export function sentimentToScore(
    sentiment: 'bullish' | 'bearish' | 'neutral' | 'positive' | 'negative',
    confidence: number = 0.7
): SentimentScore {
    let score: number;
    let label: 'bullish' | 'bearish' | 'neutral';

    switch (sentiment) {
        case 'bullish':
        case 'positive':
            score = 60 + (confidence * 40);  // 60-100
            label = 'bullish';
            break;
        case 'bearish':
        case 'negative':
            score = -(60 + (confidence * 40)); // -60 to -100
            label = 'bearish';
            break;
        default:
            score = 0;
            label = 'neutral';
    }

    return { score, confidence, label };
}

// ============================================
// IMPACT CALCULATION
// ============================================

/**
 * Market Impact Score
 * Combines sentiment, source credibility, and recency
 */
export interface MarketImpact {
    rawScore: number;       // -100 to +100 raw sentiment
    weightedScore: number;  // Adjusted by source credibility
    confidence: number;     // Overall confidence
    sourceTier: SourceTier;
    impactLevel: 'high' | 'medium' | 'low';
}

/**
 * Calculate market impact score
 */
export function calculateMarketImpact(
    sentiment: SentimentScore,
    sourceUrl: string,
    publishedAt: number
): MarketImpact {
    const source = getSourceCredibility(sourceUrl);

    // Time decay - news older than 24h loses impact
    const ageHours = (Date.now() - publishedAt) / (1000 * 60 * 60);
    const timeDecay = Math.max(0.1, 1 - (ageHours / 48));

    // Calculate weighted score
    const weightedScore = sentiment.score * source.weight * timeDecay;

    // Overall confidence
    const confidence = sentiment.confidence * source.weight * timeDecay;

    // Impact level
    const absScore = Math.abs(weightedScore);
    const impactLevel: 'high' | 'medium' | 'low' =
        absScore >= 50 ? 'high' :
            absScore >= 25 ? 'medium' : 'low';

    return {
        rawScore: sentiment.score,
        weightedScore: Math.round(weightedScore),
        confidence: Math.round(confidence * 100) / 100,
        sourceTier: source.tier,
        impactLevel,
    };
}

/**
 * Aggregate impact from multiple news items
 */
export function aggregateImpact(impacts: MarketImpact[]): {
    overallScore: number;
    overallSentiment: 'bullish' | 'bearish' | 'neutral';
    highImpactCount: number;
} {
    if (impacts.length === 0) {
        return { overallScore: 0, overallSentiment: 'neutral', highImpactCount: 0 };
    }

    // Weight by confidence
    const totalWeight = impacts.reduce((sum, i) => sum + i.confidence, 0);
    const weightedSum = impacts.reduce((sum, i) => sum + (i.weightedScore * i.confidence), 0);

    const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    const overallSentiment: 'bullish' | 'bearish' | 'neutral' =
        overallScore > 15 ? 'bullish' :
            overallScore < -15 ? 'bearish' : 'neutral';
    const highImpactCount = impacts.filter(i => i.impactLevel === 'high').length;

    return { overallScore, overallSentiment, highImpactCount };
}

const sourceCredibility = {
    SOURCE_CREDIBILITY,
    getSourceCredibility,
    getTierClass,
    getTierLabel,
    sentimentToScore,
    calculateMarketImpact,
    aggregateImpact,
};

export default sourceCredibility;
