const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const logger = require('../utils/logger');
const { CAPTCHA, RETRY } = require('../config');
const { retry } = require('../utils/helpers');

/**
 * Handles captcha solving and related functionality
 */
class CaptchaSolver {
  constructor() {
    this.twoCapApi = process.env.TWO_CAPTCHA_API_KEY || '';
    this.accountLockouts = new Map(); // accountId -> lockout end time
    this.captchaAttempts = new Map(); // accountId -> number of attempts
    
    // Initialize 2captcha if API key is available
    if (this.twoCapApi) {
      try {
        this.solver = require('@2captcha/captcha-solver');
        logger.info('2captcha solver initialized');
      } catch (error) {
        logger.warn('Failed to initialize 2captcha solver', null, error);
        this.solver = null;
      }
    } else {
      logger.warn('No 2captcha API key found in environment, captcha solving will be limited');
      this.solver = null;
    }
  }

  /**
   * Check if account is in captcha lockout period
   * @param {string} accountId - Account identifier
   * @returns {boolean} - Whether account is locked out
   */
  isAccountLockedOut(accountId) {
    const lockoutEndTime = this.accountLockouts.get(accountId);
    if (!lockoutEndTime) return false;
    
    const now = Date.now();
    if (now >= lockoutEndTime) {
      // Lockout period has ended
      this.accountLockouts.delete(accountId);
      this.captchaAttempts.delete(accountId);
      return false;
    }
    
    return true;
  }

  /**
   * Set account in lockout after exceeding max captcha attempts
   * @param {string} accountId - Account identifier
   */
  setAccountLockout(accountId) {
    const lockoutMinutes = CAPTCHA.LOCKOUT_MINUTES || 30;
    const lockoutEndTime = Date.now() + (lockoutMinutes * 60 * 1000);
    
    this.accountLockouts.set(accountId, lockoutEndTime);
    logger.warn(`Account ${accountId} locked out for ${lockoutMinutes} minutes due to excessive captcha failures`);
  }

  /**
   * Combine multiple captcha images into one for solving
   * @param {Array<Buffer>} imageBuffers - Array of image buffers
   * @returns {Promise<Buffer|Array<Buffer>>} - Combined image buffer or original buffers if combining fails
   */
  async combineImages(imageBuffers) {
    try {
      if (!imageBuffers || imageBuffers.length === 0) {
        throw new Error('No image buffers provided');
      }
      
      if (imageBuffers.length === 1) {
        return imageBuffers[0];
      }
      
      // Load all images and get their dimensions
      const images = await Promise.all(imageBuffers.map(buffer => loadImage(buffer)));
      
      // Calculate combined dimensions
      const totalWidth = images.reduce((sum, img) => sum + img.width, 0);
      const maxHeight = Math.max(...images.map(img => img.height));
      
      // Create a canvas with the combined dimensions
      const canvas = createCanvas(totalWidth, maxHeight);
      const ctx = canvas.getContext('2d');
      
      // Draw each image onto the canvas
      let x = 0;
      for (const img of images) {
        ctx.drawImage(img, x, 0);
        x += img.width;
      }
      
      // Convert canvas to buffer
      const combinedBuffer = canvas.toBuffer('image/png');
      logger.info(`Combined ${images.length} images into one (${totalWidth}x${maxHeight})`);
      
      return combinedBuffer;
    } catch (error) {
      logger.error('Error combining images', null, error);
      return imageBuffers; // Return original buffers on error
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
      // Ensure captcha-images directory exists
      const captchaDir = path.resolve('captcha-images');
      if (!fs.existsSync(captchaDir)) {
        fs.mkdirSync(captchaDir, { recursive: true });
      }
      
      // Generate a unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `captcha_${accountId}_${timestamp}.png`;
      const filePath = path.join(captchaDir, filename);
      
      // Save the image
      fs.writeFileSync(filePath, imageBuffer);
      logger.debug(`Saved captcha image to ${filePath}`);
      
      return filePath;
    } catch (error) {
      logger.error(`Error saving captcha image for ${accountId}`, accountId, error);
      return null;
    }
  }

