/**
 * Realistic keyboard patterns for human-like typing behavior
 * This plugin enhances typing patterns to avoid detection
 */

const { randomInteger, randomFloat } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Generates realistic typing speed variations based on character transitions
 * to mimic human typing patterns
 */
class KeyboardPatterns {
  constructor() {
    // Character difficulty matrix
    this.difficultyMatrix = this._generateDifficultyMatrix();
    
    // Define finger placements and difficulty multipliers
    this.fingerPlacements = {
      'q': 'left-pinky',
      'a': 'left-pinky',
      'z': 'left-pinky',
      'w': 'left-ring',
      's': 'left-ring',
      'x': 'left-ring',
      'e': 'left-middle',
      'd': 'left-middle',
      'c': 'left-middle',
      'r': 'left-index',
      'f': 'left-index',
      'v': 'left-index',
      't': 'left-index',
      'g': 'left-index',
      'b': 'left-index',
      'y': 'right-index',
      'h': 'right-index',
      'n': 'right-index',
      'u': 'right-index',
      'j': 'right-index',
      'm': 'right-index',
      'i': 'right-middle',
      'k': 'right-middle',
      ',': 'right-middle',
      'o': 'right-ring',
      'l': 'right-ring',
      '.': 'right-ring',
      'p': 'right-pinky',
      ';': 'right-pinky',
      '/': 'right-pinky'
    };
  }
  
  /**
   * Generate pseudo-realistic difficulty matrix for character transitions
   * @returns {Object} - Matrix of character transition difficulties
   * @private
   */
  _generateDifficultyMatrix() {
    const matrix = {};
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789,.;:\'"-=+!@#$%^&*()_[]{}\\|/?<> ';
    
    for (const from of characters) {
      matrix[from] = {};
      
      for (const to of characters) {
        // Base difficulty (higher means slower transition)
        let difficulty = 1.0;
        
        // Same character is easiest
        if (from === to) {
          difficulty = 0.8;
        }
        
        // Adjacent keys are easier
        if (this._areKeysAdjacent(from, to)) {
          difficulty = 0.9;
        }
        
        // Shift key adds difficulty
        if (this._requiresShift(to)) {
          difficulty += 0.3;
        }
        
        // Number row to letter row transition is harder
        if (/[0-9]/.test(from) && /[a-z]/.test(to)) {
          difficulty += 0.2;
        }
        
        // Special character transitions are harder
        if (/[^a-z0-9\s]/.test(to)) {
          difficulty += 0.2;
        }
        
        // Some combinations are naturally slower for humans
        if (/[zxcvb]/.test(from) && /[qwert]/.test(to)) {
          difficulty += 0.3;
        }
        
        // Add some randomness
        difficulty *= 0.8 + (Math.random() * 0.4);
        
        matrix[from][to] = difficulty;
      }
    }
    
    return matrix;
  }
  
  /**
   * Check if two keys are adjacent on the keyboard
   * @param {string} key1 - First key
   * @param {string} key2 - Second key
   * @returns {boolean} - Whether keys are adjacent
   * @private
   */
  _areKeysAdjacent(key1, key2) {
    // Simplified adjacency check
    const adjacencyMap = {
      'q': 'was',
      'w': 'qase',
      'e': 'wsdr',
      'r': 'edft',
      't': 'rfgy',
      'y': 'tghu',
      'u': 'yhji',
      'i': 'ujko',
      'o': 'iklp',
      'p': 'ol',
      'a': 'qwszx',
      's': 'awedxzc',
      'd': 'serfcv',
      'f': 'drtgvb',
      'g': 'ftyhbn',
      'h': 'gyujnm',
      'j': 'huikm',
      'k': 'jiol',
      'l': 'kop',
      'z': 'asx',
      'x': 'zsdc',
      'c': 'xdfv',
      'v': 'cfgb',
      'b': 'vghn',
      'n': 'bhjm',
      'm': 'njk',
      ' ': 'bnm'
    };
    
    key1 = key1.toLowerCase();
    key2 = key2.toLowerCase();
    
    return adjacencyMap[key1]?.includes(key2) || adjacencyMap[key2]?.includes(key1) || false;
  }
  
