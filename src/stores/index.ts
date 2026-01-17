/**
 * Zustand Store - Global Market State
 * Pair-based: exchange + marketType + symbol
 */

import { create } from 'zustand';
import type {
    Exchange,
    MarketType,
    Instrument,
    InstrumentId,
    Orderbook,
    Trade,
    UIMode,
    WatchlistItem,
    ExecutionMatrixData,
} from '@/lib/types';

// ============================================
// MARKET STORE
// ============================================

interface MarketStore {
    // Selected instrument
    exchange: Exchange;
    marketType: MarketType;
    symbol: string;
    setExchange: (exchange: Exchange) => void;
    setMarketType: (marketType: MarketType) => void;
    setSymbol: (symbol: string) => void;
    setInstrument: (id: InstrumentId) => void;

    // UI Mode
    mode: UIMode;
    setMode: (mode: UIMode) => void;

    // Instrument data
    instrument: Instrument | null;
    setInstrument_: (data: Instrument | null) => void;

    // Orderbook
    orderbook: Orderbook | null;
    setOrderbook: (orderbook: Orderbook | null) => void;

    // Trades
    trades: Trade[];
    addTrade: (trade: Trade) => void;
    clearTrades: () => void;

    // Execution Matrix Data
    matrixData: ExecutionMatrixData | null;
    setMatrixData: (data: ExecutionMatrixData | null) => void;

    // Connection states
    wsConnected: Partial<Record<Exchange, boolean>>;
    setWsConnected: (exchange: Exchange, connected: boolean) => void;

    // Loading states
    loading: boolean;
    setLoading: (loading: boolean) => void;

    // Watchlist
    watchlist: WatchlistItem[];
    addToWatchlist: (item: InstrumentId) => void;
    removeFromWatchlist: (id: InstrumentId) => void;
    isInWatchlist: (id: InstrumentId) => boolean;
    loadWatchlist: () => void;
}

const MAX_TRADES = 100;

export const useMarketStore = create<MarketStore>((set, get) => ({
    // Initial state - default to Binance Perpetual BTCUSDT
    exchange: 'binance',
    marketType: 'perpetual',
    symbol: 'BTCUSDT',
    mode: 'pro',
    instrument: null,
    orderbook: null,
    trades: [],
    matrixData: null,
    wsConnected: { binance: false, bybit: false, gateio: false, okx: false },
    loading: false,
    watchlist: [],

    // Actions
    setExchange: (exchange) => set({ exchange, trades: [] }),
    setMarketType: (marketType) => set({ marketType, trades: [] }),
    setSymbol: (symbol) => set({ symbol: symbol.toUpperCase(), trades: [] }),

    setInstrument: (id) => set({
        exchange: id.exchange,
        marketType: id.marketType,
        symbol: id.symbol.toUpperCase(),
        trades: [],
    }),

    setMode: (mode) => set({ mode }),
    setInstrument_: (instrument) => set({ instrument }),
    setOrderbook: (orderbook) => set({ orderbook }),

    addTrade: (trade) => set((state) => ({
        trades: [trade, ...state.trades].slice(0, MAX_TRADES),
    })),

    clearTrades: () => set({ trades: [] }),
    setMatrixData: (matrixData) => set({ matrixData }),

    setWsConnected: (exchange, connected) => set((state) => ({
        wsConnected: { ...state.wsConnected, [exchange]: connected },
    })),

    setLoading: (loading) => set({ loading }),

    // Watchlist with localStorage persistence
    addToWatchlist: (item) => {
        const { watchlist } = get();
        const exists = watchlist.some(
            (w) => w.exchange === item.exchange &&
                w.marketType === item.marketType &&
                w.symbol === item.symbol
        );
        if (!exists) {
            const newItem: WatchlistItem = { ...item, addedAt: Date.now() };
            const newList = [...watchlist, newItem];
            set({ watchlist: newList });
            if (typeof window !== 'undefined') {
                localStorage.setItem('nexus-watchlist', JSON.stringify(newList));
            }
        }
    },

    removeFromWatchlist: (id) => {
        const { watchlist } = get();
        const newList = watchlist.filter(
            (w) => !(w.exchange === id.exchange &&
                w.marketType === id.marketType &&
                w.symbol === id.symbol)
        );
        set({ watchlist: newList });
        if (typeof window !== 'undefined') {
            localStorage.setItem('nexus-watchlist', JSON.stringify(newList));
        }
    },

    isInWatchlist: (id) => {
        const { watchlist } = get();
        return watchlist.some(
            (w) => w.exchange === id.exchange &&
                w.marketType === id.marketType &&
                w.symbol === id.symbol
        );
    },

    loadWatchlist: () => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('nexus-watchlist');
                if (saved) {
                    set({ watchlist: JSON.parse(saved) });
                }
            } catch (e) {
                console.error('Failed to load watchlist:', e);
            }
        }
    },
}));

// ============================================
// LANGUAGE STORE
// ============================================

interface LanguageStore {
    locale: 'en' | 'id';
    setLocale: (locale: 'en' | 'id') => void;
}

export const useLanguageStore = create<LanguageStore>((set) => ({
    locale: 'en',
    setLocale: (locale) => {
        set({ locale });
        if (typeof window !== 'undefined') {
            localStorage.setItem('nexus-locale', locale);
        }
    },
}));

// ============================================
// MACRO DATA STORE
// ============================================

interface MacroStore {
    globalData: {
        totalMarketCap: number;
        totalVolume24h: number;
        btcDominance: number;
        ethDominance: number;
        marketCapChange24h: number;
        activeCryptos: number;
        markets: number;
    } | null;
    fearGreed: { value: number; classification: string } | null;
    topMovers: { gainers: unknown[]; losers: unknown[] } | null;
    news: { id: string; title: string; source: string; url: string; publishedAt: number }[];
    setGlobalData: (data: MacroStore['globalData']) => void;
    setFearGreed: (data: MacroStore['fearGreed']) => void;
    setTopMovers: (data: MacroStore['topMovers']) => void;
    setNews: (news: MacroStore['news']) => void;
}

export const useMacroStore = create<MacroStore>((set) => ({
    globalData: null,
    fearGreed: null,
    topMovers: null,
    news: [],
    setGlobalData: (globalData) => set({ globalData }),
    setFearGreed: (fearGreed) => set({ fearGreed }),
    setTopMovers: (topMovers) => set({ topMovers }),
    setNews: (news) => set({ news }),
}));
