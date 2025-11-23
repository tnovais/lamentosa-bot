import { BrowserManager } from './core/browser';
import { InputManager } from './core/inputs';
import { MemoryManager } from './core/memory';
import { GameState } from './game/state';
import { GameActions } from './game/actions';
import { DecisionEngine, Decision } from './engine/decision';
import { Scheduler } from './engine/scheduler';
import { Settings } from './config/settings';
import { Selectors } from './game/selectors';
import { StatusScraper } from './game/status';
import { CaptchaSolver } from './core/captcha';

async function main() {
    console.log('Starting Lamentosa Elite Bot...');

    // 1. Initialize Core Components
    const browserMgr = new BrowserManager();
    const captchaSolver = new CaptchaSolver();

    // 2. Start Browser
    await browserMgr.init();

    // 3. Define the worker function for a single account
    const runAccountWorker = async (account: any) => {
        if (!account.active) return;

        console.log(`[${account.username}] Starting worker...`);
        const { page } = await browserMgr.getContext(account.id);
        const input = new InputManager(page);
        const gameState = new GameState(page);
        const actions = new GameActions(page, input);
        const statusScraper = new StatusScraper(page);

        // Each worker gets its own memory/decision/scheduler instances to avoid state pollution
        const memory = new MemoryManager();
        const decisionEngine = new DecisionEngine(memory);
        const scheduler = new Scheduler();

        // Check Server Status
        const serverStatus = await statusScraper.checkStatus();
        if (!serverStatus.isOnline) {
            console.warn(`[${account.username}] Server offline. Stopping worker.`);
            return;
        }

        try {
            // Login Flow
            await page.goto(Settings.game.baseUrl);
            if (await page.isVisible(Selectors.Auth.LoginInput)) {
                console.log(`[${account.username}] Logging in...`);
                if (Settings.notifications.debug) {
                    console.log(`[DEBUG] Account keys: ${Object.keys(account)}`);
                    console.log(`[DEBUG] Password type: ${typeof account.password}`);
                }
                await input.type(Selectors.Auth.LoginInput, account.username);
                await input.type(Selectors.Auth.PasswordInput, account.password);
                await input.click(Selectors.Auth.LoginButton);
                await page.waitForLoadState('networkidle');

                // Verify login success
                try {
                    await page.waitForSelector(Selectors.UI.Level, { timeout: 10000 });
                    console.log(`[${account.username}] Login successful!`);
                } catch (e) {
                    console.error(`[${account.username}] Login failed or profile not visible.`);
                    // Take a screenshot to debug
                    await page.screenshot({ path: `login_fail_${account.username}.png` });
                    return;
                }
            }

            // Main Game Loop
            while (true) {
                try {
                    // 1. Check Schedule (Fatigue/Breaks)
                    if (await scheduler.checkSchedule() === false) {
                        // Sleep handled internally by scheduler
                    }

                    // 2. Parse State
                    const state = await gameState.getState();
                    gameState.logState(account.username);

                    // 3. Decide
                    const decision = decisionEngine.decide(state, account.id);

                    // 4. Act
                    switch (decision) {
                        case Decision.ATTACK:
                            await actions.attack();
                            memory.recordAction(account.id, 'ATTACK');
                            break;
                        case Decision.HEAL:
                            console.log(`[${account.username}] Low HP. Visiting Temple to heal.`);
                            await actions.visitTemple();
                            memory.recordAction(account.id, 'HEAL');
                            break;
                        case Decision.IDLE:
                            await input.moveRandomly();
                            break;
                        case Decision.HUNT:
                            await actions.attackCreature();
                            memory.recordAction(account.id, 'HUNT');
                            break;
                        case Decision.DUNGEON:
                            await actions.exploreDungeon();
                            memory.recordAction(account.id, 'DUNGEON');
                            break;
                        case Decision.SOLVE_CAPTCHA:
                            console.log(`[${account.username}] CAPTCHA DETECTED! Attempting to solve...`);
                            const solved = await captchaSolver.solve(page, Selectors.AntiBot.Container, Selectors.AntiBot.InputGeneric);
                            if (solved) {
                                console.log(`[${account.username}] Captcha solved! Resuming...`);
                                await page.waitForTimeout(2000);
                            } else {
                                console.error(`[${account.username}] Captcha solve failed. Pausing for safety.`);
                                await page.pause();
                            }
                            break;
                    }

                    // 5. Random Delay between actions
                    await new Promise(r => setTimeout(r, Math.random() * 2000 + 1000));

                } catch (error: any) {
                    if (error.message === Settings.game.errors.captchaDetected) {
                        console.log(`[${account.username}] Fast-switch to Captcha Solver!`);
                        // Force a state update to ensure isCaptchaPresent is true
                        const state = await gameState.getState();
                        if (state.isCaptchaPresent) {
                            // The next loop iteration will pick up SOLVE_CAPTCHA naturally
                            continue;
                        }
                    }

                    console.error(`[${account.username}] Loop error (recovering):`, error);
                    // Wait a bit before retrying to avoid tight error loops
                    await page.waitForTimeout(5000);
                }
            }
        } catch (error) {
            console.error(`[${account.username}] Worker error:`, error);
        }
    };

    // 4. Run all accounts in parallel
    console.log(`Starting ${Settings.accounts.length} concurrent bots...`);
    await Promise.all(Settings.accounts.map((account: any) => runAccountWorker(account)));
}

main().catch(console.error);
