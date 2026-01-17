'use client';

/**
 * News Impact Widget
 * Shows top news with credibility-weighted impact scores
 * Phase 6-7: Narrative Engine + UX
 */

import { useState, useEffect } from 'react';
import styles from './NewsImpact.module.css';
import {
    getSourceCredibility,
    getTierLabel,
    sentimentToScore,
    calculateMarketImpact,
    aggregateImpact,
    type SourceTier
} from '@/lib/source-credibility';

interface NewsItem {
    id: string;
    title: string;
    source: string;
    url: string;
    publishedAt: number;
    sentiment?: 'bullish' | 'bearish' | 'neutral';
}

interface NewsWithImpact extends NewsItem {
    impact: {
        weightedScore: number;
        sourceTier: SourceTier;
        impactLevel: 'high' | 'medium' | 'low';
    };
}

export default function NewsImpact() {
    const [news, setNews] = useState<NewsWithImpact[]>([]);
    const [loading, setLoading] = useState(true);
    const [aggregatedSentiment, setAggregatedSentiment] = useState<{
        overallScore: number;
        overallSentiment: 'bullish' | 'bearish' | 'neutral';
        highImpactCount: number;
    }>({ overallScore: 0, overallSentiment: 'neutral', highImpactCount: 0 });

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const res = await fetch('/api/news');
                const data = await res.json();

                if (data.success && data.data) {
                    // Calculate impact for each news item
                    const newsWithImpact: NewsWithImpact[] = data.data.map((item: NewsItem) => {
                        const sentiment = sentimentToScore(item.sentiment || 'neutral');
                        const impact = calculateMarketImpact(
                            sentiment,
                            item.url,
                            item.publishedAt
                        );

                        return {
                            ...item,
                            impact: {
                                weightedScore: impact.weightedScore,
                                sourceTier: impact.sourceTier,
                                impactLevel: impact.impactLevel,
                            }
                        };
                    });

                    // Sort by absolute weighted score
                    newsWithImpact.sort((a, b) =>
                        Math.abs(b.impact.weightedScore) - Math.abs(a.impact.weightedScore)
                    );

                    setNews(newsWithImpact);

                    // Calculate aggregate sentiment
                    const impacts = newsWithImpact.map(n => ({
                        ...n.impact,
                        rawScore: n.impact.weightedScore,
                        confidence: n.impact.sourceTier === 1 ? 0.9 :
                            n.impact.sourceTier === 2 ? 0.7 :
                                n.impact.sourceTier === 3 ? 0.5 : 0.3,
                    }));

                    setAggregatedSentiment(aggregateImpact(impacts));
                }
            } catch (e) {
                console.error('News fetch error:', e);
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
        const interval = setInterval(fetchNews, 5 * 60 * 1000); // Refresh every 5 min
        return () => clearInterval(interval);
    }, []);

    const formatAge = (timestamp: number) => {
        const mins = Math.floor((Date.now() - timestamp) / 60000);
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        return `${Math.floor(hrs / 24)}d`;
    };

    const getTierColor = (tier: SourceTier) => {
        switch (tier) {
            case 1: return '#22c55e';  // Green - institutional
            case 2: return '#3b82f6';  // Blue - reputable
            case 3: return '#facc15';  // Yellow - general
            case 4: return '#888';     // Gray - unverified
        }
    };

    return (
        <div className={styles.panel}>
            {/* Header with aggregate sentiment */}
            <div className={styles.header}>
                <h3 className={styles.title}>News Impact</h3>
                <div className={`${styles.sentiment} ${styles[aggregatedSentiment.overallSentiment]}`}>
                    <span className={styles.sentimentScore}>
                        {aggregatedSentiment.overallScore > 0 ? '+' : ''}
                        {aggregatedSentiment.overallScore}
                    </span>
                    <span className={styles.sentimentLabel}>
                        {aggregatedSentiment.overallSentiment.toUpperCase()}
                    </span>
                </div>
            </div>

            {/* High impact count */}
            {aggregatedSentiment.highImpactCount > 0 && (
                <div className={styles.highImpactBanner}>
                    {aggregatedSentiment.highImpactCount} HIGH IMPACT
                </div>
            )}

            {/* News list */}
            <div className={styles.list}>
                {loading ? (
                    <div className={styles.loading}>Loading news...</div>
                ) : news.length === 0 ? (
                    <div className={styles.empty}>No news available</div>
                ) : (
                    news.slice(0, 6).map((item) => (
                        <a
                            key={item.id}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${styles.item} ${styles[item.impact.impactLevel]}`}
                        >
                            <div className={styles.itemMain}>
                                <div className={styles.itemTitle}>{item.title}</div>
                                <div className={styles.itemMeta}>
                                    <span
                                        className={styles.source}
                                        style={{ color: getTierColor(item.impact.sourceTier) }}
                                    >
                                        {getSourceCredibility(item.url).name}
                                    </span>
                                    <span className={styles.tier}>
                                        {getTierLabel(item.impact.sourceTier)}
                                    </span>
                                    <span className={styles.age}>{formatAge(item.publishedAt)}</span>
                                </div>
                            </div>
                            <div className={`${styles.itemImpact} ${item.impact.weightedScore >= 0 ? styles.pos : styles.neg}`}>
                                {item.impact.weightedScore > 0 ? '+' : ''}
                                {item.impact.weightedScore}
                            </div>
                        </a>
                    ))
                )}
            </div>
        </div>
    );
}
