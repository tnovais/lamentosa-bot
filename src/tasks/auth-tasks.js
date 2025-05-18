/**
 * Authentication related tasks for Lamentosa
 */

const { delay, randomInteger } = require('../utils/helpers');
const logger = require('../utils/logger');
const { TIMING, LOGIN_URL, LOGOUT_URL, PROFILE_URL } = require('../config');

/**
 * Perform login with cookie persistence
 * @param {Object} page - Puppeteer page object
 * @param {string} username - Account username
 * @param {string} password - Account password
 * @param {string} accountId - Account identifier
 * @returns {Promise<boolean>} - Whether login was successful
 */
async function loginWithCookiePersistence(page, username, password, accountId) {
  try {
    logger.info(`[${accountId}] Tentando login`, accountId);
    
    // Navegar para a página de login
    await page.goto(LOGIN_URL, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // Verificar se já está logado
    const alreadyLoggedIn = await checkIfLoggedIn(page, accountId);
    if (alreadyLoggedIn) {
      logger.info(`[${accountId}] Já está logado, pulando login`, accountId);
      return true;
    }
    
    // Logging para debug
    logger.info(`[${accountId}] Aguardando elementos de login na página`, accountId);
    
    // Esperar a página carregar completamente
    await delay(randomInteger(2000, 5000));
    
    // Usar os seletores exatos do Lamentosa
    logger.info(`[${accountId}] Usando seletores específicos do Lamentosa.com`, accountId);
    
    const emailSelector = '#login-email';  // Seletor exato do Lamentosa
    const passwordSelector = '#login-password';  // Seletor exato do Lamentosa
    const loginButtonSelector = '.btn-login';  // Seletor exato do Lamentosa
    
    // Verificar se os elementos existem realmente na página
    const elementsExist = await page.evaluate((selectors) => {
      return {
        email: !!document.querySelector(selectors.email),
        password: !!document.querySelector(selectors.password),
        button: !!document.querySelector(selectors.button)
      };
    }, { email: emailSelector, password: passwordSelector, button: loginButtonSelector });
    
    logger.info(`[${accountId}] Elementos encontrados: ${JSON.stringify(elementsExist)}`, accountId);
    
    // Se os seletores não forem encontrados, tentar método alternativo
    if (!elementsExist.email || !elementsExist.password || !elementsExist.button) {
      logger.warn(`[${accountId}] Seletores do Lamentosa não encontrados, tentando alternativa`, accountId);
      
      // Tirar screenshot para debug
      if (process.env.DEBUG_SCREENSHOTS === "true") {
        const screenshotPath = `debug-login-form-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        logger.debug(`[${accountId}] Screenshot salvo em ${screenshotPath}`, accountId);
      }
      
      // Tentativa alternativa - encontrar campos genéricos
      const altSelectors = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const emailInput = inputs.find(i => i.type === 'email' || i.type === 'text' || i.name === 'email' || i.name === 'username');
        const passwordInput = inputs.find(i => i.type === 'password');
        const submitButton = document.querySelector('button[type="submit"], input[type="submit"], button.login');
        
        return {
          emailFound: emailInput ? true : false,
          emailSelector: emailInput ? `input[name="${emailInput.name}"]` : null,
          passwordFound: passwordInput ? true : false,
          passwordSelector: passwordInput ? `input[name="${passwordInput.name}"]` : null,
          buttonFound: submitButton ? true : false,
          buttonSelector: submitButton ? (submitButton.tagName === 'BUTTON' ? 'button[type="submit"]' : 'input[type="submit"]') : null
        };
      });
      
      logger.info(`[${accountId}] Seletores alternativos: ${JSON.stringify(altSelectors)}`, accountId);
      
      if (altSelectors.emailFound && altSelectors.passwordFound && altSelectors.buttonFound) {
        // Se encontrou alternativos, usá-los
        const altEmailSelector = altSelectors.emailSelector || 'input[type="email"], input[type="text"]';
        const altPasswordSelector = altSelectors.passwordSelector || 'input[type="password"]';
        const altButtonSelector = altSelectors.buttonSelector || 'button[type="submit"], input[type="submit"]';
        
        // Preencher com seletores alternativos
        await page.type(altEmailSelector, username, { delay: randomInteger(50, 150) });
        await delay(randomInteger(500, 1500));
        
        await page.type(altPasswordSelector, password, { delay: randomInteger(50, 150) });
        await delay(randomInteger(800, 2000));
        
        // Clicar no botão de login
        const loginButton = await page.$(altButtonSelector);
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}),
          loginButton.click()
        ]);
        
        // Verificar se o login foi bem-sucedido
        const altLoginSuccess = await checkIfLoggedIn(page, accountId);
        if (altLoginSuccess) {
          logger.info(`[${accountId}] Login com seletores alternativos bem-sucedido`, accountId);
          return true;
        }
        
        logger.error(`[${accountId}] Login com seletores alternativos falhou`, accountId);
        return false;
      }
      
      // Se falhou em encontrar elementos alternativos, tentar preencher diretamente
      await page.evaluate((user, pass) => {
        // Obter todos os inputs
        const inputs = document.querySelectorAll('input');
        const formInputs = Array.from(inputs);
        
        // Se há poucos inputs, provavelmente é um formulário de login simples
        if (formInputs.length >= 2) {
          // Normalmente o primeiro é username/email, o segundo é senha
          if (formInputs[0]) formInputs[0].value = user;
          if (formInputs[1] && formInputs[1].type === 'password') formInputs[1].value = pass;
          
          // Buscar um botão ou input submit
          const submitButton = document.querySelector('button, input[type="submit"]');
          if (submitButton) submitButton.click();
        }
      }, username, password);
      
      // Aguardar para ver se houve navegação
      await delay(5000);
      
      // Verificar se o login foi bem-sucedido após injeção direta
      const directLoginCheck = await checkIfLoggedIn(page, accountId);
      if (directLoginCheck) {
        logger.info(`[${accountId}] Login via injeção direta bem-sucedido`, accountId);
        return true;
      }
      
      logger.error(`[${accountId}] Todas as tentativas de login falharam - formulário incompatível`, accountId);
      return false;
    }
    
    // Se encontrou os seletores exatos, usar a abordagem normal
    
    // Preencher usuário com delay entre caracteres
    await page.type(emailSelector, username, { delay: randomInteger(50, 150) });
    
    // Pausa breve após preencher usuário
    await delay(randomInteger(500, 1500));
    
    // Preencher senha com delay entre caracteres
    await page.type(passwordSelector, password, { delay: randomInteger(50, 150) });
    
    // Pausa breve antes de clicar no botão de login
    await delay(randomInteger(800, 2000));
    
    // Clicar no botão de login
    const loginButton = await page.$(loginButtonSelector);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
      loginButton.click()
    ]);
    
    // Verificar se o login foi bem-sucedido
    const isLoggedIn = await checkIfLoggedIn(page, accountId);
    
    if (isLoggedIn) {
      logger.info(`[${accountId}] Login realizado com sucesso`, accountId);
      return true;
    } else {
      logger.error(`[${accountId}] Falha no login`, accountId);
      return false;
    }
  } catch (error) {
    logger.error(`[${accountId}] Erro durante login: ${error.message}`, accountId, error);
    return false;
  }
}

/**
 * Check if user is logged in
 * @param {Object} page - Puppeteer page object
 * @param {string} accountId - Account identifier
 * @returns {Promise<boolean>} - Whether user is logged in
 */
async function checkIfLoggedIn(page, accountId) {
  try {
    logger.debug(`[${accountId}] Verificando status de login`, accountId);
    
    // Capturar a URL atual para análise
    const currentUrl = await page.url();
    logger.debug(`[${accountId}] URL atual: ${currentUrl}`, accountId);
    
    // Fazer captura de tela para diagnóstico em caso de falhas repetidas
    if (process.env.DEBUG_SCREENSHOTS === "true") {
      const screenshotPath = `debug-login-check-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      logger.debug(`[${accountId}] Screenshot salvo em ${screenshotPath}`, accountId);
    }
    
    // Abordagem robusta para verificar status de login
    const loggedIn = await page.evaluate(() => {
      const loginIndicators = {
        // Elementos que indicam que está logado
        loggedInElements: [
          // Elementos de cabeçalho/navegação comuns para usuários logados
          '.header-name', '.user-avatar', '.user-profile', '.account-name', 
          '.header-stats', '.header-menu', '.user-menu', '.profile-link',
          '.logout-button', '.logout-link', 'a[href*="logout"]',
          
          // Elementos específicos do Lamentosa para usuários logados
          '.player-name', '.character-name', '.player-stats', '.player-avatar',
          '.game-menu', '.game-header', '.player-energy', '.player-gold',
          '.inventory-link', '.profile-stats', '.character-stats'
        ],
        
        // Elementos que indicam que NÃO está logado
        loggedOutElements: [
          // Elementos de login
          '#login-email', '#login-password', 'input[name="email"]', 'input[name="password"]',
          'input[type="email"]', 'input[type="password"]', '.login-form',
          '.login-button', '.btn-login', 'button[type="submit"]',
          '.register-link', '.signup-link', '.create-account',
          
          // Textos que indicam estado não logado
          '.login-header', '.login-title', '.login-welcome',
          '.register-title', '.signup-title'
        ],
        
        // URLs que indicam estado logado
        loggedInUrls: [
          '/status/', '/battlefield/', '/temple/', '/dungeons/',
          '/cemetery/', '/clan/', '/items/', '/inventory/', '/ranking/',
          '/profile/', '/character/', '/account/'
        ],
        
        // URLs que indicam estado não logado
        loggedOutUrls: [
          '/login/', '/signup/', '/register/', '/forgot-password/',
          '/recover/', '/reset-password/'
        ]
      };
      
      // Resultados da verificação para diagnóstico
      const results = {
        foundLoggedInElements: [],
        foundLoggedOutElements: [],
        currentUrl: window.location.href,
        documentTitle: document.title,
        bodyText: document.body.innerText.slice(0, 200) + '...' // Amostra do texto
      };
      
      // Verifica por elementos que indicam login
      for (const selector of loginIndicators.loggedInElements) {
        if (document.querySelector(selector)) {
          results.foundLoggedInElements.push(selector);
        }
      }
      
      // Verifica por elementos que indicam não estar logado
      for (const selector of loginIndicators.loggedOutElements) {
        if (document.querySelector(selector)) {
          results.foundLoggedOutElements.push(selector);
        }
      }
      
      // Análise de URL
      const currentUrl = window.location.href;
      
      // Verifica URLs de estado logado
      const inLoggedInUrl = loginIndicators.loggedInUrls.some(urlPart => 
        currentUrl.includes(urlPart)
      );
      
      // Verifica URLs de estado não logado
      const inLoggedOutUrl = loginIndicators.loggedOutUrls.some(urlPart => 
        currentUrl.includes(urlPart)
      );
      
      // Análise de conteúdo da página
      const pageContent = document.body.innerText.toLowerCase();
      const loggedOutPhrases = ['faça login', 'iniciar sessão', 'entrar com', 'entrar na sua conta', 'sign in', 'log in'];
      const hasLogoutText = pageContent.includes('logout') || pageContent.includes('sair') || pageContent.includes('encerrar sessão');
      
      // Elementos específicos conhecidos para o site
      const hasProfileElement = !!document.querySelector('.profile, .player-profile, .character');
      const hasInventoryLink = !!document.querySelector('a[href*="inventory"], a[href*="items"]');
      
      // Decisão lógica com base nos indicadores encontrados
      let isLoggedIn = false;
      
      // Se encontrou elementos de usuário logado e nenhum elemento de login
      if (results.foundLoggedInElements.length > 0 && results.foundLoggedOutElements.length === 0) {
        isLoggedIn = true;
      }
      // Se encontrou apenas elementos de não logado
      else if (results.foundLoggedInElements.length === 0 && results.foundLoggedOutElements.length > 0) {
        isLoggedIn = false;
      }
      // Verificação baseada em URL 
      else if (inLoggedInUrl && !inLoggedOutUrl) {
        isLoggedIn = true;
      }
      else if (!inLoggedInUrl && inLoggedOutUrl) {
        isLoggedIn = false;
      }
      // Verificação baseada em elementos específicos e texto
      else if (hasProfileElement || hasInventoryLink || hasLogoutText) {
        isLoggedIn = true;
      }
      else if (loggedOutPhrases.some(phrase => pageContent.includes(phrase))) {
        isLoggedIn = false;
      }
      
      // Resultado final com diagnóstico
      results.isLoggedIn = isLoggedIn;
      
      // Retorna objeto completo com diagnóstico
      return results;
    });
    
    // Log de diagnóstico detalhado
    logger.debug(`[${accountId}] Detalhes da verificação de login: ${JSON.stringify(loggedIn)}`, accountId);
    
    // Retornar resultado final da verificação
    logger.info(`[${accountId}] Status de login: ${loggedIn.isLoggedIn ? 'Logado' : 'Não logado'}`, accountId);
    return loggedIn.isLoggedIn;
  } catch (error) {
    logger.error(`[${accountId}] Erro ao verificar status de login: ${error.message}`, accountId, error);
    return false;
  }
}

/**
 * Perform logout
 * @param {Object} page - Puppeteer page object
 * @param {string} accountId - Account identifier
 * @returns {Promise<boolean>} - Whether logout was successful
 */
async function performLogout(page, accountId) {
  try {
    logger.info(`[${accountId}] Tentando logout`, accountId);
    
    // Navegar para a URL de logout
    await page.goto(LOGOUT_URL, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Verificar se o logout foi bem-sucedido
    const isLoggedIn = await checkIfLoggedIn(page, accountId);
    
    if (!isLoggedIn) {
      logger.info(`[${accountId}] Logout realizado com sucesso`, accountId);
      return true;
    } else {
      logger.warn(`[${accountId}] Falha no logout`, accountId);
      return false;
    }
  } catch (error) {
    logger.error(`[${accountId}] Erro durante logout: ${error.message}`, accountId, error);
    return false;
  }
}

/**
 * Check profile data
 * @param {Object} page - Puppeteer page object
 * @param {string} accountId - Account identifier
 * @returns {Promise<Object>} - Profile data
 */
async function checkProfile(page, accountId) {
  try {
    logger.info(`[${accountId}] Verificando dados de perfil`, accountId);
    
    // Navegar para a página de perfil
    await page.goto(PROFILE_URL, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Extrair dados do perfil
    const profileData = await page.evaluate(() => {
      const username = document.querySelector('.header-name')?.textContent.trim() || 'Desconhecido';
      const level = document.querySelector('.level')?.textContent.trim() || 'Desconhecido';
      const gold = document.querySelector('.gold')?.textContent.trim() || 'Desconhecido';
      const energy = document.querySelector('.energy')?.textContent.trim() || 'Desconhecido';
      const life = document.querySelector('.life')?.textContent.trim() || 'Desconhecido';
      
      // Encontrar poções de Haste
      let hasteCount = 0;
      const potionElement = document.querySelector('.potion-haste, .haste-count');
      if (potionElement) {
        const countText = potionElement.textContent.trim();
        const match = countText.match(/\d+/);
        hasteCount = match ? parseInt(match[0], 10) : 0;
      }
      
      return {
        username,
        level,
        gold,
        energy,
        life,
        hasteCount
      };
    });
    
    logger.info(`[${accountId}] Dados de perfil: Usuário ${profileData.username}, Nível ${profileData.level}, Ouro ${profileData.gold}, Energia ${profileData.energy}, Vida ${profileData.life}, Poções Haste ${profileData.hasteCount}`, accountId);
    return profileData;
  } catch (error) {
    logger.error(`[${accountId}] Erro ao verificar perfil: ${error.message}`, accountId, error);
    return {};
  }
}

/**
 * Check and resolve captcha
 * @param {Object} page - Puppeteer page object
 * @param {Object} captchaSolver - Captcha solver instance
 * @param {string} accountId - Account identifier
 * @returns {Promise<boolean>} - Whether captcha was solved successfully
 */
async function checkAndResolveCaptcha(page, captchaSolver, accountId) {
  try {
    logger.info(`[${accountId}] Verificando presença de captcha`, accountId);
    
    // Verificar se há captcha na página
    const hasCaptcha = await page.evaluate(() => {
      // Verifica elementos específicos do captcha do Lamentosa
      return !!document.querySelector('.captcha-container') || 
             !!document.querySelector('.captcha-image') ||
             !!document.querySelector('img[src*="captcha"]') ||
             !!document.querySelector('input[name="captcha"]');
    });
    
    if (!hasCaptcha) {
      logger.info(`[${accountId}] Nenhum captcha detectado`, accountId);
      return true; // Nenhum captcha para resolver
    }
    
    logger.info(`[${accountId}] Captcha detectado, tentando resolver`, accountId);
    
    // Extrair imagens de captcha
    const captchaImages = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('.captcha-image img, img[src*="captcha"]'));
      return images.map(img => img.src);
    });
    
    if (captchaImages.length === 0) {
      logger.warn(`[${accountId}] Nenhuma imagem de captcha encontrada`, accountId);
      return false;
    }
    
    // Baixar imagens de captcha
    const imageBuffers = [];
    for (const imgSrc of captchaImages) {
      try {
        const viewSource = await page.goto(imgSrc);
        const buffer = await viewSource.buffer();
        imageBuffers.push(buffer);
        
        // Voltar para a página original
        await page.goBack();
      } catch (err) {
        logger.error(`[${accountId}] Erro ao baixar imagem de captcha: ${err.message}`, accountId, err);
      }
    }
    
    if (imageBuffers.length === 0) {
      logger.warn(`[${accountId}] Falha ao baixar imagens de captcha`, accountId);
      return false;
    }
    
    // Resolver captcha
    let solution;
    if (imageBuffers.length === 1) {
      // Captcha de imagem única
      solution = await captchaSolver.solveImageCaptcha(imageBuffers[0], accountId);
    } else {
      // Captcha de múltiplas imagens (combinadas)
      solution = await captchaSolver.solveImageCaptcha(imageBuffers, accountId);
    }
    
    if (!solution) {
      logger.error(`[${accountId}] Falha ao resolver captcha`, accountId);
      return false;
    }
    
    logger.info(`[${accountId}] Captcha resolvido: ${solution}`, accountId);
    
    // Inserir solução do captcha
    await page.type('input[name="captcha"]', solution);
    
    // Clicar no botão de envio
    const submitButton = await page.$('button[type="submit"], .btn-submit, .submit-captcha');
    if (submitButton) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
        submitButton.click()
      ]);
    }
    
    // Verificar se o captcha foi resolvido com sucesso
    const captchaSuccess = await page.evaluate(() => {
      // Verifica se ainda há elementos de captcha na página
      return !document.querySelector('.captcha-container') && 
             !document.querySelector('.captcha-image') &&
             !document.querySelector('img[src*="captcha"]');
    });
    
    if (captchaSuccess) {
      logger.info(`[${accountId}] Captcha resolvido com sucesso`, accountId);
      return true;
    } else {
      logger.warn(`[${accountId}] Falha na resolução do captcha`, accountId);
      return false;
    }
  } catch (error) {
    logger.error(`[${accountId}] Erro ao resolver captcha: ${error.message}`, accountId, error);
    return false;
  }
}

module.exports = {
  loginWithCookiePersistence,
  checkIfLoggedIn,
  performLogout,
  checkProfile,
  checkAndResolveCaptcha
};