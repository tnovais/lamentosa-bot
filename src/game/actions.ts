import { Page } from 'playwright';
import { InputManager } from '../core/inputs';
import { Selectors } from './selectors';
import { randomDelay } from '../core/stealth';
import { Settings } from '../config/settings';
import { MemoryManager } from '../core/memory';
import { GameState } from './state';

/**
 * GameActions
 * 
 * Encapsulates atomic game actions (Move, Attack, Heal).
 * Uses InputManager to ensure all interactions are human-like.
 */
export class GameActions {
    private page: Page;
    private input: InputManager;
    private memory: MemoryManager;
    private gameState: GameState;
    private accountId: string;

    constructor(page: Page, input: InputManager, memory: MemoryManager, gameState: GameState, accountId: string) {
        this.page = page;
        this.input = input;
        this.memory = memory;
        this.gameState = gameState;
        this.accountId = accountId;
    }

    /**
     * Navigates to a specific game section.
     */
    async navigateTo(urlPart: string) {
        const currentUrl = this.page.url();
        // [FIX] Ignore query parameters for the check to avoid unnecessary reloads
        const currentPath = currentUrl.split('?')[0];
        const targetPath = urlPart.split('?')[0];

        if (currentUrl.includes(urlPart) || currentPath.endsWith(targetPath)) return;

        // Try to find a link with href OR hx-get matching the URL part
        const linkSelector = `a[href*="${targetPath}"], a[hx-get*="${targetPath}"], [hx-get*="${targetPath}"]`;

        try {
            await this.input.click(linkSelector);
            await this.page.waitForLoadState('domcontentloaded');
            await randomDelay(Settings.delays.navigation.min, Settings.delays.navigation.max);

            // Verify we actually arrived
            if (!this.page.url().includes(targetPath)) {
                throw new Error(Settings.game.errors.navigationFailed);
            }
        } catch (e) {
            console.warn(`[DEBUG] Navigation click failed/stalled. Forcing URL: ${urlPart}`);
            await this.page.goto(`${Settings.game.baseUrl}${urlPart}`);
            await this.page.waitForLoadState('domcontentloaded');
            await randomDelay(Settings.delays.navigationRetry.min, Settings.delays.navigationRetry.max);
        }
    }

    /**
     * Performs a PvP attack.
     * @param targetName Optional name of the player to attack. If null, attacks the first available.
     */
    async attack(targetName?: string) {
        if (Settings.notifications.debug) console.log(`[DEBUG] Navigating to PVP page...`);
        await this.navigateTo(Settings.game.paths.pvp);

        // 2. Check for Cooldown Page (Aggressive Check)
        const cooldownHeader = this.page.locator(Selectors.PvP.CooldownTimer[2]); // h2:has-text("Tempo de descanso")
        const cooldownTimer = this.page.locator(Selectors.PvP.CooldownTimer[1]); // .timer[data-seconds-duration]

        if ((await cooldownHeader.isVisible()) || (await cooldownTimer.isVisible())) {
            console.warn(`[PvP] Cooldown detected (Header/Timer). Aborting attack.`);
            return;
        }

        // 3. Robust Anti-Bot Check
        if (this.page.url().includes(Selectors.AntiBot.UrlPart) || await this.page.isVisible(Selectors.AntiBot.Header[0])) {
            throw new Error(Settings.game.errors.captchaDetected);
        }

        let clicked = false;

        if (targetName) {
            if (Settings.notifications.debug) console.log(`[DEBUG] Searching for target: ${targetName}`);
            const enemyList = await this.page.$$(Selectors.PvP.EnemyList);
            for (const enemy of enemyList) {
                const name = await enemy.$eval('.name a', el => el.textContent?.trim());
                if (name === targetName) {
                    if (Settings.notifications.debug) console.log(`[DEBUG] Target found! Clicking attack button...`);
                    const btn = await enemy.$(Selectors.PvP.AttackButton);
                    if (btn) {
                        await btn.click();
                        clicked = true;
                        break;
                    }
                }
            }
        } else {
            if (Settings.notifications.debug) console.log(`[DEBUG] No specific target. Clicking first attack button...`);
            // [FIX] Use a more specific selector to avoid clicking hidden elements
            const btn = await this.page.$(Selectors.PvP.AttackButton);
            if (btn && await btn.isVisible()) {
                await btn.click();
                clicked = true;
            } else {
                console.warn('[DEBUG] Attack button not found or not visible.');
            }
        }

        if (!clicked) {
            console.warn('[DEBUG] Failed to click attack button.');
            return;
        }

        await randomDelay(Settings.delays.click.min, Settings.delays.click.max);

        // Handle confirmation modal if it appears
        const modal = await this.page.$(Selectors.Modal.Content);
        if (modal && await modal.isVisible()) {
            const modalText = await modal.textContent();
            if (Settings.notifications.debug) console.log(`[DEBUG] Confirmation Modal Detected: "${modalText?.trim()}"`);
            console.log('Confirming attack...');
            await this.input.click(Selectors.Modal.ConfirmYes);
        }

        // [FIX] Wait for navigation or load state
        try {
            await this.page.waitForLoadState('networkidle', { timeout: Settings.delays.networkIdle });
        } catch (e) {
            console.warn('[DEBUG] Timeout waiting for networkidle after attack.');
        }

        await randomDelay(Settings.delays.combat.min, Settings.delays.combat.max);

        // Log result content for debugging
        if (Settings.notifications.debug) {
            const currentUrl = this.page.url();
            console.log(`[DEBUG] Post-Attack URL: ${currentUrl}`);
        }

        // [NEW] Parse Battle Log if we are on the log page
        if (this.page.url().includes(Selectors.BattleLog.UrlPart)) {
            await this.parseBattleLog();
        }
    }

