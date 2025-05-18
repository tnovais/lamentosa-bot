const fs = require('fs');
const path = require('path');
const { Solver } = require('@2captcha/captcha-solver');
const { createCanvas, loadImage } = require('canvas');
const logger = require('../utils/logger');
const { delay, randomInteger } = require('../utils/helpers');
const { CAPTCHA } = require('../config');

/**
 * Handles captcha solving and related functionality
 */
class CaptchaSolver {
  constructor() {
    this.solver = new Solver(CAPTCHA.API_KEY);
    this.captchaLockouts = new Map(); // Track accounts in lockout
  }
  
  /**
   * Check if account is in captcha lockout period
   * @param {string} accountId - Account identifier
   * @returns {boolean} - Whether account is locked out
   */
  isAccountLockedOut(accountId) {
    if (!this.captchaLockouts.has(accountId)) {
      return false;
    }
    
    const lockoutEndTime = this.captchaLockouts.get(accountId);
    const currentTime = new Date();
    
    if (currentTime >= lockoutEndTime) {
      // Lockout period has expired
      this.captchaLockouts.delete(accountId);
      return false;
    }
    
    // Calculate remaining lockout time
    const remainingMinutes = Math.ceil((lockoutEndTime - currentTime) / 60000);
    logger.warn(`Account ${accountId} is in captcha lockout for another ${remainingMinutes} minutes`, accountId);
    
    return true;
  }
  
  /**
   * Set account in lockout after exceeding max captcha attempts
   * @param {string} accountId - Account identifier
   */
  setAccountLockout(accountId) {
    const lockoutEndTime = new Date();
    lockoutEndTime.setMinutes(lockoutEndTime.getMinutes() + CAPTCHA.LOCKOUT_MINUTES);
    
    this.captchaLockouts.set(accountId, lockoutEndTime);
    
    logger.warn(`Account ${accountId} placed in captcha lockout for ${CAPTCHA.LOCKOUT_MINUTES} minutes`, accountId);
  }
  
  /**
   * Combine multiple captcha images into one for solving
   * @param {Array<Buffer>} imageBuffers - Array of image buffers
   * @returns {Promise<Buffer>} - Combined image buffer
   */
  async combineImages(imageBuffers) {
    try {
      const canvas = createCanvas(400, 100);
      const ctx = canvas.getContext('2d');
      
      for (let i = 0; i < 4; i++) {
        const img = await loadImage(imageBuffers[i]);
        ctx.drawImage(img, i * 100, 0, 100, 100);
      }
      
      return canvas.toBuffer();
    } catch (error) {
      logger.error('Error combining captcha images', null, error);
      throw error;
    }
  }
  
