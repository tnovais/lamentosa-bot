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
        if (await cooldownHeader.isVisible() || await cooldownTimer.isVisible()) {
            console.log('[PvP] Cooldown detected (Header/Timer). Aborting attack.');

            // Extract cooldown time
            let durationSeconds = 0;
            let durationAttr = await cooldownTimer.getAttribute('data-seconds-left');
            if (!durationAttr) durationAttr = await cooldownTimer.getAttribute('data-seconds-duration');

            if (durationAttr) {
                durationSeconds = parseInt(durationAttr, 10);
            } else {
                const text = await cooldownTimer.innerText();
                const match = text.match(/(\d{2}):(\d{2}):(\d{2})/);
                if (match) {
                    durationSeconds = parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseInt(match[3], 10);
                } else {
                    durationSeconds = Settings.limits.cooldownMinutes * 60;
                }
            }

            const cooldownEndsAt = new Date(Date.now() + durationSeconds * 1000);
            await this.memory.updateStatus(this.accountId, 'COOLDOWN', cooldownEndsAt);
            return;
        }

        // 3. Select Target
        // If targetName is provided, try to find it. Otherwise find first available.
        // ... (Simplified for brevity, assuming standard attack logic)
        const attackButtons = await this.page.$$(Selectors.PvP.AttackButton);
        if (attackButtons.length > 0) {
            await attackButtons[0].click();
            await randomDelay(Settings.delays.combat.min, Settings.delays.combat.max);

            // Post-Attack Cooldown Check
            if (await this.page.isVisible(Selectors.PvP.CooldownTimer[1])) {
                // ... logic to handle cooldown
            }

            await this.parseBattleLog();
        } else {
            console.log('[PvP] No targets found.');
        }
    }
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
        try {
            await this.navigateTo(Settings.game.paths.inventory);
        } catch (e) {
            console.warn('[INVENTORY] Failed to navigate to inventory. Skipping potion use.');
            return;
        }

        // [FIX] Robust Anti-Bot Check
        if (this.page.url().includes(Selectors.AntiBot.UrlPart) || await this.page.isVisible(Selectors.AntiBot.Header[0])) {
            throw new Error(Settings.game.errors.captchaDetected);
        }

        // Check if potion exists before clicking
        if (!await this.page.isVisible(Selectors.Inventory.HastePotion)) {
            console.log('[INVENTORY] No Haste Potion found.');
            return;
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
            // 1. Sync Actual Wins from Footer (Source of Truth)
            const footer = await this.page.$(Selectors.Ranking.FooterStats);
            if (footer) {
                const footerText = await footer.innerText();
                // Example: "Você derrotou 2 adversários e roubou..."
                const match = footerText.match(/derrotou\s+(\d+)\s+adversários/i);
                if (match) {
                    const actualWins = parseInt(match[1], 10);
                    const state = await this.gameState.getState();
                    console.log(`[RANKING] Syncing wins. Actual: ${actualWins}`);
                    await this.memory.syncPvpWins(this.accountId, state.serverDay, actualWins);
                }
            }

            // 2. Find the 15th player's wins (Cutoff)
            const rows = await this.page.$$(Selectors.Ranking.Rows);
            let cutoffWins = 0;

            if (rows.length >= 15) {
                const row15 = rows[14]; // 0-indexed
                const winsText = await row15.$eval(Selectors.Ranking.Wins, el => el.textContent);
                cutoffWins = parseInt(winsText?.replace(/\D/g, '') || '0', 10);
            }

            // 3. Calculate Target
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
     * Checks the status page to scrape character stats.
     */
    async checkStatus() {
        if (Settings.notifications.debug) console.log(`[DEBUG] Checking Status page...`);

        // [FIX] Use goto directly as there might not be a menu link
        try {
            await this.page.goto(Settings.game.statusUrl);
            await this.page.waitForLoadState('domcontentloaded');
        } catch (e) {
            console.warn('[STATUS] Failed to navigate to status page:', e);
            return;
        }

        const stats = await this.gameState.getCharacterStats();
        const state = await this.gameState.getState(); // Get server time
        if (stats) {
            console.log(`[STATUS] Character: ${stats.name} (Lv ${stats.level}) | HP: ${stats.currentHp}/${stats.maxHp}`);
            await this.memory.updateCharacterStats(this.accountId, {
                ...stats,
                lastServerTime: state.serverTime,
                serverDay: state.serverDay
            });
        } else {
            console.warn('[STATUS] Failed to scrape character stats.');
        }
    }

    /**
     * Parses the battle log to determine the result and gold.
     */
    private async parseBattleLog() {
        try {
            const state = await this.gameState.getState(); // Get server day
            const serverDay = state.serverDay;

            // [FIX] Use text content analysis as specific selectors are unreliable
            const pageText = await this.page.locator('body').innerText();
            const lowerPageText = pageText.toLowerCase();

            // 1. Determine Result (Win/Loss/Draw) - STRICT CHECK
            // We check for specific Portuguese/English keywords
            let result: 'WIN' | 'LOSS' | 'DRAW' = 'DRAW';

            // Get character name from memory to verify winner
            const charName = await this.memory.getCharacterName(this.accountId);

            if (charName) {
                // If we know our name, we can be precise
                const winnerEl = this.page.locator(Selectors.BattleLog.Winner).first();
                if (await winnerEl.isVisible()) {
                    const winnerText = await winnerEl.innerText();
                    if (winnerText.includes(charName)) {
                        result = 'WIN';
                    } else {
                        result = 'LOSS';
                    }
                } else if (lowerPageText.includes('empate') || lowerPageText.includes('draw') || lowerPageText.includes('ninguém venceu')) {
                    result = 'DRAW';
                }
            } else {
                // Fallback to legacy text matching if name unknown
                if (lowerPageText.includes('vencedor') || lowerPageText.includes('vitória') || lowerPageText.includes('victory') || lowerPageText.includes('winner')) {
                    // This is risky without name, but best effort
                    result = 'WIN';
                } else if (lowerPageText.includes('derrota') || lowerPageText.includes('defeat') || lowerPageText.includes('perdeu')) {
                    result = 'LOSS';
                } else if (lowerPageText.includes('empate') || lowerPageText.includes('draw') || lowerPageText.includes('ninguém venceu')) {
                    result = 'DRAW';
                }
            }

            // 2. Determine Gold Profit/Loss
            let gold = 0;

            // Only look for gold if it's a win or if we want to track losses (some games take gold on loss)
            // Regex to find gold amount: Look for digits near "Ouro" or "Gold"
            // New logic: Look for "roubou X" (stole X)
            const stoleRegex = /roubou\s*(\d+)/i;
            const stoleMatch = pageText.match(stoleRegex);

            if (stoleMatch && result === 'WIN') {
                gold = parseInt(stoleMatch[1], 10);
            } else if (result === 'LOSS') {
                // Check if we lost gold? Usually not shown explicitly as "lost X", but maybe "stole X from you"
                // For now assume 0 on loss unless we see "perdeu X ouro"
                gold = 0;
            }

            // Update stats
            await this.memory.updateDailyStats(this.accountId, serverDay, result, gold);
            console.log(`[BATTLE LOG] Result: ${result} | Gold: ${gold > 0 ? '+' : ''}${gold}`);
        } catch (e) {
            console.error('Error parsing battle log:', e);
        }
    }

    /**
     * Executes the decided action.
     */
    async execute(decision: { action: string, score: number, reason: string }) {
        // Update status to RUNNING if not IDLE
        if (decision.action !== 'IDLE') {
            await this.memory.updateStatus(this.accountId, 'RUNNING');
        }

        switch (decision.action) {
            case 'ATTACK':
                await this.attack();
                break;
            case 'HEAL':
                const state = await this.gameState.getState();
                if (state.stats.life < Settings.weights.heal.criticalHp) {
                    await this.visitTemple();
                } else {
                    await this.useHastePotion();
                }
                break;
            case 'FLEE':
                await this.visitTemple();
                break;
            case 'HUNT':
                await this.attackCreature();
                break;
            case 'DUNGEON':
                await this.exploreDungeon();
                break;
            case 'CHECK_RANKING':
                await this.checkRanking();
                break;
            case 'CHECK_STATUS':
                await this.checkStatus();
                break;
            case 'SOLVE_CAPTCHA':
                await this.focusCaptcha();
                break;
            case 'IDLE':
            default:
                console.log('Idling...');
                await randomDelay(1000, 2000);
                break;
        }
    }
}
