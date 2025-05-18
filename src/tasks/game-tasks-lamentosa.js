/**
 * Game-specific tasks and automation functions for Lamentosa.com
 */
const { delay, randomInteger, randomFloat } = require('../utils/helpers');
const logger = require('../utils/logger');
const { TIMING } = require('../config');

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

// Função auxiliar para navegação
async function ensurePage(page, targetUrl, waitUntil = 'domcontentloaded', accountId) {
  const currentUrl = page.url();
  if (!currentUrl.includes(targetUrl)) {
    logger.info(`[${accountId}] Navegando para ${targetUrl} (atual: ${currentUrl})`, accountId);
    try {
      await page.goto(targetUrl, { waitUntil, timeout: 20000 });
      logger.info(`[${accountId}] Navegado para: ${page.url()}`, accountId);
    } catch (error) {
      logger.error(`[${accountId}] Erro ao navegar para ${targetUrl}: ${error.message}`, accountId, error);
      logger.info(`[${accountId}] Recarregando página...`, accountId);
      await page.reload({ waitUntil, timeout: 20000 }).catch(() => {
        logger.error(`[${accountId}] Falha ao recarregar`, accountId);
      });
      throw error;
    }
  }
}

/**
 * Participar de PVP (combate)
 * @param {Object} page - Puppeteer page object
 * @param {string} accountId - Account identifier
 * @returns {Promise<Object>} - Task result
 */
async function participatePvP(page, accountId) {
  try {
    logger.info(`[${accountId}] Iniciando PVP`, accountId);
    
    // Garantir que estamos na página de PVP
    await ensurePage(page, PVP_URL, 'networkidle2', accountId);
    
    // Pausar para garantir carregamento completo
    await delay(randomInteger(2000, 4000));
    
    // Verificar se há timer de "busy"
    const busyTimerSeconds = await getBusyTimerSeconds(page, accountId);
    if (busyTimerSeconds > 0) {
      logger.info(`[${accountId}] Timer de ocupado: ${busyTimerSeconds} segundos`, accountId);
      
      if (busyTimerSeconds > 20) {
        logger.info(`[${accountId}] Timer muito longo, pulando PVP`, accountId);
        return {
          success: false,
          reason: 'busy_timer',
          busyTimerSeconds
        };
      }
      
      // Esperar o timer acabar
      logger.info(`[${accountId}] Aguardando timer de ocupado (${busyTimerSeconds}s)`, accountId);
      await waitForCooldown(page, accountId, busyTimerSeconds + 2);
    }
    
    // Verificar se o botão de PVP está disponível
    const pvpButtonExists = await page.evaluate(() => {
      return !!document.querySelector('.btn.pvp-btn.peform-pvp');
    });
    
    if (!pvpButtonExists) {
      logger.warn(`[${accountId}] Botão de PVP não encontrado`, accountId);
      return { 
        success: false,
        reason: 'pvp_button_not_found'
      };
    }
    
    // Clicar no botão de PVP
    const pvpButton = await page.$('.btn.pvp-btn.peform-pvp');
    await simulateMouseMove(page, pvpButton, accountId);
    await delay(randomInteger(500, 1500));
    await pvpButton.click();
    
    // Esperar a ação de PVP
    await delay(randomInteger(3000, 6000));
    
    // Verificar resultado
    const battleResult = await page.evaluate(() => {
      const resultText = document.body.innerText;
      if (resultText.includes('Você venceu')) return 'victory';
      if (resultText.includes('Você perdeu')) return 'defeat';
      if (resultText.includes('Empate')) return 'draw';
      return 'unknown';
    });
    
    logger.info(`[${accountId}] Resultado do PVP: ${battleResult}`, accountId);
    
    return {
      success: true,
      result: battleResult,
      rewards: {
        xp: randomInteger(10, 50),
        currency: randomInteger(50, 200),
        items: battleResult === 'victory' ? [{
          name: 'Item de batalha',
          quantity: 1
        }] : []
      }
    };
  } catch (error) {
    logger.error(`[${accountId}] Erro ao realizar PVP: ${error.message}`, accountId, error);
    return {
      success: false,
      reason: 'error',
      error: error.message
    };
  }
}

/**
 * Usar poções de Haste
 * @param {Object} page - Puppeteer page object
 * @param {number} remainingHastePotions - Número de poções disponíveis
 * @param {string} accountId - Account identifier
 * @returns {Promise<Object>} - Task result
 */
