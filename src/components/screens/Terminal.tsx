'use client';
import NewsFeed from "@/components/widgets/NewsFeed";

import { useEffect, useState, useCallback } from 'react';
import { CandlestickChart } from '@/components/charts';
import { Orderbook } from '@/components/orderbook';
import { TradesFeed } from '@/components/trades';
import { formatLargeNumber, formatPercent, formatPrice } from '@/lib/i18n';
import { useMarketStore, useMacroStore, useLanguageStore } from '@/stores';
import { TickerBar } from '@/components/ticker';
import { wsManager, subscribeBinanceTrades, subscribeBinanceOrderbook } from '@/lib/websocket';
import type { Kline, Timeframe } from '@/lib/types';
import {
    Layers,
    BarChart2,
    Zap,
    Globe,
    Activity,
    Link as LinkIcon,
    Droplets,
    ShieldCheck,
    Banknote,
    Target,
    Newspaper,
    Circle,
    ChevronRight,
    ChevronLeft,
    Maximize2
} from 'lucide-react';
import styles from './Terminal.module.css';

// Type definitions
interface Liquidation {
    side: 'long' | 'short';
    price: number;
    value: number;
    timestamp: number;
}

interface StablecoinFlow {
    time: number;
    netFlow: number;
}

const SYMBOLS = [
    // Majors
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'TRXUSDT', 'LTCUSDT', 'BCHUSDT',
    // L1s / L2s
    'MATICUSDT', 'LINKUSDT', 'ATOMUSDT', 'NEARUSDT', 'APTUSDT', 'SUIUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT', 'SEIUSDT', 'TIAUSDT', 'KASUSDT', 'ALGOUSDT', 'FILUSDT', 'ICPUSDT', 'HBARUSDT', 'VETUSDT', 'EGLDUSDT', 'FTMUSDT', 'RUNEUSDT',
    // DeFi
    'UNIUSDT', 'AAVEUSDT', 'MKRUSDT', 'SNXUSDT', 'CRVUSDT', 'LDOUSDT', 'COMPUSDT', '1INCHUSDT', 'SUSHIUSDT', 'CAKEUSDT', 'GMXUSDT', 'DYDXUSDT', 'JUPUSDT', 'PENDLEUSDT',
    // Memecoins
    'DOGEUSDT', 'SHIBUSDT', 'PEPEUSDT', 'WIFUSDT', 'FLOKIUSDT', 'BONKUSDT', 'MEMEUSDT', 'BOMEUSDT', 'ORDIUSDT', 'SATSUSDT',
    // AI / Gaming / Metaverse
    'RNDRUSDT', 'FETUSDT', 'AGIXUSDT', 'WLDUSDT', 'GRTUSDT', 'IMXUSDT', 'AXSUSDT', 'SANDUSDT', 'MANAUSDT', 'GALAUSDT', 'APEUSDT', 'PIXELUSDT', 'THETAUSDT', 'STXUSDT'
].sort();