  /**
   * Check if a key requires the shift key
   * @param {string} key - The key to check
   * @returns {boolean} - Whether the key requires shift
   * @private
   */
  _requiresShift(key) {
    return /[A-Z!@#$%^&*()_+{}:"<>?~|]/.test(key);
  }
  
  /**
   * Calculate the typing delay for a character transition
   * @param {string} prevChar - Previous character
   * @param {string} nextChar - Next character
   * @param {number} baseSpeed - Base typing speed in ms
   * @returns {number} - Delay in milliseconds
   */
  getTypingDelay(prevChar, nextChar, baseSpeed = 100) {
    // Default to average difficulty if characters aren't in the matrix
    let difficulty = 1.0;
    
    // Get difficulty from matrix if available
    if (prevChar && nextChar) {
      const lowerPrev = prevChar.toLowerCase();
      const lowerNext = nextChar.toLowerCase();
      
      if (this.difficultyMatrix[lowerPrev] && this.difficultyMatrix[lowerPrev][lowerNext]) {
        difficulty = this.difficultyMatrix[lowerPrev][lowerNext];
      }
    }
    
    // Apply thinking pause if typing a complex sequence
    let extraDelay = 0;
    if (nextChar && /[.,;:!?]/.test(nextChar)) {
      // Pausing at punctuation
      extraDelay = randomInteger(100, 500);
    } else if (nextChar === ' ') {
      // Slight pause at spaces
      extraDelay = randomInteger(20, 150);
    }
    
    // Calculate final delay with some natural variation
    const normalizedDelay = baseSpeed * difficulty * (0.8 + (Math.random() * 0.4)) + extraDelay;
    
    return Math.round(normalizedDelay);
  }
  
  /**
   * Generate a realistic mistake in typing
   * @param {string} text - The text being typed
   * @param {number} position - Current position in the text
   * @returns {Object|null} - Mistake details or null if no mistake
   */
  generateMistake(text, position) {
    // Only generate mistakes occasionally (5-10% chance depending on text length)
    const mistakeChance = 0.05 + (text.length > 20 ? 0.05 : 0);
    
    if (Math.random() > mistakeChance) {
      return null;
    }
    
    const mistakeTypes = [
      'adjacent', // Type adjacent key
      'transposition', // Swap two characters
      'insertion', // Insert an extra character
      'omission' // Miss a character and need to go back
    ];
    
    const mistakeType = mistakeTypes[Math.floor(Math.random() * mistakeTypes.length)];
    let result = null;
    
    switch (mistakeType) {
      case 'adjacent':
        const currentChar = text[position];
        if (currentChar && currentChar.match(/[a-z]/i)) {
          // Find a realistic adjacent key to mistype
          const adjacencyMap = {
            'q': 'wa', 'w': 'qase', 'e': 'wsd', 'r': 'efdt', 't': 'rgy',
            'y': 'thu', 'u': 'yij', 'i': 'uok', 'o': 'ipl', 'p': 'o[',
            'a': 'qswz', 's': 'weadzx', 'd': 'erfcx', 'f': 'rtvg', 'g': 'tyhf',
            'h': 'yujg', 'j': 'uikh', 'k': 'iolj', 'l': 'op;k', 'z': 'asx',
            'x': 'sdzc', 'c': 'xdfv', 'v': 'cfgb', 'b': 'vghn', 'n': 'hjmb',
            'm': 'nkj', ' ': ' '
          };
          
          const possibleMistakes = adjacencyMap[currentChar.toLowerCase()] || 'e';
          const mistakeChar = possibleMistakes[Math.floor(Math.random() * possibleMistakes.length)];
          
          result = {
            type: 'adjacent',
            correctChar: currentChar,
            mistakeChar: mistakeChar,
            backspaces: 1
          };
        }
        break;
        
      case 'transposition':
        // Only if we're not at the beginning or end
        if (position > 0 && position < text.length - 1) {
          result = {
            type: 'transposition',
            char1: text[position],
            char2: text[position + 1],
            backspaces: 2
          };
        }
        break;
        
      case 'insertion':
        // Random insertions
        const insertChars = 'etaoinshrdlu'; // Common letters
        const randomChar = insertChars[Math.floor(Math.random() * insertChars.length)];
        
        result = {
          type: 'insertion',
          insertedChar: randomChar,
          backspaces: 1
        };
        break;
        
      case 'omission':
        // Only if we're not at the end
        if (position < text.length - 1) {
          result = {
            type: 'omission',
            missedChar: text[position],
            backspaces: 0
          };
        }
        break;
    }
    
    return result;
  }
}

module.exports = new KeyboardPatterns();