  /**
   * Solve image captcha
   * @param {Buffer|Array<Buffer>} imageBuffer - Captcha image buffer or array of buffers
   * @param {string} accountId - Account identifier
   * @returns {Promise<string|null>} - Captcha solution or null if failed
   */
  async solveImageCaptcha(imageBuffer, accountId) {
    try {
      // Check if account is locked out
      if (this.isAccountLockedOut(accountId)) {
        logger.warn(`Account ${accountId} is locked out from captcha solving due to excessive failures`);
        return null;
      }
      
      // Increment captcha attempt counter
      const attempts = (this.captchaAttempts.get(accountId) || 0) + 1;
      this.captchaAttempts.set(accountId, attempts);
      
      // If attempts exceed max attempts, lock out the account
      if (attempts > CAPTCHA.MAX_ATTEMPTS) {
        this.setAccountLockout(accountId);
        return null;
      }
      
      // If we have multiple image buffers, combine them
      let finalImageBuffer = imageBuffer;
      if (Array.isArray(imageBuffer)) {
        finalImageBuffer = await this.combineImages(imageBuffer);
      }
      
      // Save captcha image for debugging
      this.saveCaptchaImage(finalImageBuffer, accountId);
      
      // Check if we have a solver available
      if (!this.solver) {
        logger.warn(`No captcha solver available for account ${accountId}`);
        return null;
      }
      
      logger.info(`Attempting to solve captcha for account ${accountId}`);
      
      // Use 2captcha solver
      const client = new this.solver.Solver(this.twoCapApi);
      
      const result = await retry(async () => {
        const solution = await client.imageCaptcha({
          body: finalImageBuffer.toString('base64'),
          numeric: CAPTCHA.NUMERIC_ONLY ? 1 : 0,
          minLength: CAPTCHA.MIN_LENGTH,
          maxLength: CAPTCHA.MAX_LENGTH,
          case: CAPTCHA.CASE_SENSITIVE
        });
        
        if (!solution || !solution.data || solution.data.length < CAPTCHA.MIN_LENGTH) {
          throw new Error('Invalid captcha solution received');
        }
        
        return solution.data;
      }, {
        retries: RETRY.CAPTCHA_SOLVE,
        minDelay: 2000,
        maxDelay: 5000,
        onRetry: (error, attempt) => {
          logger.warn(`Captcha solve retry ${attempt} for account ${accountId}: ${error.message}`);
        }
      });
      
      logger.info(`Captcha solved successfully for account ${accountId}`);
      return result;
    } catch (error) {
      logger.error(`Error solving captcha for account ${accountId}: ${error.message}`, accountId, error);
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
      // Check if account is locked out
      if (this.isAccountLockedOut(accountId)) {
        logger.warn(`Account ${accountId} is locked out from captcha solving due to excessive failures`);
        return null;
      }
      
      // Increment captcha attempt counter
      const attempts = (this.captchaAttempts.get(accountId) || 0) + 1;
      this.captchaAttempts.set(accountId, attempts);
      
      // If attempts exceed max attempts, lock out the account
      if (attempts > CAPTCHA.MAX_ATTEMPTS) {
        this.setAccountLockout(accountId);
        return null;
      }
      
      // Check if we have a solver available
      if (!this.solver) {
        logger.warn(`No captcha solver available for account ${accountId}`);
        return null;
      }
      
      logger.info(`Attempting to solve reCAPTCHA for account ${accountId}`);
      
      // Use 2captcha solver
      const client = new this.solver.Solver(this.twoCapApi);
      
      const result = await retry(async () => {
        const solution = await client.recaptcha({
          googlekey: siteKey,
          pageurl: url,
          version: 'v2',
          invisible: 1
        });
        
        if (!solution || !solution.data) {
          throw new Error('Invalid reCAPTCHA solution received');
        }
        
        return solution.data;
      }, {
        retries: RETRY.CAPTCHA_SOLVE,
        minDelay: 2000,
        maxDelay: 5000,
        onRetry: (error, attempt) => {
          logger.warn(`reCAPTCHA solve retry ${attempt} for account ${accountId}: ${error.message}`);
        }
      });
      
      logger.info(`reCAPTCHA solved successfully for account ${accountId}`);
      return result;
    } catch (error) {
      logger.error(`Error solving reCAPTCHA for account ${accountId}: ${error.message}`, accountId, error);
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
    let attempts = 0;
    const maxAttempts = RETRY.CAPTCHA_HANDLE;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        logger.info(`Handling captcha (attempt ${attempts}/${maxAttempts}) for account ${accountId}`);
        
        // 1. Extract captcha data using the provided function
        const captchaData = await extractCaptchaFn(page);
        
        if (!captchaData) {
          logger.warn(`Failed to extract captcha data for account ${accountId}`);
          continue;
        }
        
        // 2. Solve the captcha
        let solution = null;
        
        if (captchaData.type === 'image') {
          solution = await this.solveImageCaptcha(captchaData.image, accountId);
        } else if (captchaData.type === 'recaptcha') {
          solution = await this.solveRecaptcha(captchaData.siteKey, captchaData.url, accountId);
        } else {
          logger.warn(`Unsupported captcha type: ${captchaData.type} for account ${accountId}`);
          continue;
        }
        
        if (!solution) {
          logger.warn(`Failed to solve captcha for account ${accountId}`);
          continue;
        }
        
        // 3. Submit the captcha solution using the provided function
        await submitCaptchaFn(page, solution);
        
        // 4. Verify if captcha was solved successfully
        const success = await verifyCaptchaFn(page);
        
        if (success) {
          logger.info(`Captcha handled successfully for account ${accountId}`);
          // Reset captcha attempts on success
          this.captchaAttempts.set(accountId, 0);
          return true;
        } else {
          logger.warn(`Captcha verification failed for account ${accountId}`);
        }
      } catch (error) {
        logger.error(`Error handling captcha for account ${accountId}: ${error.message}`, accountId, error);
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    logger.error(`Failed to handle captcha after ${maxAttempts} attempts for account ${accountId}`);
    return false;
  }
}

module.exports = CaptchaSolver;