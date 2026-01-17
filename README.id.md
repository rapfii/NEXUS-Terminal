# NEXUS Terminal

<div align="center">

**Terminal Intelijen Pasar Kripto Profesional, Real-Time, Multi-Exchange**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## 🎯 Gambaran Proyek

**NEXUS Terminal** adalah terminal intelijen pasar kripto berbasis web yang dirancang untuk trader, analis, dan penggemar yang membutuhkan data pasar multi-exchange secara real-time dalam satu antarmuka terpadu.

### Masalah Apa yang Dipecahkan?

- **Data Terfragmentasi**: Trader kripto seringkali membutuhkan banyak tab browser untuk memantau exchange yang berbeda. NEXUS menggabungkan semuanya ke dalam satu terminal.
- **Informasi Tertunda**: NEXUS menggunakan koneksi WebSocket langsung ke exchange untuk data real-time, bukan polling.
- **Kelebihan Informasi**: Terminal menyediakan antarmuka bergaya Bloomberg yang bersih dengan hierarki informasi yang tepat.

### Untuk Siapa Ini?

- **Trader Kripto** - Memantau banyak exchange, melihat peluang arbitrase, melacak funding rate
- **Analis Pasar** - Mengumpulkan data derivatif, open interest, likuidasi, sentimen pasar
- **Penggemar DeFi** - Melacak TVL, hasil (yield), aliran stablecoin, metrik on-chain
- **Developer** - Belajar cara membangun terminal trading tingkat profesional

---

## 🧠 Konsep Inti

NEXUS Terminal menggunakan **arsitektur hibrida** untuk kinerja optimal:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (React/Next.js)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   WebSocket (Langsung)            REST API (Di-proxy)           │
│   ───────────────────             ─────────────────────         │
│   • Harga real-time               • Klines historis             │
│   • Pembaruan orderbook           • Data makro (CoinGecko)      │
│   • Feed perdagangan              • Fear & Greed Index          │
│   • Likuidasi                     • TVL DeFi                    │
│   • Funding rates                 • Feed berita                 │
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
│                                 │  API Eksternal   │            │
│                                 │  CoinGecko       │            │
│                                 │  DefiLlama       │            │
│                                 │  Alternative.me  │            │
│                                 └──────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

**Keputusan Desain Utama:**
- **Data WebSocket** terhubung langsung dari browser → exchange (latensi minimal)
- **Data REST** diarahkan melalui backend untuk caching dan manajemen batas laju (rate limit)
- **Tidak perlu API key** - Hanya menggunakan endpoint publik exchange
- **Tanpa autentikasi** - Sepenuhnya sisi klien, tanpa akun pengguna

---

## ✨ Fitur

### 📊 Dashboard
- Kapitalisasi pasar global dan volume 24 jam
- Persentase dominasi BTC & ETH
- Fear & Greed Index dengan klasifikasi
- Top gainers dan losers (real-time)
- Deteksi rezim pasar (Risk-On/Risk-Off/Netral)

### 💻 Terminal
- Grafik candlestick bergaya TradingView (Lightweight Charts)
- Orderbook teragregasi real-time dengan visualisasi kedalaman
- Feed perdagangan langsung dengan indikator beli/jual
- Widget funding rate dengan hitung mundur
- Pelacakan open interest
- Spread harga Mark/Index

### 📈 Markets
- Grid harga multi-aset
- Indikator volume dan perubahan harga
- Pergantian simbol cepat
- Dukungan Watchlist

### ⚖️ Compare
- Perbandingan exchange berdampingan (Binance vs Bybit vs Gate.io)
- Penyorotan bid/ask terbaik
- Deteksi celah arbitrase
- Analisis spread di berbagai tempat

### 📉 Derivatives
- Open interest teragregasi di seluruh exchange
- Perbandingan funding rate
- Rasio Long/Short
- Peta panas (heatmap) likuidasi
- Analisis posisi

### 💰 Yields (Hasil)
- Peluang hasil DeFi
- Pelacakan TVL berdasarkan protokol
- Perbandingan APY

### ⛓️ On-Chain
- Metrik aktivitas L2
- Aliran stablecoin
- Perbandingan rantai (chain)

### 📰 Berita
- Feed berita kripto teragregasi
- Penyaringan sumber
- Indikator sentimen

### ⭐ Watchlist
- Pelacakan instrumen pribadi
- Persisten antar sesi
- Akses cepat ke favorit

---

## 🛠️ Tech Stack

| Kategori | Teknologi | Tujuan |
|----------|------------|---------|
| **Framework** | Next.js 14 | React framework dengan App Router, rute API |
| **UI Library** | React 18 | UI berbasis komponen |
| **Bahasa** | TypeScript 5.3 | Keamanan tipe (Type safety) |
| **Manajemen State** | Zustand | State ringan berbasis hooks |
| **Charts** | Lightweight Charts | Pustaka grafik TradingView |
| **Styling** | CSS Modules | Styling modular dan tertutup |
| **Ikon** | Lucide React | Sistem ikon konsisten |
| **i18n** | Implementasi kustom | Dukungan Bahasa Inggris + Indonesia |

