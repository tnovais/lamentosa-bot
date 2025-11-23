import { Page } from 'playwright';
import { Selectors } from './selectors';
import { Settings } from '../config/settings';

export interface PlayerStats {
    level: number;
    gold: number;
    energy: number;
    life: number;
    hastePotions: number;
}

export interface WorldState {
    currentUrl: string;
    isBusy: boolean;
    busySeconds: number;
    stats: PlayerStats;
    isInCombat: boolean;
    isCaptchaPresent: boolean;
    pvpCooldown: number;
}

/**
 * GameState
 * 
 * Parses the DOM to create a structured representation of the game state.
 * This allows the Logic Engine to make decisions based on clean data.
 */
export class GameState {
    private page: Page;
    // Internal state storage for logging
    private lastState: WorldState | null = null;

    constructor(page: Page) {
        this.page = page;
    }

    /**
     * Scans the page and returns the full World State.
     */
    async getState(): Promise<WorldState> {
        const stats = await this.getPlayerStats();
        const busySeconds = await this.getBusyTimer();
        const currentUrl = this.page.url();

        // Check for specific conditions
        // 1. Check URL (Most reliable)
        let isCaptchaPresent = currentUrl.includes('anti-bot');

        // 2. Fallback: Check for Header if URL doesn't match yet
        if (!isCaptchaPresent) {
            // Selectors.Captcha.Header is an array of strings
            for (const selector of Selectors.Captcha.Header) {
                if (await this.page.isVisible(selector).catch(() => false)) {
                    isCaptchaPresent = true;
                    if (Settings.notifications.debug) console.log(`[DEBUG] Captcha detected via selector: ${selector}`);
                    break;
                }
            }
        }

        if (Settings.notifications.debug) {
            // console.log(`[DEBUG] URL: ${currentUrl} | CaptchaPresent: ${isCaptchaPresent}`);
        }

        const isInCombat = await this.page.isVisible(Selectors.PvP.AttackButton).catch(() => false);

        const state = {
            currentUrl,
            isBusy: busySeconds > 0,
            busySeconds,
            stats,
            isInCombat,
            isCaptchaPresent,
            pvpCooldown: await this.getPvpCooldown()
        };

        this.lastState = state; // Store for logging

        if (Settings.notifications.debug) {
            console.log(`[DEBUG] State: HP=${stats.life}, Gold=${stats.gold}, Busy=${state.isBusy}, Cooldown=${state.pvpCooldown}`);
        }

        return state;
    }

    /**
     * Prints a summary of the current state to the console.
     */
    logState() {
        if (!this.lastState) return;

        console.log(`
╔════════════════════════════════════════════════════════════╗
║ 🧠 BOT PERCEPTION                                          ║
╠════════════════════════════════════════════════════════════╣
║ 📍 Location:   ${this.lastState.currentUrl.split('.com')[1] || this.lastState.currentUrl}
║ ❤️ Health:     ${this.lastState.stats.life}%
║ 💰 Gold:       ${this.lastState.stats.gold}
║ ⏳ Cooldown:   ${this.lastState.pvpCooldown > 0 ? (this.lastState.pvpCooldown / 1000).toFixed(0) + 's' : 'Ready'}
║ 🤖 Captcha:    ${this.lastState.isCaptchaPresent ? 'YES' : 'No'}
║ ⚔️ In Combat:  ${this.lastState.isInCombat ? 'Yes' : 'No'}
╚════════════════════════════════════════════════════════════╝
        `);
    }

    // [FIX] Persist cooldown expiration to handle page navigation
    private pvpCooldownExpiresAt: number = 0;

    /**
     * Parses the PVP Cooldown timer.
     */
    private async getPvpCooldown(): Promise<number> {
        try {
            let cooldownMs = 0;
            let foundTimer = false;

            // 1. Check for data-seconds-duration (Most reliable)
            const timerEl = this.page.locator('.timer[data-seconds-duration]').first();
            if (await timerEl.isVisible()) {
                const seconds = await timerEl.getAttribute('data-seconds-duration');
                if (seconds) {
                    cooldownMs = parseInt(seconds, 10) * 1000;
                    foundTimer = true;
                }
            }

            // 2. Fallback: Check for text timers
            if (!foundTimer) {
                for (const selector of Selectors.PvP.CooldownTimer) {
                    const timer = this.page.locator(selector).first();
                    if (await timer.isVisible()) {
                        const timerText = await timer.innerText();
                        // Format: "04:50:30" or similar
                        const match = timerText.match(/(\d{2}):(\d{2}):(\d{2})/);
                        if (match) {
                            const h = parseInt(match[1], 10);
                            const m = parseInt(match[2], 10);
                            const s = parseInt(match[3], 10);
                            cooldownMs = (h * 3600 + m * 60 + s) * 1000; // Convert to ms
                            foundTimer = true;
                            break;
                        }
                    }
                }
            }

            // 3. Update Persistence or Use Persisted Value
            if (foundTimer) {
                this.pvpCooldownExpiresAt = Date.now() + cooldownMs;
                return cooldownMs;
            } else {
                // If no timer found on page, check if we have a valid persisted cooldown
                const remaining = this.pvpCooldownExpiresAt - Date.now();
                if (remaining > 0) {
                    if (Settings.notifications.debug) console.log(`[DEBUG] Using persisted PvP cooldown: ${(remaining / 1000).toFixed(0)}s`);
                    return remaining;
                }
            }

            return 0;
        } catch {
            return 0;
        }
    }

    /**
     * Parses player stats from the UI.
     */
    private async getPlayerStats(): Promise<PlayerStats> {
        return await this.page.evaluate((selectors) => {
            const parseNum = (sel: string) => {
                const el = document.querySelector(sel);
                return el ? parseInt(el.textContent?.replace(/\D/g, '') || '0', 10) : 0;
            };

            // Handle Haste Potions (multiple possible selectors)
            let haste = 0;
            for (const sel of selectors.UI.HastePotions) {
                const el = document.querySelector(sel);
                if (el) {
                    haste = parseInt(el.textContent?.replace(/\D/g, '') || '0', 10);
                    break;
                }
            }

            const currentHp = parseNum(selectors.UI.Life);
            const maxHp = parseNum(selectors.UI.MaxLife);
            const hpPercent = maxHp > 0 ? Math.round((currentHp / maxHp) * 100) : 100;

            return {
                level: parseNum(selectors.UI.Level),
                gold: parseNum(selectors.UI.Gold),
                energy: parseNum(selectors.UI.Energy),
                life: hpPercent, // Return percentage for logic compatibility
                hastePotions: haste
            };
        }, Selectors);
    }

    /**
     * Checks for the "Busy" timer.
     */
    private async getBusyTimer(): Promise<number> {
        try {
            const timerText = await this.page.textContent(Selectors.UI.BusyTimer, { timeout: 1000 }).catch(() => null);
            if (!timerText) return 0;

            const match = timerText.match(/(\d{2}):(\d{2}):(\d{2})/);
            if (match) {
                const h = parseInt(match[1], 10);
                const m = parseInt(match[2], 10);
                const s = parseInt(match[3], 10);
                return h * 3600 + m * 60 + s;
            }
            return 0;
        } catch {
            return 0;
        }
    }
}