    /**
     * Attacks a PVE creature, prioritizing Medium then Easy.
     */
    async attackCreature() {
        if (Settings.notifications.debug) console.log(`[DEBUG] Navigating to PVE page...`);
        await this.navigateTo(Settings.game.paths.pve);

        // [FIX] Robust Anti-Bot Check
        if (this.page.url().includes(Selectors.AntiBot.UrlPart) || await this.page.isVisible(Selectors.AntiBot.Header[0])) {
            throw new Error(Settings.game.errors.captchaDetected);
        }

        // Get all creatures
        const creatures = await this.page.$$(Selectors.PvE.CreatureList);
        if (creatures.length === 0) {
            if (Settings.notifications.debug) console.log(`[DEBUG] No creatures found.`);
            return;
        }

        let targetBtn = null;
        let targetDifficulty = '';

        // Try to find preferred difficulty in order
        for (const diff of Settings.weights.pve.difficulties) {
            for (const creature of creatures) {
                const text = await creature.textContent();
                // Check if the card text contains the difficulty (e.g. "Medium", "Easy")
                // Case insensitive check might be safer
                if (text && text.toLowerCase().includes(diff.toLowerCase())) {
                    const btn = await creature.$(Selectors.PvE.AttackButton);
                    if (btn) {
                        targetBtn = btn;
                        targetDifficulty = diff;
                        break;
                    }
                }
            }
            if (targetBtn) break;
        }

        if (targetBtn) {
            if (Settings.notifications.debug) console.log(`[DEBUG] Found ${targetDifficulty} creature. Attacking...`);
            await targetBtn.click();

            // Update Persistent PVE Count
            const state = await this.gameState.getState();
            this.memory.updateDailyStats(this.accountId, state.serverDay, { pveIncrement: 1 });

            await randomDelay(Settings.delays.combat.min, Settings.delays.combat.max); // Wait for combat result
        } else {
            console.log('No suitable PVE target found (Medium/Easy).');
        }
    }

    /**
     * Uses a Haste potion if available.
     */
    async useHastePotion() {
        // Must be in inventory
        await this.navigateTo(Settings.game.paths.inventory);

        // [FIX] Robust Anti-Bot Check
        if (this.page.url().includes(Selectors.AntiBot.UrlPart) || await this.page.isVisible(Selectors.AntiBot.Header[0])) {
            throw new Error(Settings.game.errors.captchaDetected);
        }

        await this.input.click(Selectors.Inventory.HastePotion);
        await randomDelay(Settings.delays.click.min, Settings.delays.click.max);

        // Handle confirmation dialog if it exists
        for (const selector of Selectors.Inventory.ConfirmUse) {
            if (await this.page.isVisible(selector)) {
                await this.input.click(selector);
                break;
            }
        }
    }

    /**
     * Solves a simple text captcha (if we implement a solver later).
     * For now, this just focuses the input.
     */
    async focusCaptcha() {
        await this.input.click(Selectors.AntiBot.Input);
    }

    /**
     * Performs a job in the cemetery.
     */
    async performJob() {
        await this.navigateTo(Settings.game.paths.jobs);

        // [FIX] Robust Anti-Bot Check
        if (this.page.url().includes(Selectors.AntiBot.UrlPart) || await this.page.isVisible(Selectors.AntiBot.Header[0])) {
            throw new Error(Settings.game.errors.captchaDetected);
        }
    }

    /**
     * Explores a dungeon.
     */
    async exploreDungeon() {
        await this.navigateTo(Settings.game.paths.dungeons);

        // [FIX] Robust Anti-Bot Check
        if (this.page.url().includes(Selectors.AntiBot.UrlPart) || await this.page.isVisible(Selectors.AntiBot.Header[0])) {
            throw new Error(Settings.game.errors.captchaDetected);
        }

        // Check for "Explore" or "Fight"
        for (const selector of Selectors.Dungeon.ExploreButton) {
            if (await this.page.isVisible(selector)) {
                await this.input.click(selector);
                await randomDelay(Settings.delays.navigation.min, Settings.delays.navigation.max);
                return;
            }
        }

        for (const selector of Selectors.Dungeon.FightButton) {
            if (await this.page.isVisible(selector)) {
                await this.input.click(selector);
                await randomDelay(Settings.delays.combat.min, Settings.delays.combat.max); // Combat delay
                return;
            }
        }
    }


