/**
 * Authentication related tasks
 */

const { delay, randomInteger } = require('../utils/helpers');
const logger = require('../utils/logger');
const { TIMING } = require('../config');

/**
 * Perform login with cookie persistence for better session management
 * @param {Object} page - Puppeteer page object
 * @param {string} username - Account username
 * @param {string} password - Account password
 * @param {string} accountId - Account identifier
 * @returns {Promise<boolean>} - Whether login was successful
 */
async function loginWithCookiePersistence(page, username, password, accountId) {
  try {
    logger.info(`Attempting login for account ${accountId}`, accountId);
    
    // Navigate to login page (se necessário, substitua pela URL real de login)
    await page.goto('https://example.com/login', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // Verificar se já está logado
    const alreadyLoggedIn = await checkIfLoggedIn(page, accountId);
    if (alreadyLoggedIn) {
      logger.info(`Account ${accountId} already logged in, skipping login`, accountId);
      return true;
    }
    
    // Wait for login form to load
    await page.waitForSelector('#username', { timeout: 30000 });
    await page.waitForSelector('#password', { timeout: 30000 });
    
    // Fill username with slight delay between characters
    await page.type('#username', username, { delay: randomInteger(50, 150) });
    
    // Brief pause after entering username
    await delay(randomInteger(500, 1500));
    
    // Fill password with slight delay between characters
    await page.type('#password', password, { delay: randomInteger(50, 150) });
    
    // Brief pause before clicking login button
    await delay(randomInteger(800, 2000));
    
    // Click login button
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
      page.click('#loginButton')
    ]);
    
    // Verify login success
    const isLoggedIn = await checkIfLoggedIn(page, accountId);
    
    if (isLoggedIn) {
      logger.info(`Login successful for account ${accountId}`, accountId);
      return true;
    } else {
      logger.error(`Login failed for account ${accountId}`, accountId);
      return false;
    }
  } catch (error) {
    logger.error(`Error during login for account ${accountId}: ${error.message}`, accountId, error);
    return false;
  }
}

/**
 * Check if the user is logged in
 * @param {Object} page - Puppeteer page object
 * @param {string} accountId - Account identifier
 * @returns {Promise<boolean>} - Whether user is logged in
 */
async function checkIfLoggedIn(page, accountId) {
  try {
    // Check for login status by looking for elements that would indicate a logged-in state
    // Note: Replace these selectors with ones that accurately indicate login status
    
    // Method 1: Check for user menu/profile element
    const userMenuExists = await page.evaluate(() => {
      return !!document.querySelector('.user-menu, .profile-icon, .avatar');
    });
    
    if (userMenuExists) {
      return true;
    }
    
    // Method 2: Check for logout button/link
    const logoutButtonExists = await page.evaluate(() => {
      return !!document.querySelector('a[href*="logout"], button:contains("Logout"), .logout-button');
    });
    
    if (logoutButtonExists) {
      return true;
    }
    
    // Method 3: Check for login form (inverse logic)
    const loginFormExists = await page.evaluate(() => {
      return !!document.querySelector('#loginForm, .login-form, form[action*="login"]');
    });
    
    if (!loginFormExists) {
      // If login form doesn't exist, user might be logged in
      return true;
    }
    
    // If none of the above checks passed, user is likely not logged in
    return false;
  } catch (error) {
    logger.error(`Error checking login status for account ${accountId}: ${error.message}`, accountId, error);
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
    logger.info(`Attempting logout for account ${accountId}`, accountId);
    
    // Navigate to logout page or click logout button
    // Note: Replace with actual logout mechanism for the target site
    
    // Method 1: Click a logout link/button
    const logoutButton = await page.$('a[href*="logout"], button:contains("Logout"), .logout-button');
    
    if (logoutButton) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        logoutButton.click()
      ]);
    } else {
      // Method 2: Navigate directly to logout URL
      await page.goto('https://example.com/logout', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
    }
    
    // Verify logout success
    const isLoggedIn = await checkIfLoggedIn(page, accountId);
    
    if (!isLoggedIn) {
      logger.info(`Logout successful for account ${accountId}`, accountId);
      return true;
    } else {
      logger.warn(`Logout appears to have failed for account ${accountId}`, accountId);
      return false;
    }
  } catch (error) {
    logger.error(`Error during logout for account ${accountId}: ${error.message}`, accountId, error);
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
    logger.info(`Checking profile data for account ${accountId}`, accountId);
    
    // Navigate to profile page (if necessary)
    // await page.goto('https://example.com/profile', { waitUntil: 'networkidle2' });
    
    // Extract profile data (replace with actual selectors and data extraction)
    const profileData = await page.evaluate(() => {
      // Replace these selectors with actual ones for the target site
      const username = document.querySelector('.profile-username, .username')?.textContent.trim();
      const email = document.querySelector('.profile-email, .email')?.textContent.trim();
      const level = document.querySelector('.profile-level, .level')?.textContent.trim();
      const points = document.querySelector('.profile-points, .points')?.textContent.trim();
      
      return {
        username,
        email,
        level,
        points
      };
    });
    
    logger.info(`Profile data retrieved for account ${accountId}`, accountId);
    return profileData;
  } catch (error) {
    logger.error(`Error checking profile for account ${accountId}: ${error.message}`, accountId, error);
    return {};
  }
}

module.exports = {
  loginWithCookiePersistence,
  checkIfLoggedIn,
  performLogout,
  checkProfile
};