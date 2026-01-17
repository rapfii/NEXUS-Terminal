'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './NewsFeed.module.css';
import { Newspaper, ExternalLink, Tag } from 'lucide-react';

export default function NewsFeed() {
    const [news, setNews] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string | null>(null);

    const loadNews = useCallback(async () => {
        setLoading(true);
        try {
            // Use server-side proxy API to avoid CORS
            const query = filter ? `?filter=${encodeURIComponent(filter)}&limit=20` : '?limit=20';
            const res = await fetch(`/api/rss-news${query}`);
            const json = await res.json();

            if (json.success && json.data) {
                let data = json.data;
                // Client-side filtering if API doesn't support it yet
                if (filter && data.items) {
                    data.items = data.items.filter((i: any) => i.tags?.includes(filter));
                }
                setNews(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        loadNews();
    }, [loadNews]);

    if (loading && !news) return <div className={styles.panel}><div className="p-4 text-xs text-gray-500">Loading News Wire...</div></div>;

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <div className={styles.title}>
                    <Newspaper size={16} className={styles.icon} />
                    <span>LATEST WIRE</span>
                </div>
                <div className={styles.updateBadge}>
                    LIVE
                </div>
            </div>

            {/* Tags / filters */}
            <div className={styles.tags}>
                <button
                    className={`${styles.tag} ${!filter ? styles.active : ''}`}
                    onClick={() => setFilter(null)}
                >
                    ALL
                </button>
                {news?.trendingTags?.map((t: any) => (
                    <button
                        key={t.name}
                        className={`${styles.tag} ${filter === t.name ? styles.active : ''}`}
                        onClick={() => setFilter(t.name)}
                    >
                        {t.name}
                    </button>
                ))}
            </div>

            <div className={styles.list}>
                {news?.items.map((item: any, i: number) => (
                    <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className={styles.item}>
                        <div className={styles.itemHeader}>
                            <span className={styles.source}>{item.source}</span>
                            <span className={styles.time}>{new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className={styles.itemTitle}>{item.title}</div>
                        {item.sentiment !== 'neutral' && (
                            <div className={`${styles.sentiment} ${styles[item.sentiment]}`}>
                                {item.sentiment}
                            </div>
                        )}
                    </a>
                ))}
            </div>
        </div>
    );
}
