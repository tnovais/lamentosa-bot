/**
 * Configuration for the bot
 */

// File paths
const PATHS = {
  ACCOUNTS_DIR: 'accounts',
  BROWSER_DATA_DIR: 'browser-data',
  LOGS_DIR: 'logs',
  CAPTCHA_IMAGES_DIR: 'captcha-images'
};

// Timing configurations in milliseconds
const TIMING = {
  // Delays for human-like interaction
  TYPE_MIN: 50, // Minimum delay between keypresses when typing
  TYPE_MAX: 150, // Maximum delay between keypresses when typing
  MOUSE_MOVE_MIN: 10, // Minimum delay between mouse movements
  MOUSE_MOVE_MAX: 30, // Maximum delay between mouse movements
  
  // Delays between actions
  MIN_ACTION_DELAY: 1000, // Minimum delay between actions
  MAX_ACTION_DELAY: 3000, // Maximum delay between actions
  
  // Delays between tasks
  MIN_TASK_DELAY: 5000, // Minimum delay between tasks
  MAX_TASK_DELAY: 15000, // Maximum delay between tasks
  
  // Session timing
  MIN_SESSION_DURATION: 15 * 60 * 1000, // Minimum session duration (15 minutes)
  MAX_SESSION_DURATION: 60 * 60 * 1000, // Maximum session duration (1 hour)
  
  // Cooldown timing
  MIN_COOLDOWN: 30 * 60 * 1000, // Minimum cooldown between sessions (30 minutes)
  MAX_COOLDOWN: 120 * 60 * 1000, // Maximum cooldown between sessions (2 hours)
  
  // Random wait times
  SHORT_WAIT_MIN: 1000, // Minimum short wait time
  SHORT_WAIT_MAX: 3000, // Maximum short wait time
  MEDIUM_WAIT_MIN: 3000, // Minimum medium wait time
  MEDIUM_WAIT_MAX: 8000, // Maximum medium wait time
  LONG_WAIT_MIN: 8000, // Minimum long wait time
  LONG_WAIT_MAX: 15000 // Maximum long wait time
};

// Retry configurations
const RETRY = {
  NAVIGATION: 3, // Number of retries for navigation
  ACTION: 3, // Number of retries for actions
  CAPTCHA_SOLVE: 2, // Number of retries for captcha solving
  CAPTCHA_HANDLE: 3, // Number of retries for captcha handling
  LOGIN: 3, // Number of retries for login
  GENERAL: 2 // Number of retries for general operations
};

// Captcha configurations
const CAPTCHA = {
  MAX_ATTEMPTS: 5, // Maximum number of captcha attempts before lockout
  LOCKOUT_MINUTES: 30, // Lockout duration in minutes
  NUMERIC_ONLY: false, // Whether captcha only contains numbers
  MIN_LENGTH: 5, // Minimum length of captcha
  MAX_LENGTH: 10, // Maximum length of captcha
  CASE_SENSITIVE: true // Whether captcha is case sensitive
};

// Fingerprint data for browser randomization
const FINGERPRINT = {
  // User agent strings for different browsers
  USER_AGENTS: [
    // Chrome
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36",
    
    // Firefox
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:90.0) Gecko/20100101 Firefox/90.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
    
    // Edge
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36 Edg/92.0.902.55",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59",
    
    // Safari
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15",
    
    // Mobile
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
  ],
  
  // Language preferences
  LANGUAGES: [
    ['pt-BR', 'pt', 'en-US', 'en'],
    ['en-US', 'en', 'pt-BR', 'pt'],
    ['es-ES', 'es', 'en-US', 'en'],
    ['fr-FR', 'fr', 'en-US', 'en']
  ],
  
  // Screen resolutions
  RESOLUTIONS: [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 1600, height: 900 },
    { width: 1280, height: 800 },
    { width: 2560, height: 1440 },
    { width: 1024, height: 768 },
    // Mobile resolutions
    { width: 375, height: 667 },
    { width: 414, height: 896 },
    { width: 360, height: 740 },
    { width: 412, height: 915 }
  ],
  
  // Accept headers
  ACCEPT_HEADERS: [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  ]
};

module.exports = {
  PATHS,
  TIMING,
  RETRY,
  CAPTCHA,
  FINGERPRINT
};