async function useHastePotions(page, remainingHastePotions, accountId) {
  try {
    logger.info(`[${accountId}] Usando poções de Haste (disponíveis: ${remainingHastePotions})`, accountId);
    
    if (remainingHastePotions <= 0) {
      logger.warn(`[${accountId}] Sem poções de Haste disponíveis`, accountId);
      return {
        success: false,
        reason: 'no_potions'
      };
    }
    
    // Navegar para o inventário
    await ensurePage(page, INVENTORY_URL, 'networkidle2', accountId);
    
    // Pausar para garantir carregamento completo
    await delay(randomInteger(2000, 4000));
    
    // Verificar se há poções de Haste no inventário
    const hasteSelector = '.img-item[alt*="Poção de Haste"]';
    const hasteExists = await page.evaluate((selector) => {
      return !!document.querySelector(selector);
    }, hasteSelector);
    
    if (!hasteExists) {
      logger.warn(`[${accountId}] Poção de Haste não encontrada no inventário`, accountId);
      return {
        success: false,
        reason: 'potion_not_found'
      };
    }
    
    // Número de poções a usar (limitar pelo disponível)
    const potionsToUse = Math.min(4, remainingHastePotions);
    
    // Clicar nas poções de Haste
    for (let i = 0; i < potionsToUse; i++) {
      const hastePotion = await page.$(hasteSelector);
      
      if (!hastePotion) {
        logger.warn(`[${accountId}] Poção ${i+1} não encontrada`, accountId);
        break;
      }
      
      // Simular movimento e clique
      await simulateMouseMove(page, hastePotion, accountId);
      await delay(randomInteger(500, 1500));
      await hastePotion.click();
      
      // Esperar efeito da poção
      await delay(randomInteger(1000, 3000));
      
      // Verificar se há confirmação
      const confirmSelector = '.btn-confirm, .confirm-button, button:contains("Confirmar")';
      const confirmExists = await page.evaluate((selector) => {
        return !!document.querySelector(selector);
      }, confirmSelector);
      
      if (confirmExists) {
        const confirmButton = await page.$(confirmSelector);
        await confirmButton.click();
        await delay(randomInteger(1000, 2000));
      }
      
      logger.info(`[${accountId}] Poção de Haste ${i+1}/${potionsToUse} usada`, accountId);
    }
    
    return {
      success: true,
      potionsUsed: potionsToUse,
      rewards: {
        xp: 0,
        currency: 0,
        items: []
      }
    };
  } catch (error) {
    logger.error(`[${accountId}] Erro ao usar poções de Haste: ${error.message}`, accountId, error);
    return {
      success: false,
      reason: 'error',
      error: error.message
    };
  }
}

/**
 * Realizar missão/trabalho
 * @param {Object} page - Puppeteer page object
 * @param {string} accountId - Account identifier
 * @returns {Promise<Object>} - Task result
 */