  /**
   * Save captcha image for debugging
   * @param {Buffer} imageBuffer - Image buffer
   * @param {string} accountId - Account identifier
   * @returns {string} - Path to saved image
   */
  saveCaptchaImage(imageBuffer, accountId) {
    try {
      const captchaDir = path.join('captcha-images');
      
      if (!fs.existsSync(captchaDir)) {
        fs.mkdirSync(captchaDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const imagePath = path.join(captchaDir, `captcha_${accountId}_${timestamp}.png`);
      
      fs.writeFileSync(imagePath, imageBuffer);
      logger.debug(`Saved captcha image to ${imagePath}`, accountId);
      
      return imagePath;
    } catch (error) {
      logger.error('Error saving captcha image', accountId, error);
      return null;
    }
  }
  
  /**
   * Solve image captcha
   * @param {Buffer} imageBuffer - Captcha image buffer
   * @param {string} accountId - Account identifier
   * @returns {Promise<string|null>} - Captcha solution or null if failed
   */
  async solveImageCaptcha(imageBuffer, accountId) {
    try {
      // Save captcha for debugging
      this.saveCaptchaImage(imageBuffer, accountId);
      
      logger.info('Solving captcha...', accountId);
      
      // Add some delay to simulate human solving time
      await delay(randomInteger(2000, 5000));
      
      const result = await this.solver.imageCaptcha({
        body: imageBuffer,
        case: true, // case sensitive
        numeric: 2, // numeric plus latin alphabet
        minLength: 4,
        maxLength: 8
      });
      
      logger.info(`Captcha solved: ${result.code}`, accountId);
      return result.code;
    } catch (error) {
      logger.error(`Failed to solve captcha: ${error.message}`, accountId);
      return null;
    }
  }
  
  /**
   * Solve reCAPTCHA
   * @param {string} siteKey - reCAPTCHA site key
   * @param {string} url - Page URL
   * @param {string} accountId - Account identifier
   * @returns {Promise<string|null>} - reCAPTCHA solution or null if failed
   */
  async solveRecaptcha(siteKey, url, accountId) {
    try {
      logger.info('Solving reCAPTCHA...', accountId);
      
      // Add some delay to simulate human solving time
      await delay(randomInteger(10000, 20000));
      
      const result = await this.solver.recaptcha({
        sitekey: siteKey,
        url: url
      });
      
      logger.info('reCAPTCHA solved successfully', accountId);
      return result.code;
    } catch (error) {
      logger.error(`Failed to solve reCAPTCHA: ${error.message}`, accountId);
      return null;
    }
  }
  
  /**
   * Handle the complete captcha solving flow with retries
   * @param {Object} page - Puppeteer page
   * @param {Function} extractCaptchaFn - Function to extract captcha data
   * @param {Function} submitCaptchaFn - Function to submit captcha solution
   * @param {Function} verifyCaptchaFn - Function to verify captcha success
   * @param {string} accountId - Account identifier
   * @returns {Promise<boolean>} - Whether captcha was solved successfully
   */
  async handleCaptcha(page, extractCaptchaFn, submitCaptchaFn, verifyCaptchaFn, accountId) {
    // Check if account is in lockout period
    if (this.isAccountLockedOut(accountId)) {
      return false;
    }
    
    let attempts = 0;
    
    while (attempts < CAPTCHA.MAX_ATTEMPTS) {
      try {
        logger.info(`Captcha attempt ${attempts + 1}/${CAPTCHA.MAX_ATTEMPTS}`, accountId);
        
        // Extract captcha data
        const captchaData = await extractCaptchaFn(page);
        if (!captchaData) {
          logger.warn('Failed to extract captcha data', accountId);
          attempts++;
          continue;
        }
        
        // Solve captcha
        let solution;
        if (captchaData.type === 'image') {
          solution = await this.solveImageCaptcha(captchaData.data, accountId);
        } else if (captchaData.type === 'recaptcha') {
          solution = await this.solveRecaptcha(captchaData.siteKey, captchaData.url, accountId);
        } else {
          logger.warn(`Unsupported captcha type: ${captchaData.type}`, accountId);
          attempts++;
          continue;
        }
        
        if (!solution) {
          logger.warn('Failed to get captcha solution', accountId);
          attempts++;
          continue;
        }
        
        // Submit solution
        await submitCaptchaFn(page, solution);
        
        // Verify submission was successful
        const isSuccess = await verifyCaptchaFn(page);
        
        if (isSuccess) {
          logger.info('Captcha solved successfully', accountId);
          return true;
        } else {
          logger.warn('Captcha solution was incorrect', accountId);
          attempts++;
        }
      } catch (error) {
        logger.error(`Error during captcha handling: ${error.message}`, accountId);
        attempts++;
      }
      
      // Wait before retrying
      if (attempts < CAPTCHA.MAX_ATTEMPTS) {
        const retryDelay = randomInteger(3000, 8000);
        logger.info(`Waiting ${retryDelay / 1000}s before retry...`, accountId);
        await delay(retryDelay);
      }
    }
    
    // If we've exhausted all attempts, set account in lockout
    logger.error(`Failed to solve captcha after ${CAPTCHA.MAX_ATTEMPTS} attempts`, accountId);
    this.setAccountLockout(accountId);
    
    return false;
  }
}

module.exports = new CaptchaSolver();
