/**
 * Main entry point for the bot do Lamentosa
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');
const Bot = require('./src/bot'); // Importa a classe Bot
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
    // Ensure accounts directory exists
    if (!fs.existsSync(PATHS.ACCOUNTS_DIR)) {
      fs.mkdirSync(PATHS.ACCOUNTS_DIR, { recursive: true });
    }
    
    // Check for accounts.json file
    const accountsPath = path.join(PATHS.ACCOUNTS_DIR, 'accounts.json');
    
    if (!fs.existsSync(accountsPath)) {
      logger.warn(`Accounts file not found: ${accountsPath}`);
      return [];
    }
    
    // Read and parse accounts file
    const accountsData = fs.readFileSync(accountsPath, 'utf8');
    const accounts = JSON.parse(accountsData);
    
    if (!Array.isArray(accounts)) {
      logger.error('Invalid accounts file format');
      return [];
    }
    
    // Filter accounts if specific accounts were specified
    let filteredAccounts = accounts;
    if (options.accounts.length > 0) {
      filteredAccounts = accounts.filter(account => 
        options.accounts.includes(account.id) || 
        options.accounts.includes(account.username)
      );
      
      if (filteredAccounts.length === 0) {
        logger.warn(`No accounts found matching specified IDs: ${options.accounts.join(', ')}`);
      }
    }
    
    logger.info(`Loaded ${filteredAccounts.length} accounts from ${accountsPath}`);
    return filteredAccounts;
  } catch (error) {
    logger.error(`Error loading accounts: ${error.message}`, null, error);
    return [];
  }
}

/**
 * Handle shutdown signals
 */
function setupShutdownHandlers(bot) {
  // Handle process termination
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down...`);
      try {
        await bot.shutdown();
      } catch (error) {
        logger.error(`Error during shutdown: ${error.message}`);
      }
      process.exit(0);
    });
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    try {
      await bot.shutdown();
    } catch (error) {
      logger.error(`Error during shutdown: ${error.message}`);
    }
    process.exit(1);
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    logger.error(`Fatal error: ${error.message}`, null, error);
    try {
      await bot.shutdown();
    } catch (shutdownError) {
      logger.error(`Error during shutdown: ${shutdownError.message}`);
    }
    process.exit(1);
  });
}

/**
 * Main function
 */
async function main() {
  try {
    logger.info('Starting application...');
    
    // Instanciar o bot (esta é a parte importante)
    const bot = new Bot();
    
    // Setup shutdown handlers
    setupShutdownHandlers(bot);
    
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
      maxConcurrent: options.maxConcurrentSessions,
      headless: options.headless,
      keepSessionsAlive: false
    };
    
    // Run bot with loaded accounts
    await bot.run(accounts, runOptions);
  } catch (error) {
    logger.error(`Application error: ${error.message}`, null, error);
    process.exit(1);
  }
}

// Run the main function
main();