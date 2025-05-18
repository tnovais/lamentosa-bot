const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const { Solver } = require('@2captcha/captcha-solver');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
require('dotenv').config();

// Funções utilitárias
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const log = message => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

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
const ACCOUNTS_DIR = 'accounts';
const ACCOUNTS_FILE = 'accounts.json';

// Configurações globais
const CAPTCHA_API_KEY = process.env.CAPTCHA_API_KEY;
const MAX_CAPTCHA_ATTEMPTS = 3;
const CAPTCHA_LOCKOUT_MINUTES = 50;
const HASTE_POTIONS_PER_USE = 4;
const MAX_HASTE_POTIONS = 200;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY = 5000;
const BUSY_TIMER_RETRIES = 3;
const BUSY_TIMER_RETRY_DELAY = 15000;
const COOKIE_RESET_MIN_SECONDS = 1800;
const COOKIE_RESET_MAX_SECONDS = 5400;
const PAUSE_MIN_SECONDS = 60;
const PAUSE_MAX_SECONDS = 300;
const PAUSE_INTERVAL_MIN_SECONDS = 2700;
const PAUSE_INTERVAL_MAX_SECONDS = 5400;
const LOGOUT_INTERVAL_MIN_SECONDS = 3600;
const LOGOUT_INTERVAL_MAX_SECONDS = 7200;
const MAX_LOOP_ITERATIONS = 1000;

// Lista de User-Agents expandida
const USER_AGENTS = [
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
];

// Lista de cabeçalhos Accept
const ACCEPT_HEADERS = [
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.7',
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
];

// Lista de resoluções de tela
const RESOLUTIONS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1600, height: 900 },
  { width: 375, height: 812 }, // iPhone
  { width: 768, height: 1024 } // iPad
];

// Lista de idiomas
const LANGUAGES = [
  ['pt-BR', 'pt'],
  ['en-US', 'en'],
  ['es-ES', 'es'],
  ['fr-FR', 'fr']
];

// Inicializa o solver do 2Captcha
const captchaSolver = new Solver(CAPTCHA_API_KEY);

// Função para obter timestamp
function getTimestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
}

// Função para combinar imagens
async function combineImages(imageBuffers) {
  const canvas = createCanvas(400, 100);
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 4; i++) {
    const img = await loadImage(imageBuffers[i]);
    ctx.drawImage(img, i * 100, 0, 100, 100);
  }
  return canvas.toBuffer();
}

// Função para calcular curva de Bezier
function getBezierPoints(startX, startY, endX, endY, steps) {
  const cp1x = startX + (endX - startX) * (0.3 + Math.random() * 0.4);
  const cp1y = startY + (endY - startY) * (0.3 + Math.random() * 0.4);
  const cp2x = startX + (endX - startX) * (0.6 + Math.random() * 0.4);
  const cp2y = startY + (endY - startY) * (0.6 + Math.random() * 0.4);
  const points = [];
  for (let t = 0; t <= 1; t += 1 / steps) {
    const x = (1 - t) ** 3 * startX + 3 * (1 - t) ** 2 * t * cp1x + 3 * (1 - t) * t ** 2 * cp2x + t ** 3 * endX;
    const y = (1 - t) ** 3 * startY + 3 * (1 - t) ** 2 * t * cp1y + 3 * (1 - t) * t ** 2 * cp2y + t ** 3 * endY;
    points.push({ x, y });
  }
  return points;
}

// Função para simular movimento do mouse avançado
async function simulateMouseMove(page, element, accountId) {
  try {
    const box = await element.boundingBox();
    if (!box) {
      log(`[${accountId}] Bounding box não encontrado para elemento`);
      return;
    }
    const startX = box.x + Math.random() * box.width;
    const startY = box.y + Math.random() * box.height;
    const endX = box.x + box.width / 2 + (Math.random() * 50 - 25);
    const endY = box.y + box.height / 2 + (Math.random() * 50 - 25);
    const steps = Math.floor(Math.random() * 10 + 10);
    const bezierPoints = getBezierPoints(startX, startY, endX, endY, steps);
    for (let i = 0; i < bezierPoints.length; i++) {
      const { x, y } = bezierPoints[i];
      await page.mouse.move(x, y, { steps: 1 });
      await delay(Math.random() * 100 + 50);
    }
    log(`[${accountId}] Mouse movido para (${endX}, ${endY}) com curva de Bezier`);
    await page.mouse.move(endX + (Math.random() * 10 - 5), endY + (Math.random() * 10 - 5), { steps: 5 });
    await delay(Math.pow(Math.random(), 2) * 500 + 300);
    await page.evaluate(() => {
      const event = new MouseEvent('mouseover', { bubbles: true });
      document.dispatchEvent(event);
    });
  } catch (error) {
    log(`[${accountId}] Erro ao simular movimento do mouse: ${error.message}`);
  }
}

// Função para atraso com distribuição exponencial
async function naturalDelay(minDelay = 2000, maxDelay = 7000) {
  const delayMs = Math.pow(Math.random(), 2) * (maxDelay - minDelay) + minDelay;
  await delay(delayMs);
}

// Função para verificar e navegar
async function ensurePage(page, targetUrl, waitUntil = 'domcontentloaded', accountId) {
  const currentUrl = page.url();
  if (!currentUrl.includes(targetUrl)) {
    log(`[${accountId}] Navegando para ${targetUrl} (atual: ${currentUrl})`);
    try {
      await page.goto(targetUrl, { waitUntil, timeout: 20000 });
      log(`[${accountId}] Navegado para: ${page.url()}`);
    } catch (error) {
      log(`[${accountId}] Erro ao navegar para ${targetUrl}: ${error.message}`);
      log(`[${accountId}] Recarregando página...`);
      await page.reload({ waitUntil, timeout: 20000 }).catch(() => {
        log(`[${accountId}] Falha ao recarregar`);
      });
      throw error;
    }
  }
}

// Função para rolar página
async function randomScroll(page, accountId) {
  try {
    await page.evaluate(() => {
      window.scrollBy(0, Math.random() * 200 - 100);
    });
    log(`[${accountId}] Página rolada aleatoriamente`);
  } catch (error) {
    log(`[${accountId}] Erro ao rolar página: ${error.message}`);
  }
}

// Função para randomizar propriedades do navegador
async function randomizeBrowserProperties(page, accountId) {
  try {
    await page.evaluateOnNewDocument(() => {
      // Randomizar navigator.plugins
      const plugins = [
        { name: 'PDF Viewer', filename: 'pdf-viewer.js' },
        { name: 'Chrome PDF Plugin', filename: 'chrome-pdf.js' },
        { name: 'Widevine Content Decryption Module', filename: 'widevinecdm.dll' }
      ].slice(0, Math.floor(Math.random() * 3 + 2));
      Object.defineProperty(navigator, 'plugins', {
        get: () => plugins.map(p => ({ name: p.name, filename: p.filename }))
      });

      // Randomizar navigator.languages
      const languages = [
        ['pt-BR', 'pt'],
        ['en-US', 'en'],
        ['es-ES', 'es'],
        ['fr-FR', 'fr']
      ][Math.floor(Math.random() * 4)];
      Object.defineProperty(navigator, 'languages', { get: () => languages });

      // Randomizar WebGL
      const gl = document.createElement('canvas').getContext('webgl');
      const vendors = ['Intel Inc.', 'NVIDIA Corporation', 'AMD'];
      const renderers = ['Intel Iris OpenGL Engine', 'GeForce GTX 1650/PCIe/SSE2', 'Radeon RX 580 Series'];
      gl.getParameter = (function(original) {
        return function(param) {
          if (param === 0x1F00) return vendors[Math.floor(Math.random() * vendors.length)]; // VENDOR
          if (param === 0x1F01) return renderers[Math.floor(Math.random() * renderers.length)]; // RENDERER
          return original.call(this, param);
        };
      })(gl.getParameter);

      // Reduzir precisão temporal
      const originalNow = Date.now;
      Date.now = () => Math.round(originalNow() / 10) * 10;
      performance.now = () => Math.round(performance.now() / 10) * 10;
    });
    log(`[${accountId}] Propriedades do navegador randomizadas`);
  } catch (error) {
    log(`[${accountId}] Erro ao randomizar propriedades do navegador: ${error.message}`);
  }
}

