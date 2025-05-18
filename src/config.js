require('dotenv').config();

// URLs
const URLS = {
  LOGIN: 'https://se.lamentosa.com/',
  LOGOUT: 'https://se.lamentosa.com/logout/',
  PROFILE: 'https://se.lamentosa.com/status/',
  PVP: 'https://se.lamentosa.com/battlefield/enemies-g/?no-scroll=1',
  TEMPLE: 'https://se.lamentosa.com/temple/main-room/',
  CAPTCHA: 'https://se.lamentosa.com/battlefield/anti-bot/',
  MARKET: 'https://se.lamentosa.com/items/market/',
  JOBS: 'https://se.lamentosa.com/cemetery/jobs/',
  DUNGEON: 'https://se.lamentosa.com/dungeons/start/',
  RANKING: 'https://se.lamentosa.com/ranking/pvp/daily-list/',
  INVENTORY: 'https://se.lamentosa.com/items/inventory/',
  CLAN: 'https://se.lamentosa.com/clan/',
};

// Timing configurations
const TIMING = {
  RETRY_DELAY: 5000,
  BUSY_TIMER_RETRY_DELAY: 15000,
  COOKIE_RESET: {
    MIN_SECONDS: 1800,
    MAX_SECONDS: 5400
  },
  PAUSE: {
    MIN_SECONDS: 60,
    MAX_SECONDS: 300,
    INTERVAL_MIN_SECONDS: 2700,
    INTERVAL_MAX_SECONDS: 5400
  },
  LOGOUT_INTERVAL: {
    MIN_SECONDS: 3600,
    MAX_SECONDS: 7200
  }
};

// Captcha settings
const CAPTCHA = {
  API_KEY: process.env.CAPTCHA_API_KEY,
  MAX_ATTEMPTS: 3,
  LOCKOUT_MINUTES: 50
};

// Game specific settings
const GAME = {
  HASTE_POTIONS_PER_USE: 4,
  MAX_HASTE_POTIONS: 200
};

// Retry configurations
const RETRY = {
  MAX_ATTEMPTS: 5,
  BUSY_TIMER_RETRIES: 3,
  MAX_LOOP_ITERATIONS: 1000
};

// File paths
const PATHS = {
  ACCOUNTS_DIR: 'accounts',
  ACCOUNTS_FILE: 'accounts.json'
};

// Browser fingerprint randomization options
const FINGERPRINT = {
  // User agent strings
  USER_AGENTS: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.0.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
  ],

  // HTTP Accept headers
  ACCEPT_HEADERS: [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.7',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
  ],

  // Screen resolutions
  RESOLUTIONS: [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1600, height: 900 },
    { width: 375, height: 812 },  // iPhone
    { width: 768, height: 1024 }  // iPad
  ],

  // Browser languages
  LANGUAGES: [
    ['pt-BR', 'pt'],
    ['en-US', 'en'],
    ['es-ES', 'es'],
    ['fr-FR', 'fr']
  ],
  
  // WebGL vendor options
  WEBGL_VENDORS: [
    'Intel Inc.', 
    'NVIDIA Corporation', 
    'AMD'
  ],
  
  // WebGL renderer options
  WEBGL_RENDERERS: [
    'Intel Iris OpenGL Engine', 
    'GeForce GTX 1650/PCIe/SSE2', 
    'Radeon RX 580 Series'
  ],
  
  // Browser plugins options
  PLUGINS: [
    { name: 'PDF Viewer', filename: 'pdf-viewer.js' },
    { name: 'Chrome PDF Plugin', filename: 'chrome-pdf.js' },
    { name: 'Widevine Content Decryption Module', filename: 'widevinecdm.dll' },
    { name: 'Native Client', filename: 'nacl_irt.nexe' },
    { name: 'Chrome Remote Desktop Viewer', filename: 'remotedesktopclient.dll' }
  ]
};

module.exports = {
  URLS,
  TIMING,
  CAPTCHA,
  GAME,
  RETRY,
  PATHS,
  FINGERPRINT
};
