/**
 * Funções utilitárias para uso em todo o bot
 */

/**
 * Cria um atraso/sleep
 * @param {number} ms - Milissegundos para esperar
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Gera um número inteiro aleatório entre min e max (inclusivo)
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {number} - Número inteiro aleatório
 */
function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Gera um número float aleatório entre min e max
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {number} - Número float aleatório
 */
function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Espera um elemento ficar visível na página
 * @param {Object} page - Página do Puppeteer
 * @param {string} selector - Seletor CSS para o elemento
 * @param {number} timeout - Tempo máximo de espera em ms
 * @returns {Promise<ElementHandle|null>} - Handle do elemento ou null
 */
async function waitForVisible(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { 
      visible: true, 
      timeout 
    });
    return await page.$(selector);
  } catch (error) {
    return null;
  }
}

/**
 * Escolhe um item aleatório de um array
 * @param {Array} array - Array para escolher
 * @returns {*} - Item aleatório do array
 */
function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Embaralha um array
 * @param {Array} array - Array para embaralhar
 * @returns {Array} - Array embaralhado
 */
function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Formata uma data para string ISO
 * @param {Date} date - Data para formatar
 * @returns {string} - String ISO formatada
 */
function formatISODate(date = new Date()) {
  return date.toISOString();
}

/**
 * Formata uma data em formato legível
 * @param {Date} date - Data para formatar
 * @returns {string} - String de data formatada
 */
function formatReadableDate(date = new Date()) {
  return date.toLocaleString();
}

/**
 * Verifica se um valor é um objeto
 * @param {*} value - Valor para verificar
 * @returns {boolean} - Se é um objeto
 */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Mescla objetos profundamente
 * @param {Object} target - Objeto alvo
 * @param {...Object} sources - Objetos fonte
 * @returns {Object} - Objeto mesclado
 */
function deepMerge(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * Retorna um timestamp formatado
 * @returns {string} - Timestamp formatado
 */
function getTimestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
}

/**
 * Verifica se um objeto está vazio
 * @param {Object} obj - Objeto para verificar
 * @returns {boolean} - Se o objeto está vazio
 */
function isEmptyObject(obj) {
  return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
}

/**
 * Tenta uma operação múltiplas vezes
 * @param {Function} fn - Função para tentar
 * @param {number} retries - Número de tentativas
 * @param {number} delay - Delay entre tentativas em ms
 * @param {Function} onError - Callback para erros
 * @returns {Promise<*>} - Resultado da função
 */
async function retry(fn, retries = 3, delayMs = 1000, onError = null) {
  try {
    return await fn();
  } catch (error) {
    if (onError) {
      onError(error);
    }
    
    if (retries <= 1) {
      throw error;
    }
    
    await delay(delayMs);
    return retry(fn, retries - 1, delayMs, onError);
  }
}

module.exports = {
  delay,
  randomInteger,
  randomFloat,
  waitForVisible,
  randomChoice,
  shuffleArray,
  formatISODate,
  formatReadableDate,
  isObject,
  deepMerge,
  getTimestamp,
  isEmptyObject,
  retry
};