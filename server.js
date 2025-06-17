const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const port = 3000;

// Middleware to handle CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Function to create proper headers for video hosts
function getVideoHeaders(host, url) {
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
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,ar;q=0.7',
        'Connection': 'close'
    };

    // Video hosting domains that need Cloudflare cookie
    const videoHosts = ['miravd.com', 'mwdy.cc', 'vidroba.com', 'streamtape.com', 'doodstream.com', 'streamwish.com'];
    
    if (videoHosts.some(vh => host.includes(vh))) {
        // Generate Cloudflare clearance cookie for video hosts
        const timestamp = Math.floor(Date.now() / 1000);
        baseHeaders['Cookie'] = `cf_clearance=ZYvGjWD614gjjWzzaHcAcgTwSH0CNtIjnamT..CIhso-${timestamp}-1.2.1.1-PuAT98NFZLgoUfLXNMtOem5MWcbsPS9a_UM41_nzNHoT70td41BfST4dZXpJm_5SFx_bRKahIshzCJ3ShnyRbJ0SgEk8mcDFL18cfb6Mch4V1hONV0wlHCKhHVqH7VU4IU30hwtdhZdeXQuu2__ffCzuVPgF7UUfHKtP.He0ntIkroHkt6GUvUmoSnmZ6bJBdw14Y5yiYiF.NCcLwDOFVgRz.mKGGVVNXvWF1fXMwwszaqEEGEfwa9CE9MuNoHJBRtcnpvD.ls0hJaKZwO5P.6ZhGeFJrGQgvydUzY1IzQnL0pbiF5ZMq81H_qzDx.reodNgne9whLX9Feu81ox2pOf6JGJyEVSlgCbB64aLPBg; adb_detection=false; legitimate_user=true`;
        console.log(`🍪 Using Cloudflare cookie for: ${host}`);
    }

    return baseHeaders;
}

// Function to fetch content with proper headers
async function fetchWithHeaders(url) {
    try {
        const urlObj = new URL(url);
        const host = urlObj.hostname;
        const headers = getVideoHeaders(host, url);
        
        console.log(`📡 Fetching: ${url}`);
        console.log(`🏠 Host: ${host}`);
        
        const response = await axios.get(url, {
            headers,
            timeout: 30000,
            maxRedirects: 5,
            validateStatus: function (status) {
                return status < 400; // Accept any status less than 400
            }
        });
        
        console.log(`✅ Status: ${response.status}`);
        return response.data;
        
    } catch (error) {
        console.error(`❌ Error fetching ${url}:`, error.message);
        throw error;
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
    
    // Remove specific ad scripts while preserving video functionality
    $('script').each(function() {
        const scriptContent = $(this).html();
        if (scriptContent && (
            scriptContent.includes('bvtpk.com') ||
            scriptContent.includes('popunder') ||
            (scriptContent.includes('adb') && !scriptContent.includes('jwplayer'))
        )) {
            $(this).remove();
        }
    });
    
    // Add bypass scripts
    const bypassScript = `
    <script>
    // 🛡️ ULTIMATE ADBLOCK BYPASS
    (function() {
        console.log("🛡️ Node.js ADBlock Bypass Loading...");
        
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
        
        // Block popups
        window.open = (url, name, features) => {
            console.log("🚫 Popup blocked:", url);
            return { close: () => {}, focus: () => {} };
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
            
            // Handle JWPlayer when available
            if (window.jwplayer && document.querySelector("#vplayer")) {
                setTimeout(() => {
                    try {
                        const jwp = jwplayer("vplayer");
                        if (jwp) {
                            jwp.on("ready", () => {
                                console.log("🎯 JWPlayer ready and playing");
                                jwp.play();
                            });
                        }
                    } catch(e) {
                        console.log("JWPlayer setup:", e.message);
                    }
                }, 2000);
            }
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
        
        console.log("✅ Node.js ADBlock bypass activated");
    })();
    </script>`;
    
    // Enhanced CSS
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

// Main route to handle video requests
app.get('/video', async (req, res) => {
    try {
        const videoUrl = req.query.url || 'https://3isk.onl/embed/1/193981/1/';
        console.log(`\n🎬 === Processing Video Request ===`);
        console.log(`📺 URL: ${videoUrl}`);
        
        // Step 1: Fetch main page
        const mainContent = await fetchWithHeaders(videoUrl);
        
        // Step 2: Extract iframe URL
        const iframeUrl = extractIframeUrl(mainContent);
        
        if (iframeUrl) {
            console.log(`🎯 Found iframe, fetching: ${iframeUrl}`);
            
            // Step 3: Fetch iframe content
            const videoContent = await fetchWithHeaders(iframeUrl);
            
            // Step 4: Enhance and bypass detection
            const enhancedContent = enhanceVideoContent(videoContent, iframeUrl);
            
            // Step 5: Send enhanced content
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            
            res.send(enhancedContent);
            console.log(`✅ Successfully served enhanced video content`);
            
        } else {
            console.log(`⚠️ No iframe found, serving main content`);
            const enhancedContent = enhanceVideoContent(mainContent, videoUrl);
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            res.send(enhancedContent);
        }
        
    } catch (error) {
        console.error(`❌ Error processing video:`, error.message);
        
        res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Video Server Error</title>
            <style>
                body { 
                    font-family: Arial; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; text-align: center; padding: 50px; margin: 0; 
                }
                .error { 
                    background: rgba(0,0,0,0.8); padding: 40px; border-radius: 15px; 
                    display: inline-block; max-width: 600px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
                }
                .btn { 
                    background: #4CAF50; color: white; border: none; padding: 12px 25px; 
                    margin: 10px; border-radius: 8px; cursor: pointer; text-decoration: none; 
                    display: inline-block; transition: all 0.3s; 
                }
                .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
            </style>
        </head>
        <body>
            <div class="error">
                <h2>🛡️ Node.js Video Server Error</h2>
                <p><strong>Error:</strong> ${error.message}</p>
                <p><strong>URL:</strong> ${req.query.url || 'Default video URL'}</p>
                
                <div style="margin: 20px 0;">
                    <h3>🧪 Try These URLs:</h3>
                    <a href="/video?url=https://3isk.onl/embed/1/193981/1/" class="btn">🎬 Server 1</a><br>
                    <a href="/video?url=https://3isk.onl/embed/2/193981/1/" class="btn">🎬 Server 2</a><br>
                    <a href="/video?url=https://3isk.onl/embed/3/193981/1/" class="btn">🎬 Server 3</a>
                </div>
                
                <button class="btn" onclick="location.reload()">🔄 Retry</button>
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

// Start server
app.listen(port, () => {
    console.log(`\n🎬 =======================================`);
    console.log(`🚀 Node.js Video Proxy Server STARTED`);
    console.log(`🌐 Server: http://localhost:${port}`);
    console.log(`🎯 Test URL: http://localhost:${port}/video?url=https://3isk.onl/embed/1/193981/1/`);
    console.log(`🛡️ Features: ADBlock bypass, Cloudflare cookies, proper headers`);
    console.log(`🎬 =======================================\n`);
});

module.exports = app;