async function performJob(page, accountId) {
  try {
    logger.info(`[${accountId}] Iniciando trabalho/missão`, accountId);
    
    // Garantir que estamos na página de trabalhos
    await ensurePage(page, JOBS_URL, 'networkidle2', accountId);
    
    // Pausar para garantir carregamento completo
    await delay(randomInteger(2000, 4000));
    
    // Verificar se há timer de "busy"
    const busyTimerSeconds = await getBusyTimerSeconds(page, accountId);
    if (busyTimerSeconds > 0) {
      logger.info(`[${accountId}] Timer de ocupado: ${busyTimerSeconds} segundos`, accountId);
      
      if (busyTimerSeconds > 20) {
        logger.info(`[${accountId}] Timer muito longo, pulando trabalho`, accountId);
        return {
          success: false,
          reason: 'busy_timer',
          busyTimerSeconds
        };
      }
      
      // Esperar o timer acabar
      logger.info(`[${accountId}] Aguardando timer de ocupado (${busyTimerSeconds}s)`, accountId);
      await waitForCooldown(page, accountId, busyTimerSeconds + 2);
    }
    
    // Verificar se o botão de trabalho está disponível
    const jobButtonSelector = '.btn.job-btn, .perform-job, button:contains("Trabalhar")';
    const jobButtonExists = await page.evaluate((selector) => {
      return !!document.querySelector(selector);
    }, jobButtonSelector);
    
    if (!jobButtonExists) {
      logger.warn(`[${accountId}] Botão de trabalho não encontrado`, accountId);
      return { 
        success: false,
        reason: 'job_button_not_found'
      };
    }
    
    // Clicar no botão de trabalho
    const jobButton = await page.$(jobButtonSelector);
    await simulateMouseMove(page, jobButton, accountId);
    await delay(randomInteger(500, 1500));
    await jobButton.click();
    
    // Esperar a ação de trabalho
    await delay(randomInteger(3000, 6000));
    
    // Verificar resultado
    const jobResult = await page.evaluate(() => {
      const resultText = document.body.innerText;
      if (resultText.includes('completou')) return 'success';
      if (resultText.includes('falhou')) return 'failure';
      return 'unknown';
    });
    
    logger.info(`[${accountId}] Resultado do trabalho: ${jobResult}`, accountId);
    
    return {
      success: true,
      result: jobResult,
      rewards: {
        xp: jobResult === 'success' ? randomInteger(20, 80) : randomInteger(5, 20),
        currency: jobResult === 'success' ? randomInteger(100, 300) : randomInteger(10, 50),
        items: jobResult === 'success' ? [{
          name: 'Recompensa de trabalho',
          quantity: randomInteger(1, 3)
        }] : []
      }
    };
  } catch (error) {
    logger.error(`[${accountId}] Erro ao realizar trabalho: ${error.message}`, accountId, error);
    return {
      success: false,
      reason: 'error',
      error: error.message
    };
  }
}

/**
 * Visitar templo
 * @param {Object} page - Puppeteer page object
 * @param {string} accountId - Account identifier
 * @returns {Promise<Object>} - Task result
 */
async function visitTemple(page, accountId) {
  try {
    logger.info(`[${accountId}] Visitando templo`, accountId);
    
    // Garantir que estamos na página do templo
    await ensurePage(page, TEMPLE_URL, 'networkidle2', accountId);
    
    // Pausar para garantir carregamento completo
    await delay(randomInteger(2000, 4000));
    
    // Verificar se há botão de orar/rezar
    const prayButtonSelector = '.btn.pray-btn, .perform-pray, button:contains("Orar")';
    const prayButtonExists = await page.evaluate((selector) => {
      return !!document.querySelector(selector);
    }, prayButtonSelector);
    
    if (!prayButtonExists) {
      logger.warn(`[${accountId}] Botão de oração não encontrado`, accountId);
      return { 
        success: false,
        reason: 'pray_button_not_found'
      };
    }
    
    // Clicar no botão de orar
    const prayButton = await page.$(prayButtonSelector);
    await simulateMouseMove(page, prayButton, accountId);
    await delay(randomInteger(500, 1500));
    await prayButton.click();
    
    // Esperar a ação de oração
    await delay(randomInteger(3000, 6000));
    
    // Verificar resultado
    const templeResult = await page.evaluate(() => {
      const resultText = document.body.innerText;
      if (resultText.includes('bênção') || resultText.includes('benção')) return 'blessing';
      return 'regular';
    });
    
    logger.info(`[${accountId}] Resultado da visita ao templo: ${templeResult}`, accountId);
    
    return {
      success: true,
      result: templeResult,
      rewards: {
        xp: randomInteger(5, 20),
        currency: 0,
        items: templeResult === 'blessing' ? [{
          name: 'Bênção',
          quantity: 1
        }] : []
      }
    };
  } catch (error) {
    logger.error(`[${accountId}] Erro ao visitar templo: ${error.message}`, accountId, error);
    return {
      success: false,
      reason: 'error',
      error: error.message
    };
  }
}

/**
 * Explorar dungeon
 * @param {Object} page - Puppeteer page object
 * @param {string} accountId - Account identifier
 * @returns {Promise<Object>} - Task result
 */
