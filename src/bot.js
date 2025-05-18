/**
 * Classe principal do Bot - Coordena todos os módulos e funcionalidades
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

// Módulos do bot
const AntiDetection = require('./modules/anti-detection');
const CaptchaSolver = require('./modules/captcha-solver-simplified');
// Usar o arquivo correto para tarefas do jogo
let gameTasks;
try {
  gameTasks = require('./tasks/game-tasks-lamentosa');
} catch (e) {
  try {
    gameTasks = require('./tasks/game-tasks');
  } catch (e2) {
    console.error("Erro ao importar módulo de tarefas do jogo:", e2);
    // Criar stub para evitar erros fatais
    gameTasks = {
      participatePvP: async () => ({ success: false, reason: 'module_not_found' }),
      useHastePotions: async () => ({ success: false, reason: 'module_not_found' }),
      performJob: async () => ({ success: false, reason: 'module_not_found' }),
      visitTemple: async () => ({ success: false, reason: 'module_not_found' }),
      exploreDungeon: async () => ({ success: false, reason: 'module_not_found' }),
      checkProfile: async () => ({ success: false, reason: 'module_not_found' }),
      checkRanking: async () => ({ success: false, reason: 'module_not_found' })
    };
  }
}
const authTasks = require('./tasks/auth-tasks');

// Utilitários
const logger = require('./utils/logger');
const { delay, randomInteger, retry } = require('./utils/helpers');

// Configurações
const { 
  PATHS, 
  TIMING, 
  RETRY, 
  FINGERPRINT, 
  HASTE, 
  MAX_LOOP_ITERATIONS 
} = require('./config');

/**
 * Classe principal do Bot
 */
class Bot {
  constructor() {
    logger.info('Inicializando Bot Lamentosa');
    
    // Inicializar módulos
    this.antiDetection = new AntiDetection();
    this.captchaSolver = new CaptchaSolver();
    
    // Inicializar estado
    this.browsers = {};
    this.pages = {};
    this.sessions = {};
    this.taskQueue = [];
    this.isProcessingQueue = false;
    this.isShuttingDown = false;
    
    // Garantir que diretórios existam
    this._ensureDirectories();
    
    logger.info('Bot inicializado com sucesso');
  }
  
  /**
   * Inicializar o bot
   */
  async initialize() {
    try {
      logger.info('Usando puppeteer-extra com plugin stealth');
      
      // Configurações adicionais
      logger.configure({
        level: 'INFO',
        outputToFile: true
      });
      
      logger.info('Bot inicializado com sucesso');
      return true;
    } catch (error) {
      logger.error(`Erro ao inicializar bot: ${error.message}`, null, error);
      return false;
    }
  }
  