// Função para spoof de telemetria
async function spoofTelemetry(page, accountId) {
  try {
    await page.evaluateOnNewDocument(() => {
      // Randomizar canvas
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
        const data = originalToDataURL.call(this, type, quality);
        const img = new Image();
        img.src = data;
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          if (Math.random() < 0.02) {
            imageData.data[i] += Math.floor(Math.random() * 3 - 1);
            imageData.data[i + 1] += Math.floor(Math.random() * 3 - 1);
            imageData.data[i + 2] += Math.floor(Math.random() * 3 - 1);
          }
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL(type, quality);
      };

      // Simular eventos de teclado
      setInterval(() => {
        const keys = ['Tab', 'ArrowDown', 'ArrowUp'];
        const event = new KeyboardEvent('keydown', { key: keys[Math.floor(Math.random() * keys.length)] });
        document.dispatchEvent(event);
      }, Math.random() * 10000 + 5000);

      // Simular movimentos de mouse fora de elementos
      setInterval(() => {
        const event = new MouseEvent('mousemove', {
          bubbles: true,
          clientX: Math.random() * window.innerWidth,
          clientY: Math.random() * window.innerHeight
        });
        document.dispatchEvent(event);
      }, Math.random() * 15000 + 10000);
    });
    log(`[${accountId}] Telemetria spoofada`);
  } catch (error) {
    log(`[${accountId}] Erro ao spoofar telemetria: ${error.message}`);
  }
}

// Função para simular contexto de usuário
async function simulateUserContext(page, cookiesPath, accountId) {
  try {
    const sites = [
      'https://www.google.com',
      'https://www.youtube.com'
    ];
    for (const site of sites) {
      log(`[${accountId}] Visitando ${site} para coletar cookies`);
      await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {
        log(`[${accountId}] Erro ao visitar ${site}`);
      });
      await naturalDelay(5000, 10000);
      await randomScroll(page, accountId);
    }
    const cookies = await page.cookies();
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    log(`[${accountId}] Cookies de contexto salvos`);
  } catch (error) {
    log(`[${accountId}] Erro ao simular contexto de usuário: ${error.message}`);
  }
}

// Função para visitar página aleatória
async function visitRandomPage(page, accountId) {
  const RANDOM_PAGE_CHANCE = Math.random() * 0.2 + 0.1; // 0.1 a 0.3
  if (Math.random() > RANDOM_PAGE_CHANCE) {
    log(`[${accountId}] Nenhuma página aleatória visitada (chance ${RANDOM_PAGE_CHANCE.toFixed(2)} não atingida)`);
    return;
  }

  const pages = [
    {
      url: PROFILE_URL,
      name: 'Perfil',
      action: async () => {
        const button = await page.$('a.view-profile-btn');
        if (button) {
          await simulateMouseMove(page, button, accountId);
          await button.hover();
          log(`[${accountId}] Passou o mouse sobre o botão de perfil`);
          await naturalDelay();
          await button.click();
          log(`[${accountId}] Clicou em visualizar perfil`);
          await naturalDelay(2000, 5000);
        }
      }
    },
    {
      url: MARKET_URL,
      name: 'Mercado',
      action: async () => {
        const button = await page.$('a.category-btn');
        if (button) {
          await simulateMouseMove(page, button, accountId);
          await button.hover();
          log(`[${accountId}] Passou o mouse sobre a categoria do mercado`);
          await naturalDelay();
          await button.click();
          log(`[${accountId}] Clicou em categoria do mercado`);
          await naturalDelay(2000, 5000);
        }
        const searchInput = await page.$('input.search-input');
        if (searchInput && Math.random() < 0.3) {
          await simulateMouseMove(page, searchInput, accountId);
          await searchInput.focus();
          await page.type('input.search-input', 'item', { delay: Math.random() * 200 + 100 });
          log(`[${accountId}] Digitou no campo de busca do mercado`);
          await naturalDelay(1000, 3000);
        }
      }
    },
    {
      url: JOBS_URL,
      name: 'Trabalho',
      action: async () => {
        await randomScroll(page, accountId);
        const button = await page.$('a.g-link[hx-get="/premium-market/"]');
        if (button) {
          await simulateMouseMove(page, button, accountId);
          await button.hover();
          log(`[${accountId}] Passou o mouse sobre Mercado Premium`);
          await naturalDelay();
          await button.click();
          log(`[${accountId}] Clicou em Mercado Premium`);
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {
            log(`[${accountId}] Nenhuma navegação detectada após clicar, continuando...`);
          });
          await naturalDelay(2000, 5000);
        }
      }
    },
    {
      url: DUNGEON_URL,
      name: 'Masmorra',
      action: async () => {
        await randomScroll(page, accountId);
        const button = await page.$('a[rel="modal"][data-content-selector=".scalps-info"]');
        if (button) {
          await simulateMouseMove(page, button, accountId);
          await button.hover();
          log(`[${accountId}] Passou o mouse sobre Escalpos`);
          await naturalDelay();
          await button.click();
          log(`[${accountId}] Clicou em Escalpos (modal)`);
          await naturalDelay(2000, 5000);
          const closeButton = await page.$('a.close-modal');
          if (closeButton) {
            await simulateMouseMove(page, closeButton, accountId);
            await closeButton.hover();
            log(`[${accountId}] Passou o mouse sobre o botão de fechar modal`);
            await naturalDelay();
            await closeButton.click();
            log(`[${accountId}] Fechou o modal de Escalpos`);
            await naturalDelay(2000, 5000);
          }
        }
      }
    },
    {
      url: RANKING_URL,
      name: 'Ranking PvP',
      action: async () => {
        await randomScroll(page, accountId);
        const topPlayers = await page.$$('td a.char-werewolf');
        if (topPlayers.length > 0) {
          const topPlayer = topPlayers[0];
          await simulateMouseMove(page, topPlayer, accountId);
          await topPlayer.hover();
          log(`[${accountId}] Passou o mouse sobre o perfil do top 1 do ranking`);
          await naturalDelay();
          await topPlayer.click();
          log(`[${accountId}] Clicou no perfil do top 1 do ranking`);
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {
            log(`[${accountId}] Nenhuma navegação detectada após clicar, continuando...`);
          });
          await naturalDelay(2000, 5000);
        }
      }
    },
    {
      url: INVENTORY_URL,
      name: 'Inventário',
      action: async () => {
        await randomScroll(page, accountId);
        const item = await page.$('a.item-link');
        if (item) {
          await simulateMouseMove(page, item, accountId);
          await item.hover();
          log(`[${accountId}] Passou o mouse sobre um item do inventário`);
          await naturalDelay();
          if (Math.random() < 0.5) {
            await item.click();
            log(`[${accountId}] Clicou em um item do inventário`);
            await naturalDelay(2000, 5000);
          }
        }
      }
    },
    {
      url: CLAN_URL,
      name: 'Clã',
      action: async () => {
        await randomScroll(page, accountId);
        const member = await page.$('a.clan-member');
        if (member) {
          await simulateMouseMove(page, member, accountId);
          await member.hover();
          log(`[${accountId}] Passou o mouse sobre um membro do clã`);
          await naturalDelay();
          await member.click();
          log(`[${accountId}] Clicou no perfil de um membro do clã`);
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {
            log(`[${accountId}] Nenhuma navegação detectada após clicar, continuando...`);
          });
          await naturalDelay(2000, 5000);
        }
      }
    }
  ];

  // Navegação em cadeia
  const maxPages = Math.random() < 0.2 ? 2 : 1;
  for (let i = 0; i < maxPages; i++) {
    const randomPage = pages[Math.floor(Math.random() * pages.length)];
    log(`[${accountId}] Visitando página aleatória: ${randomPage.name} (${randomPage.url})`);
    try {
      if (!(await checkAndResolveCaptcha(page, accountId))) {
        log(`[${accountId}] Falha ao resolver CAPTCHA antes de visitar página aleatória`);
        return;
      }
      await page.goto(randomPage.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      log(`[${accountId}] Navegado para ${randomPage.name}: ${page.url()}`);
      await randomScroll(page, accountId);
      if (randomPage.action) {
        await randomPage.action();
      }
      await naturalDelay(5000, 15000);
      if (Math.random() < 0.3 && i === maxPages - 1) {
        log(`[${accountId}] Permanecendo em ${randomPage.name} sem retornar ao PvP`);
        await naturalDelay(5000, 10000);
        return;
      }
    } catch (error) {
      log(`[${accountId}] Erro ao visitar ${randomPage.name}: ${error.message}`);
      const pageContent = await page.evaluate(() => document.body.innerText.substring(0, 200));
      log(`[${accountId}] Conteúdo da página após erro: ${pageContent}...`);
    }
  }
  await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
}

