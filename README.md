# NEXUS Terminal

<div align="center">

**Professional, Real-Time, Multi-Exchange Crypto Market Intelligence Terminal**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## 🎯 Project Overview

**NEXUS Terminal** is a web-based crypto market intelligence terminal designed for traders, analysts, and enthusiasts who need real-time, multi-exchange market data in a single unified interface.

### What Problem Does It Solve?

- **Fragmented Data**: Crypto traders often need multiple browser tabs to monitor different exchanges. NEXUS consolidates everything into one terminal.
- **Delayed Information**: NEXUS uses direct WebSocket connections to exchanges for real-time data, not polling.
- **Information Overload**: The terminal provides a clean, Bloomberg-style interface with proper information hierarchy.

### Who Is It For?

- **Crypto Traders** - Monitor multiple exchanges, spot arbitrage opportunities, track funding rates
- **Market Analysts** - Aggregate derivatives data, open interest, liquidations, market sentiment
- **DeFi Enthusiasts** - Track TVL, yields, stablecoin flows, on-chain metrics
- **Developers** - Learn how to build a professional-grade trading terminal

---

## 🧠 Core Concept

NEXUS Terminal uses a **hybrid architecture** for optimal performance:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (React/Next.js)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   WebSocket (Direct)              REST API (Proxied)            │
│   ───────────────────             ─────────────────────         │
│   • Real-time prices              • Historical klines           │
│   • Orderbook updates             • Macro data (CoinGecko)      │
│   • Trade feed                    • Fear & Greed Index          │
│   • Liquidations                  • DeFi TVL                    │
│   • Funding rates                 • News feeds                  │
│                                                                  │
│         ↓                                  ↓                     │
│   ┌─────────────┐               ┌──────────────────┐            │
│   │  Exchanges  │               │  Node.js Server  │            │
│   │  Binance    │               │  (Caching/Rate   │            │
│   │  Bybit      │               │   Limiting)      │            │
│   │  OKX        │               └────────┬─────────┘            │
│   │  Gate.io    │                        │                      │
│   └─────────────┘                        ↓                      │
│                                 ┌──────────────────┐            │
│                                 │  External APIs   │            │
│                                 │  CoinGecko       │            │
│                                 │  DefiLlama       │            │
│                                 │  Alternative.me  │            │
│                                 └──────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**
- **WebSocket data** connects directly from browser → exchange (minimal latency)
- **REST data** routes through backend for caching and rate limit management
- **No API keys required** - Uses only public exchange endpoints
- **No authentication** - Fully client-side, no user accounts

---

## ✨ Features

### 📊 Dashboard
- Global market cap and 24h volume
- BTC & ETH dominance percentages
- Fear & Greed Index with classification
- Top gainers and losers (real-time)
- Market regime detection (Risk-On/Risk-Off/Neutral)

### 💻 Terminal
- TradingView-style candlestick charts (Lightweight Charts)
- Real-time aggregated orderbook with depth visualization
- Live trade feed with buy/sell indicators
- Funding rate widget with countdown
- Open interest tracking
- Mark/Index price spread

### 📈 Markets
- Multi-asset price grid
- Volume and price change indicators
- Quick symbol switching
- Watchlist support

### ⚖️ Compare
- Side-by-side exchange comparison (Binance vs Bybit vs Gate.io)
- Best bid/ask highlighting
- Arbitrage gap detection
- Spread analysis across venues

### 📉 Derivatives
- Aggregated open interest across exchanges
- Funding rate comparison
- Long/Short ratio
- Liquidation heatmap
- Position analysis

### 💰 Yields
- DeFi yield opportunities
- TVL tracking by protocol
- APY comparison

### ⛓️ On-Chain
- L2 activity metrics
- Stablecoin flows
- Chain comparison

### 📰 News
- Aggregated crypto news feed
- Source filtering
- Sentiment indicators

### ⭐ Watchlist
- Personal instrument tracking
- Persistent across sessions
- Quick access to favorites

---

## 🛠️ Tech Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| **Framework** | Next.js 14 | React framework with App Router, API routes |
| **UI Library** | React 18 | Component-based UI |
| **Language** | TypeScript 5.3 | Type safety |
| **State Management** | Zustand | Lightweight, hooks-based state |
| **Charts** | Lightweight Charts | TradingView charting library |
| **Styling** | CSS Modules | Scoped, modular styling |
| **Icons** | Lucide React | Consistent icon system |
| **i18n** | Custom implementation | English + Indonesian support |

---

## 📁 Folder Structure

