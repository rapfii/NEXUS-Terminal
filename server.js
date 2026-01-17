/**
 * NEXUS Terminal - Custom Long-Running Node.js Server
 * 
 * This server runs Next.js in a persistent process, enabling:
 * - Stable WebSocket connections (not serverless cold starts)
 * - In-memory caching for rate limit management
 * - Persistent connection pools to exchange APIs
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory cache for rate-limited data
const cache = new Map();
const CACHE_TTL = {
    ticker: 1000,      // 1 second
    depth: 500,        // 500ms
    klines: 5000,      // 5 seconds
    funding: 30000,    // 30 seconds
    openInterest: 10000, // 10 seconds
    macro: 60000,      // 1 minute
};

// Export cache for use in API routes
global.nexusCache = {
    get: (key) => {
        const item = cache.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
            cache.delete(key);
            return null;
        }
        return item.data;
    },
    set: (key, data, ttlKey) => {
        const ttl = CACHE_TTL[ttlKey] || 5000;
        cache.set(key, {
            data,
            expiry: Date.now() + ttl,
        });
    },
};

app.prepare().then(() => {
    createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error handling request:', err);
            res.statusCode = 500;
            res.end('Internal Server Error');
        }
    })
        .once('error', (err) => {
            console.error('Server error:', err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗          ║
║   ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝          ║
║   ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗          ║
║   ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║          ║
║   ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║          ║
║   ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝          ║
║                                                        ║
║   Crypto Market Intelligence Terminal                  ║
║   Running at http://${hostname}:${port}                      ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
      `);
        });
});