// Funções existentes (mantidas com alterações para erros e CAPTCHAs)
async function checkSession(page, accountId) {
  try {
    const pvpButton = await page.$('.btn.pvp-btn.peform-pvp');
    const loginInput = await page.$('input#id_email');
    if (pvpButton) {
      log(`[${accountId}] Sessão confirmada: Botão de ataque presente`);
      return true;
    }
    if (loginInput) {
      log(`[${accountId}] Sessão expirada: Página de login detectada`);
      return false;
    }
    await page.waitForSelector('strong.haste', { timeout: 10000 });
    log(`[${accountId}] Sessão confirmada: Elemento strong.haste encontrado`);
    return true;
  } catch (error) {
    log(`[${accountId}] Erro na verificação de sessão: ${error.message}`);
    await naturalDelay(30000, 120000); // Delay variável após erro
    if (Math.random() < 0.1) {
      log(`[${accountId}] Simulando abandono após erro de sessão`);
      return false;
    }
    return false;
  }
}

async function getHastePotionsCount(page, accountId, attempt = 1) {
  try {
    await ensurePage(page, PVP_URL, 'networkidle2', accountId);
    await page.waitForTimeout(5000);
    const pageContent = await page.evaluate(() => document.body.innerHTML.substring(0, 500));
    if (pageContent.includes('cf-error-details') || pageContent.includes('Bad gateway') || pageContent.includes('Error code 502')) {
      if (attempt > MAX_RETRY_ATTEMPTS) {
        log(`[${accountId}] Máximo de tentativas (${MAX_RETRY_ATTEMPTS}) atingido para erro do Cloudflare`);
        return 0;
      }
      log(`[${accountId}] Erro do Cloudflare detectado (tentativa ${attempt}/${MAX_RETRY_ATTEMPTS})`);
      await page.reload({ waitUntil: 'networkidle2', timeout: 20000 });
      await naturalDelay(30000, 120000); // Delay variável após erro
      if (Math.random() < 0.1) {
        log(`[${accountId}] Simulando abandono após erro do Cloudflare`);
        return 0;
      }
      return await getHastePotionsCount(page, accountId, attempt + 1);
    }
    if (!(await checkAndResolveCaptcha(page, accountId))) {
      log(`[${accountId}] CAPTCHA detectado ao obter poções`);
      return 0;
    }
    const selectors = ['strong.haste', '.haste', '#haste', 'span.haste-count', 'div.haste-counter'];
    let hasteCount = 0;
    for (const selector of selectors) {
      const hasteElement = await page.$(selector);
      if (hasteElement) {
        hasteCount = await page.evaluate(el => parseInt(el.innerText, 10), hasteElement);
        if (!isNaN(hasteCount)) {
          log(`[${accountId}] Encontrado seletor ${selector}: ${hasteCount} poções`);
          return hasteCount;
        }
      }
    }
    log(`[${accountId}] Nenhum seletor de poções encontrado, recarregando página (tentativa ${attempt}/${MAX_RETRY_ATTEMPTS})`);
    if (attempt >= MAX_RETRY_ATTEMPTS) {
      log(`[${accountId}] Máximo de tentativas atingido para encontrar poções`);
      return 0;
    }
    await page.reload({ waitUntil: 'networkidle2', timeout: 20000 });
    await page.waitForTimeout(5000);
    return await getHastePotionsCount(page, accountId, attempt + 1);
  } catch (error) {
    log(`[${accountId}] Erro ao obter poções: ${error.message}`);
    if (attempt > MAX_RETRY_ATTEMPTS) {
      log(`[${accountId}] Máximo de tentativas (${MAX_RETRY_ATTEMPTS}) atingido`);
      return 0;
    }
    log(`[${accountId}] Tentando novamente (tentativa ${attempt}/${MAX_RETRY_ATTEMPTS})`);
    await page.reload({ waitUntil: 'networkidle2', timeout: 20000 });
    await naturalDelay(30000, 120000); // Delay variável após erro
    if (Math.random() < 0.1) {
      log(`[${accountId}] Simulando abandono após erro de poções`);
      return 0;
    }
    return await getHastePotionsCount(page, accountId, attempt + 1);
  }
}

async function getBusyTimerSeconds(page, accountId) {
  try {
    await page.waitForSelector('h2#busyTimer', { visible: true, timeout: 10000 });
    const timerText = await page.evaluate(() => document.querySelector('h2#busyTimer')?.innerText);
    if (!timerText) {
      log(`[${accountId}] Elemento busyTimer não encontrado`);
      return null;
    }
    const timeMatch = timerText.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (!timeMatch) {
      log(`[${accountId}] Formato de busyTimer inválido: ${timerText}`);
      return null;
    }
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = parseInt(timeMatch[3], 10);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    log(`[${accountId}] Tempo restante no busyTimer: ${timerText} (${totalSeconds} segundos)`);
    return totalSeconds;
  } catch (error) {
    log(`[${accountId}] Erro ao obter busyTimer: ${error.message}`);
    const attackButton = await page.$('.btn.pvp-btn.peform-pvp');
    if (error.message.includes('waiting for selector') && attackButton) {
      log(`[${accountId}] Botão de ataque encontrado, assumindo nenhum cooldown`);
      return 0;
    }
    return null;
  }
}

async function waitForCooldown(page, accountId, maxWaitSeconds = 20 * 60) {
  let totalAttempts = 0;
  const maxTotalAttempts = 50; // Limite total de tentativas para evitar loop infinito
  let remainingSeconds = maxWaitSeconds;
  let retryAttempts = 0;

  while (remainingSeconds > 0 && totalAttempts < maxTotalAttempts) {
    totalAttempts++;
    log(`[${accountId}] Tentativa ${totalAttempts}/${maxTotalAttempts} de espera de cooldown`);
    await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
    if (!(await checkAndResolveCaptcha(page, accountId))) {
      log(`[${accountId}] CAPTCHA detectado durante espera de cooldown`);
      await delay(BUSY_TIMER_RETRY_DELAY);
      continue;
    }
    const timerSeconds = await getBusyTimerSeconds(page, accountId);
    if (timerSeconds === null) {
      retryAttempts++;
      if (retryAttempts >= BUSY_TIMER_RETRIES) {
        log(`[${accountId}] busyTimer não encontrado após ${BUSY_TIMER_RETRIES} tentativas`);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        retryAttempts = 0;
        continue;
      }
      log(`[${accountId}] busyTimer não encontrado, aguardando ${BUSY_TIMER_RETRY_DELAY/1000} segundos`);
      await delay(BUSY_TIMER_RETRY_DELAY);
      continue;
    }
    retryAttempts = 0;
    if (timerSeconds <= 0) {
      log(`[${accountId}] Cooldown finalizado`);
      return;
    }
    remainingSeconds = Math.min(timerSeconds, maxWaitSeconds);
    log(`[${accountId}] Aguardando ${remainingSeconds} segundos`);
    await delay(Math.min(remainingSeconds, 60) * 1000);
  }
  if (totalAttempts >= maxTotalAttempts) {
    log(`[${accountId}] Máximo de tentativas (${maxTotalAttempts}) atingido em waitForCooldown`);
    return;
  }
  if (remainingSeconds <= 0) {
    log(`[${accountId}] Tempo máximo de espera (${maxWaitSeconds} segundos) atingido`);
    return;
  }
}

async function clearCookies(page, cookiesPath, accountId) {
  try {
    await page.deleteCookie(...(await page.cookies()));
    if (fs.existsSync(cookiesPath)) {
      fs.unlinkSync(cookiesPath);
      log(`[${accountId}] Cookies limpos e arquivo ${cookiesPath} removido`);
    }
    return true;
  } catch (error) {
    log(`[${accountId}] Erro ao limpar cookies: ${error.message}`);
    return false;
  }
}

