import { BrowserManager } from './core/browser';
import { InputManager } from './core/inputs';
import { MemoryManager } from './core/memory';
import { GameState } from './game/state';
import { GameActions } from './game/actions';
import { DecisionEngine } from './engine/decision';
import { Scheduler } from './engine/scheduler';
import { Settings } from './config/settings';
import { Selectors } from './game/selectors';
import { StatusScraper } from './game/status';
import { CaptchaSolver } from './core/captcha';
import { CommunicationManager, BotCommand } from './core/communication';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting Lamentosa Elite Bot (Docker/Redis Mode)...');

    // 1. Initialize Core Components
    const browserMgr = new BrowserManager();
    const captchaSolver = new CaptchaSolver();
    await browserMgr.init();

    // 2. Periodic Account Check
    const activeWorkers = new Set<string>();

    setInterval(async () => {
        const accounts = await prisma.account.findMany({
            where: { isActive: true }
        });

        for (const account of accounts) {
            if (!activeWorkers.has(account.id)) {
                activeWorkers.add(account.id);
                runAccountWorker(account, browserMgr, captchaSolver).catch(err => {
                    console.error(`[${account.email}] Worker crashed:`, err);
                    activeWorkers.delete(account.id);
                });
            }
        }
    }, 10000); // Check every 10 seconds
}

async function runAccountWorker(account: any, browserMgr: BrowserManager, captchaSolver: CaptchaSolver) {
    console.log(`[${account.email}] Starting worker...`);

    // Initialize Communication (Redis)
    const comms = new CommunicationManager(account.id);
    let currentOverride: BotCommand | null = null;

    // Listen for Commands
    comms.onCommand((cmd) => {
        console.log(`[${account.email}] Received command: ${cmd.type}`);
        currentOverride = cmd;

        if (cmd.type === 'STOP') {
            // Handle graceful shutdown
            console.log(`[${account.email}] Stopping worker...`);
            // We need to break the main loop. We can do this by setting a flag or throwing a specific error.
            // Since we are in a callback, we can't break the loop directly.
            // We'll set a flag on the comms manager or use a shared variable.
            // Actually, let's just set currentOverride to STOP and handle it in the loop.
        }
    });

    const { page } = await browserMgr.getContext(account.id);
    const input = new InputManager(page);
    const gameState = new GameState(page);
    const memory = new MemoryManager(); // TODO: Migrate to Prisma-based memory
    const actions = new GameActions(page, input, memory, gameState, account.id);
    const statusScraper = new StatusScraper(page);
    const decisionEngine = new DecisionEngine(memory);
    const scheduler = new Scheduler();

    // [NEW] Set status to STARTING
    await memory.updateStatus(account.id, 'STARTING');

    // Check Server Status
    const serverStatus = await statusScraper.checkStatus();
    if (!serverStatus.isOnline) {
        comms.publishLog('warn', 'Server offline. Stopping worker.');
        await memory.updateStatus(account.id, 'OFFLINE');
        return;
    }

    try {
        // Login Flow
        await page.goto(Settings.game.baseUrl);
        if (await page.isVisible(Selectors.Auth.LoginInput)) {
            comms.publishLog('info', 'Logging in...');
            await input.type(Selectors.Auth.LoginInput, account.email); // Use email from DB
            await input.type(Selectors.Auth.PasswordInput, account.password);
            await input.click(Selectors.Auth.LoginButton);
            await page.waitForLoadState('networkidle');

            try {
                await page.waitForSelector(Selectors.UI.Level, { timeout: 10000 });
                comms.publishLog('info', 'Login successful!');
            } catch (e) {
                comms.publishLog('error', 'Login failed or profile not visible.');
                await page.screenshot({ path: `login_fail_${account.email}.png` });
                return;
            }
        }

        // Initial Ranking Check
        await actions.checkRanking();

        // [NEW] Initial Status Check (for Server Time)
        await actions.checkStatus();

        // [NEW] Set status to RUNNING
        await memory.updateStatus(account.id, 'RUNNING');

        // Main Game Loop
        while (true) {
            try {
                // ... (loop content)
            } catch (loopError: any) {
                comms.publishLog('error', `Loop error: ${loopError.message}`);
                await page.waitForTimeout(5000);
            }
        }

    } catch (error: any) {
        comms.publishLog('error', `Fatal worker error: ${error.message}`);
    } finally {
        await memory.updateStatus(account.id, 'OFFLINE');
        // [FIX] Close only this worker's context, NOT the whole browser
        if (page && !page.isClosed()) {
            await page.context().close();
        }
    }
}

main().catch(console.error);
