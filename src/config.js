/**
 * Configuração para o Bot do Lamentosa
 */

// URLs e constantes
const PVP_URL = 'https://se.lamentosa.com/battlefield/enemies-g/?no-scroll=1';
const TEMPLE_URL = 'https://se.lamentosa.com/temple/main-room/';
const LOGIN_URL = 'https://se.lamentosa.com/';
const CAPTCHA_URL = 'https://se.lamentosa.com/battlefield/anti-bot/';
const LOGOUT_URL = 'https://se.lamentosa.com/logout/';
const PROFILE_URL = 'https://se.lamentosa.com/status/';
const MARKET_URL = 'https://se.lamentosa.com/items/market/';
const JOBS_URL = 'https://se.lamentosa.com/cemetery/jobs/';
const DUNGEON_URL = 'https://se.lamentosa.com/dungeons/start/';
const RANKING_URL = 'https://se.lamentosa.com/ranking/pvp/daily-list/';
const INVENTORY_URL = 'https://se.lamentosa.com/items/inventory/';
const CLAN_URL = 'https://se.lamentosa.com/clan/';

// File paths
const PATHS = {
  ACCOUNTS_DIR: 'accounts',
  BROWSER_DATA_DIR: 'browser-data',
  LOGS_DIR: 'logs',
  CAPTCHA_IMAGES_DIR: 'captcha-images'
};

// Configurações globais
const CAPTCHA = {
  MAX_ATTEMPTS: 3,                // Número máximo de tentativas antes de bloqueio
  LOCKOUT_MINUTES: 50,            // Duração do bloqueio em minutos após falhas excessivas
  NUMERIC_ONLY: false,            // Se captcha contém apenas números
  MIN_LENGTH: 3,                  // Comprimento mínimo do captcha
  MAX_LENGTH: 10,                 // Comprimento máximo do captcha
  CASE_SENSITIVE: true            // Se captcha é sensível a maiúsculas/minúsculas
};

// Configurações de retry
const RETRY = {
  NAVIGATION: 3,                  // Número de tentativas para navegação
  ACTION: 3,                      // Número de tentativas para ações
  CAPTCHA_SOLVE: 2,               // Número de tentativas para resolver captcha
  CAPTCHA_HANDLE: 3,              // Número de tentativas para lidar com captcha
  LOGIN: 3,                       // Número de tentativas para login
  GENERAL: 2,                     // Número de tentativas para operações gerais
  MAX_RETRY_ATTEMPTS: 5,          // Número máximo de tentativas de retry
  RETRY_DELAY: 5000,              // Delay entre retries em ms
  BUSY_TIMER_RETRIES: 3,          // Tentativas para timer de ocupado
  BUSY_TIMER_RETRY_DELAY: 15000   // Delay entre tentativas de timer de ocupado
};

// Configurações de tempo
const TIMING = {
  // Delays para interação humana
  TYPE_MIN: 50,                   // Delay mínimo entre pressionamentos de tecla
  TYPE_MAX: 150,                  // Delay máximo entre pressionamentos de tecla
  MOUSE_MOVE_MIN: 10,             // Delay mínimo entre movimentos do mouse
  MOUSE_MOVE_MAX: 30,             // Delay máximo entre movimentos do mouse
  
  // Delays entre ações
  MIN_ACTION_DELAY: 1000,         // Delay mínimo entre ações
  MAX_ACTION_DELAY: 3000,         // Delay máximo entre ações
  
  // Delays entre tarefas
  MIN_TASK_DELAY: 5000,           // Delay mínimo entre tarefas
  MAX_TASK_DELAY: 15000,          // Delay máximo entre tarefas
  
  // Timing de sessão
  MIN_SESSION_DURATION: 15 * 60 * 1000,    // Duração mínima de sessão (15 minutos)
  MAX_SESSION_DURATION: 60 * 60 * 1000,    // Duração máxima de sessão (1 hora)
  
  // Timing de cooldown
  MIN_COOLDOWN: 30 * 60 * 1000,            // Cooldown mínimo entre sessões (30 minutos)
  MAX_COOLDOWN: 120 * 60 * 1000,           // Cooldown máximo entre sessões (2 horas)
  
  // Tempos de espera aleatórios
  SHORT_WAIT_MIN: 1000,                    // Tempo mínimo de espera curta
  SHORT_WAIT_MAX: 3000,                    // Tempo máximo de espera curta
  MEDIUM_WAIT_MIN: 3000,                   // Tempo mínimo de espera média
  MEDIUM_WAIT_MAX: 8000,                   // Tempo máximo de espera média
  LONG_WAIT_MIN: 8000,                     // Tempo mínimo de espera longa
  LONG_WAIT_MAX: 15000,                    // Tempo máximo de espera longa
  
  // Tempos de reset de cookies e pausa
  COOKIE_RESET_MIN_SECONDS: 1800,          // Tempo mínimo para reset de cookies (segundos)
  COOKIE_RESET_MAX_SECONDS: 5400,          // Tempo máximo para reset de cookies (segundos)
  PAUSE_MIN_SECONDS: 60,                   // Duração mínima de pausa (segundos)
  PAUSE_MAX_SECONDS: 300,                  // Duração máxima de pausa (segundos)
  PAUSE_INTERVAL_MIN_SECONDS: 2700,        // Intervalo mínimo entre pausas (segundos)
  PAUSE_INTERVAL_MAX_SECONDS: 5400,        // Intervalo máximo entre pausas (segundos)
  LOGOUT_INTERVAL_MIN_SECONDS: 3600,       // Intervalo mínimo para logout (segundos)
  LOGOUT_INTERVAL_MAX_SECONDS: 7200        // Intervalo máximo para logout (segundos)
};

// Configurações de Haste Potions
const HASTE = {
  POTIONS_PER_USE: 4,                     // Número de poções por uso
  MAX_POTIONS: 200                        // Número máximo de poções
};

// Outras configurações
const MAX_LOOP_ITERATIONS = 1000;          // Número máximo de iterações para evitar loops infinitos

// Fingerprint data para randomização do navegador
const FINGERPRINT = {
  // User agent strings para diferentes navegadores
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
  
  // Cabeçalhos Accept
  ACCEPT_HEADERS: [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.7',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
  ],
  
  // Resoluções de tela
  RESOLUTIONS: [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1600, height: 900 },
    { width: 375, height: 812 }, // iPhone
    { width: 768, height: 1024 } // iPad
  ],
  
  // Idiomas
  LANGUAGES: [
    ['pt-BR', 'pt'],
    ['en-US', 'en'],
    ['es-ES', 'es'],
    ['fr-FR', 'fr']
  ]
};

// Exportar todos os objetos de configuração
module.exports = {
  // URLs
  PVP_URL,
  TEMPLE_URL,
  LOGIN_URL,
  CAPTCHA_URL,
  LOGOUT_URL,
  PROFILE_URL,
  MARKET_URL,
  JOBS_URL,
  DUNGEON_URL,
  RANKING_URL,
  INVENTORY_URL,
  CLAN_URL,
  
  // Configurações
  PATHS,
  TIMING,
  RETRY,
  CAPTCHA,
  FINGERPRINT,
  HASTE,
  MAX_LOOP_ITERATIONS
};