async function performLogout(page, cookiesPath, accountId) {
  try {
    await ensurePage(page, LOGOUT_URL, 'domcontentloaded', accountId);
    await clearCookies(page, cookiesPath, accountId);
    log(`[${accountId}] Logout realizado com sucesso`);
    return true;
  } catch (error) {
    log(`[${accountId}] Erro ao realizar logout: ${error.message}`);
    await clearCookies(page, cookiesPath, accountId);
    return false;
  }
}

async function resolveCaptcha(page, attempt = 1, accountId) {
  if (attempt > MAX_CAPTCHA_ATTEMPTS) {
    log(`[${accountId}] Limite de ${MAX_CAPTCHA_ATTEMPTS} tentativas de CAPTCHA atingido`);
    const cookiesPath = `${ACCOUNTS_DIR}/${accountId}/cookies.json`;
    await clearCookies(page, cookiesPath, accountId);
    await delay(CAPTCHA_LOCKOUT_MINUTES * 60 * 1000);
    return false;
  }
  await ensurePage(page, CAPTCHA_URL, 'domcontentloaded', accountId);
  log(`[${accountId}] Tentativa ${attempt} de resolução do CAPTCHA`);
  let captchaFilePath;
  try {
    const captchaImagesSelector = 'div.im img.bot-trap';
    await page.waitForSelector(captchaImagesSelector, { visible: true, timeout: 15000 }).catch(() => {
      log(`[${accountId}] Imagens de CAPTCHA não encontradas, verificando estado da página`);
    });
    const captchaImages = await page.$$(captchaImagesSelector);
    log(`[${accountId}] Encontradas ${captchaImages.length} imagens de CAPTCHA`);

    // Verificar se estamos realmente na página de CAPTCHA e se as imagens são válidas
    if (captchaImages.length !== 4) {
      log(`[${accountId}] Número de imagens inválido (${captchaImages.length}), verificando página atual`);
      const currentPage = await identifyCurrentPage(page, accountId);
      if (currentPage === 'pvp_ready' || currentPage === 'pvp_cooldown') {
        log(`[${accountId}] Já na página de PvP, assumindo CAPTCHA resolvido`);
        return true;
      }
      log(`[${accountId}] Erro: Esperadas 4 imagens, recarregando...`);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
      await naturalDelay(30000, 60000);
      return await resolveCaptcha(page, attempt, accountId);
    }

    for (let i = 0; i < captchaImages.length; i++) {
      const height = await page.evaluate(el => el.height, captchaImages[i]);
      if (height === 0) {
        log(`[${accountId}] Imagem ${i + 1} tem altura 0, recarregando...`);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await naturalDelay(30000, 60000);
        return await resolveCaptcha(page, attempt, accountId);
      }
    }

    const imageBuffers = await Promise.all(captchaImages.map(img => img.screenshot()));
    const combinedImage = await combineImages(imageBuffers);
    captchaFilePath = `${ACCOUNTS_DIR}/${accountId}/combined_captcha_${getTimestamp()}.png`;
    fs.writeFileSync(captchaFilePath, combinedImage);
    log(`[${accountId}] Imagem de CAPTCHA salva em: ${captchaFilePath}`);

    const stats = fs.statSync(captchaFilePath);
    if (stats.size < 1000) {
      log(`[${accountId}] Imagem de CAPTCHA muito pequena (${stats.size} bytes)`);
      fs.unlinkSync(captchaFilePath);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
      await naturalDelay(30000, 60000);
      return await resolveCaptcha(page, attempt, accountId);
    }

    let captchaCode;
    try {
      const result = await captchaSolver.imageCaptcha({
        body: combinedImage.toString('base64'),
        lang: 'en',
      });
      captchaCode = result.data;
      log(`[${accountId}] Código do CAPTCHA: ${captchaCode}`);
      if (!captchaCode || !/^\d{4}$/.test(captchaCode)) {
        log(`[${accountId}] Código inválido: ${captchaCode}`);
        fs.unlinkSync(captchaFilePath);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await naturalDelay(30000, 60000);
        return await resolveCaptcha(page, attempt, accountId);
      }
    } catch (error) {
      log(`[${accountId}] Erro ao resolver CAPTCHA: ${error.message}`);
      if (fs.existsSync(captchaFilePath)) {
        fs.unlinkSync(captchaFilePath);
      }
      if (error.message.includes('521') || error.message.includes('Unexpected Error') || error.message.includes('unable to be solved')) {
        log(`[${accountId}] Erro temporário no 2Captcha ou CAPTCHA inválido, recarregando...`);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await naturalDelay(30000, 60000);
        return await resolveCaptcha(page, attempt, accountId);
      }
      throw error;
    }

    const inputSelector = 'input#id_number[name="number"]';
    await page.waitForSelector(inputSelector, { visible: true, timeout: 15000 });
    const isEnabled = await page.evaluate((sel) => {
      const input = document.querySelector(sel);
      return input && !input.disabled && !input.readOnly;
    }, inputSelector);
    if (!isEnabled) {
      log(`[${accountId}] Campo de CAPTCHA desabilitado`);
      if (fs.existsSync(captchaFilePath)) {
        fs.unlinkSync(captchaFilePath);
      }
      await naturalDelay(30000, 60000);
      return false;
    }

    await page.click(inputSelector);
    await page.focus(inputSelector);
    await naturalDelay(3000, 8000);
    await page.evaluate((sel, val) => {
      const input = document.querySelector(sel);
      input.value = '';
      input.value = val;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, inputSelector, captchaCode);

    const inputValue = await page.evaluate((sel) => document.querySelector(sel).value, inputSelector);
    if (inputValue !== captchaCode) {
      log(`[${accountId}] Erro: Campo contém "${inputValue}" em vez de "${captchaCode}"`);
      if (fs.existsSync(captchaFilePath)) {
        fs.unlinkSync(captchaFilePath);
      }
      await naturalDelay(30000, 60000);
      return false;
    }

    log(`[${accountId}] Campo de CAPTCHA preenchido`);
    await naturalDelay(2000, 5000);
    log(`[${accountId}] Pressionando Enter...`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Verificar se a página mudou ou se estamos na página de PvP
    const currentPage = await identifyCurrentPage(page, accountId);
    if (currentPage === 'pvp_ready' || currentPage === 'pvp_cooldown') {
      log(`[${accountId}] CAPTCHA resolvido, página de PvP detectada (${page.url()})`);
      if (fs.existsSync(captchaFilePath)) {
        fs.unlinkSync(captchaFilePath);
        log(`[${accountId}] Imagem de CAPTCHA apagada`);
      }
      await naturalDelay(15000, 30000);
      await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
      return true;
    }

    // Tentar detectar navegação com timeout maior
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {
      log(`[${accountId}] Nenhuma navegação detectada após CAPTCHA, verificando página atual`);
    });

    if (page.url().includes('anti-bot')) {
      log(`[${accountId}] Falha ao resolver CAPTCHA, ainda em anti-bot`);
      if (fs.existsSync(captchaFilePath)) {
        fs.unlinkSync(captchaFilePath);
      }
      await naturalDelay(30000, 60000);
      return await resolveCaptcha(page, attempt + 1, accountId);
    }

    // Verificar novamente a página atual
    const finalPageCheck = await identifyCurrentPage(page, accountId);
    if (finalPageCheck === 'pvp_ready' || finalPageCheck === 'pvp_cooldown') {
      log(`[${accountId}] CAPTCHA resolvido, página de PvP detectada após verificação final (${page.url()})`);
      if (fs.existsSync(captchaFilePath)) {
        fs.unlinkSync(captchaFilePath);
        log(`[${accountId}] Imagem de CAPTCHA apagada`);
      }
      await naturalDelay(15000, 30000);
      await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
      return true;
    }

    log(`[${accountId}] Página inesperada após CAPTCHA: ${page.url()}`);
    if (fs.existsSync(captchaFilePath)) {
      fs.unlinkSync(captchaFilePath);
    }
    await naturalDelay(30000, 60000);
    return await resolveCaptcha(page, attempt + 1, accountId);
  } catch (error) {
    log(`[${accountId}] Erro ao resolver CAPTCHA: ${error.message}`);
    if (fs.existsSync(captchaFilePath)) {
      fs.unlinkSync(captchaFilePath);
    }
    if (error.message.includes('Protocol error') || error.message.includes('net::ERR')) {
      log(`[${accountId}] Erro de rede, recarregando...`);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
      await naturalDelay(30000, 60000);
      return await resolveCaptcha(page, attempt, accountId);
    }
    await naturalDelay(30000, 60000);
    return await resolveCaptcha(page, attempt + 1, accountId);
  }
}

async function checkAndResolveCaptcha(page, accountId) {
  if (page.url().includes('anti-bot')) {
    log(`[${accountId}] Página de CAPTCHA detectada`);
    return await resolveCaptcha(page, 1, accountId);
  }
  return true;
}

async function useHastePotions(page, remainingHastePotions, accountId) {
  const USE_HASTE_POTIONS = true;
  if (!USE_HASTE_POTIONS || remainingHastePotions < HASTE_POTIONS_PER_USE) {
    log(`[${accountId}] Nenhuma Haste Potion disponível (restantes: ${remainingHastePotions})`);
    return { success: false, remaining: remainingHastePotions };
  }
  log(`[${accountId}] Usando ${HASTE_POTIONS_PER_USE} Haste Potions...`);
  try {
    await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
    if (!(await checkAndResolveCaptcha(page, accountId))) {
      log(`[${accountId}] Falha ao resolver CAPTCHA antes de usar poções`);
      return { success: false, remaining: remainingHastePotions };
    }
    await randomScroll(page, accountId);
    const modalButtons = await page.$$('a[rel="modal"][href="/premium-market/use-haste/20/"]');
    if (modalButtons.length === 0) {
      log(`[${accountId}] Nenhum botão do modal encontrado`);
      await naturalDelay(30000, 120000); // Delay variável após erro
      if (Math.random() < 0.1) {
        log(`[${accountId}] Simulando abandono após falha de botão do modal`);
        return { success: false, remaining: remainingHastePotions };
      }
      return { success: false, remaining: remainingHastePotions };
    }
    const modalButton = modalButtons[0];
    await page.waitForSelector('a[rel="modal"][href="/premium-market/use-haste/20/"]', { visible: true, timeout: 10000 });
    await simulateMouseMove(page, modalButton, accountId);
    await modalButton.hover();
    log(`[${accountId}] Passou o mouse sobre o botão de Haste Potions`);
    await naturalDelay();
    await page.evaluate(() => {
      const button = document.querySelector('a[rel="modal"][href="/premium-market/use-haste/20/"]');
      if (button) {
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        button.click();
      }
    });
    log(`[${accountId}] Botão de Haste Potions clicado`);
    await page.waitForSelector('button.btn[type="submit"]', { visible: true, timeout: 10000 });
    const submitButton = await page.$('button.btn[type="submit"]');
    await simulateMouseMove(page, submitButton, accountId);
    await submitButton.hover();
    log(`[${accountId}] Passou o mouse sobre o botão de confirmação`);
    await naturalDelay();
    await submitButton.click();
    log(`[${accountId}] Botão de confirmação clicado`);
    await page.waitForSelector('a.close-modal', { visible: true, timeout: 10000 });
    const closeButton = await page.$('a.close-modal');
    await simulateMouseMove(page, closeButton, accountId);
    await closeButton.hover();
    log(`[${accountId}] Passou o mouse sobre o botão de fechar modal`);
    await naturalDelay();
    await closeButton.click();
    log(`[${accountId}] Botão "X" do modal clicado`);
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {
      log(`[${accountId}] Nenhuma navegação detectada após fechar modal`);
    });
    await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
    remainingHastePotions -= HASTE_POTIONS_PER_USE;
    log(`[${accountId}] Haste Potions restantes: ${remainingHastePotions}`);
    return { success: true, remaining: remainingHastePotions };
  } catch (error) {
    log(`[${accountId}] Erro ao usar Haste Potions: ${error.message}`);
    await naturalDelay(30000, 120000); // Delay variável após erro
    if (Math.random() < 0.1) {
      log(`[${accountId}] Simulando abandono após erro de poções`);
      return { success: false, remaining: remainingHastePotions };
    }
    return { success: false, remaining: remainingHastePotions };
  }
}