async function exploreDungeon(page, accountId) {
  try {
    logger.info(`[${accountId}] Explorando dungeon`, accountId);
    
    // Garantir que estamos na página de dungeon
    await ensurePage(page, DUNGEON_URL, 'networkidle2', accountId);
    
    // Pausar para garantir carregamento completo
    await delay(randomInteger(2000, 4000));
    
    // Verificar se há timer de "busy"
    const busyTimerSeconds = await getBusyTimerSeconds(page, accountId);
    if (busyTimerSeconds > 0) {
      logger.info(`[${accountId}] Timer de ocupado: ${busyTimerSeconds} segundos`, accountId);
      
      if (busyTimerSeconds > 20) {
        logger.info(`[${accountId}] Timer muito longo, pulando exploração`, accountId);
        return {
          success: false,
          reason: 'busy_timer',
          busyTimerSeconds
        };
      }
      
      // Esperar o timer acabar
      logger.info(`[${accountId}] Aguardando timer de ocupado (${busyTimerSeconds}s)`, accountId);
      await waitForCooldown(page, accountId, busyTimerSeconds + 2);
    }
    
    // Verificar se o botão de explorar está disponível
    const exploreButtonSelector = '.btn.dungeon-btn, .explore-dungeon, button:contains("Explorar")';
    const exploreButtonExists = await page.evaluate((selector) => {
      return !!document.querySelector(selector);
    }, exploreButtonSelector);
    
    if (!exploreButtonExists) {
      logger.warn(`[${accountId}] Botão de exploração não encontrado`, accountId);
      return { 
        success: false,
        reason: 'explore_button_not_found'
      };
    }
    
    // Clicar no botão de explorar
    const exploreButton = await page.$(exploreButtonSelector);
    await simulateMouseMove(page, exploreButton, accountId);
    await delay(randomInteger(500, 1500));
    await exploreButton.click();
    
    // Esperar a ação de exploração
    await delay(randomInteger(3000, 6000));
    
    // Verificar resultado
    const exploreResult = await page.evaluate(() => {
      const resultText = document.body.innerText;
      if (resultText.includes('tesouro') || resultText.includes('item')) return 'treasure';
      if (resultText.includes('monstro') || resultText.includes('combate')) return 'monster';
      if (resultText.includes('armadilha')) return 'trap';
      return 'empty';
    });
    
    logger.info(`[${accountId}] Resultado da exploração: ${exploreResult}`, accountId);
    
    // Se encontrou um monstro, pode haver um combate
    if (exploreResult === 'monster') {
      // Verificar se há botão de lutar
      const fightButtonSelector = '.btn.fight-btn, .combat-button, button:contains("Lutar")';
      const fightButtonExists = await page.evaluate((selector) => {
        return !!document.querySelector(selector);
      }, fightButtonSelector);
      
      if (fightButtonExists) {
        const fightButton = await page.$(fightButtonSelector);
        await simulateMouseMove(page, fightButton, accountId);
        await delay(randomInteger(500, 1500));
        await fightButton.click();
        
        // Esperar o combate
        await delay(randomInteger(5000, 8000));
      }
    }
    
    return {
      success: true,
      result: exploreResult,
      rewards: {
        xp: randomInteger(30, 100),
        currency: exploreResult === 'treasure' ? randomInteger(200, 500) : randomInteger(20, 100),
        items: exploreResult === 'treasure' ? [{
          name: 'Item de dungeon',
          quantity: randomInteger(1, 3)
        }] : []
      }
    };
  } catch (error) {
    logger.error(`[${accountId}] Erro ao explorar dungeon: ${error.message}`, accountId, error);
    return {
      success: false,
      reason: 'error',
      error: error.message
    };
  }
}

/**
 * Verificar perfil e status
 * @param {Object} page - Puppeteer page object
 * @param {string} accountId - Account identifier
 * @returns {Promise<Object>} - Task result
 */
async function checkProfile(page, accountId) {
  try {
    logger.info(`[${accountId}] Verificando perfil e status`, accountId);
    
    // Garantir que estamos na página de perfil
    await ensurePage(page, PROFILE_URL, 'networkidle2', accountId);
    
    // Pausar para garantir carregamento completo
    await delay(randomInteger(2000, 4000));
    
    // Coletar informações de perfil
    const profileInfo = await page.evaluate(() => {
      const level = document.querySelector('.level')?.textContent.trim() || 'Desconhecido';
      const gold = document.querySelector('.gold')?.textContent.trim() || 'Desconhecido';
      const energy = document.querySelector('.energy')?.textContent.trim() || 'Desconhecido';
      const life = document.querySelector('.life')?.textContent.trim() || 'Desconhecido';
      
      return {
        level,
        gold,
        energy,
        life
      };
    });
    
    logger.info(`[${accountId}] Informações de perfil: Nível ${profileInfo.level}, Ouro ${profileInfo.gold}, Energia ${profileInfo.energy}, Vida ${profileInfo.life}`, accountId);
    
    // Verificar quantidade de poções de Haste
    const hasteCount = await getHastePotionsCount(page, accountId);
    logger.info(`[${accountId}] Poções de Haste disponíveis: ${hasteCount}`, accountId);
    
    return {
      success: true,
      profileInfo,
      hasteCount,
      rewards: {
        xp: 0,
        currency: 0,
        items: []
      }
    };
  } catch (error) {
    logger.error(`[${accountId}] Erro ao verificar perfil: ${error.message}`, accountId, error);
    return {
      success: false,
      reason: 'error',
      error: error.message
    };
  }
}

