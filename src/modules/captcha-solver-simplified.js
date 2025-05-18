/**
 * Módulo simplificado para resolução de captchas - sem dependência do Canvas
 * para compatibilidade com o Replit
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Solver } = require('@2captcha/captcha-solver');
const logger = require('../utils/logger');
const { CAPTCHA, PATHS } = require('../config');

class CaptchaSolver {
  constructor() {
    // Checar se a chave de API está definida
    const apiKey = process.env.CAPTCHA_API_KEY;
    if (!apiKey) {
      logger.warn('CAPTCHA_API_KEY não encontrada no arquivo .env');
    }

    // Inicializar o solver do 2captcha
    this.solver = new Solver(apiKey);
    
    // Garantir que o diretório de imagens de captcha existe
    this.captchaImagesDir = path.join(process.cwd(), PATHS.CAPTCHA_IMAGES_DIR);
    if (!fs.existsSync(this.captchaImagesDir)) {
      fs.mkdirSync(this.captchaImagesDir, { recursive: true });
    }

    // Inicializar contador de tentativas por conta
    this.accountAttempts = {};
    this.accountLockouts = {};

    logger.info('CaptchaSolver simplificado inicializado');
  }

  /**
   * Verifica se a conta está em período de bloqueio por captcha
   * @param {string} accountId - Identificador da conta
   * @returns {boolean} - Se a conta está bloqueada
   */
  isAccountLockedOut(accountId) {
    const lockoutUntil = this.accountLockouts[accountId];
    if (!lockoutUntil) return false;
    
    const now = Date.now();
    if (now < lockoutUntil) {
      const remainingMinutes = Math.ceil((lockoutUntil - now) / (60 * 1000));
      logger.warn(`[${accountId}] Conta bloqueada por falhas de captcha (${remainingMinutes} minutos restantes)`, accountId);
      return true;
    }
    
    // Limpar o bloqueio expirado
    delete this.accountLockouts[accountId];
    return false;
  }

  /**
   * Define bloqueio para a conta após muitas falhas de captcha
   * @param {string} accountId - Identificador da conta
   */
  setAccountLockout(accountId) {
    const lockoutDuration = CAPTCHA.LOCKOUT_MINUTES * 60 * 1000;
    const lockoutUntil = Date.now() + lockoutDuration;
    this.accountLockouts[accountId] = lockoutUntil;
    
    logger.warn(`[${accountId}] Conta bloqueada por ${CAPTCHA.LOCKOUT_MINUTES} minutos devido a falhas de captcha`, accountId);
    
    // Resetar as tentativas
    this.accountAttempts[accountId] = 0;
  }

  /**
   * Salva a imagem do captcha para depuração
   * @param {Buffer} imageBuffer - Buffer da imagem
   * @param {string} accountId - Identificador da conta
   * @returns {string} - Caminho para a imagem salva
   */
  saveCaptchaImage(imageBuffer, accountId) {
    try {
      // Cria um nome de arquivo único
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `captcha-${accountId}-${timestamp}.png`;
      const filepath = path.join(this.captchaImagesDir, filename);
      
      // Salva a imagem
      fs.writeFileSync(filepath, imageBuffer);
      logger.debug(`[${accountId}] Imagem de captcha salva em ${filepath}`, accountId);
      
      return filepath;
    } catch (error) {
      logger.error(`[${accountId}] Erro ao salvar imagem de captcha: ${error.message}`, accountId, error);
      return null;
    }
  }

  /**
   * Resolve captcha de imagem com 2captcha
   * @param {Buffer|Array<Buffer>} imageBuffer - Buffer da imagem de captcha ou array de buffers
   * @param {string} accountId - Identificador da conta
   * @returns {Promise<string|null>} - Solução do captcha ou null se falhou
   */
  async solveImageCaptcha(imageBuffer, accountId) {
    try {
      // Verificar se está bloqueado
      if (this.isAccountLockedOut(accountId)) {
        return null;
      }

      // Inicializar contagem de tentativas
      if (!this.accountAttempts[accountId]) {
        this.accountAttempts[accountId] = 0;
      }
      
      // Incrementar tentativas
      this.accountAttempts[accountId]++;
      
      // Verificar se excedeu o limite
      if (this.accountAttempts[accountId] > CAPTCHA.MAX_ATTEMPTS) {
        this.setAccountLockout(accountId);
        return null;
      }

      logger.info(`[${accountId}] Tentando resolver captcha (tentativa ${this.accountAttempts[accountId]}/${CAPTCHA.MAX_ATTEMPTS})`, accountId);
      
      // Salvar imagem(s) para depuração
      if (Array.isArray(imageBuffer)) {
        imageBuffer.forEach((buffer, index) => {
          this.saveCaptchaImage(buffer, `${accountId}-part${index+1}`);
        });
      } else {
        this.saveCaptchaImage(imageBuffer, accountId);
      }

      // Enviar para o 2captcha
      let buffer = imageBuffer;
      // Caso seja array, usamos apenas o primeiro buffer por simplicidade
      // Na versão completa, combinaríamos as imagens
      if (Array.isArray(buffer)) {
        buffer = buffer[0];
      }

      const result = await this.solver.imageCaptcha({
        body: buffer.toString('base64'),
        numeric: CAPTCHA.NUMERIC_ONLY ? 1 : 0,
        minLength: CAPTCHA.MIN_LENGTH,
        maxLength: CAPTCHA.MAX_LENGTH,
        caseSensitive: CAPTCHA.CASE_SENSITIVE ? 1 : 0
      });

      if (result && result.data) {
        logger.info(`[${accountId}] Captcha resolvido: ${result.data}`, accountId);
        
        // Resetar tentativas após sucesso
        this.accountAttempts[accountId] = 0;
        
        return result.data;
      } else {
        logger.warn(`[${accountId}] 2captcha não retornou solução`, accountId);
        return null;
      }
    } catch (error) {
      logger.error(`[${accountId}] Erro ao resolver captcha: ${error.message}`, accountId, error);
      return null;
    }
  }

  /**
   * Resolve reCAPTCHA com 2captcha
   * @param {string} siteKey - Chave do site reCAPTCHA
   * @param {string} url - URL da página
   * @param {string} accountId - Identificador da conta
   * @returns {Promise<string|null>} - Token reCAPTCHA ou null se falhou
   */
  async solveRecaptcha(siteKey, url, accountId) {
    try {
      // Verificar se está bloqueado
      if (this.isAccountLockedOut(accountId)) {
        return null;
      }

      // Inicializar contagem de tentativas
      if (!this.accountAttempts[accountId]) {
        this.accountAttempts[accountId] = 0;
      }
      
      // Incrementar tentativas
      this.accountAttempts[accountId]++;
      
      // Verificar se excedeu o limite
      if (this.accountAttempts[accountId] > CAPTCHA.MAX_ATTEMPTS) {
        this.setAccountLockout(accountId);
        return null;
      }

      logger.info(`[${accountId}] Tentando resolver reCAPTCHA (tentativa ${this.accountAttempts[accountId]}/${CAPTCHA.MAX_ATTEMPTS})`, accountId);

      const result = await this.solver.recaptcha({
        googlekey: siteKey,
        pageurl: url
      });

      if (result && result.data) {
        logger.info(`[${accountId}] reCAPTCHA resolvido`, accountId);
        
        // Resetar tentativas após sucesso
        this.accountAttempts[accountId] = 0;
        
        return result.data;
      } else {
        logger.warn(`[${accountId}] 2captcha não retornou solução para reCAPTCHA`, accountId);
        return null;
      }
    } catch (error) {
      logger.error(`[${accountId}] Erro ao resolver reCAPTCHA: ${error.message}`, accountId, error);
      return null;
    }
  }

  /**
   * Gerencia o fluxo de resolução de captcha com retentativas
   * @param {Object} page - Objeto página do Puppeteer
   * @param {Function} extractCaptchaFn - Função para extrair dados do captcha
   * @param {Function} submitCaptchaFn - Função para submeter solução do captcha
   * @param {Function} verifyCaptchaFn - Função para verificar sucesso do captcha
   * @param {string} accountId - Identificador da conta
   * @returns {Promise<boolean>} - Se o captcha foi resolvido com sucesso
   */
  async handleCaptcha(page, extractCaptchaFn, submitCaptchaFn, verifyCaptchaFn, accountId) {
    const maxAttempts = Math.min(CAPTCHA.MAX_ATTEMPTS, 3);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Verificar se a conta está bloqueada
        if (this.isAccountLockedOut(accountId)) {
          return false;
        }

        logger.info(`[${accountId}] Iniciando resolução de captcha (tentativa ${attempt}/${maxAttempts})`, accountId);
        
        // Extrair dados do captcha
        const captchaData = await extractCaptchaFn(page);
        if (!captchaData) {
          logger.warn(`[${accountId}] Não foi possível extrair dados do captcha`, accountId);
          continue;
        }
        
        // Resolver captcha
        let solution;
        if (captchaData.type === 'image') {
          solution = await this.solveImageCaptcha(captchaData.image, accountId);
        } else if (captchaData.type === 'recaptcha') {
          solution = await this.solveRecaptcha(captchaData.siteKey, captchaData.url, accountId);
        }
        
        if (!solution) {
          logger.warn(`[${accountId}] Não foi possível obter solução do captcha`, accountId);
          continue;
        }
        
        // Submeter solução
        await submitCaptchaFn(page, solution);
        
        // Verificar sucesso
        const success = await verifyCaptchaFn(page);
        if (success) {
          logger.info(`[${accountId}] Captcha resolvido com sucesso`, accountId);
          return true;
        } else {
          logger.warn(`[${accountId}] Verificação do captcha falhou`, accountId);
        }
      } catch (error) {
        logger.error(`[${accountId}] Erro na tentativa ${attempt} de resolver captcha: ${error.message}`, accountId, error);
      }
    }
    
    // Se chegamos aqui, todas as tentativas falharam
    if (!this.isAccountLockedOut(accountId)) {
      this.setAccountLockout(accountId);
    }
    
    return false;
  }
}

module.exports = CaptchaSolver;