  /**
   * Garantir que os diretórios necessários existam
   * @private
   */
  _ensureDirectories() {
    const directories = [
      PATHS.ACCOUNTS_DIR,
      PATHS.BROWSER_DATA_DIR,
      PATHS.LOGS_DIR,
      PATHS.CAPTCHA_IMAGES_DIR
    ];
    
    directories.forEach(dir => {
      const dirPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        logger.info(`Diretório criado: ${dirPath}`);
      }
    });
  }
  
  /**
   * Executar o bot com múltiplas contas
   * @param {Array<Object>} accounts - Lista de objetos de conta
   * @param {Object} options - Opções de execução
   */
  async run(accounts, options = {}) {
    try {
      logger.info(`Iniciando execução com ${accounts.length} contas`);
      
      // Configurações padrão
      const defaultOptions = {
        maxConcurrent: 1,
        headless: true,
        keepSessionsAlive: false
      };
      
      // Mesclar opções
      const runOptions = { ...defaultOptions, ...options };
      
      // Criar uma fila de tarefas
      accounts.forEach(account => {
        this.queueTask({
          type: 'process_account',
          account,
          options: runOptions
        });
      });
      
      // Iniciar processamento da fila
      await this._processTaskQueue(runOptions.maxConcurrent);
      
      // Iniciar timer para reset de cookies
      if (runOptions.keepSessionsAlive) {
        this.startCookieResetTimer();
      }
      
      logger.info('Execução iniciada com sucesso');
    } catch (error) {
      logger.error(`Erro ao executar bot: ${error.message}`, null, error);
    }
  }
  
  /**
   * Adicionar uma tarefa à fila
   * @param {Object} task - Objeto de tarefa
   */
  queueTask(task) {
    this.taskQueue.push(task);
    logger.debug(`Tarefa adicionada à fila: ${task.type}`);
  }
  
  /**
   * Processar a fila de tarefas
   * @param {number} maxConcurrent - Número máximo de tarefas concorrentes
   * @private
   */
  async _processTaskQueue(maxConcurrent = 1) {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    try {
      while (this.taskQueue.length > 0 && !this.isShuttingDown) {
        // Verificar quantas tarefas estão em execução
        const activeTasks = Object.keys(this.sessions).filter(
          id => this.sessions[id].isActive
        ).length;
        
        // Se já estiver no limite de tarefas concorrentes, aguardar
        if (activeTasks >= maxConcurrent) {
          await delay(1000);
          continue;
        }
        
        // Pegar próxima tarefa
        const task = this.taskQueue.shift();
        
        // Executar tarefa
        this._executeTask(task).catch(error => {
          logger.error(`Erro ao executar tarefa ${task.type}: ${error.message}`, null, error);
        });
        
        // Pequeno atraso entre tarefas
        await delay(randomInteger(500, 1500));
      }
    } catch (error) {
      logger.error(`Erro ao processar fila de tarefas: ${error.message}`, null, error);
    } finally {
      this.isProcessingQueue = false;
      
      // Se ainda há tarefas, continuar processando
      if (this.taskQueue.length > 0 && !this.isShuttingDown) {
        setTimeout(() => this._processTaskQueue(maxConcurrent), 1000);
      }
    }
  }
  
  /**
   * Executar uma tarefa
   * @param {Object} task - Objeto de tarefa
   * @private
   */
  async _executeTask(task) {
    if (!task || !task.type) {
      logger.error('Tarefa inválida');
      return;
    }
    
    try {
      switch (task.type) {
        case 'process_account':
          await this._processAccount(task.account, task.options);
          break;
          
        // Outros tipos de tarefas podem ser adicionados aqui
          
        default:
          logger.warn(`Tipo de tarefa desconhecido: ${task.type}`);
      }
    } catch (error) {
      logger.error(`Erro ao executar tarefa ${task.type}: ${error.message}`, null, error);
    }
  }
  
  /**
   * Processar uma conta
   * @param {Object} account - Objeto de conta
   * @param {Object} options - Opções de processamento
   * @private
   */
  async _processAccount(account, options = {}) {
    const accountId = account.id || account.username;
    
    try {
      logger.info(`Processando conta: ${accountId}`, accountId);
      
      // Marcar a sessão como ativa
      this.sessions[accountId] = {
        isActive: true,
        account,
        startTime: Date.now()
      };
      
      // Iniciar a sessão para a conta
      const sessionStarted = await this.startSession(account);
      
      if (!sessionStarted) {
        logger.error(`Falha ao iniciar sessão para conta ${accountId}`, accountId);
        this.sessions[accountId].isActive = false;
        return;
      }
      
      // Executar sequência de tarefas
      await this.executeTaskSequence(accountId);
      
      // Finalizar a sessão
      await this.endSession(accountId);
      
      logger.info(`Processamento da conta ${accountId} concluído`, accountId);
    } catch (error) {
      logger.error(`Erro ao processar conta ${accountId}: ${error.message}`, accountId, error);
      
      // Garantir que a sessão seja encerrada em caso de erro
      try {
        await this.endSession(accountId);
      } catch (endError) {
        logger.error(`Erro ao encerrar sessão para ${accountId}: ${endError.message}`, accountId, endError);
      }
    }
  }
  
  /**
   * Iniciar uma sessão para uma conta
   * @param {Object} account - Objeto de conta
   * @returns {Promise<boolean>} - Se a sessão foi iniciada com sucesso
   */
  async startSession(account) {
    const accountId = account.id || account.username;
    
    try {
      logger.info(`Iniciando sessão para conta ${accountId}`, accountId);
      
      // Verificar se já existe uma sessão ativa
      if (this.browsers[accountId] || this.pages[accountId]) {
        await this.endSession(accountId);
      }
      
      // Diretório para dados do navegador específicos da conta
      const userDataDir = path.join(process.cwd(), PATHS.BROWSER_DATA_DIR, accountId);
      
      // Garantir que o diretório existe
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }
      
      // Escolher um user agent aleatório
      const userAgent = FINGERPRINT.USER_AGENTS[Math.floor(Math.random() * FINGERPRINT.USER_AGENTS.length)];
      
      // Escolher uma resolução aleatória
      const resolution = FINGERPRINT.RESOLUTIONS[Math.floor(Math.random() * FINGERPRINT.RESOLUTIONS.length)];
      
      // Configurações do navegador
      const browserOptions = {
        headless: 'new',
        userDataDir,
        args: [
          `--window-size=${resolution.width},${resolution.height}`,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-infobars',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--lang=pt-BR,pt',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--ignore-certificate-errors'
        ],
        defaultViewport: {
          width: resolution.width,
          height: resolution.height
        },
        ignoreHTTPSErrors: true,
        ignoreDefaultArgs: ['--enable-automation']
      };
      
      // Em ambiente Windows, tentar encontrar o caminho do Chrome instalado
      try {
        const platform = process.platform;
        
        if (platform === 'win32') {
          // Possíveis caminhos do Chrome no Windows
          const possiblePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
            process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
            process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe'
          ];
          
          // Verificar qual caminho existe
          for (const chromePath of possiblePaths) {
            if (fs.existsSync(chromePath)) {
              logger.info(`[${accountId}] Usando Chrome em: ${chromePath}`, accountId);
              browserOptions.executablePath = chromePath;
              break;
            }
          }
        } else if (platform === 'darwin') {
          // MacOS
          const macPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
          if (fs.existsSync(macPath)) {
            browserOptions.executablePath = macPath;
          }
        } else if (platform === 'linux') {
          // Linux
          const possibleLinuxPaths = [
            '/usr/bin/google-chrome',
            '/usr/bin/chrome',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser'
          ];
          
          for (const chromePath of possibleLinuxPaths) {
            if (fs.existsSync(chromePath)) {
              browserOptions.executablePath = chromePath;
              break;
            }
          }
        }
        
        // Se tiver uma variável de ambiente configurada, use-a com prioridade
        if (process.env.CHROME_PATH) {
          browserOptions.executablePath = process.env.CHROME_PATH;
        }
        
        // Se tiver o caminho no Replit Deployments
        if (process.env.PUPPETEER_EXEC_PATH) {
          browserOptions.executablePath = process.env.PUPPETEER_EXEC_PATH;
        }
        
        logger.info(`[${accountId}] Configurado caminho do Chrome: ${browserOptions.executablePath || 'padrão'}`, accountId);
      } catch (pathError) {
        logger.warn(`[${accountId}] Erro ao determinar caminho do Chrome: ${pathError.message}`, accountId);
        // Continuar com as configurações padrão
      }
      
      // Iniciar o navegador
      const browser = await puppeteer.launch(browserOptions);
      this.browsers[accountId] = browser;
      
      // Criar uma nova página
      const page = await browser.newPage();
      this.pages[accountId] = page;
      
      // Configurar página
      await page.setUserAgent(userAgent);
      await page.setDefaultNavigationTimeout(60000);
      await page.setJavaScriptEnabled(true);
      
      // Aplicar medidas anti-detecção
      await this.antiDetection.applyAllMeasures(page, accountId);
      
      // Carregar cookies (se existirem)
      const cookiesPath = path.join(userDataDir, 'cookies.json');
      if (fs.existsSync(cookiesPath)) {
        try {
          const cookiesString = fs.readFileSync(cookiesPath, 'utf8');
          const cookies = JSON.parse(cookiesString);
          await page.setCookie(...cookies);
          logger.info(`[${accountId}] Cookies carregados`, accountId);
        } catch (cookieError) {
          logger.warn(`[${accountId}] Erro ao carregar cookies: ${cookieError.message}`, accountId);
        }
      }
      
      // Realizar login
      const loggedIn = await this.performLogin(accountId);
      
      if (!loggedIn) {
        logger.error(`[${accountId}] Falha no login, encerrando sessão`, accountId);
        await this.endSession(accountId);
        return false;
      }
      
      // Salvar cookies após login bem-sucedido
      try {
        const cookies = await page.cookies();
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
        logger.info(`[${accountId}] Cookies salvos após login`, accountId);
      } catch (saveCookieError) {
        logger.warn(`[${accountId}] Erro ao salvar cookies: ${saveCookieError.message}`, accountId);
      }
      
      logger.info(`[${accountId}] Sessão iniciada com sucesso`, accountId);
      return true;
    } catch (error) {
      logger.error(`[${accountId}] Erro ao iniciar sessão: ${error.message}`, accountId, error);
      return false;
    }
  }
  
  /**
   * Encerrar uma sessão para uma conta
   * @param {string} accountId - Identificador da conta
   * @returns {Promise<boolean>} - Se a sessão foi encerrada com sucesso
   */
  async endSession(accountId) {
    try {
      logger.info(`[${accountId}] Encerrando sessão`, accountId);
      
      // Realizar logout (se estiver logado)
      if (this.pages[accountId]) {
        try {
          await authTasks.performLogout(this.pages[accountId], accountId);
        } catch (logoutError) {
          logger.warn(`[${accountId}] Erro ao realizar logout: ${logoutError.message}`, accountId);
        }
      }
      
      // Salvar cookies antes de fechar
      if (this.pages[accountId]) {
        try {
          const userDataDir = path.join(process.cwd(), PATHS.BROWSER_DATA_DIR, accountId);
          const cookiesPath = path.join(userDataDir, 'cookies.json');
          const cookies = await this.pages[accountId].cookies();
          fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
          logger.info(`[${accountId}] Cookies salvos antes de encerrar sessão`, accountId);
        } catch (cookieError) {
          logger.warn(`[${accountId}] Erro ao salvar cookies: ${cookieError.message}`, accountId);
        }
      }
      
      // Fechar página
      if (this.pages[accountId]) {
        await this.pages[accountId].close().catch(e => 
          logger.warn(`[${accountId}] Erro ao fechar página: ${e.message}`, accountId)
        );
        delete this.pages[accountId];
      }
      
      // Fechar navegador
      if (this.browsers[accountId]) {
        await this.browsers[accountId].close().catch(e => 
          logger.warn(`[${accountId}] Erro ao fechar navegador: ${e.message}`, accountId)
        );
        delete this.browsers[accountId];
      }
      
      // Marcar a sessão como inativa
      if (this.sessions[accountId]) {
        this.sessions[accountId].isActive = false;
        this.sessions[accountId].endTime = Date.now();
      }
      
      logger.info(`[${accountId}] Sessão encerrada com sucesso`, accountId);
      return true;
    } catch (error) {
      logger.error(`[${accountId}] Erro ao encerrar sessão: ${error.message}`, accountId, error);
      return false;
    }
  }
  
  /**
   * Encerrar todas as sessões ativas
   */
  async endAllSessions() {
    logger.info('Encerrando todas as sessões ativas');
    
    const accountIds = Object.keys(this.sessions).filter(id => this.sessions[id].isActive);
    
    for (const accountId of accountIds) {
      await this.endSession(accountId).catch(error => {
        logger.error(`Erro ao encerrar sessão para ${accountId}: ${error.message}`, accountId, error);
      });
    }
    
    logger.info('Todas as sessões foram encerradas');
  }
  
  /**
   * Realizar login para uma conta
   * @param {string} accountId - Identificador da conta
   * @returns {Promise<boolean>} - Se o login foi bem-sucedido
   */
  async performLogin(accountId) {
    try {
      logger.info(`[${accountId}] Iniciando processo de login`, accountId);
      
      const account = this.sessions[accountId]?.account;
      if (!account) {
        logger.error(`[${accountId}] Dados da conta não encontrados`, accountId);
        return false;
      }
      
      const page = this.pages[accountId];
      if (!page) {
        logger.error(`[${accountId}] Página não encontrada`, accountId);
        return false;
      }
      
      // Verificar se já está logado
      const isLoggedIn = await authTasks.checkIfLoggedIn(page, accountId);
      
      if (isLoggedIn) {
        logger.info(`[${accountId}] Já está logado, pulando login`, accountId);
        return true;
      }
      
      // Realizar login
      const loginSuccess = await retry(
        async () => authTasks.loginWithCookiePersistence(page, account.username, account.password, accountId),
        RETRY.LOGIN,
        RETRY.RETRY_DELAY,
        (error) => logger.warn(`[${accountId}] Tentativa de login falhou: ${error.message}`, accountId)
      );
      
      if (!loginSuccess) {
        logger.error(`[${accountId}] Falha ao realizar login após ${RETRY.LOGIN} tentativas`, accountId);
        return false;
      }
      
      // Verificar e resolver captcha (se necessário)
      const captchaDetected = await this.antiDetection.checkForDetection(page, accountId);
      
      if (captchaDetected) {
        logger.info(`[${accountId}] Captcha detectado após login, tentando resolver`, accountId);
        
        const captchaSolved = await authTasks.checkAndResolveCaptcha(
          page, this.captchaSolver, accountId
        );
        
        if (!captchaSolved) {
          logger.error(`[${accountId}] Falha ao resolver captcha, login comprometido`, accountId);
          return false;
        }
      }
      
      logger.info(`[${accountId}] Login realizado com sucesso`, accountId);
      return true;
    } catch (error) {
      logger.error(`[${accountId}] Erro durante processo de login: ${error.message}`, accountId, error);
      return false;
    }
  }
  
  /**
   * Executar uma sequência de tarefas para uma conta
   * @param {string} accountId - Identificador da conta
   * @returns {Promise<Object>} - Resultados das tarefas
   */
  async executeTaskSequence(accountId) {
    try {
      logger.info(`[${accountId}] Iniciando sequência de tarefas`, accountId);
      
      const page = this.pages[accountId];
      if (!page) {
        logger.error(`[${accountId}] Página não encontrada para executar tarefas`, accountId);
        return { success: false };
      }
      
      // Verificar se está logado
      const isLoggedIn = await authTasks.checkIfLoggedIn(page, accountId);
      
      if (!isLoggedIn) {
        logger.error(`[${accountId}] Não está logado, impossível executar tarefas`, accountId);
        return { success: false };
      }
      
      // Gerar sequência aleatória de tarefas
      const taskSequence = this._generateRandomTaskSequence();
      
      logger.info(`[${accountId}] Sequência de tarefas: ${taskSequence.join(', ')}`, accountId);
      
      // Verificar perfil e obter contagem de poções
      const profileCheck = await gameTasks.checkProfile(page, accountId);
      let hastePotions = profileCheck.hasteCount || 0;
      
      // Resultados das tarefas
      const results = {
        success: true,
        taskResults: {},
        totalRewards: {
          xp: 0,
          currency: 0,
          items: []
        }
      };
      
      // Executar tarefas em sequência
      for (const task of taskSequence) {
        if (this.isShuttingDown) break;
        
        try {
          logger.info(`[${accountId}] Executando tarefa: ${task}`, accountId);
          
          // Pequeno atraso entre tarefas
          await delay(randomInteger(TIMING.MIN_TASK_DELAY, TIMING.MAX_TASK_DELAY));
          
          // Verificar e resolver captcha antes de cada tarefa
          const captchaDetected = await this.antiDetection.checkForDetection(page, accountId);
          
          if (captchaDetected) {
            logger.info(`[${accountId}] Captcha detectado antes da tarefa ${task}, tentando resolver`, accountId);
            
            const captchaSolved = await authTasks.checkAndResolveCaptcha(
              page, this.captchaSolver, accountId
            );
            
            if (!captchaSolved) {
              logger.error(`[${accountId}] Falha ao resolver captcha, pulando tarefa ${task}`, accountId);
              continue;
            }
          }
          
          // Executar tarefa específica
          let taskResult;
          
          switch (task) {
            case 'participatePvP':
              // Usar poções de Haste antes de PVP se disponíveis
              if (hastePotions >= HASTE.POTIONS_PER_USE) {
                const hasteResult = await gameTasks.useHastePotions(page, hastePotions, accountId);
                
                if (hasteResult.success) {
                  hastePotions -= hasteResult.potionsUsed;
                  logger.info(`[${accountId}] Usou ${hasteResult.potionsUsed} poções de Haste, restam ${hastePotions}`, accountId);
                }
              }
              
              taskResult = await gameTasks.participatePvP(page, accountId);
              break;
              
            case 'performJob':
              taskResult = await gameTasks.performJob(page, accountId);
              break;
              
            case 'visitTemple':
              taskResult = await gameTasks.visitTemple(page, accountId);
              break;
              
            case 'exploreDungeon':
              taskResult = await gameTasks.exploreDungeon(page, accountId);
              break;
              
            case 'checkRanking':
              taskResult = await gameTasks.checkRanking(page, accountId);
              break;
              
            default:
              logger.warn(`[${accountId}] Tarefa desconhecida: ${task}`, accountId);
              continue;
          }
          
          // Registrar resultado
          results.taskResults[task] = taskResult;
          
          // Acumular recompensas
          if (taskResult && taskResult.success && taskResult.rewards) {
            results.totalRewards.xp += taskResult.rewards.xp || 0;
            results.totalRewards.currency += taskResult.rewards.currency || 0;
            
            if (Array.isArray(taskResult.rewards.items)) {
              results.totalRewards.items.push(...taskResult.rewards.items);
            }
          }
          
          logger.info(`[${accountId}] Tarefa ${task} concluída com ${taskResult?.success ? 'sucesso' : 'falha'}`, accountId);
        } catch (taskError) {
          logger.error(`[${accountId}] Erro na tarefa ${task}: ${taskError.message}`, accountId, taskError);
          results.taskResults[task] = { success: false, error: taskError.message };
        }
      }
      
      logger.info(`[${accountId}] Sequência de tarefas concluída`, accountId);
      return results;
    } catch (error) {
      logger.error(`[${accountId}] Erro ao executar sequência de tarefas: ${error.message}`, accountId, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Gerar uma sequência aleatória de tarefas
   * @returns {Array<string>} - Lista de nomes de tarefas
   * @private
   */
  _generateRandomTaskSequence() {
    // Lista de todas as tarefas disponíveis
    const availableTasks = [
      'participatePvP',
      'performJob',
      'visitTemple',
      'exploreDungeon',
      'checkRanking'
    ];
    
    // Embaralhar a lista
    const shuffled = [...availableTasks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Pegar um número aleatório de tarefas (entre 2 e o total)
    const taskCount = Math.max(2, Math.floor(Math.random() * availableTasks.length));
    
    // Sempre incluir PVP e pelo menos uma outra tarefa
    const sequence = ['participatePvP'];
    
    // Adicionar outras tarefas aleatórias (sem PVP, pois já está incluído)
    const otherTasks = shuffled.filter(task => task !== 'participatePvP');
    
    for (let i = 0; i < taskCount - 1 && i < otherTasks.length; i++) {
      sequence.push(otherTasks[i]);
    }
    
    // Embaralhar a sequência final
    for (let i = sequence.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sequence[i], sequence[j]] = [sequence[j], sequence[i]];
    }
    
    return sequence;
  }
  
  /**
   * Iniciar timer para resetar cookies periodicamente
   * @param {number} interval - Intervalo em milissegundos
   */
  startCookieResetTimer(interval = 3600000) { // Default 1 hora
    logger.info(`Iniciando timer de reset de cookies (intervalo: ${interval}ms)`);
    
    this.cookieResetTimer = setInterval(async () => {
      try {
        const accountIds = Object.keys(this.sessions).filter(id => this.sessions[id].isActive);
        
        for (const accountId of accountIds) {
          try {
            logger.info(`[${accountId}] Resetando cookies periodicamente`, accountId);
            
            // Salvar cookies atuais
            const page = this.pages[accountId];
            if (!page) continue;
            
            const userDataDir = path.join(process.cwd(), PATHS.BROWSER_DATA_DIR, accountId);
            const cookiesPath = path.join(userDataDir, 'cookies.json');
            
            const cookies = await page.cookies();
            fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
            
            // Limpar cookies do navegador
            await page.deleteCookie(...cookies);
            
            // Recarregar cookies
            const cookiesString = fs.readFileSync(cookiesPath, 'utf8');
            const loadedCookies = JSON.parse(cookiesString);
            await page.setCookie(...loadedCookies);
            
            logger.info(`[${accountId}] Cookies resetados com sucesso`, accountId);
          } catch (error) {
            logger.warn(`[${accountId}] Erro ao resetar cookies: ${error.message}`, accountId);
          }
        }
      } catch (error) {
        logger.error(`Erro no timer de reset de cookies: ${error.message}`, null, error);
      }
    }, interval);
  }
  
  /**
   * Finalizar e liberar recursos
   */
  async shutdown() {
    logger.info('Iniciando desligamento do bot');
    
    // Marcar como em desligamento para evitar novas tarefas
    this.isShuttingDown = true;
    
    // Limpar timers
    if (this.cookieResetTimer) {
      clearInterval(this.cookieResetTimer);
    }
    
    // Encerrar todas as sessões
    await this.endAllSessions();
    
    logger.info('Bot desligado com sucesso');
  }
}

module.exports = Bot;