const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const port = process.env.PORT || 3000;

// Trust proxy for Railway deployment
app.set('trust proxy', true);

// Enhanced CORS and security middleware for Railway
app.use((req, res, next) => {
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', '*');
        res.header('Access-Control-Max-Age', '86400');
        return res.sendStatus(200);
    }
    
    // Set CORS headers for all requests
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Expose-Headers', '*');
    
    // Security headers
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'SAMEORIGIN');
    res.header('Referrer-Policy', 'no-referrer-when-downgrade');
    
    // Log request for debugging
    console.log(`📥 ${req.method} ${req.url} | IP: ${req.ip} | User-Agent: ${req.get('User-Agent')?.slice(0, 50)}...`);
    
    next();
});

// Middleware to parse custom headers from users
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint for Railway
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: port
    });
});

// Function to create proper headers for video hosts
function getVideoHeaders(host, url, customHeaders = {}) {
    const baseHeaders = {
        'Host': host,
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Dest': 'iframe',
        'Referer': 'https://3isk.onl/',
        
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,ar;q=0.7',
        'Connection': 'close'
    };

    // Merge custom headers from user (if any)
    const mergedHeaders = { ...baseHeaders, ...customHeaders };

    // Video hosting domains that need Cloudflare cookie
    const videoHosts = ['miravd.com', 'mwdy.cc', 'vidroba.com', 'streamtape.com', 'doodstream.com', 'streamwish.com'];
    
    if (videoHosts.some(vh => host.includes(vh))) {
        // Generate Cloudflare clearance cookie for video hosts
        const timestamp = Math.floor(Date.now() / 1000);
        mergedHeaders['Cookie'] = `cf_clearance=ZYvGjWD614gjjWzzaHcAcgTwSH0CNtIjnamT..CIhso-${timestamp}-1.2.1.1-PuAT98NFZLgoUfLXNMtOem5MWcbsPS9a_UM41_nzNHoT70td41BfST4dZXpJm_5SFx_bRKahIshzCJ3ShnyRbJ0SgEk8mcDFL18cfb6Mch4V1hONV0wlHCKhHVqH7VU4IU30hwtdhZdeXQuu2__ffCzuVPgF7UUfHKtP.He0ntIkroHkt6GUvUmoSnmZ6bJBdw14Y5yiYiF.NCcLwDOFVgRz.mKGGVVNXvWF1fXMwwszaqEEGEfwa9CE9MuNoHJBRtcnpvD.ls0hJaKZwO5P.6ZhGeFJrGQgvydUzY1IzQnL0pbiF5ZMq81H_qzDx.reodNgne9whLX9Feu81ox2pOf6JGJyEVSlgCbB64aLPBg; adb_detection=false; legitimate_user=true`;
        console.log(`🍪 Using Cloudflare cookie for: ${host}`);
    }

    return mergedHeaders;
}

// Function to fetch content with proper headers and error handling
async function fetchWithHeaders(url, customHeaders = {}) {
    try {
        const urlObj = new URL(url);
        const host = urlObj.hostname;
        const headers = getVideoHeaders(host, url, customHeaders);
        
        console.log(`📡 Fetching: ${url}`);
        console.log(`🏠 Host: ${host}`);
        
        // Enhanced axios config for Railway deployment
        const config = {
            headers,
            timeout: 30000,
            maxRedirects: 5,
            maxContentLength: 50 * 1024 * 1024, // 50MB limit
            maxBodyLength: 50 * 1024 * 1024,
            validateStatus: function (status) {
                return status < 500; // Accept any status less than 500
            },
            // Important for Railway: handle proxy and SSL
            httpAgent: false,
            httpsAgent: false,
            proxy: false
        };
        
        const response = await axios.get(url, config);
        
        console.log(`✅ Status: ${response.status} | Size: ${response.data?.length || 0} bytes`);
        
        if (response.status >= 400) {
            throw new Error(`HTTP ${response.status}: ${response.statusText || 'Unknown error'}`);
        }
        
        return response.data;
        
    } catch (error) {
        console.error(`❌ Error fetching ${url}:`, {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText
        });
        
        // Provide more specific error messages
        if (error.code === 'ENOTFOUND') {
            throw new Error(`Network error: Cannot resolve hostname. Check your network settings.`);
        } else if (error.code === 'ECONNREFUSED') {
            throw new Error(`Connection refused. The target server may be down.`);
        } else if (error.code === 'ETIMEDOUT') {
            throw new Error(`Request timeout. The server took too long to respond.`);
        } else if (error.response?.status === 403) {
            throw new Error(`Access forbidden. The server blocked this request.`);
        } else if (error.response?.status === 404) {
            throw new Error(`Video not found. The requested video may have been removed.`);
        } else {
            throw new Error(`Fetch error: ${error.message}`);
        }
    }
}

