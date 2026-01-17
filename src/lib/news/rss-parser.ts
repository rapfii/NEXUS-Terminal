/**
 * RSS News Parser
 * Aggregates news from multiple crypto sources
 */

// RSS Feed URLs
const RSS_FEEDS = {
    coindesk: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    cryptoslate: 'https://cryptoslate.com/feed/',
    decrypt: 'https://decrypt.co/feed',
    theblock: 'https://www.theblock.co/rss.xml',
    cointelegraph: 'https://cointelegraph.com/rss',
    cryptopanic: 'https://cryptopanic.com/news/rss/',
    bankless: 'https://newsletter.banklesshq.com/feed'
};

interface NewsItem {
    title: string;
    link: string;
    source: string;
    pubDate: number;
    description?: string;
    descriptionSnippet?: string; // Shorter description for UI
    tags: string[]; // Keyword tags
    sentiment?: 'positive' | 'negative' | 'neutral';
}

// Simple keyword-based tagging
const KEYWORDS = {
    'Bitcoin': ['bitcoin', 'btc', 'satoshi'],
    'Ethereum': ['ethereum', 'eth', 'vitalik'],
    'DeFi': ['defi', 'uniswap', 'aave', 'curve', 'maker', 'compound'],
    'NFT': ['nft', 'opensea', 'bored ape', 'punk'],
    'Regulation': ['sec', 'regulation', 'gensler', 'ban', 'law'],
    'Macro': ['fed', 'inflation', 'powell', 'rate hike', 'recession'],
    'Hacks': ['hack', 'exploit', 'stolen', 'attack'],
    'L2': ['layer 2', 'arbitrum', 'optimism', 'zk', 'rollup', 'polygon']
};

// Simple keyword-based sentiment (very basic)
const SENTIMENT_KEYWORDS = {
    positive: ['surge', 'rally', 'bull', 'record', 'growth', 'adoption', 'soar', 'jump', 'gain'],
    negative: ['crash', 'plunge', 'bear', 'ban', 'lawsuit', 'hack', 'drain', 'drop', 'fall']
};

/**
 * Simple RSS XML parser (no external dependencies)
 */
function parseRSS(xml: string, source: string): NewsItem[] {
    const items: NewsItem[] = [];

    // Extract items using regex (simple approach for compatibility)
    // Note: A real HTML/XML parser would be more robust but heavier
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1];

        const titleMatch = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
        const linkMatch = itemXml.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/);
        const pubDateMatch = itemXml.match(/<pubDate[^>]*>(.*?)<\/pubDate>/);
        const descMatch = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/s);

        if (titleMatch && linkMatch) {
            const title = titleMatch[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#8217;/g, "'").replace(/&#8220;/g, '"').replace(/&#8221;/g, '"');
            const description = descMatch ? descMatch[1].trim().replace(/<[^>]*>?/gm, '').substring(0, 500) : undefined;

            // Tagging logic
            const tags: string[] = [];
            const textToScan = (title + ' ' + (description || '')).toLowerCase();

            for (const [tag, keywords] of Object.entries(KEYWORDS)) {
                if (keywords.some(k => textToScan.includes(k))) {
                    tags.push(tag);
                }
            }

            // Sentiment logic
            let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
            let score = 0;
            SENTIMENT_KEYWORDS.positive.forEach(w => { if (textToScan.includes(w)) score++; });
            SENTIMENT_KEYWORDS.negative.forEach(w => { if (textToScan.includes(w)) score--; });

            if (score > 0) sentiment = 'positive';
            if (score < 0) sentiment = 'negative';

            items.push({
                title,
                link: linkMatch[1].trim(),
                source,
                pubDate: pubDateMatch ? new Date(pubDateMatch[1]).getTime() : Date.now(),
                description,
                descriptionSnippet: description ? description.substring(0, 150) + '...' : undefined,
                tags,
                sentiment
            });
        }
    }

    return items;
}

export const rssNewsAdapter = {
    name: 'rss-news' as const,

    /**
     * Fetch news from a single source
     */
    async fetchFromSource(source: keyof typeof RSS_FEEDS): Promise<NewsItem[]> {
        try {
            const url = RSS_FEEDS[source];
            const res = await fetch(url, {
                next: { revalidate: 300 }, // Cache for 5 minutes
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; NEXUSTerminal/1.0)',
                },
            });

            if (!res.ok) return [];

            const xml = await res.text();
            return parseRSS(xml, source);
        } catch (error) {
            console.error(`RSS fetch error for ${source}:`, error);
            return [];
        }
    },

    /**
     * Fetch news from all sources
     */
    async fetchAll(): Promise<NewsItem[]> {
        // Fetch in parallel but limit concurrency if needed (here we just do all)
        const sources = Object.keys(RSS_FEEDS) as (keyof typeof RSS_FEEDS)[];

        const results = await Promise.allSettled(
            sources.map(source => this.fetchFromSource(source))
        );

        const allNews: NewsItem[] = [];

        for (const result of results) {
            if (result.status === 'fulfilled') {
                allNews.push(...result.value);
            }
        }

        // Sort by date, newest first
        return allNews.sort((a, b) => b.pubDate - a.pubDate);
    },

    /**
     * Get aggregated news feed with filtering
     */
    async getNews(limit: number = 50, tagFilter?: string): Promise<{
        items: NewsItem[];
        sources: { name: string; count: number }[];
        trendingTags: { name: string; count: number }[];
        lastUpdate: number;
    }> {
        let allNews = await this.fetchAll();

        if (tagFilter) {
            allNews = allNews.filter(i => i.tags.includes(tagFilter));
        }

        const items = allNews.slice(0, limit);

        // Count items per source
        const sourceCounts: Record<string, number> = {};
        const tagCounts: Record<string, number> = {};

        for (const item of allNews) {
            sourceCounts[item.source] = (sourceCounts[item.source] || 0) + 1;
            item.tags.forEach(t => {
                tagCounts[t] = (tagCounts[t] || 0) + 1;
            });
        }

        const sources = Object.entries(sourceCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        const trendingTags = Object.entries(tagCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            items,
            sources,
            trendingTags,
            lastUpdate: Date.now(),
        };
    },
};

export default rssNewsAdapter;
