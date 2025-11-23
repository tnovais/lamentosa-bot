import { Page } from 'playwright';
import { InputManager } from '../core/inputs';
import { Selectors } from './selectors';
import { randomDelay } from '../core/stealth';
import { Settings } from '../config/settings';

/**
 * GameActions
 * 
 * Encapsulates atomic game actions (Move, Attack, Heal).
 * Uses InputManager to ensure all interactions are human-like.
 */
export class GameActions {
    private page: Page;
    private input: InputManager;

    constructor(page: Page, input: InputManager) {
        this.page = page;
        this.input = input;
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
            await randomDelay(1000, 3000);

            // Verify we actually arrived
            if (!this.page.url().includes(targetPath)) {
                throw new Error('Navigation click did not change URL');
            }
        } catch (e) {
            console.warn(`[DEBUG] Navigation click failed/stalled. Forcing URL: ${urlPart}`);
            await this.page.goto(`${Settings.game.baseUrl}${urlPart}`);
            await this.page.waitForLoadState('domcontentloaded');
            await randomDelay(1000, 2000);
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
        const cooldownHeader = this.page.locator('h2:has-text("Tempo de descanso")');
        const cooldownTimer = this.page.locator('.timer[data-seconds-duration]');

        if ((await cooldownHeader.isVisible()) || (await cooldownTimer.isVisible())) {
            console.warn(`[PvP] Cooldown detected (Header/Timer). Aborting attack.`);
            return;
        }

        // 3. Robust Anti-Bot Check
        if (this.page.url().includes('anti-bot') || await this.page.isVisible('h2:has-text("SISTEMA ANTI-BOT")')) {
            throw new Error('CAPTCHA_DETECTED');
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

        await randomDelay(500, 1000);

        // Handle confirmation modal if it appears
        const modal = await this.page.$('.modal-confirm-content');
        if (modal && await modal.isVisible()) {
            const modalText = await modal.textContent();
            if (Settings.notifications.debug) console.log(`[DEBUG] Confirmation Modal Detected: "${modalText?.trim()}"`);
            console.log('Confirming attack...');
            await this.input.click('.confirm-yes');
        }

        // [FIX] Wait for navigation or load state
        try {
            await this.page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch (e) {
            console.warn('[DEBUG] Timeout waiting for networkidle after attack.');
        }

        await randomDelay(2000, 4000);

        // Log result content for debugging
        if (Settings.notifications.debug) {
            const currentUrl = this.page.url();
            console.log(`[DEBUG] Post-Attack URL: ${currentUrl}`);
            const resultText = await this.page.$eval('body', el => el.textContent);
            console.log(`[DEBUG] Post-Attack Page Text (Snippet): ${resultText?.substring(0, 200).replace(/\s+/g, ' ')}...`);
        }
    }

    /**
     * Attacks a PVE creature, prioritizing Medium then Easy.
     */
    async attackCreature() {
        if (Settings.notifications.debug) console.log(`[DEBUG] Navigating to PVE page...`);
        await this.navigateTo(Settings.game.paths.pve);

        // [FIX] Robust Anti-Bot Check
        if (this.page.url().includes('anti-bot') || await this.page.isVisible('h2:has-text("SISTEMA ANTI-BOT")')) {
            throw new Error('CAPTCHA_DETECTED');
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
            await randomDelay(2000, 4000); // Wait for combat result
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
        if (this.page.url().includes('anti-bot') || await this.page.isVisible('h2:has-text("SISTEMA ANTI-BOT")')) {
            throw new Error('CAPTCHA_DETECTED');
        }

        await this.input.click(Selectors.Inventory.HastePotion);
        await randomDelay(500, 1500);

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
        await this.input.click(Selectors.Captcha.Input);
    }

    /**
     * Performs a job in the cemetery.
     */
    async performJob() {
        await this.navigateTo(Settings.game.paths.jobs);

        // [FIX] Robust Anti-Bot Check
        if (this.page.url().includes('anti-bot') || await this.page.isVisible('h2:has-text("SISTEMA ANTI-BOT")')) {
            throw new Error('CAPTCHA_DETECTED');
        }
    }

    /**
     * Explores a dungeon.
     */
    async exploreDungeon() {
        await this.navigateTo(Settings.game.paths.dungeons);

        // [FIX] Robust Anti-Bot Check
        if (this.page.url().includes('anti-bot') || await this.page.isVisible('h2:has-text("SISTEMA ANTI-BOT")')) {
            throw new Error('CAPTCHA_DETECTED');
        }

        // Check for "Explore" or "Fight"
        for (const selector of Selectors.Dungeon.ExploreButton) {
            if (await this.page.isVisible(selector)) {
                await this.input.click(selector);
                await randomDelay(1000, 2000);
                return;
            }
        }

        for (const selector of Selectors.Dungeon.FightButton) {
            if (await this.page.isVisible(selector)) {
                await this.input.click(selector);
                await randomDelay(2000, 4000); // Combat delay
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
        if (this.page.url().includes('anti-bot') || await this.page.isVisible('h2:has-text("SISTEMA ANTI-BOT")')) {
            throw new Error('CAPTCHA_DETECTED');
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
        if (this.page.url().includes('anti-bot') || await this.page.isVisible('h2:has-text("SISTEMA ANTI-BOT")')) {
            throw new Error('CAPTCHA_DETECTED');
        }

        await randomDelay(2000, 4000);
        // We could parse the rank here if needed, but just visiting mimics human behavior
        console.log('Checked ranking');
    }
}
