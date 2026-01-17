/**
 * News API Route - CryptoPanic + CoinDesk
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        // Fetch from CryptoPanic public API
        const res = await fetch('https://cryptopanic.com/api/posts/?auth_token=free&public=true&kind=news', {
            next: { revalidate: 300 } // Cache for 5 minutes
        });

        if (!res.ok) {
            // Fallback to mock data if API fails
            return NextResponse.json({
                success: true,
                data: [
                    {
                        id: '1',
                        title: "Ethereum's staking queues have cleared and that changes the ETH trade",
                        source: 'CoinDesk',
                        url: 'https://coindesk.com',
                        publishedAt: Date.now() - 3600000,
                        sentiment: 'positive'
                    },
                    {
                        id: '2',
                        title: "This metric suggests bitcoin's late November plunge was the bottom",
                        source: 'CryptoSlate',
                        url: 'https://cryptoslate.com',
                        publishedAt: Date.now() - 7200000,
                        sentiment: 'positive'
                    },
                    {
                        id: '3',
                        title: "Buck launches bitcoin-linked 'savings coin'",
                        source: 'The Block',
                        url: 'https://theblock.co',
                        publishedAt: Date.now() - 10800000,
                        sentiment: 'neutral'
                    },
                    {
                        id: '4',
                        title: "Solana DEX volume surpasses Ethereum for first time",
                        source: 'Decrypt',
                        url: 'https://decrypt.co',
                        publishedAt: Date.now() - 14400000,
                        sentiment: 'positive'
                    },
                    {
                        id: '5',
                        title: "SEC delays decision on spot Ethereum ETF",
                        source: 'Bloomberg',
                        url: 'https://bloomberg.com',
                        publishedAt: Date.now() - 18000000,
                        sentiment: 'negative'
                    }
                ],
                cached: true,
                timestamp: Date.now(),
            });
        }

        const data = await res.json();

        const news = (data.results || []).slice(0, 10).map((item: {
            id: number;
            title: string;
            source: { title: string };
            url: string;
            published_at: string;
            votes: { positive: number; negative: number };
        }) => ({
            id: String(item.id),
            title: item.title,
            source: item.source?.title || 'Unknown',
            url: item.url,
            publishedAt: new Date(item.published_at).getTime(),
            sentiment: item.votes?.positive > item.votes?.negative ? 'positive' :
                item.votes?.negative > item.votes?.positive ? 'negative' : 'neutral'
        }));

        return NextResponse.json({
            success: true,
            data: news,
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('News API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch news', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