    /**
     * Visits the temple to heal/pray.
     */
    async visitTemple() {
        await this.navigateTo(Settings.game.paths.temple);
        console.log('Visiting Temple to heal...');

        // [FIX] Robust Anti-Bot Check
        if (this.page.url().includes(Selectors.AntiBot.UrlPart) || await this.page.isVisible(Selectors.AntiBot.Header[0])) {
            throw new Error(Settings.game.errors.captchaDetected);
        }

        // The temple has multiple "Recuperar" buttons (10%, 25%, 50%).
        // We want to click the last one (highest heal) for efficiency.
        // PrayButton is an array of selectors, we try them until we find matches.
        let buttons = null;
        for (const selector of Selectors.Temple.PrayButton) {
            const loc = this.page.locator(selector);
            if (await loc.count() > 0) {
                buttons = loc;
                break;
            }
        }

        if (buttons && await buttons.count() > 0) {
            // Click the last button (usually 50% heal)
            await buttons.last().click();
            console.log('Clicked highest heal option.');
            await this.page.waitForLoadState('networkidle');
        } else {
            console.warn('No heal buttons found in Temple.');
        }
    }

    /**
     * Checks the PVP ranking.
     */
    async checkRanking() {
        await this.navigateTo(Settings.game.paths.ranking);

        // [FIX] Robust Anti-Bot Check
        if (this.page.url().includes(Selectors.AntiBot.UrlPart) || await this.page.isVisible(Selectors.AntiBot.Header[0])) {
            throw new Error(Settings.game.errors.captchaDetected);
        }

        await randomDelay(Settings.delays.combat.min, Settings.delays.combat.max);

        // Parse Ranking
        try {
            // 1. Find the 15th player's wins (Cutoff)
            const rows = await this.page.$$(Selectors.Ranking.Rows);
            let cutoffWins = 0;

            if (rows.length >= 15) {
                const row15 = rows[14]; // 0-indexed
                const winsText = await row15.$eval(Selectors.Ranking.Wins, el => el.textContent);
                cutoffWins = parseInt(winsText?.replace(/\D/g, '') || '0', 10);
            }

            // 2. Calculate Target
            const targetWins = cutoffWins + 1;
            this.memory.setRankingTarget(this.accountId, targetWins);

            console.log(`[RANKING] Top 15 Cutoff: ${cutoffWins} wins. Target set to: ${targetWins}`);

            // Record that we checked ranking
            this.memory.recordAction(this.accountId, 'CHECK_RANKING');

        } catch (e) {
            console.warn('[RANKING] Failed to parse ranking table:', e);
        }
    }

    /**
     * Parses the Battle Log to extract profit and result.
     */
    private async parseBattleLog() {
        try {
            const state = await this.gameState.getState(); // Get server day
            const serverDay = state.serverDay;

            // [FIX] Use text content analysis as specific selectors are unreliable
            const pageText = await this.page.locator('body').innerText();
            const lowerPageText = pageText.toLowerCase();

            // 1. Determine Result (Win/Loss/Draw)
            const isWin = lowerPageText.includes('vitória') || lowerPageText.includes('vencedor');
            const isLoss = lowerPageText.includes('derrota');
            const isDraw = lowerPageText.includes('empate');

            if (!isWin && !isLoss && !isDraw) {
                console.warn('[BATTLE LOG] Could not determine win/loss/draw from page text.');
                return;
            }

            // 2. Determine Gold Profit/Loss
            let gold = 0;

            // Try 1: Regex on full text (flexible patterns)
            // Matches: "100 Ouro", "Ouro: 100", "+100 Gold", "Ganhou 100"
            const goldRegex = /(?:ouro|gold|ganhou|perdeu)[\s:]*([+-]?\d+)|([+-]?\d+)\s*(?:ouro|gold)/i;
            const goldMatch = pageText.match(goldRegex);

            if (goldMatch) {
                // match[1] or match[2] will have the number
                const rawNum = goldMatch[1] || goldMatch[2];
                gold = parseInt(rawNum, 10);
            } else {
                // Try 2: Specific Selector Fallback
                const goldEl = this.page.locator(Selectors.BattleLog.Gold).first();
                if (await goldEl.isVisible()) {
                    const text = await goldEl.textContent();
                    gold = parseInt(text?.replace(/\D/g, '') || '0', 10);
                }
            }

            // Adjust sign based on context if we only found a positive number
            if (gold > 0) {
                if (isLoss && (lowerPageText.includes('perdeu') || lowerPageText.includes('lost'))) {
                    gold = -gold;
                }
            } else if (gold === 0 && (lowerPageText.includes('ninguém recebeu nada') || lowerPageText.includes('sem ganhos'))) {
                gold = 0;
            }

            // 3. Update Memory
            this.memory.updateDailyStats(this.accountId, serverDay, {
                gold: gold,
                win: isWin
            });

            const resultStr = isWin ? 'WIN' : (isLoss ? 'LOSS' : 'DRAW');
            const profitStr = gold > 0 ? `+${gold}` : `${gold}`;
            console.log(`[BATTLE LOG] Result: ${resultStr} | Gold: ${profitStr}`);

        } catch (e) {
            console.error('Error parsing battle log:', e);
        }
    }
}