```
NEXUS Terminal/

├── public/
│   └── locales/           # Translation files (en.json, id.json)
│
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── api/           # API routes for proxying external data
│   │   │   ├── binance/   # Binance API endpoints
│   │   │   ├── bybit/     # Bybit API endpoints
│   │   │   ├── macro/     # Market cap, Fear & Greed, etc.
│   │   │   └── ...        # Other exchange/data APIs
│   │   ├── warroom/       # War Room page
│   │   ├── globals.css    # Global styles and CSS variables
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Home page (main terminal)
│   │
│   ├── components/
│   │   ├── charts/        # Candlestick chart component
│   │   ├── layout/        # Shell, TerminalLayout
│   │   ├── orderbook/     # Orderbook display
│   │   ├── screens/       # Major screen components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Terminal.tsx
│   │   │   ├── Markets.tsx
│   │   │   ├── Compare.tsx
│   │   │   ├── Derivatives.tsx
│   │   │   └── ...
│   │   ├── selector/      # Instrument selector
│   │   ├── ticker/        # Ticker bar
│   │   ├── trades/        # Trade feed
│   │   ├── ui/            # Reusable UI components
│   │   └── widgets/       # Funding, OI, Mark Price widgets
│   │
│   ├── hooks/             # Custom React hooks
│   │   └── useStreams.ts  # WebSocket stream hooks
│   │
│   ├── lib/
│   │   ├── exchanges/     # Exchange adapter implementations
│   │   │   ├── binance.ts
│   │   │   ├── bybit.ts
│   │   │   ├── okx.ts
│   │   │   └── ...
│   │   ├── engines/       # Intelligence engines
│   │   │   ├── regime.ts      # Market regime detection
│   │   │   ├── squeeze.ts     # Squeeze detection
│   │   │   ├── arb-calculator.ts
│   │   │   └── ...
│   │   ├── i18n/          # Internationalization
│   │   ├── types/         # TypeScript types
│   │   ├── websocket/     # WebSocket manager
│   │   ├── api-client.ts  # Rate-limited API client
│   │   ├── config.ts      # Exchange/API configuration
│   │   └── types.ts       # Core type definitions
│   │
│   └── stores/            # Zustand stores
│       └── index.ts       # Market, Language, Macro, Currency stores
│
├── server.js              # Custom Node.js server
├── package.json
├── tsconfig.json
└── next.config.js
```

---

## 🚀 Installation & Setup

### Prerequisites
- **Node.js 18+** (required)
- **npm** (package manager)

> ⚠️ **Package Manager Policy**: This project uses **npm** exclusively. The `package-lock.json` is the single source of truth for dependency resolution. Do NOT use yarn, pnpm, or bun. Do NOT mix lock files.

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/nexus-terminal.git
cd nexus-terminal

# 2. Install dependencies (npm only)
npm install

# 3. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm run start
```

> **Note**: This app requires a **long-running Node.js server** (not serverless) for WebSocket connections and caching. Deploy on DigitalOcean, Railway, Render, or your own VPS.

---

## 📖 Usage Guide

### Navigation
- Use the **top navigation bar** to switch between screens (Dashboard, Markets, Terminal, etc.)
- **Keyboard shortcuts**: `Alt+1` through `Alt+9` for quick tab switching
- **Language toggle**: EN/ID in the header (right side)

### Terminal Screen
1. **Select a symbol** using the dropdown (e.g., BTCUSDT, ETHUSDT)
2. **Chart** displays real-time candlestick data
3. **Orderbook** shows aggregated bid/ask with depth visualization
4. **Trade feed** streams live trades
5. **Widgets** display funding rate, open interest, mark price

### Compare Screen
1. Select a trading pair
2. View prices from Binance, Bybit, and Gate.io side-by-side
3. Best bid/ask is highlighted in green
4. Arbitrage gap shows if any profitable spread exists

### Watchlist
1. Click the ⭐ icon on any instrument to add to watchlist
2. Access your watchlist from the WATCHLIST tab
3. Data persists in localStorage

---

## 🔧 Development Notes

### API Rate Limiting
The backend implements rate limiting per exchange to avoid getting blocked:
- Binance: 1200 req/min
- Bybit: 120 req/min
- OKX: 60 req/min

### Data Sources (All Free, No API Keys)
- **Binance** - REST + WebSocket (spot, futures)
- **Bybit** - REST + WebSocket (derivatives)
- **Gate.io** - REST + WebSocket
- **CoinGecko** - Global market data
- **DefiLlama** - TVL, yields, stablecoin data
- **Alternative.me** - Fear & Greed Index

### Known Limitations
- Options data from Deribit requires manual refresh
- Some L2 chain data may have slight delays
- RSS news parsing depends on source availability
- War Room page (`/warroom`) uses separate routing, not integrated with main tab navigation

### Prepared But Not Yet Integrated

The following modules exist in the codebase but are **not currently used at runtime**. They are prepared for future features:

| Module | Purpose | Status |
|--------|---------|--------|
| `lib/engines/alert-manager.ts` | Price/funding alert system | Prepared, not connected |
| `lib/engines/arb-calculator.ts` | Arbitrage opportunity calculator | Prepared, not connected |
| `lib/engines/execution.ts` | Trade execution analysis | Prepared, not connected |
| `lib/services/confidence-calculator.ts` | Data confidence scoring | Prepared, not connected |

> These modules compile without errors and can be integrated in future releases.

### Future Improvements
- Additional exchanges (Kraken, Coinbase Pro)
- More chart timeframes and indicators
- Alert system integration (using prepared `alert-manager.ts`)
- Arbitrage engine integration
- Mobile-responsive improvements

---

## 🔒 Security

- ✅ **No API keys required** - Uses only public endpoints
- ✅ **No wallet connections** - No Web3 integration
- ✅ **No user accounts** - No personal data stored
- ✅ **No secrets in code** - Safe for public repositories
- ✅ **LocalStorage only** - Watchlist and preferences stored locally

---

## 📄 License

MIT License

Copyright (c) 2024 NEXUS Terminal

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
