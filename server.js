const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*']
}));

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Exact headers from your specification
const CUSTOM_HEADERS = {
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Dest': 'iframe',
    'Referer': 'https://aa.3isk.icu/',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,ar;q=0.7',
    'Connection': 'close',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache'
};

// Home page with usage instructions
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Video Proxy Server</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
            .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #333; text-align: center; }
            .endpoint { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #007bff; }
            .example { background: #e7f3ff; padding: 10px; border-radius: 5px; font-family: monospace; margin: 5px 0; }
            .status { text-align: center; padding: 20px; }
            .btn { background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 5px; }
            .btn:hover { background: #0056b3; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎬 Video Proxy Server</h1>
            <div class="status">
                <span style="color: green;">✅ Server is running on Railway</span>
                <br><small>Port: ${PORT}</small>
            </div>
            
            <h2>📋 Available Endpoints:</h2>
            
            <div class="endpoint">
                <h3>🎯 Direct Embed Proxy</h3>
                <p><strong>Pattern:</strong> <code>/embed/{server}/{id}/{episode}/</code></p>
                <div class="example">
                    <a href="/embed/1/194239/2/" class="btn">▶️ Test: /embed/1/194239/2/</a>
                    <a href="/embed/2/194239/2/" class="btn">▶️ Test: /embed/2/194239/2/</a>
                </div>
            </div>
            
            <div class="endpoint">
                <h3>🌐 URL Proxy</h3>
                <p><strong>Pattern:</strong> <code>/proxy?url={URL}</code></p>
                <div class="example">
                    <a href="/proxy?url=https://3isk.onl/embed/1/194239/2/" class="btn">▶️ Test Proxy</a>
                </div>
            </div>
            
            <div class="endpoint">
                <h3>📺 Video Host Proxy</h3>
                <p><strong>Pattern:</strong> <code>/video?url={VIDEO_URL}</code></p>
                <div class="example">
                    <a href="/video?url=https://miravd.com/embed-jcxqi2f36mld.html" class="btn">▶️ Test Video</a>
                </div>
            </div>
            
            <h2>🔧 Headers Used:</h2>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 12px;">
                User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36<br>
                Referer: https://aa.3isk.icu/<br>
                sec-ch-ua: "Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"<br>
                + All other headers as specified
            </div>
        </div>
    </body>
    </html>
    `);
});

// Function to clean and enhance content
function enhanceContent(content, originalUrl) {
    // Remove problematic scripts and external resources
    content = content.replace(/<script[^>]*src=[^>]*cdn-cgi[^>]*>.*?<\/script>/gis, '');
    content = content.replace(/<script[^>]*src=[^>]*cloudflare[^>]*>.*?<\/script>/gis, '');
    content = content.replace(/<script[^>]*src=[^>]*analytics[^>]*>.*?<\/script>/gis, '');
    content = content.replace(/<link[^>]*href=[^>]*3isk\.onl[^>]*css[^>]*>/gis, '');
    
    // Remove X-Frame-Options
    content = content.replace(/<meta[^>]*http-equiv[^>]*X-Frame-Options[^>]*>/gi, '');
    
    // Add fullscreen enhancement
    const enhancement = `
    <style>
        html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; overflow: hidden !important; background: #000 !important; }
        iframe, video, .Video { width: 100vw !important; height: 100vh !important; border: none !important; position: absolute !important; top: 0 !important; left: 0 !important; }
        .ad, .ads, .popup, .modal, .overlay, .social-box, .copy { display: none !important; }
    </style>
    <script>
        // Block problematic requests
        if (typeof window.fetch !== "undefined") {
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
                const url = args[0];
                if (typeof url === "string" && (url.includes("google-analytics") || url.includes("cdn-cgi") || url.includes("3isk.onl/wp-content"))) {
                    console.log("🚫 Blocked:", url);
                    return Promise.resolve(new Response("", { status: 204 }));
                }
                return originalFetch.apply(this, args);
            };
        }
        
        // Remove ads and enhance video
        function enhance() {
            document.querySelectorAll(".ad, .ads, .popup, .modal, .overlay, .social-box").forEach(el => el.remove());
            document.querySelectorAll("video, iframe").forEach(video => {
                video.style.width = "100vw";
                video.style.height = "100vh";
                video.style.position = "absolute";
                video.style.top = "0";
                video.style.left = "0";
                if (video.tagName === "VIDEO") video.controls = true;
            });
        }
        
        // Suppress errors
        console.error = function(...args) {
            const msg = args.join(" ");
            if (!msg.includes("CORS") && !msg.includes("Failed to fetch")) {
                console.log(...args);
            }
        };
        
        // Run enhancement
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", enhance);
        } else {
            enhance();
        }
        setInterval(enhance, 3000);
        
        console.log("✅ Enhanced video player loaded");
    </script>`;
    
    // Insert enhancement
    if (content.includes('</head>')) {
        content = content.replace('</head>', enhancement + '</head>');
    } else {
        content = enhancement + content;
    }
    
    return content;
}

// Direct embed route: /embed/1/194239/2/
app.get('/embed/:server/:id/:episode/', async (req, res) => {
    try {
        const { server, id, episode } = req.params;
        const targetUrl = `https://3isk.onl/embed/${server}/${id}/${episode}/`;
        
        console.log(`📺 Proxying embed: ${targetUrl}`);
        
        // Make request with custom headers
        const fetch = require('node-fetch');
        const response = await fetch(targetUrl, {
            headers: {
                ...CUSTOM_HEADERS,
                'Host': '3isk.onl'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        let content = await response.text();
        content = enhanceContent(content, targetUrl);
        
        res.set({
            'Content-Type': 'text/html; charset=UTF-8',
            'Access-Control-Allow-Origin': '*',
            'X-Frame-Options': 'ALLOWALL'
        });
        
        res.send(content);
        
    } catch (error) {
        console.error('❌ Embed error:', error.message);
        res.status(500).send(`
            <div style="text-align:center;padding:50px;font-family:Arial;">
                <h2>🚫 Error Loading Video</h2>
                <p>Error: ${error.message}</p>
                <a href="/" style="color:blue;">← Back to Home</a>
            </div>
        `);
    }
});

// URL proxy route: /proxy?url=https://example.com
app.get('/proxy', async (req, res) => {
    try {
        const targetUrl = req.query.url;
        if (!targetUrl) {
            return res.status(400).send('❌ Missing url parameter');
        }
        
        console.log(`🌐 Proxying URL: ${targetUrl}`);
        
        const fetch = require('node-fetch');
        const parsedUrl = new URL(targetUrl);
        
        const response = await fetch(targetUrl, {
            headers: {
                ...CUSTOM_HEADERS,
                'Host': parsedUrl.host
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('text/html')) {
            let content = await response.text();
            content = enhanceContent(content, targetUrl);
            
            res.set({
                'Content-Type': 'text/html; charset=UTF-8',
                'Access-Control-Allow-Origin': '*'
            });
            
            res.send(content);
        } else {
            // For non-HTML content, stream directly
            response.body.pipe(res);
        }
        
    } catch (error) {
        console.error('❌ Proxy error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Video host proxy: /video?url=https://miravd.com/...
app.get('/video', async (req, res) => {
    try {
        const videoUrl = req.query.url;
        if (!videoUrl) {
            return res.status(400).send('❌ Missing url parameter');
        }
        
        console.log(`🎬 Proxying video: ${videoUrl}`);
        
        const fetch = require('node-fetch');
        const parsedUrl = new URL(videoUrl);
        
        // Use custom headers for video hosts
        const videoHeaders = {
            ...CUSTOM_HEADERS,
            'Host': parsedUrl.host,
            'Referer': 'https://3isk.onl/' // Override referer for video hosts
        };
        
        const response = await fetch(videoUrl, { headers: videoHeaders });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        let content = await response.text();
        content = enhanceContent(content, videoUrl);
        
        res.set({
            'Content-Type': 'text/html; charset=UTF-8',
            'Access-Control-Allow-Origin': '*',
            'X-Frame-Options': 'ALLOWALL'
        });
        
        res.send(content);
        
    } catch (error) {
        console.error('❌ Video error:', error.message);
        res.status(500).send(`
            <div style="text-align:center;padding:50px;font-family:Arial;">
                <h2>🎬 Video Loading Error</h2>
                <p>Error: ${error.message}</p>
                <p>URL: ${req.query.url}</p>
                <a href="/" style="color:blue;">← Back to Home</a>
            </div>
        `);
    }
});

// Health check for Railway
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        port: PORT,
        uptime: process.uptime()
    });
});

// Catch-all for other routes
app.get('*', (req, res) => {
    res.redirect('/');
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Proxy server running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`📺 Test embed: http://localhost:${PORT}/embed/1/194239/2/`);
    console.log(`✅ Ready for Railway deployment!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 Shutting down gracefully...');
    process.exit(0);
});

module.exports = app;
