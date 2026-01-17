'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Newspaper,
    Circle,
    TrendingUp,
    TrendingDown,
    Zap,
    ExternalLink
} from 'lucide-react';
import styles from './News.module.css';

interface NewsItem {
    title: string;
    source: string;
    publishedAt?: number;
    url?: string;
}

// Asset detection patterns
const ASSET_PATTERNS: { pattern: RegExp; asset: string; color: string }[] = [
    { pattern: /\b(bitcoin|btc)\b/i, asset: 'BTC', color: '#f7931a' },
    { pattern: /\b(ethereum|eth)\b/i, asset: 'ETH', color: '#627eea' },
    { pattern: /\b(solana|sol)\b/i, asset: 'SOL', color: '#9945ff' },
    { pattern: /\b(bnb|binance)\b/i, asset: 'BNB', color: '#f3ba2f' },
    { pattern: /\b(xrp|ripple)\b/i, asset: 'XRP', color: '#25a9e0' },
    { pattern: /\b(cardano|ada)\b/i, asset: 'ADA', color: '#0033ad' },
    { pattern: /\b(doge|dogecoin)\b/i, asset: 'DOGE', color: '#c2a633' },
    { pattern: /\b(avalanche|avax)\b/i, asset: 'AVAX', color: '#e84142' },
    { pattern: /\b(polkadot|dot)\b/i, asset: 'DOT', color: '#e6007a' },
    { pattern: /\b(polygon|matic)\b/i, asset: 'MATIC', color: '#8247e5' },
    { pattern: /\b(arbitrum|arb)\b/i, asset: 'ARB', color: '#28a0f0' },
    { pattern: /\b(optimism|op)\b/i, asset: 'OP', color: '#ff0420' },
];

// Sentiment keywords
const BULLISH_KEYWORDS = [
    'surge', 'soar', 'rally', 'pump', 'breakout', 'bullish', 'gains', 'rises',
    'high', 'record', 'ath', 'adoption', 'approval', 'etf approved', 'green',
    'partnership', 'launch', 'upgrade', 'milestone', 'growth', 'buy',
];

const BEARISH_KEYWORDS = [
    'crash', 'dump', 'plunge', 'drop', 'fall', 'bearish', 'losses', 'decline',
    'low', 'hack', 'exploit', 'sec', 'lawsuit', 'ban', 'regulation', 'red',
    'sell', 'fear', 'warning', 'concern', 'risk', 'collapse',
];

// Analyze headline
function analyzeHeadline(title: string): { assets: string[]; sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; impact: 'HIGH' | 'MEDIUM' | 'LOW' } {
    const titleLower = title.toLowerCase();

    // Detect assets
    const assets = ASSET_PATTERNS
        .filter(p => p.pattern.test(title))
        .map(p => p.asset);

    // Detect sentiment
    const bullishScore = BULLISH_KEYWORDS.filter(k => titleLower.includes(k)).length;
    const bearishScore = BEARISH_KEYWORDS.filter(k => titleLower.includes(k)).length;

    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (bullishScore > bearishScore) sentiment = 'BULLISH';
    else if (bearishScore > bullishScore) sentiment = 'BEARISH';

    // Estimate impact based on keywords and asset specificity
    let impact: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    const highImpactKeywords = ['etf', 'sec', 'hack', 'exploit', 'ban', 'approval', 'record', 'ath', 'collapse'];
    if (highImpactKeywords.some(k => titleLower.includes(k))) impact = 'HIGH';
    else if (assets.length > 0 && (bullishScore > 0 || bearishScore > 0)) impact = 'MEDIUM';

    return { assets, sentiment, impact };
}

type FilterMode = 'all' | 'btc' | 'eth' | 'alts' | 'bullish' | 'bearish' | 'high_impact';

