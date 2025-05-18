/**
 * Sistema de Logging para o Bot
 */
const fs = require('fs');
const path = require('path');
const { formatISODate } = require('./helpers');
const { PATHS } = require('../config');

// Níveis de log
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// Configuração do logger
const config = {
  level: LOG_LEVELS.INFO, // Nível de log padrão
  outputToConsole: true, // Saída para console
  outputToFile: true, // Saída para arquivo
  colorizeConsole: true, // Colorir saída do console
  includeTimestamp: true, // Incluir timestamp nos logs
  logDirectory: path.join(process.cwd(), PATHS.LOGS_DIR), // Diretório de logs
  accountLogFiles: {} // Cache para arquivos de log por conta
};

// Cores para logs no console
const COLORS = {
  RESET: '\x1b[0m',
  DEBUG: '\x1b[36m', // Ciano
  INFO: '\x1b[32m',  // Verde
  WARN: '\x1b[33m',  // Amarelo
  ERROR: '\x1b[31m'  // Vermelho
};

// Criar diretório de logs se não existir
if (config.outputToFile && !fs.existsSync(config.logDirectory)) {
  fs.mkdirSync(config.logDirectory, { recursive: true });
}

/**
 * Registra uma mensagem de log
 * @param {string} level - Nível do log (DEBUG, INFO, WARN, ERROR)
 * @param {string} message - Mensagem do log
 * @param {string} [accountId] - ID da conta relacionada ao log
 * @param {Error} [error] - Objeto de erro opcional
 */
function log(level, message, accountId = null, error = null) {
  // Verificar nível de log
  if (LOG_LEVELS[level] < config.level) {
    return;
  }

  // Formatar timestamp
  const timestamp = config.includeTimestamp ? formatISODate() : '';
  
  // Formatar mensagem
  let logMessage = `[${timestamp}] [${level}] ${message}`;
  
  // Se houver erro, adicionar stack trace
  if (error && error.stack) {
    logMessage += `\n${error.stack}`;
  }
  
  // Output para console
  if (config.outputToConsole) {
    if (config.colorizeConsole) {
      const color = COLORS[level] || COLORS.RESET;
      console.log(`${color}${logMessage}${COLORS.RESET}`);
    } else {
      console.log(logMessage);
    }
  }
  
  // Output para arquivo
  if (config.outputToFile) {
    try {
      // Log geral
      const logFile = path.join(config.logDirectory, `app-${new Date().toISOString().split('T')[0]}.log`);
      fs.appendFileSync(logFile, logMessage + '\n');
      
      // Log específico por conta
      if (accountId) {
        const accountLogDir = path.join(config.logDirectory, 'accounts');
        if (!fs.existsSync(accountLogDir)) {
          fs.mkdirSync(accountLogDir, { recursive: true });
        }
        
        const accountLogFile = path.join(accountLogDir, `${accountId}.log`);
        fs.appendFileSync(accountLogFile, logMessage + '\n');
      }
    } catch (err) {
      // Fallback para console se falhar ao escrever arquivo
      console.error(`Erro ao escrever log em arquivo: ${err.message}`);
      console.log(logMessage);
    }
  }
}

/**
 * Configurar o logger
 * @param {Object} options - Opções de configuração
 */
function configure(options = {}) {
  // Mesclar configurações
  Object.assign(config, options);
  
  // Converter nível de string para número se necessário
  if (typeof config.level === 'string') {
    config.level = LOG_LEVELS[config.level.toUpperCase()] || LOG_LEVELS.INFO;
  }
}

/**
 * Log nível DEBUG
 * @param {string} message - Mensagem do log
 * @param {string} [accountId] - ID da conta relacionada ao log
 * @param {Error} [error] - Objeto de erro opcional
 */
function debug(message, accountId = null, error = null) {
  log('DEBUG', message, accountId, error);
}

/**
 * Log nível INFO
 * @param {string} message - Mensagem do log
 * @param {string} [accountId] - ID da conta relacionada ao log
 * @param {Error} [error] - Objeto de erro opcional
 */
function info(message, accountId = null, error = null) {
  log('INFO', message, accountId, error);
}

/**
 * Log nível WARN
 * @param {string} message - Mensagem do log
 * @param {string} [accountId] - ID da conta relacionada ao log
 * @param {Error} [error] - Objeto de erro opcional
 */
function warn(message, accountId = null, error = null) {
  log('WARN', message, accountId, error);
}

/**
 * Log nível ERROR
 * @param {string} message - Mensagem do log
 * @param {string} [accountId] - ID da conta relacionada ao log
 * @param {Error} [error] - Objeto de erro opcional
 */
function error(message, accountId = null, error = null) {
  log('ERROR', message, accountId, error);
}

module.exports = {
  configure,
  debug,
  info,
  warn,
  error,
  LOG_LEVELS
};