async function performLogin(page, account, cookiesPath, accountId) {
  try {
    await ensurePage(page, LOGIN_URL, 'domcontentloaded', accountId);
    await page.waitForSelector('input#id_email', { visible: true, timeout: 15000 });
    await page.waitForSelector('input#id_password', { visible: true, timeout: 15000 });
    log(`[${accountId}] Campos de email e senha encontrados`);
    const isEmailEnabled = await page.evaluate(() => {
      const emailInput = document.querySelector('input#id_email');
      return emailInput && !emailInput.disabled && !emailInput.readOnly;
    });
    if (!isEmailEnabled) {
      log(`[${accountId}] Campo de email desabilitado`);
      await naturalDelay(30000, 120000); // Delay variável após erro
      return false;
    }
    await randomScroll(page, accountId);
    const emailInput = await page.$('input#id_email');
    await simulateMouseMove(page, emailInput, accountId);
    await emailInput.click();
    await emailInput.focus();
    await naturalDelay(3000, 8000);
    await page.evaluate((email) => {
      const input = document.querySelector('input#id_email');
      input.value = '';
      input.value = email;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, account.email);
    const emailValue = await page.evaluate(() => document.querySelector('input#id_email').value);
    if (emailValue !== account.email) {
      log(`[${accountId}] Erro: Campo de email contém "${emailValue}"`);
      await naturalDelay(30000, 120000); // Delay variável após erro
      return false;
    }
    log(`[${accountId}] Campo de email preenchido`);
    const isPasswordEnabled = await page.evaluate(() => {
      const passwordInput = document.querySelector('input#id_password');
      return passwordInput && !passwordInput.disabled && !passwordInput.readOnly;
    });
    if (!isPasswordEnabled) {
      log(`[${accountId}] Campo de senha desabilitado`);
      await naturalDelay(30000, 120000); // Delay variável após erro
      return false;
    }
    const passwordInput = await page.$('input#id_password');
    await simulateMouseMove(page, passwordInput, accountId);
    await passwordInput.click();
    await passwordInput.focus();
    await naturalDelay(3000, 8000);
    await page.evaluate((password) => {
      const input = document.querySelector('input#id_password');
      input.value = '';
      input.value = password;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, account.password);
    const passwordValue = await page.evaluate(() => document.querySelector('input#id_password').value);
    if (passwordValue !== account.password) {
      log(`[${accountId}] Erro: Campo de senha contém "${passwordValue}"`);
      await naturalDelay(30000, 120000); // Delay variável após erro
      return false;
    }
    log(`[${accountId}] Campo de senha preenchido`);
    await page.waitForSelector('button.btn[type="submit"]', { visible: true, timeout: 10000 });
    const submitButton = await page.$('button.btn[type="submit"]');
    await simulateMouseMove(page, submitButton, accountId);
    await submitButton.hover();
    log(`[${accountId}] Passou o mouse sobre o botão de login`);
    await naturalDelay();
    await submitButton.click();
    log(`[${accountId}] Botão de login clicado`);
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
    log(`[${accountId}] Navegado para: ${page.url()}`);
    const isStillOnLoginPage = await page.$('input#id_email') !== null;
    if (isStillOnLoginPage) {
      log(`[${accountId}] Falha ao realizar login`);
      await naturalDelay(30000, 120000); // Delay variável após erro
      return false;
    }
    const cookies = await page.cookies();
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    log(`[${accountId}] Cookies salvos`);
    return true;
  } catch (error) {
    log(`[${accountId}] Erro ao realizar login: ${error.message}`);
    await naturalDelay(30000, 120000); // Delay variável após erro
    if (Math.random() < 0.1) {
      log(`[${accountId}] Simulando abandono após erro de login`);
      return false;
    }
    return false;
  }
}

async function identifyCurrentPage(page, accountId) {
  const currentUrl = page.url();
  log(`[${accountId}] Identificando página atual: ${currentUrl}`);
  try {
    if (currentUrl.includes('anti-bot')) {
      log(`[${accountId}] Página: CAPTCHA`);
      return 'captcha';
    }
    if (currentUrl.includes('se.lamentosa.com') && !currentUrl.includes('battlefield') && !currentUrl.includes('temple')) {
      const loginInput = await page.$('input#id_email');
      if (loginInput) {
        log(`[${accountId}] Página: Login`);
        return 'login';
      }
    }
    if (currentUrl.includes('battlefield')) {
      const pvpButton = await page.$('.btn.pvp-btn.peform-pvp');
      const busyTimer = await page.$('h2#busyTimer');
      const lifeLow = await page.evaluate(() => document.body.innerText.includes('life is too low'));
      if (lifeLow) {
        log(`[${accountId}] Página: PvP (vida baixa)`);
        return 'low_life';
      }
      if (pvpButton) {
        log(`[${accountId}] Página: PvP (pronto para atacar)`);
        return 'pvp_ready';
      }
      if (busyTimer) {
        log(`[${accountId}] Página: PvP (em cooldown)`);
        return 'pvp_cooldown';
      }
      log(`[${accountId}] Página: PvP (estado desconhecido)`);
      return 'pvp_unknown';
    }
    if (currentUrl.includes('temple')) {
      const recoveryButton = await page.$('button.recovery-btn[data-percent="50"]');
      if (recoveryButton) {
        log(`[${accountId}] Página: Templo`);
        return 'temple';
      }
    }
    log(`[${accountId}] Página desconhecida`);
    return 'unknown';
  } catch (error) {
    log(`[${accountId}] Erro ao identificar página: ${error.message}`);
    await naturalDelay(30000, 120000); // Delay variável após erro
    return 'unknown';
  }
}

async function runAccount(account) {
  const accountId = account.id;
  const accountDir = `${ACCOUNTS_DIR}/${accountId}`;
  if (!fs.existsSync(accountDir)) {
    fs.mkdirSync(accountDir, { recursive: true });
  }
  let remainingHastePotions = account.hastePotionsToUse || 0;
  if (remainingHastePotions < 0 || isNaN(remainingHastePotions)) {
    log(`[${accountId}] Valor inválido para hastePotionsToUse: ${account.hastePotionsToUse}`);
    remainingHastePotions = 0;
  }
  const cookiesPath = `${accountDir}/cookies.json`;
  const hasteStatePath = `${accountDir}/haste_state.json`;
  let lastCookieReset = Date.now();
  let lastPause = Date.now();
  let lastLogout = Date.now();
  let lastCaptchaResolved = 0; // Timestamp do último CAPTCHA resolvido
  const CAPTCHA_COOLDOWN_SECONDS = 60; // Evitar novo CAPTCHA por 60 segundos após um bem-sucedido
  let nextPauseInterval = Math.random() * (PAUSE_INTERVAL_MAX_SECONDS - PAUSE_INTERVAL_MIN_SECONDS) + PAUSE_INTERVAL_MIN_SECONDS;
  let nextLogoutInterval = Math.random() * (LOGOUT_INTERVAL_MAX_SECONDS - LOGOUT_INTERVAL_MIN_SECONDS) + LOGOUT_INTERVAL_MIN_SECONDS;
  let loopIterations = 0;
  let errorCount = 0;
  let lastErrorTime = Date.now();

  if (fs.existsSync(hasteStatePath)) {
    try {
      const hasteState = JSON.parse(fs.readFileSync(hasteStatePath));
      remainingHastePotions = hasteState.remainingHastePotions || remainingHastePotions;
      log(`[${accountId}] Estado de Haste Potions carregado: ${remainingHastePotions}`);
    } catch (error) {
      log(`[${accountId}] Erro ao carregar haste_state.json: ${error.message}`);
    }
  }

  let browser;
  let page;
  try {
    const headless = account.headless !== false;
    browser = await puppeteer.launch({ headless });
    log(`[${accountId}] Navegador iniciado em modo ${headless ? 'headless' : 'visível'}`);
    page = await browser.newPage();
    const randomUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const randomAcceptLanguage = LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)].join(',');
    const randomAccept = ACCEPT_HEADERS[Math.floor(Math.random() * ACCEPT_HEADERS.length)];
    const randomResolution = RESOLUTIONS[Math.floor(Math.random() * RESOLUTIONS.length)];
    await page.setViewport({
      width: randomResolution.width + Math.floor(Math.random() * 20 - 10),
      height: randomResolution.height + Math.floor(Math.random() * 20 - 10)
    });
    log(`[${accountId}] Resolução definida: ${randomResolution.width}x${randomResolution.height}`);
    await page.setUserAgent(randomUserAgent);
    await page.setExtraHTTPHeaders({
      'Accept-Language': randomAcceptLanguage,
      'Accept': randomAccept,
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Dest': 'document'
    });
    log(`[${accountId}] Usando User-Agent: ${randomUserAgent}`);
    log(`[${accountId}] Usando Accept-Language: ${randomAcceptLanguage}`);
    log(`[${accountId}] Usando Accept: ${randomAccept}`);

    // Randomizar propriedades do navegador e spoofar telemetria
    await randomizeBrowserProperties(page, accountId);
    await spoofTelemetry(page, accountId);

    // Simular contexto de usuário
    await simulateUserContext(page, cookiesPath, accountId);
    if (fs.existsSync(cookiesPath)) {
      try {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath));
        await page.setCookie(...cookies);
        log(`[${accountId}] Cookies carregados`);
      } catch (error) {
        log(`[${accountId}] Erro ao carregar cookies: ${error.message}`);
      }
    }
    log(`[${accountId}] Verificando página inicial...`);
    await page.goto(PVP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {
      log(`[${accountId}] Erro ao acessar PVP_URL inicial`);
      errorCount++;
    });
    let currentPage = await identifyCurrentPage(page, accountId);
    switch (currentPage) {
      case 'login':
        log(`[${accountId}] Iniciando na página de login`);
        if (!(await performLogin(page, account, cookiesPath, accountId))) {
          log(`[${accountId}] Falha no login inicial`);
          errorCount++;
          return;
        }
        break;
      case 'captcha':
        log(`[${accountId}] Iniciando na página de CAPTCHA`);
        if (!(await resolveCaptcha(page, 1, accountId))) {
          log(`[${accountId}] Falha ao resolver CAPTCHA inicial`);
          errorCount++;
          currentPage = await identifyCurrentPage(page, accountId);
          if (currentPage === 'login') {
            if (!(await performLogin(page, account, cookiesPath, accountId))) {
              log(`[${accountId}] Falha no login após CAPTCHA`);
              errorCount++;
              return;
            }
          }
        } else {
          lastCaptchaResolved = Date.now();
        }
        break;
      case 'temple':
        log(`[${accountId}] Iniciando na página do templo`);
        try {
          await page.waitForSelector('button.recovery-btn[data-percent="50"]', { visible: true, timeout: 5000 });
          for (let j = 0; j < 2; j++) {
            const recoveryButton = await page.$('button.recovery-btn[data-percent="50"]');
            if (!recoveryButton) {
              log(`[${accountId}] Botão de recuperação não encontrado na tentativa ${j + 1}`);
              break;
            }
            await page.waitForSelector('button.recovery-btn[data-percent="50"]', { visible: true, timeout: 5000 });
            await simulateMouseMove(page, recoveryButton, accountId);
            await recoveryButton.hover();
            log(`[${accountId}] Passou o mouse sobre o botão de recuperação (tentativa ${j + 1})`);
            await naturalDelay();
            await recoveryButton.click();
            log(`[${accountId}] Botão de recuperação clicado (tentativa ${j + 1})`);
            await naturalDelay();
          }
          await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
        } catch (error) {
          log(`[${accountId}] Erro ao curar no templo: ${error.message}`);
          errorCount++;
          await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
        }
        break;
      case 'low_life':
        log(`[${accountId}] Iniciando com vida baixa`);
        try {
          await ensurePage(page, TEMPLE_URL, 'domcontentloaded', accountId);
          if (!(await checkAndResolveCaptcha(page, accountId))) {
            log(`[${accountId}] Falha ao resolver CAPTCHA antes de curar`);
            errorCount++;
            break;
          }
          await page.waitForSelector('button.recovery-btn[data-percent="50"]', { visible: true, timeout: 5000 });
          for (let j = 0; j < 2; j++) {
            const recoveryButton = await page.$('button.recovery-btn[data-percent="50"]');
            if (!recoveryButton) {
              log(`[${accountId}] Botão de recuperação não encontrado na tentativa ${j + 1}`);
              break;
            }
            await page.waitForSelector('button.recovery-btn[data-percent="50"]', { visible: true, timeout: 5000 });
            await simulateMouseMove(page, recoveryButton, accountId);
            await recoveryButton.hover();
            log(`[${accountId}] Passou o mouse sobre o botão de recuperação (tentativa ${j + 1})`);
            await naturalDelay();
            await recoveryButton.click();
            log(`[${accountId}] Botão de recuperação clicado (tentativa ${j + 1})`);
            await naturalDelay();
          }
          await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
        } catch (error) {
          log(`[${accountId}] Erro ao curar no templo: ${error.message}`);
          errorCount++;
          await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
        }
        break;
      case 'pvp_ready':
      case 'pvp_cooldown':
      case 'pvp_unknown':
        log(`[${accountId}] Iniciando na página de PvP`);
        await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
        break;
      case 'unknown':
        log(`[${accountId}] Página desconhecida, verificando sessão...`);
        if (!(await checkSession(page, accountId))) {
          log(`[${accountId}] Sessão expirada, tentando login...`);
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
          if (!(await performLogin(page, account, cookiesPath, accountId))) {
            log(`[${accountId}] Falha no login`);
            errorCount++;
            return;
          }
        }
        await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
        break;
    }
   while (true) {
  loopIterations++;
  if (loopIterations > MAX_LOOP_ITERATIONS) {
    log(`[${accountId}] Máximo de iterações (${MAX_LOOP_ITERATIONS}) atingido`);
    return;
  }
  // Verificar limite de erros
  const currentTime = Date.now();
  if (errorCount >= 5 && (currentTime - lastErrorTime) / 1000 < 600) {
    const pauseSeconds = Math.random() * (600 - 300) + 300;
    log(`[${accountId}] Limite de erros atingido, pausando por ${Math.round(pauseSeconds)} segundos`);
    await delay(pauseSeconds * 1000);
    errorCount = 0;
  }
  const secondsSinceLastCookieReset = (currentTime - lastCookieReset) / 1000;
  const secondsSinceLastPause = (currentTime - lastPause) / 1000;
  const secondsSinceLastLogout = (currentTime - lastLogout) / 1000;
  if (secondsSinceLastPause > nextPauseInterval) {
    const pauseDuration = Math.random() * (PAUSE_MAX_SECONDS - PAUSE_MIN_SECONDS) + PAUSE_MIN_SECONDS;
    log(`[${accountId}] Iniciando pausa aleatória de ${Math.round(pauseDuration)} segundos`);
    await delay(pauseDuration * 1000);
    lastPause = Date.now();
    nextPauseInterval = Math.random() * (PAUSE_INTERVAL_MAX_SECONDS - PAUSE_INTERVAL_MIN_SECONDS) + PAUSE_INTERVAL_MIN_SECONDS;
    log(`[${accountId}] Pausa finalizada. Próxima pausa em ${Math.round(nextPauseInterval)} segundos`);
  }
  const cookieResetInterval = Math.random() * (COOKIE_RESET_MAX_SECONDS - COOKIE_RESET_MIN_SECONDS) + COOKIE_RESET_MIN_SECONDS;
  if (secondsSinceLastCookieReset > cookieResetInterval) {
    log(`[${accountId}] Rotação de cookies após ${Math.round(secondsSinceLastCookieReset)} segundos`);
    if (await clearCookies(page, cookiesPath, accountId)) {
      log(`[${accountId}] Realizando login após limpeza de cookies`);
      await simulateUserContext(page, cookiesPath, accountId);
      if (!(await performLogin(page, account, cookiesPath, accountId))) {
        log(`[${accountId}] Falha ao relogar, aguardando 5 minutos`);
        errorCount++;
        lastErrorTime = currentTime;
        await delay(5 * 60 * 1000);
        continue;
      }
      lastCookieReset = currentTime;
    }
  }
  if (secondsSinceLastLogout > nextLogoutInterval) {
    log(`[${accountId}] Iniciando logout após ${Math.round(secondsSinceLastLogout)} segundos`);
    if (await performLogout(page, cookiesPath, accountId)) {
      log(`[${accountId}] Realizando login após logout`);
      await simulateUserContext(page, cookiesPath, accountId);
      if (!(await performLogin(page, account, cookiesPath, accountId))) {
        log(`[${accountId}] Falha ao relogar, aguardando 5 minutos`);
        errorCount++;
        lastErrorTime = currentTime;
        await delay(5 * 60 * 1000);
        continue;
      }
    }
    lastLogout = currentTime;
    nextLogoutInterval = Math.random() * (LOGOUT_INTERVAL_MAX_SECONDS - LOGOUT_INTERVAL_MIN_SECONDS) + LOGOUT_INTERVAL_MIN_SECONDS;
    log(`[${accountId}] Logout/login concluído. Próximo logout em ${Math.round(nextLogoutInterval)} segundos`);
  }
  await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
  let currentPage = await identifyCurrentPage(page, accountId);
  if (currentPage === 'login') {
    log(`[${accountId}] Detectado logout, realizando login`);
    if (!(await performLogin(page, account, cookiesPath, accountId))) {
      log(`[${accountId}] Falha ao relogar, aguardando 5 minutos`);
      errorCount++;
      lastErrorTime = currentTime;
      await delay(5 * 60 * 1000);
      continue;
    }
    await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
    continue;
  }
  const secondsSinceLastCaptcha = (Date.now() - lastCaptchaResolved) / 1000;
  if (secondsSinceLastCaptcha < CAPTCHA_COOLDOWN_SECONDS) {
    log(`[${accountId}] Ignorando verificação de CAPTCHA (ultimo resolvido há ${Math.round(secondsSinceLastCaptcha)} segundos)`);
  } else if (!(await checkAndResolveCaptcha(page, accountId))) {
    log(`[${accountId}] Falha ao resolver CAPTCHA`);
    errorCount++;
    lastErrorTime = currentTime;
    currentPage = await identifyCurrentPage(page, accountId);
    if (currentPage === 'login') {
      log(`[${accountId}] Detectado logout após CAPTCHA`);
      if (!(await performLogin(page, account, cookiesPath, accountId))) {
        log(`[${accountId}] Falha ao relogar, aguardando 5 minutos`);
        errorCount++;
        lastErrorTime = currentTime;
        await delay(5 * 60 * 1000);
        continue;
      }
    }
    continue;
  } else {
    lastCaptchaResolved = Date.now();
  }
  if (currentPage === 'pvp_ready') {
    // Página pronta para atacar, executar ataque imediatamente
    try {
      await page.waitForSelector('.btn.pvp-btn.peform-pvp', { visible: true, timeout: 5000 });
      const attackButton = await page.$('.btn.pvp-btn.peform-pvp');
      if (!attackButton) {
        log(`[${accountId}] Botão de ataque não encontrado`);
        errorCount++;
        lastErrorTime = currentTime;
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        continue;
      }
      await simulateMouseMove(page, attackButton, accountId);
      await attackButton.hover();
      log(`[${accountId}] Passou o mouse sobre o botão de ataque`);
      await naturalDelay();
      await attackButton.click();
      log(`[${accountId}] Botão de ataque clicado`);
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {
        log(`[${accountId}] Nenhuma navegação detectada após ataque`);
      });
      await naturalDelay(2000, 5000);
      currentPage = await identifyCurrentPage(page, accountId);
      if (currentPage === 'pvp_cooldown') {
        log(`[${accountId}] Ataque realizado, agora em cooldown`);
        await waitForCooldown(page, accountId);
      } else if (currentPage === 'low_life') {
        log(`[${accountId}] Vida baixa após ataque, navegando para o templo`);
        await ensurePage(page, TEMPLE_URL, 'domcontentloaded', accountId);
        try {
          await page.waitForSelector('button.recovery-btn[data-percent="50"]', { visible: true, timeout: 5000 });
          for (let j = 0; j < 2; j++) {
            const recoveryButton = await page.$('button.recovery-btn[data-percent="50"]');
            if (!recoveryButton) {
              log(`[${accountId}] Botão de recuperação não encontrado na tentativa ${j + 1}`);
              break;
            }
            await page.waitForSelector('button.recovery-btn[data-percent="50"]', { visible: true, timeout: 5000 });
            await simulateMouseMove(page, recoveryButton, accountId);
            await recoveryButton.hover();
            log(`[${accountId}] Passou o mouse sobre o botão de recuperação (tentativa ${j + 1})`);
            await naturalDelay();
            await recoveryButton.click();
            log(`[${accountId}] Botão de recuperação clicado (tentativa ${j + 1})`);
            await naturalDelay();
          }
          await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
        } catch (error) {
          log(`[${accountId}] Erro ao curar no templo após ataque: ${error.message}`);
          errorCount++;
          lastErrorTime = currentTime;
          await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
          continue;
        }
      } else if (currentPage === 'login') {
        log(`[${accountId}] Detectado logout após ataque, realizando login`);
        if (!(await performLogin(page, account, cookiesPath, accountId))) {
          log(`[${accountId}] Falha ao relogar, aguardando 5 minutos`);
          errorCount++;
          lastErrorTime = currentTime;
          await delay(5 * 60 * 1000);
          continue;
        }
        await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
        continue;
      } else if (currentPage === 'pvp_unknown' && page.url().includes('battle-log')) {
        log(`[${accountId}] Página de log de batalha detectada, retornando ao PvP`);
        await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
        continue;
      } else {
        log(`[${accountId}] Estado inesperado após ataque: ${currentPage}`);
        await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
        continue;
      }
    } catch (error) {
      log(`[${accountId}] Erro ao executar ataque PvP: ${error.message}`);
      errorCount++;
      lastErrorTime = currentTime;
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
      continue;
    }
  } else if (currentPage === 'low_life') {
    log(`[${accountId}] Vida baixa, navegando para o templo`);
    await ensurePage(page, TEMPLE_URL, 'domcontentloaded', accountId);
    try {
      await page.waitForSelector('button.recovery-btn[data-percent="50"]', { visible: true, timeout: 5000 });
      for (let j = 0; j < 2; j++) {
        const recoveryButton = await page.$('button.recovery-btn[data-percent="50"]');
        if (!recoveryButton) {
          log(`[${accountId}] Botão de recuperação não encontrado na tentativa ${j + 1}`);
          break;
        }
        await page.waitForSelector('button.recovery-btn[data-percent="50"]', { visible: true, timeout: 5000 });
        await simulateMouseMove(page, recoveryButton, accountId);
        await recoveryButton.hover();
        log(`[${accountId}] Passou o mouse sobre o botão de recuperação (tentativa ${j + 1})`);
        await naturalDelay();
        await recoveryButton.click();
        log(`[${accountId}] Botão de recuperação clicado (tentativa ${j + 1})`);
        await naturalDelay();
      }
      await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
    } catch (error) {
      log(`[${accountId}] Erro ao curar no templo: ${error.message}`);
      errorCount++;
      lastErrorTime = currentTime;
      await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
      continue;
    }
  } else if (currentPage === 'pvp_cooldown') {
    log(`[${accountId}] Em cooldown, aguardando...`);
    await waitForCooldown(page, accountId);
    await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
  } else if (currentPage === 'pvp_unknown' && page.url().includes('battle-log')) {
    log(`[${accountId}] Página de log de batalha detectada, retornando ao PvP`);
    await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
    continue;
  } else if (currentPage === 'pvp_unknown') {
    log(`[${accountId}] Estado de PvP desconhecido, recarregando...`);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
    currentPage = await identifyCurrentPage(page, accountId);
    continue;
  } else {
    log(`[${accountId}] Página inesperada: ${currentPage}, navegando para PvP`);
    await ensurePage(page, PVP_URL, 'domcontentloaded', accountId);
    continue;
  }

  // Atualizar contagem de poções apenas após cooldown, cura ou em intervalos
  if (currentPage === 'pvp_cooldown' || currentPage === 'pvp_ready') {
    const newHasteCount = await getHastePotionsCount(page, accountId);
    if (newHasteCount > remainingHastePotions) {
      remainingHastePotions = newHasteCount;
      log(`[${accountId}] Contagem de Haste Potions atualizada: ${remainingHastePotions}`);
    } else if (newHasteCount < remainingHastePotions) {
      log(`[${accountId}] Contagem de poções menor que esperado (${newHasteCount} < ${remainingHastePotions}), mantendo valor atual`);
    }
    // Salvar estado das poções
    try {
      fs.writeFileSync(hasteStatePath, JSON.stringify({ remainingHastePotions }, null, 2));
      log(`[${accountId}] Estado de Haste Potions salvo: ${remainingHastePotions}`);
    } catch (error) {
      log(`[${accountId}] Erro ao salvar haste_state.json: ${error.message}`);
    }
    // Usar Haste Potions se necessário
    if (remainingHastePotions >= HASTE_POTIONS_PER_USE) {
      const { success, remaining } = await useHastePotions(page, remainingHastePotions, accountId);
      if (success) {
        remainingHastePotions = remaining;
        try {
          fs.writeFileSync(hasteStatePath, JSON.stringify({ remainingHastePotions }, null, 2));
          log(`[${accountId}] Estado de Haste Potions atualizado após uso: ${remainingHastePotions}`);
        } catch (error) {
          log(`[${accountId}] Erro ao salvar haste_state.json após uso: ${error.message}`);
        }
      } else {
        errorCount++;
        lastErrorTime = currentTime;
      }
    }
  }

  // Visitar página aleatória para simular comportamento humano
  if (Math.random() < 0.3 && currentPage !== 'pvp_ready') {
    await visitRandomPage(page, accountId);
  }

  // Salvar estado final das poções
  try {
    fs.writeFileSync(hasteStatePath, JSON.stringify({ remainingHastePotions }, null, 2));
    log(`[${accountId}] Estado final de Haste Potions salvo: ${remainingHastePotions}`);
  } catch (error) {
    log(`[${accountId}] Erro ao salvar haste_state.json final: ${error.message}`);
  }
}
  } catch (error) {
    log(`[${accountId}] Erro crítico na execução: ${error.message}`);
    errorCount++;
    lastErrorTime = Date.now();
  } finally {
    // Salvar estado das poções antes de fechar
    try {
      fs.writeFileSync(hasteStatePath, JSON.stringify({ remainingHastePotions }, null, 2));
      log(`[${accountId}] Estado de Haste Potions salvo antes de fechar: ${remainingHastePotions}`);
    } catch (error) {
      log(`[${accountId}] Erro ao salvar haste_state.json no finally: ${error.message}`);
    }
    // Fechar navegador
    if (page) {
      try {
        await page.close();
        log(`[${accountId}] Página fechada`);
      } catch (error) {
        log(`[${accountId}] Erro ao fechar página: ${error.message}`);
      }
    }
    if (browser) {
      try {
        await browser.close();
        log(`[${accountId}] Navegador fechado`);
      } catch (error) {
        log(`[${accountId}] Erro ao fechar navegador: ${error.message}`);
      }
    }
  }
}