---

## 📁 Struktur Folder

```
NEXUS Terminal/

├── public/
│   └── locales/           # File terjemahan (en.json, id.json)
│
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── api/           # Rute API untuk proxy data eksternal
│   │   │   ├── binance/   # Endpoint API Binance
│   │   │   ├── bybit/     # Endpoint API Bybit
│   │   │   ├── macro/     # Kapitalisasi pasar, Fear & Greed, dll.
│   │   │   └── ...        # API exchange/data lainnya
│   │   ├── warroom/       # Halaman War Room
│   │   ├── globals.css    # Gaya global dan variabel CSS
│   │   ├── layout.tsx     # Layout root
│   │   └── page.tsx       # Halaman beranda (terminal utama)
│   │
│   ├── components/
│   │   ├── charts/        # Komponen grafik candlestick
│   │   ├── layout/        # Shell, TerminalLayout
│   │   ├── orderbook/     # Tampilan Orderbook
│   │   ├── screens/       # Komponen layar utama
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Terminal.tsx
│   │   │   ├── Markets.tsx
│   │   │   ├── Compare.tsx
│   │   │   ├── Derivatives.tsx
│   │   │   └── ...
│   │   ├── selector/      # Pemilih instrumen
│   │   ├── ticker/        # Bar ticker
│   │   ├── trades/        # Feed perdagangan
│   │   ├── ui/            # Komponen UI yang dapat digunakan kembali
│   │   └── widgets/       # Widget Funding, OI, Mark Price
│   │
│   ├── hooks/             # React hooks kustom
│   │   └── useStreams.ts  # Hooks stream WebSocket
│   │
│   ├── lib/
│   │   ├── exchanges/     # Implementasi adaptor exchange
│   │   │   ├── binance.ts
│   │   │   ├── bybit.ts
│   │   │   ├── okx.ts
│   │   │   └── ...
│   │   ├── engines/       # Mesin intelijen
│   │   │   ├── regime.ts      # Deteksi rezim pasar
│   │   │   ├── squeeze.ts     # Deteksi squeeze
│   │   │   ├── arb-calculator.ts
│   │   │   └── ...
│   │   ├── i18n/          # Internasionalisasi
│   │   ├── types/         # Tipe TypeScript
│   │   ├── websocket/     # Manajer WebSocket
│   │   ├── api-client.ts  # Klien API dengan batas laju (rate-limited)
│   │   ├── config.ts      # Konfigurasi Exchange/API
│   │   └── types.ts       # Definisi tipe inti
│   │
│   └── stores/            # Store Zustand
│       └── index.ts       # Store Pasar, Bahasa, Makro, Mata Uang
│
├── server.js              # Server Node.js kustom
├── package.json
├── tsconfig.json
└── next.config.js
```

---

## 🚀 Instalasi & Pengaturan

### Prasyarat
- **Node.js 18+** (wajib)
- **npm** (manajer paket)

> ⚠️ **Kebijakan Manajer Paket**: Proyek ini menggunakan **npm** secara eksklusif. `package-lock.json` adalah satu-satunya sumber kebenaran untuk resolusi dependensi. JANGAN gunakan yarn, pnpm, atau bun. JANGAN mencampur file lock.

### Langkah-langkah

```bash
# 1. Clone repositori
git clone https://github.com/yourusername/nexus-terminal.git
cd nexus-terminal

# 2. Instal dependensi (hanya npm)
npm install

# 3. Jalankan server pengembangan
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser Anda.

### Build Produksi

```bash
# Build untuk produksi
npm run build