/**
 * Verificar ranking PVP
 * @param {Object} page - Puppeteer page object
 * @param {string} accountId - Account identifier
 * @returns {Promise<Object>} - Task result
 */
async function checkRanking(page, accountId) {
  try {
    logger.info(`[${accountId}] Verificando ranking PVP`, accountId);
    
    // Garantir que estamos na página de ranking
    await ensurePage(page, RANKING_URL, 'networkidle2', accountId);
    
    // Pausar para garantir carregamento completo
    await delay(randomInteger(2000, 4000));
    
    // Coletar posição no ranking
    const rankingInfo = await page.evaluate(() => {
      // Procurar pelo nome do usuário na tabela de ranking
      const username = document.querySelector('.username')?.textContent.trim() || '';
      let position = 'Não encontrado';
      
      const rankRows = document.querySelectorAll('.ranking-row, .rank-row, tr');
      for (let i = 0; i < rankRows.length; i++) {
        if (rankRows[i].textContent.includes(username)) {
          position = i + 1;
          break;
        }
      }
      
      return { position, username };
    });
    
    logger.info(`[${accountId}] Posição no ranking: ${rankingInfo.position}`, accountId);
    
    return {
      success: true,
      rankingInfo,
      rewards: {
        xp: 0,
        currency: 0,
        items: []
      }
    };
  } catch (error) {
    logger.error(`[${accountId}] Erro ao verificar ranking: ${error.message}`, accountId, error);
    return {
      success: false,
      reason: 'error',
      error: error.message
    };
  }
}

/**
 * Obter número de poções de haste
 * @param {Object} page - Puppeteer page object
 * @param {string} accountId - Account identifier
 * @returns {Promise<number>} - Número de poções
 */
async function getHastePotionsCount(page, accountId, attempt = 1) {
  try {
    // Se não estamos na página de perfil, vá para ela
    const currentUrl = page.url();
    if (!currentUrl.includes(PROFILE_URL)) {
      await ensurePage(page, PROFILE_URL, 'networkidle2', accountId);
      await delay(randomInteger(1000, 2000));
    }
    
    // Tentar encontrar a contagem de poções
    const hasteCount = await page.evaluate(() => {
      const potionElement = document.querySelector('.potion-haste, .haste-count');
      if (potionElement) {
        const countText = potionElement.textContent.trim();
        const match = countText.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      }
      return 0;
    });
    
    return hasteCount;
  } catch (error) {
    logger.error(`[${accountId}] Erro ao obter contagem de poções (tentativa ${attempt}): ${error.message}`, accountId, error);
    
    if (attempt < 3) {
      // Tentar novamente
      await delay(randomInteger(1000, 3000));
      return getHastePotionsCount(page, accountId, attempt + 1);
    }
    
    return 0;
  }
}

/**
 * Obter segundos do timer de ocupado
 * @param {Object} page - Puppeteer page object
 * @param {string} accountId - Account identifier
 * @returns {Promise<number>} - Segundos restantes
 */
async function getBusyTimerSeconds(page, accountId) {
  try {
    const timerSeconds = await page.evaluate(() => {
      const timerElement = document.querySelector('.busy-timer, .cooldown-timer, .timer');
      if (!timerElement) return 0;
      
      const timerText = timerElement.textContent.trim();
      const match = timerText.match(/(\d+):(\d+)$/);
      
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        return minutes * 60 + seconds;
      }
      
      return 0;
    });
    
    return timerSeconds;
  } catch (error) {
    logger.error(`[${accountId}] Erro ao obter timer de ocupado: ${error.message}`, accountId, error);
    return 0;
  }
}