export function News() {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterMode>('all');

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const res = await fetch('/api/news');
                const d = await res.json();
                if (d.data) setNews(d.data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
        const iv = setInterval(fetchNews, 60000);
        return () => clearInterval(iv);
    }, []);

    // Analyzed news
    const analyzedNews = useMemo(() => {
        return news.map(n => ({
            ...n,
            analysis: analyzeHeadline(n.title),
        }));
    }, [news]);

    // Filtered news
    const filteredNews = useMemo(() => {
        return analyzedNews.filter(n => {
            switch (filter) {
                case 'btc':
                    return n.analysis.assets.includes('BTC');
                case 'eth':
                    return n.analysis.assets.includes('ETH');
                case 'alts':
                    return n.analysis.assets.length > 0 && !n.analysis.assets.includes('BTC') && !n.analysis.assets.includes('ETH');
                case 'bullish':
                    return n.analysis.sentiment === 'BULLISH';
                case 'bearish':
                    return n.analysis.sentiment === 'BEARISH';
                case 'high_impact':
                    return n.analysis.impact === 'HIGH';
                default:
                    return true;
            }
        });
    }, [analyzedNews, filter]);

    // Stats
    const stats = useMemo(() => ({
        total: analyzedNews.length,
        bullish: analyzedNews.filter(n => n.analysis.sentiment === 'BULLISH').length,
        bearish: analyzedNews.filter(n => n.analysis.sentiment === 'BEARISH').length,
        highImpact: analyzedNews.filter(n => n.analysis.impact === 'HIGH').length,
        btcRelated: analyzedNews.filter(n => n.analysis.assets.includes('BTC')).length,
    }), [analyzedNews]);

    // Sentiment meter
    const sentimentRatio = stats.total > 0 ? (stats.bullish / (stats.bullish + stats.bearish + 0.01)) * 100 : 50;

    return (
        <div className={styles.container}>
            {/* HEADER */}
            <div className={styles.header}>
                <div className={styles.titleRow}>
                    <h2><Newspaper size={24} /> NARRATIVE ENGINE</h2>
                    <span className={styles.live}><Circle size={10} fill="currentColor" /> LIVE</span>
                </div>

                {/* Sentiment Meter */}
                <div className={styles.sentimentMeter}>
                    <span className={styles.bearLabel}>BEARISH</span>
                    <div className={styles.meterBar}>
                        <div className={styles.meterFill} style={{ width: `${sentimentRatio}%` }} />
                    </div>
                    <span className={styles.bullLabel}>BULLISH</span>
                </div>

                {/* Stats */}
                <div className={styles.statsRow}>
                    <div className={styles.stat}>
                        <span className={styles.statValue}>{stats.total}</span>
                        <span className={styles.statLabel}>TOTAL</span>
                    </div>
                    <div className={styles.stat}>
                        <span className={`${styles.statValue} ${styles.pos}`}>{stats.bullish}</span>
                        <span className={styles.statLabel}>BULLISH</span>
                    </div>
                    <div className={styles.stat}>
                        <span className={`${styles.statValue} ${styles.neg}`}>{stats.bearish}</span>
                        <span className={styles.statLabel}>BEARISH</span>
                    </div>
                    <div className={styles.stat}>
                        <span className={`${styles.statValue} ${styles.warning}`}>{stats.highImpact}</span>
                        <span className={styles.statLabel}>HIGH IMPACT</span>
                    </div>
                </div>
            </div>

            {/* FILTERS */}
            <div className={styles.filters}>
                <button className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`} onClick={() => setFilter('all')}>
                    ALL ({stats.total})
                </button>
                <button className={`${styles.filterBtn} ${styles.btcBtn} ${filter === 'btc' ? styles.active : ''}`} onClick={() => setFilter('btc')}>
                    BTC
                </button>
                <button className={`${styles.filterBtn} ${styles.ethBtn} ${filter === 'eth' ? styles.active : ''}`} onClick={() => setFilter('eth')}>
                    ETH
                </button>
                <button className={`${styles.filterBtn} ${filter === 'alts' ? styles.active : ''}`} onClick={() => setFilter('alts')}>
                    ALTS
                </button>
                <button className={`${styles.filterBtn} ${styles.bullBtn} ${filter === 'bullish' ? styles.active : ''}`} onClick={() => setFilter('bullish')}>
                    <TrendingUp size={12} /> BULLISH
                </button>
                <button className={`${styles.filterBtn} ${styles.bearBtn} ${filter === 'bearish' ? styles.active : ''}`} onClick={() => setFilter('bearish')}>
                    <TrendingDown size={12} /> BEARISH
                </button>
                <button className={`${styles.filterBtn} ${styles.impactBtn} ${filter === 'high_impact' ? styles.active : ''}`} onClick={() => setFilter('high_impact')}>
                    <Zap size={12} fill="currentColor" /> HIGH IMPACT
                </button>
            </div>

            {/* NEWS LIST */}
            <div className={styles.list}>
                {loading ? (
                    <div className={styles.loading}>Fetching Intel...</div>
                ) : filteredNews.length === 0 ? (
                    <div className={styles.empty}>No news matching filter</div>
                ) : filteredNews.map((n, i) => (
                    <div key={i} className={styles.item}>
                        <span className={styles.source}>{n.source}</span>
                        <div className={styles.title}>{n.title}</div>
                        <div className={styles.itemFooter}>
                            <div className={styles.badges}>
                                {n.analysis.assets.map(asset => (
                                    <span key={asset} className={styles.assetBadge}>{asset}</span>
                                ))}
                                {n.analysis.sentiment !== 'NEUTRAL' && (
                                    <span className={`${styles.sentimentBadge} ${n.analysis.sentiment === 'BULLISH' ? styles.bullish : styles.bearish}`}>
                                        {n.analysis.sentiment}
                                    </span>
                                )}
                                {n.analysis.impact === 'HIGH' && (
                                    <span className={styles.impactBadge}><Zap size={10} fill="currentColor" /> HIGH</span>
                                )}
                            </div>
                            {n.publishedAt && (
                                <span className={styles.time}>
                                    {new Date(n.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                            {n.url && (
                                <a href={n.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                                    READ <ExternalLink size={10} />
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