# Mulai server produksi
npm run start
```

> **Catatan**: Aplikasi ini memerlukan **server Node.js yang berjalan lama** (bukan serverless) untuk koneksi WebSocket dan caching. Deploy di DigitalOcean, Railway, Render, atau VPS Anda sendiri.

---

## 📖 Panduan Penggunaan

### Navigasi
- Gunakan **bilah navigasi atas** untuk beralih antar layar (Dashboard, Markets, Terminal, dll.)
- **Pintasan keyboard**: `Alt+1` hingga `Alt+9` untuk perpindahan tab cepat
- **Tombol bahasa**: EN/ID di header (sebelah kanan)

### Layar Terminal
1. **Pilih simbol** menggunakan dropdown (misalnya, BTCUSDT, ETHUSDT)
2. **Grafik** menampilkan data candlestick real-time
3. **Orderbook** menunjukkan bid/ask teragregasi dengan bar kedalaman
4. **Feed perdagangan** mengalirkan perdagangan langsung
5. **Widget** menampilkan funding rate, open interest, harga mark

### Layar Bandingkan (Compare)
1. Pilih pasangan perdagangan
2. Lihat harga dari Binance, Bybit, dan Gate.io secara berdampingan
3. Bid/ask terbaik disorot dengan warna hijau
4. Celah arbitrase menunjukkan jika ada spread yang menguntungkan

### Watchlist
1. Klik ikon ⭐ pada instrumen apa pun untuk menambahkannya ke watchlist
2. Akses watchlist Anda dari tab WATCHLIST
3. Data bertahan di localStorage

---

## 🔧 Catatan Pengembangan

### Batas Laju API (Rate Limiting)
Backend mengimplementasikan batas laju per exchange untuk menghindari pemblokiran:
- Binance: 1200 req/menit
- Bybit: 120 req/menit
- OKX: 60 req/menit

### Sumber Data (Semua Gratis, Tanpa API Key)
- **Binance** - REST + WebSocket (spot, futures)
- **Bybit** - REST + WebSocket (derivatif)
- **Gate.io** - REST + WebSocket
- **CoinGecko** - Data pasar global
- **DefiLlama** - TVL, hasil, data stablecoin
- **Alternative.me** - Fear & Greed Index

### Keterbatasan yang Diketahui
- Data opsi dari Deribit memerlukan penyegaran manual
- Beberapa data rantai L2 mungkin memiliki sedikit keterlambatan
- Parsing berita RSS tergantung pada ketersediaan sumber
- Halaman War Room (`/warroom`) menggunakan rute terpisah, tidak terintegrasi dengan navigasi tab utama

### Disiapkan Tetapi Belum Terintegrasi

Modul-modul berikut ada di basis kode tetapi **saat ini tidak digunakan saat runtime**. Mereka disiapkan untuk fitur masa depan:

| Modul | Tujuan | Status |
|--------|---------|--------|
| `lib/engines/alert-manager.ts` | Sistem peringatan harga/funding | Disiapkan, belum terhubung |
| `lib/engines/arb-calculator.ts` | Kalkulator peluang arbitrase | Disiapkan, belum terhubung |
| `lib/engines/execution.ts` | Analisis eksekusi perdagangan | Disiapkan, belum terhubung |
| `lib/services/confidence-calculator.ts` | Penilaian kepercayaan data | Disiapkan, belum terhubung |

> Modul-modul ini dikompilasi tanpa kesalahan dan dapat diintegrasikan dalam rilis mendatang.

### Perbaikan Masa Depan
- Tambahan exchange (Kraken, Coinbase Pro)
- Lebih banyak kerangka waktu dan indikator grafik
- Integrasi sistem peringatan (menggunakan `alert-manager.ts` yang sudah disiapkan)
- Integrasi mesin arbitrase
- Perbaikan responsif seluler

---

## 🔒 Keamanan

- ✅ **Tidak perlu API key** - Hanya menggunakan endpoint publik
- ✅ **Tidak ada koneksi dompet** - Tidak ada integrasi Web3
- ✅ **Tidak ada akun pengguna** - Tidak ada data pribadi yang disimpan
- ✅ **Tidak ada rahasia dalam kode** - Aman untuk repositori publik
- ✅ **Hanya LocalStorage** - Watchlist dan preferensi disimpan secara lokal

---

## 📄 Lisensi

Lisensi MIT

Hak Cipta (c) 2024 NEXUS Terminal

Izin dengan ini diberikan, tanpa biaya, kepada siapa pun yang mendapatkan salinan
perangkat lunak ini dan file dokumentasi terkait ("Perangkat Lunak"), untuk berurusan
dengan Perangkat Lunak tanpa batasan, termasuk namun tidak terbatas pada hak
untuk menggunakan, menyalin, memodifikasi, menggabungkan, menerbitkan, mendistribusikan, mensublisensikan, dan/atau menjual
salinan Perangkat Lunak, dan untuk mengizinkan orang yang kepadanya Perangkat Lunak
diberikan untuk melakukannya, dengan tunduk pada kondisi berikut:

Pemberitahuan hak cipta di atas dan pemberitahuan izin ini harus disertakan dalam semua
salinan atau bagian substansial dari Perangkat Lunak.

PERANGKAT LUNAK INI DISEDIAKAN "SEBAGAIMANA ADANYA", TANPA JAMINAN APA PUN, TERSURAT MAUPUN
TERSIRAT, TERMASUK NAMUN TIDAK TERBATAS PADA JAMINAN KELAYAKAN UNTUK DIPERDAGANGKAN,
KESESUAIAN UNTUK TUJUAN TERTENTU DAN NON-PELANGGARAN. DALAM HAL APA PUN
PENULIS ATAU PEMEGANG HAK CIPTA TIDAK BERTANGGUNG JAWAB ATAS KLAIM, KERUSAKAN, ATAU
KEWAJIBAN LAINNYA, BAIK DALAM TINDAKAN KONTRAK, KEJAHATAN ATAU LAINNYA, YANG TIMBUL DARI,
KELUAR DARI ATAU SEHUBUNGAN DENGAN PERANGKAT LUNAK ATAU PENGGUNAAN ATAU URUSAN LAINNYA DALAM
PERANGKAT LUNAK.