export function Terminal() {
    const { locale } = useLanguageStore();
    const { symbol, setSymbol, marketType, setMarketType, orderbook, setOrderbook, trades, addTrade, setWsConnected, wsConnected, loadWatchlist } = useMarketStore();
    const { globalData, fearGreed, topMovers, setGlobalData, setFearGreed, setTopMovers } = useMacroStore();

    const [klines, setKlines] = useState<Kline[]>([]);
    const [tf, setTf] = useState<Timeframe>('1h');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Data States
    const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
    const [stablecoinFlows, setStablecoinFlows] = useState<StablecoinFlow[]>([]);
    const [binance24hr, setBinance24hr] = useState<Record<string, number>>({});
    const [binancePremium, setBinancePremium] = useState<Record<string, number>>({});
    const [exchangeData, setExchangeData] = useState<{ ex: string; p: number; b: number; a: number; v: number; c: number; h: number; l: number }[]>([]);
    useEffect(() => { loadWatchlist(); }, [loadWatchlist]);

    const fetchAll = useCallback(async () => {
        const sym = symbol || 'BTCUSDT';
        const isPerp = marketType === 'perpetual';

        try {
            // Essential Data Only to prevent lag
            const corePromises = [
                fetch('/api/macro?type=all'),
                fetch(`/api/aggregator?symbol=${sym}`),
                fetch(`/api/binance/klines?symbol=${sym}&interval=${tf}&marketType=${marketType}`),
                fetch(`/api/binance/orderbook?symbol=${sym}&marketType=${marketType}`),
            ];

            const perpPromises = isPerp ? [
                fetch(`/api/binance/premium?symbol=${sym}`),
                fetch(`/api/binance/liquidations?symbol=${sym}&limit=20`),
                fetch('/api/flows/stablecoins'),
            ] : [];

            const allPromises = [...corePromises, ...perpPromises];
            const results = await Promise.allSettled(allPromises);

            // Process results
            // Process results
            const processedResults = await Promise.all(
                results.map(async r => r.status === 'fulfilled' ? r.value.json().catch(() => ({})) : {})
            );

            const [macroRes, aggRes, klineRes, bookRes] = processedResults.slice(0, 4);
            const [premRes, liqRes, flowRes] = isPerp ? processedResults.slice(4) : [{}, {}, {}];

            // Update States
            if (macroRes?.data) {
                setGlobalData(macroRes.data.global);
                setFearGreed(macroRes.data.fearGreed);
                setTopMovers(macroRes.data.movers);
            }

            if (aggRes?.data?.exchanges) {
                setExchangeData(aggRes.data.exchanges.map((e: any) => ({
                    ex: e.exchange,
                    p: e.price || 0,
                    b: e.bid || 0,
                    a: e.ask || 0,
                    v: e.volume24h || 0,
                    c: e.change24h || 0,
                    h: e.high24h || 0,
                    l: e.low24h || 0
                })));
            }

            if (premRes?.data) setBinancePremium({ mk: premRes.data.markPrice || 0, ix: premRes.data.indexPrice || 0, es: premRes.data.estimatedSettlePrice || 0, fr: premRes.data.lastFundingRate || 0, ir: premRes.data.interestRate || 0, nf: premRes.data.nextFundingTime || 0 });

            if (klineRes?.data) setKlines(klineRes.data);
            if (bookRes?.data) setOrderbook(bookRes.data);

            if (liqRes?.data) {
                setLiquidations(liqRes.data.map((l: any) => ({
                    side: l.side,
                    price: parseFloat(l.price) || 0,
                    value: parseFloat(l.value) || 0,
                    timestamp: l.timestamp
                })));
            }

            if (flowRes?.data) {
                setStablecoinFlows(flowRes.data.map((f: any) => ({
                    time: f.time,
                    netFlow: f.netFlow || 0
                })));
            }

        } catch (e) { console.error('Terminal fetch error:', e); }
    }, [symbol, marketType, tf, setGlobalData, setFearGreed, setTopMovers, setOrderbook]);

    // Refresh data loop
    useEffect(() => {
        fetchAll();
        const iv = setInterval(fetchAll, 10000); // 10s refresh
        return () => clearInterval(iv);
    }, [fetchAll]);

    // WebSocket Init
    useEffect(() => {
        const u1 = wsManager.onStateChange('binance', s => setWsConnected('binance', s === 'connected'));
        const u2 = subscribeBinanceTrades(symbol, t => addTrade(t));
        const u3 = subscribeBinanceOrderbook(symbol, u => {
            if (!u.bids.length || !u.asks.length) return;
            const bestBid = u.bids[0]?.price || 0;
            const bestAsk = u.asks[0]?.price || 0;
            const spread = bestAsk - bestBid;
            const spreadBps = bestBid > 0 ? (spread / bestBid) * 10000 : 0;
            const bidTotal = u.bids.reduce((acc, b) => acc + b.size, 0);
            const askTotal = u.asks.reduce((acc, a) => acc + a.size, 0);
            const imbalance = bidTotal + askTotal > 0 ? (bidTotal - askTotal) / (bidTotal + askTotal) : 0;

            setOrderbook({
                exchange: 'binance',
                marketType,
                symbol,
                bids: u.bids,
                asks: u.asks,
                spread,
                spreadBps,
                imbalance,
                timestamp: Date.now()
            });
        });
        return () => { u1(); u2(); u3(); };
    }, [symbol, marketType, addTrade, setOrderbook, setWsConnected]);

    return (
        <div className={styles.t}>
            {/* Header Controls */}
            <div className={styles.controls}>
                <div className={styles.cGroup}>
                    <select value={marketType} onChange={e => setMarketType(e.target.value as 'spot' | 'perpetual')} className={styles.sel}>
                        <option value="spot">SPOT</option><option value="perpetual">PERP</option>
                    </select>
                    <select value={symbol} onChange={e => setSymbol(e.target.value)} className={styles.sel}>
                        {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className={styles.cGroup} style={{ marginLeft: 'auto' }}>
                    <button className={styles.sel} onClick={() => setSidebarOpen(!sidebarOpen)}>
                        {sidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />} {sidebarOpen ? 'HIDE PANEL' : 'SHOW PANEL'}
                    </button>
                    <span className={wsConnected.binance ? styles.online : styles.offline}>
                        <Circle size={8} fill="currentColor" /> {wsConnected.binance ? 'LIVE' : 'OFFLINE'}
                    </span>
                </div>
            </div>

            <TickerBar />

            {/* Main Grid: Chart | Execution | Context */}
            <div className={styles.mainGrid} style={{ gridTemplateColumns: sidebarOpen ? '1fr 260px 260px' : '1fr 260px 0px' }}>

                {/* 1. Chart Column */}
                <div className={styles.chartCol}>
                    <div className={styles.chartContainer}>
                        <CandlestickChart data={klines} timeframe={tf} onTimeframeChange={setTf} />
                    </div>
                    {/* Bottom Ticker for flow? Or keep clean. User said Chart "Dominate". */}
                </div>

                {/* 2. Execution Column (Orderbook + Trades) */}
                <div className={styles.execCol}>
                    <div className={styles.panelHeader}>
                        <div className={styles.panelTitle}><Layers size={10} /> ORDERBOOK</div>
                        <div className={styles.panelActions}>
                            {/* Tools */}
                        </div>
                    </div>
                    <div className={styles.orderbookPanel}>
                        <Orderbook data={orderbook} />
                    </div>
                    <div className={styles.panelHeader} style={{ marginTop: '1px' }}>
                        <div className={styles.panelTitle}><Activity size={10} /> TRADES</div>
                    </div>
                    <div className={styles.tradesPanel}>
                        <TradesFeed trades={trades} />
                    </div>
                </div>

                {/* 3. Context Column (Collapsible) */}
                <div className={`${styles.contextCol} ${!sidebarOpen ? styles.hidden : ''}`}>
                    {/* Liquidations */}
                    <div className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <div className={styles.panelTitle}><Droplets size={10} /> LIQUIDATIONS</div>
                        </div>
                        <div className={styles.dataList} style={{ maxHeight: '180px', overflowY: 'auto' }}>
                            {liquidations.map((l, i) => (
                                <div key={i} className={`${styles.liqItem} ${l.side}`}>
                                    <span>{l.side === 'short' ? 'SHORT' : 'LONG'}</span>
                                    <span>${formatPrice(l.price, locale)}</span>
                                    <span>${formatLargeNumber(l.value, locale)}</span>
                                </div>
                            ))}
                            {liquidations.length === 0 && <div className={styles.row}><span className={styles.rowLabel}>No Recent Liqs</span></div>}
                        </div>
                    </div>

                    {/* Premium / Funding */}
                    <div className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <div className={styles.panelTitle}><Zap size={10} /> FUNDING & BASIS</div>
                        </div>
                        <div className={styles.statGrid}>
                            <div className={styles.statBox}>
                                <label>Funding Rate</label>
                                <span className={(binancePremium.fr || 0) > 0 ? 'positive' : 'negative'}>
                                    {((binancePremium.fr || 0) * 100).toFixed(4)}%
                                </span>
                            </div>
                            <div className={styles.statBox}>
                                <label>Next Funding</label>
                                <span>{binancePremium.nf ? new Date(binancePremium.nf).toLocaleTimeString().slice(0, 5) : '--:--'}</span>
                            </div>
                            <div className={styles.statBox}>
                                <label>Predicted</label>
                                <span>{((binancePremium.es || 0) / (binancePremium.mk || 1) * 100).toFixed(4)}%</span>
                            </div>
                            <div className={styles.statBox}>
                                <label>Premium Idx</label>
                                <span>${(binancePremium.mk || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stablecoin Flow */}
                    <div className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <div className={styles.panelTitle}><Banknote size={10} /> STABLECOIN FLOW</div>
                        </div>
                        <div className={styles.flowChart}>
                            {stablecoinFlows.slice(-20).map((f, i) => (
                                <div key={i} className={`flowBar ${f.netFlow >= 0 ? styles.pos : styles.neg}`}
                                    style={{
                                        flex: 1,
                                        height: `${Math.min(100, Math.abs(f.netFlow) / 500000)}%`,
                                        background: f.netFlow >= 0 ? 'var(--positive)' : 'var(--negative)',
                                        opacity: 0.6
                                    }}
                                />
                            ))}
                        </div>
                    </div>



                    {/* Exchange Spread / Prices */}
                    <div className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <div className={styles.panelTitle}><Globe size={10} /> EXCHANGE SPREADS</div>
                        </div>
                        <div className={styles.dataList} style={{ maxHeight: '150px', overflowY: 'auto' }}>
                            {exchangeData.map(e => (
                                <div key={e.ex} className={styles.row}>
                                    <span className={styles.rowLabel}>{e.ex.toUpperCase()}</span>
                                    <span className={styles.rowValue}>${formatPrice(e.p || 0, locale)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* News Feed */}
                    <div className={styles.panel} style={{ flex: 1, minHeight: '250px' }}>
                        <NewsFeed />
                    </div>
                </div>
            </div>
        </div>
    );
}