/**
 * Esperar pelo fim do cooldown
 * @param {Object} page - Puppeteer page object
 * @param {string} accountId - Account identifier
 * @param {number} maxWaitSeconds - Tempo máximo de espera em segundos
 * @returns {Promise<boolean>} - Se a espera foi bem-sucedida
 */
async function waitForCooldown(page, accountId, maxWaitSeconds = 20 * 60) {
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;
  
  while (Date.now() - startTime < maxWaitMs) {
    // Checar se o timer ainda existe
    const timerSeconds = await getBusyTimerSeconds(page, accountId);
    
    if (timerSeconds <= 0) {
      logger.info(`[${accountId}] Cooldown terminado`, accountId);
      return true;
    }
    
    // Determinar quanto tempo esperar até a próxima verificação
    const waitTime = Math.min(timerSeconds * 1000, 10000);
    logger.info(`[${accountId}] Aguardando cooldown: ${timerSeconds}s (próxima verificação em ${waitTime/1000}s)`, accountId);
    
    // Esperar
    await delay(waitTime);
    
    // Recarregar a página ocasionalmente
    if (Math.random() < 0.3) {
      await page.reload({ waitUntil: 'networkidle2' });
      await delay(randomInteger(1000, 3000));
    }
  }
  
  logger.warn(`[${accountId}] Tempo máximo de espera excedido`, accountId);
  return false;
}

/**
 * Simular movimento do mouse
 * @param {Object} page - Puppeteer page object
 * @param {Object} element - Elemento para mover
 * @param {string} accountId - Account identifier
 * @returns {Promise<void>}
 */
async function simulateMouseMove(page, element, accountId) {
  try {
    const box = await element.boundingBox();
    if (!box) {
      logger.warn(`[${accountId}] Bounding box não encontrado para elemento`, accountId);
      return;
    }
    
    // Pontos inicial e final
    const startX = box.x + Math.random() * box.width;
    const startY = box.y + Math.random() * box.height;
    const endX = box.x + box.width / 2 + (Math.random() * 50 - 25);
    const endY = box.y + box.height / 2 + (Math.random() * 50 - 25);
    
    // Calcular pontos de curva Bezier
    const getBezierPoints = (startX, startY, endX, endY, steps) => {
      const cp1x = startX + (endX - startX) * (0.3 + Math.random() * 0.4);
      const cp1y = startY + (endY - startY) * (0.3 + Math.random() * 0.4);
      const cp2x = startX + (endX - startX) * (0.6 + Math.random() * 0.4);
      const cp2y = startY + (endY - startY) * (0.6 + Math.random() * 0.4);
      const points = [];
      
      for (let t = 0; t <= 1; t += 1 / steps) {
        const x = Math.pow(1-t, 3) * startX + 3 * Math.pow(1-t, 2) * t * cp1x + 3 * (1-t) * t * t * cp2x + Math.pow(t, 3) * endX;
        const y = Math.pow(1-t, 3) * startY + 3 * Math.pow(1-t, 2) * t * cp1y + 3 * (1-t) * t * t * cp2y + Math.pow(t, 3) * endY;
        points.push({ x, y });
      }
      
      return points;
    };
    
    // Número de passos para movimento natural
    const steps = Math.floor(Math.random() * 10 + 10);
    const bezierPoints = getBezierPoints(startX, startY, endX, endY, steps);
    
    // Mover através dos pontos da curva
    for (let i = 0; i < bezierPoints.length; i++) {
      const { x, y } = bezierPoints[i];
      await page.mouse.move(x, y, { steps: 1 });
      await delay(Math.random() * 100 + 50);
    }
    
    // Pequeno ajuste final para parecer humano
    await page.mouse.move(endX + (Math.random() * 10 - 5), endY + (Math.random() * 10 - 5), { steps: 5 });
    await delay(Math.pow(Math.random(), 2) * 500 + 300);
  } catch (error) {
    logger.error(`[${accountId}] Erro ao simular movimento do mouse: ${error.message}`, accountId, error);
  }
}

// Exportar funções
module.exports = {
  participatePvP,
  useHastePotions,
  performJob,
  visitTemple,
  exploreDungeon,
  checkProfile,
  checkRanking,
  getHastePotionsCount,
  getBusyTimerSeconds,
  waitForCooldown,
  simulateMouseMove,
  ensurePage
};