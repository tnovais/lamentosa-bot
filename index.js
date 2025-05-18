/**
 * Main entry point for the bot application
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');
const bot = require('./src/bot');
const accountManager = require('./src/modules/account-manager');
const { PATHS } = require('./src/config');

// Process command line arguments
const args = process.argv.slice(2);
const options = {
  headless: true,
  maxConcurrentSessions: 1,
  accounts: []
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--visible' || arg === '-v') {
    options.headless = false;
  } else if (arg === '--concurrent' || arg === '-c') {
    options.maxConcurrentSessions = parseInt(args[++i]) || 1;
  } else if (arg === '--account' || arg === '-a') {
    options.accounts.push(args[++i]);
  }
}

/**
 * Load accounts from file
 * @returns {Array<Object>} - Array of account objects
 */
function loadAccounts() {
  try {
    // Check if accounts directory exists
    if (!fs.existsSync(PATHS.ACCOUNTS_DIR)) {
      fs.mkdirSync(PATHS.ACCOUNTS_DIR, { recursive: true });
      logger.info(`Created accounts directory: ${PATHS.ACCOUNTS_DIR}`);
    }
    
    // Check if accounts file exists
    const accountsFilePath = path.join(PATHS.ACCOUNTS_DIR, PATHS.ACCOUNTS_FILE);
    
    if (!fs.existsSync(accountsFilePath)) {
      logger.warn(`Accounts file not found: ${accountsFilePath}`);
      return [];
    }
    
    // Load accounts
    const accountsData = JSON.parse(fs.readFileSync(accountsFilePath, 'utf8'));
    
    // Filter accounts if specific ones were requested
    let filteredAccounts = accountsData;
    
    if (options.accounts.length > 0) {
      filteredAccounts = accountsData.filter(account => 
        options.accounts.includes(account.id) || 
        options.accounts.includes(account.username)
      );
      
      logger.info(`Filtered ${filteredAccounts.length} accounts from ${accountsData.length} total`);
    }
    
    return filteredAccounts;
  } catch (error) {
    logger.error(`Error loading accounts: ${error.message}`, null, error);
    return [];
  }
}

/**
 * Handle shutdown signals
 */
function setupShutdownHandlers() {
  const shutdownHandler = async () => {
    logger.info('Shutdown signal received, cleaning up...');
    await bot.shutdown();
    process.exit(0);
  };
  
  // Handle shutdown signals
  process.on('SIGINT', shutdownHandler);
  process.on('SIGTERM', shutdownHandler);
  process.on('SIGHUP', shutdownHandler);
  
  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    logger.error(`Uncaught exception: ${error.message}`, null, error);
    await bot.shutdown();
    process.exit(1);
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    logger.error(`Unhandled promise rejection: ${reason}`, null, reason);
    await bot.shutdown();
    process.exit(1);
  });
}

/**
 * Main function
 */
async function main() {
  try {
    logger.info('Starting application...');
    
    // Setup shutdown handlers
    setupShutdownHandlers();
    
    // Initialize bot
    await bot.initialize();
    
    // Load accounts
    const accounts = loadAccounts();
    
    if (accounts.length === 0) {
      logger.error('No accounts found, exiting');
      return;
    }
    
    logger.info(`Loaded ${accounts.length} accounts`);
    
    // Configure run options
    const runOptions = {
      maxConcurrentSessions: options.maxConcurrentSessions,
      maxSessionDuration: 3600, // 1 hour in seconds
      randomizeLogout: true,
      taskSequences: 3
    };
    
    // Start bot
    await bot.run(accounts, runOptions);
    
    // Start cookie reset timer
    bot.startCookieResetTimer();
    
    logger.info(`Bot running with ${accounts.length} accounts`);
  } catch (error) {
    logger.error(`Application error: ${error.message}`, null, error);
    await bot.shutdown();
    process.exit(1);
  }
}

// Start the application
main().catch(error => {
  logger.error(`Fatal error: ${error.message}`, null, error);
  process.exit(1);
});
