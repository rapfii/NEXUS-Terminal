/**
 * RSS News Aggregator API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { rssNewsAdapter } from '@/lib/news/rss-parser';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    try {
        const data = await rssNewsAdapter.getNews(limit);

        return NextResponse.json({
            success: true,
            data,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('RSS News API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch news' },
            { status: 500 }
        );
    }
}