// Função principal para executar múltiplas contas
async function runMultipleAccounts() {
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    log(`Arquivo ${ACCOUNTS_FILE} não encontrado`);
    return;
  }

  let accounts;
  try {
    const raw = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'));
    accounts = raw.accounts;
    if (!Array.isArray(accounts)) {
      throw new Error("Formato inválido: 'accounts' não é uma lista");
    }
    log(`Carregadas ${accounts.length} contas de ${ACCOUNTS_FILE}`);
  } catch (error) {
    log(`Erro ao carregar ${ACCOUNTS_FILE}: ${error.message}`);
    return;
  }

  for (const account of accounts) {
    if (!account.id || !account.email || !account.password) {
      log(`Conta inválida: ${JSON.stringify(account)}`);
      continue;
    }
    log(`Iniciando execução da conta ${account.id}`);
    await runAccount(account);
    const delayBetweenAccounts = Math.random() * (300 - 60) + 60;
    log(`Aguardando ${Math.round(delayBetweenAccounts)} segundos antes da próxima conta`);
    await delay(delayBetweenAccounts * 1000);
  }
}

// Executar o script
(async () => {
  try {
    if (!fs.existsSync(ACCOUNTS_DIR)) {
      fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
      log(`Diretório ${ACCOUNTS_DIR} criado`);
    }
    await runMultipleAccounts();
    log('Execução de todas as contas finalizada');
  } catch (error) {
    log(`Erro na execução principal: ${error.message}`);
  }
})();