// Function to extract iframe URL from content
function extractIframeUrl(content) {
    const $ = cheerio.load(content);
    
    // Look for iframe sources
    const iframe = $('iframe[src]').first();
    if (iframe.length) {
        const src = iframe.attr('src');
        console.log(`🎬 Found iframe: ${src}`);
        return src;
    }
    
    // Alternative patterns
    const patterns = [
        /src=["']([^"']*(?:miravd|mwdy|vidroba|streamtape|doodstream|streamwish)\.com[^"']*)["']/,
        /src=["']([^"']*embed[^"']*)["']/,
        /src=["']([^"']*player[^"']*)["']/
    ];
    
    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
            console.log(`🎬 Found iframe URL: ${match[1]}`);
            return match[1];
        }
    }
    
    return null;
}

// Function to enhance video content and bypass ADBlock detection
function enhanceVideoContent(content, originalUrl) {
    const $ = cheerio.load(content);
    
    // Remove ADBlock detection elements
    $('#adbd').remove();
    $('.overdiv:contains("Disable ADBlock")').remove();
    $('script[src*="bvtpk.com"]').remove();
    
    // Fix broken resource paths by serving them locally or using CDN
    $('link[href^="/css/"]').each(function() {
        $(this).remove(); // Remove broken CSS links
    });
    
    $('script[src^="/js/"]').each(function() {
        const src = $(this).attr('src');
        if (src.includes('jquery.min.js')) {
            $(this).attr('src', 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js');
        } else if (src.includes('jquery.cookie.js')) {
            $(this).attr('src', 'https://cdnjs.cloudflare.com/ajax/libs/jquery-cookie/1.4.1/jquery.cookie.min.js');
        } else {
            $(this).remove(); // Remove other broken scripts
        }
    });
    
    // Fix JWPlayer script path
    $('script[src^="/player/jw8/jwplayer.js"]').attr('src', 'https://cdnjs.cloudflare.com/ajax/libs/jwplayer/8.24.0/jwplayer.js');
    
    // Remove ad scripts while preserving video functionality
    $('script').each(function() {
        const src = $(this).attr('src');
        const scriptContent = $(this).html();
        
        if (src && (
            src.includes('bvtpk.com') ||
            src.includes('pteefoagha.com') ||
            src.includes('ccg90.com') ||
            src.includes('rtmark.net') ||
            src.includes('tzegilo.com')
        )) {
            $(this).remove();
            return;
        }
        
        if (scriptContent && (
            scriptContent.includes('bvtpk.com') ||
            scriptContent.includes('popunder') ||
            scriptContent.includes('pteefoagha') ||
            (scriptContent.includes('adb') && !scriptContent.includes('jwplayer'))
        )) {
            $(this).remove();
        }
    });
    
    // Add bypass scripts with jQuery and JWPlayer fix
    const bypassScript = `
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-cookie/1.4.1/jquery.cookie.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jwplayer/8.24.0/jwplayer.js"></script>
    <script>
    // 🛡️ ULTIMATE ADBLOCK BYPASS WITH DEPENDENCIES
    (function() {
        console.log("🛡️ Node.js ADBlock Bypass Loading...");
        
        // Set JWPlayer key if needed
        if (window.jwplayer) {
            try {
                jwplayer.key = "ITWMv7t88JGzI0xPwW8I0+LveiXX9SWbfdmt0ArUSyc=";
            } catch(e) {}
        }
        
        // Override detection variables
        window.adblock = false;
        window.adb = false;
        window.AdBlock = false;
        window.adBlockEnabled = false;
        window.adBlockDetected = false;
        
        // Create fake ad elements when DOM is ready
        function createFakeAds() {
            if (!document.body) {
                setTimeout(createFakeAds, 100);
                return;
            }
            
            const fakeAd = document.createElement("div");
            fakeAd.className = "adsbox";
            fakeAd.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;";
            fakeAd.innerHTML = "advertisement";
            document.body.appendChild(fakeAd);
            
            const fakeAd2 = document.createElement("div");
            fakeAd2.id = "ads";
            fakeAd2.style.display = "none";
            document.body.appendChild(fakeAd2);
            
            console.log("🎭 Created fake ad elements");
        }
        
        createFakeAds();
        
        // Override detection functions
        window.checkAdb = () => false;
        window.detectAdBlock = () => false;
        window.showAdbMessage = () => {};
        
        // Block popups and ads
        window.open = (url, name, features) => {
            console.log("🚫 Popup blocked:", url);
            return { close: () => {}, focus: () => {} };
        };
        
        // Override fetch to block ad requests
        const originalFetch = window.fetch;
        window.fetch = function(url, options) {
            if (typeof url === 'string' && (
                url.includes('pteefoagha.com') ||
                url.includes('ccg90.com') ||
                url.includes('rtmark.net') ||
                url.includes('tzegilo.com')
            )) {
                console.log("🚫 Blocked ad fetch:", url);
                return Promise.reject(new Error('Blocked'));
            }
            return originalFetch.apply(this, arguments);
        };
        
        // Hide ADBlock messages
        function hideAdbMessages() {
            if (!document.body) return;
            
            const adbdEl = document.querySelector("#adbd");
            if (adbdEl) {
                adbdEl.style.display = "none";
                console.log("🧹 Hidden ADBlock message");
            }
            
            document.querySelectorAll(".overdiv").forEach(el => {
                if (el.textContent && el.textContent.toLowerCase().includes("disable")) {
                    el.style.display = "none";
                    console.log("🧹 Hidden disable message");
                }
            });
        }
        
        // Force show video player
        function forceShowPlayer() {
            if (!document.body) return;
            
            const player = document.querySelector("#vplayer");
            if (player) {
                player.style.cssText = "display:block!important;visibility:visible!important;opacity:1!important;";
                console.log("📺 Forced video player visible");
            }
            
            // Handle JWPlayer when available - wait for it to load
            setTimeout(() => {
                if (window.jwplayer && document.querySelector("#vplayer")) {
                    try {
                        const jwp = jwplayer("vplayer");
                        if (jwp && jwp.getState) {
                            jwp.on("ready", () => {
                                console.log("🎯 JWPlayer ready and playing");
                                setTimeout(() => jwp.play(), 1000);
                            });
                            
                            jwp.on("error", (e) => {
                                console.log("JWPlayer error:", e);
                            });
                        }
                    } catch(e) {
                        console.log("JWPlayer setup error:", e.message);
                    }
                }
            }, 3000);
        }
        
        // Run enhancements
        hideAdbMessages();
        forceShowPlayer();
        
        // Continuous monitoring
        setInterval(hideAdbMessages, 1000);
        setInterval(forceShowPlayer, 3000);
        
        // Set legitimate user cookies
        setTimeout(() => {
            document.cookie = "adb_detection=false; path=/";
            document.cookie = "legitimate_user=true; path=/";
            document.cookie = "popunder_shown=true; path=/";
            console.log("👤 Set legitimate user cookies");
        }, 1000);
        
        // Wait for jQuery then set cookies properly
        function waitForJQuery() {
            if (window.$ && window.$.cookie) {
                try {
                    $.cookie('file_id', '386532', { expires: 10 });
                    $.cookie('aff', '20', { expires: 10 });
                    $.cookie('ref_url', '3isk.onl', { expires: 10 });
                    console.log("🍪 Set jQuery cookies");
                } catch(e) {
                    console.log("Cookie setting error:", e);
                }
            } else {
                setTimeout(waitForJQuery, 500);
            }
        }
        
        waitForJQuery();
        
        console.log("✅ Node.js ADBlock bypass activated");
    })();
    </script>`;
    
    // Enhanced CSS with ad blocking
    const enhancedCSS = `
    <style>
    /* Hide ADBlock detection elements */
    #adbd, .overdiv:has-text("Disable ADBlock") {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
    }
    
    /* Block ad iframes and scripts */
    iframe[src*="pteefoagha.com"],
    iframe[src*="ccg90.com"],
    iframe[src*="rtmark.net"],
    iframe[src*="tzegilo.com"],
    script[src*="pteefoagha.com"],
    script[src*="ccg90.com"],
    script[src*="rtmark.net"],
    script[src*="tzegilo.com"] {
        display: none !important;
    }
    
    /* Ensure video player is visible */
    #vplayer, .jwplayer, video {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 9999 !important;
    }
    
    /* Fullscreen video styles */
    html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: #000 !important;
        overflow: hidden !important;
    }
    
    #vplayer, .Video, iframe, video {
        width: 100vw !important;
        height: 100vh !important;
        border: none !important;
        position: relative !important;
    }
    
    video {
        object-fit: contain !important;
        background: #000 !important;
    }
    
    /* Hide promotional elements */
    .social-box, .copy, a[href*="premium.html"] {
        display: none !important;
    }
    
    /* Block Cloudflare challenge scripts */
    script[src*="/cdn-cgi/"],
    script[src*="challenge-platform"] {
        display: none !important;
    }
    </style>`;
    
    // Inject enhancements
    if ($('head').length) {
        $('head').append(bypassScript + enhancedCSS);
    } else {
        $('body').prepend(bypassScript + enhancedCSS);
    }
    
    console.log("🔧 Enhanced video content with bypass");
    return $.html();
}

// Main route to handle video requests with custom headers support
app.get('/video', async (req, res) => {
    try {
        const videoUrl = req.query.url || 'https://3isk.onl/embed/1/193981/1/';
        console.log(`\n🎬 === Processing Video Request ===`);
        console.log(`📺 URL: ${videoUrl}`);
        console.log(`🌐 Client IP: ${req.ip}`);
        console.log(`📱 User Agent: ${req.get('User-Agent')?.slice(0, 100)}...`);
        
        // Extract custom headers from query params or request headers
        const customHeaders = {};
        
        // Allow users to pass custom headers via query params
        Object.keys(req.query).forEach(key => {
            if (key.startsWith('header_')) {
                const headerName = key.replace('header_', '').replace(/_/g, '-');
                customHeaders[headerName] = req.query[key];
                console.log(`🔧 Custom header: ${headerName} = ${req.query[key]}`);
            }
        });
        
        // Step 1: Fetch main page
        const mainContent = await fetchWithHeaders(videoUrl, customHeaders);
        
        // Step 2: Extract iframe URL
        const iframeUrl = extractIframeUrl(mainContent);
        
        if (iframeUrl) {
            console.log(`🎯 Found iframe, fetching: ${iframeUrl}`);
            
            // Step 3: Fetch iframe content
            const videoContent = await fetchWithHeaders(iframeUrl, customHeaders);
            
            // Step 4: Enhance and bypass detection
            const enhancedContent = enhanceVideoContent(videoContent, iframeUrl);
            
            // Step 5: Send enhanced content with proper headers for Railway
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            
            res.send(enhancedContent);
            console.log(`✅ Successfully served enhanced video content`);
            
        } else {
            console.log(`⚠️ No iframe found, serving main content`);
            const enhancedContent = enhanceVideoContent(mainContent, videoUrl);
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            res.send(enhancedContent);
        }
        
    } catch (error) {
        console.error(`❌ Error processing video:`, {
            message: error.message,
            stack: error.stack?.split('\n')[0]
        });
        
        // Enhanced error page for Railway deployment
        res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Video Proxy Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; text-align: center; padding: 20px; margin: 0; 
                    min-height: 100vh; display: flex; align-items: center; justify-content: center;
                }
                .error { 
                    background: rgba(0,0,0,0.8); padding: 30px; border-radius: 15px; 
                    max-width: 600px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
                }
                .btn { 
                    background: #4CAF50; color: white; border: none; padding: 12px 20px; 
                    margin: 8px; border-radius: 8px; cursor: pointer; text-decoration: none; 
                    display: inline-block; transition: all 0.3s; font-size: 14px;
                }
                .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
                .error-details { 
                    background: rgba(255,0,0,0.1); padding: 15px; margin: 15px 0; 
                    border-radius: 8px; border-left: 4px solid #ff4757; text-align: left; 
                }
                .help-section { 
                    background: rgba(255,255,255,0.1); padding: 15px; margin: 15px 0; 
                    border-radius: 8px; text-align: left; 
                }
                code { background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; }
                @media (max-width: 600px) {
                    .error { padding: 20px; margin: 10px; }
                    .btn { display: block; margin: 10px 0; }
                }
            </style>
        </head>
        <body>
            <div class="error">
                <h2>🛡️ Video Proxy Server Error</h2>
                
                <div class="error-details">
                    <strong>❌ Error:</strong> ${error.message}<br>
                    <strong>🔗 URL:</strong> ${req.query.url || 'Default video URL'}<br>
                    <strong>🌐 Server:</strong> Railway Deployment<br>
                    <strong>⏰ Time:</strong> ${new Date().toISOString()}
                </div>
                
                <div class="help-section">
                    <h3>🔧 Common Solutions:</h3>
                    <ul>
                        <li><strong>Network Settings:</strong> Check if your network allows outbound connections</li>
                        <li><strong>URL Format:</strong> Ensure the video URL is valid and accessible</li>
                        <li><strong>Custom Headers:</strong> Try adding custom headers using <code>header_*</code> parameters</li>
                        <li><strong>Server Location:</strong> The target video server might be blocking Railway's IP range</li>
                    </ul>
                </div>
                
                <div style="margin: 20px 0;">
                    <h3>🧪 Try Alternative URLs:</h3>
                    <a href="/video?url=https://3isk.onl/embed/1/193981/1/" class="btn">🎬 Server 1</a>
                    <a href="/video?url=https://3isk.onl/embed/2/193981/1/" class="btn">🎬 Server 2</a>
                    <a href="/video?url=https://3isk.onl/embed/3/193981/1/" class="btn">🎬 Server 3</a>
                </div>
                
                <div>
                    <button class="btn" onclick="location.reload()">🔄 Retry</button>
                    <a href="/" class="btn">🏠 Home</a>
                    <a href="/health" class="btn">🩺 Health Check</a>
                </div>
                
                <div style="margin-top: 20px; font-size: 12px; color: #ccc;">
                    Railway Video Proxy | Node.js ${process.version}
                </div>
            </div>
        </body>
        </html>`);
    }
});

// Default route with instructions
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Node.js Video Proxy Server</title>
        <style>
            body { 
                font-family: Arial; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; text-align: center; padding: 50px; margin: 0; 
            }
            .container { 
                background: rgba(0,0,0,0.8); padding: 40px; border-radius: 15px; 
                display: inline-block; max-width: 800px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
            }
            .btn { 
                background: #4CAF50; color: white; border: none; padding: 12px 25px; 
                margin: 10px; border-radius: 8px; cursor: pointer; text-decoration: none; 
                display: inline-block; transition: all 0.3s; 
            }
            .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
            .feature { background: rgba(255,255,255,0.1); padding: 15px; margin: 10px 0; border-radius: 8px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎬 Node.js Video Proxy Server</h1>
            <p>Advanced video embedding with ADBlock detection bypass</p>
            
            <div class="feature">
                <h3>🛡️ Features</h3>
                <ul style="text-align: left;">
                    <li>✅ Cloudflare bypass with proper cookies</li>
                    <li>✅ ADBlock detection removal</li>
                    <li>✅ Proper browser headers simulation</li>
                    <li>✅ Video content protection</li>
                    <li>✅ JWPlayer enhancement</li>
                </ul>
            </div>
            
            <div style="margin: 30px 0;">
                <h3>🚀 Usage</h3>
                <p>Access videos using: <code>/video?url=VIDEO_URL</code></p>
            </div>
            
            <div>
                <a href="/video?url=https://3isk.onl/embed/1/193981/1/" class="btn">🎬 Test Video 1</a>
                <a href="/video?url=https://3isk.onl/embed/2/193981/1/" class="btn">🎬 Test Video 2</a>
                <a href="/video?url=https://3isk.onl/embed/3/193981/1/" class="btn">🎬 Test Video 3</a>
            </div>
            
            <div style="margin-top: 30px; font-size: 12px; color: #ccc;">
                Server running on port ${port} | Node.js Video Proxy
            </div>
        </div>
    </body>
    </html>`);
});

// Start server with Railway-compatible settings
app.listen(port, '0.0.0.0', () => {
    console.log(`\n🎬 =======================================`);
    console.log(`🚀 Video Proxy Server STARTED`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🚢 Platform: ${process.env.RAILWAY_ENVIRONMENT || 'local'}`);
    console.log(`🔗 Server: ${process.env.RAILWAY_PUBLIC_DOMAIN || `http://localhost:${port}`}`);
    console.log(`🎯 Test: ${process.env.RAILWAY_PUBLIC_DOMAIN || `http://localhost:${port}`}/video?url=https://3isk.onl/embed/1/193981/1/`);
    console.log(`🛡️ Features: CORS, Custom Headers, ADBlock Bypass, Cloudflare Support`);
    console.log(`📡 Health Check: ${process.env.RAILWAY_PUBLIC_DOMAIN || `http://localhost:${port}`}/health`);
    console.log(`🎬 =======================================\n`);
});

// Graceful shutdown for Railway
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    process.exit(0);
});

module.exports = app;
