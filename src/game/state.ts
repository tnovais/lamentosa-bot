import { Page } from 'playwright';
import { Selectors } from './selectors';
import { Settings } from '../config/settings';

export interface PlayerStats {
    level: number;
    gold: number;
    life: number; // Percentage
    maxLife: number;
    hastePotions: number;
}

export interface WorldState {
    stats: PlayerStats;
    isBusy: boolean;
    currentUrl: string;
    isInCombat: boolean;
    isCaptchaPresent: boolean;
    pvpCooldown: number; // ms remaining
    serverDay: number;
    serverTime: string;
}

/**
 * GameState
 * 
 * Responsible for perceiving the world.
 * Parses the DOM to extract state information.
 */
export class GameState {
    private page: Page;
    private lastState: WorldState | null = null;
    private pvpCooldownExpiresAt: number = 0;

    constructor(page: Page) {
        this.page = page;
    }

    /**
     * Scrapes the current state of the game.
     */
    async getState(): Promise<WorldState> {
        const currentUrl = this.page.url();
        const stats = await this.getPlayerStats();

        // Check for "Busy" timer
        const busyTimer = await this.getBusyTimer();
        const isBusy = busyTimer > 0;

        // Check for Combat
        // We are in combat if the Battle Log is visible OR if we are on a battle page
        const battleLogVisible = await this.page.isVisible(Selectors.BattleLog.Container);
        const isInCombat = battleLogVisible || currentUrl.includes('/battlefield/battle-log/');

        // Check for Captcha
        const isCaptchaPresent = await this.page.isVisible(Selectors.AntiBot.Header[0]) ||
            currentUrl.includes(Selectors.AntiBot.UrlPart);

        // Get Server Time
        const { day, time } = await this.getServerTime();

        const state: WorldState = {
            isBusy,
            currentUrl,
            stats,
            isInCombat,
            isCaptchaPresent,
            pvpCooldown: await this.getPvpCooldown(),
            serverDay: day,
            serverTime: time
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
    logState(accountName?: string, daily?: { gold: number, wins: number, losses: number, pveCount: number, rankTarget: number, pveLimit: number }) {
        if (!this.lastState) return;

        const pveProgress = `${daily?.pveCount ?? '?'}/${daily?.pveLimit ?? '?'}`;
        const profit = daily?.gold ?? 0;
        const profitStr = profit > 0 ? `+${profit}` : `${profit}`;
        const rankMsg = daily && daily.rankTarget > 0
            ? `Need ${daily.rankTarget} wins`
            : 'Calculating...';

        console.log(`
╔════════════════════════════════════════════════════════════╗
║ 🧠 BOT PERCEPTION [${accountName || 'Unknown'}]
╠════════════════════════════════════════════════════════════╣
║ 📍 Location:   ${this.lastState.currentUrl.split('.com')[1] || this.lastState.currentUrl}
║ 📅 Day:        ${this.lastState.serverDay || '?'} | 🕒 ${this.lastState.serverTime || '?'}
║ ❤️ Health:     ${this.lastState.stats.life}%
║ 💰 Gold:       ${this.lastState.stats.gold}
║ ⏳ Cooldown:   ${this.formatCooldown(this.lastState.pvpCooldown)}
║ 🤖 Captcha:    ${this.lastState.isCaptchaPresent ? 'YES' : 'No'}
║ ⚔️ In Combat:  ${this.lastState.isInCombat ? 'Yes' : 'No'}
╠════════════════════════════════════════════════════════════╣
║ 📊 DAILY STATS (Server Day ${this.lastState.serverDay || '?'})
║ ⚔️ PVP:        ${daily?.wins ?? 0} Wins / ${daily?.losses ?? 0} Losses
║ 💰 Profit:     ${profitStr} Gold
║ 🏆 Rank Target: ${rankMsg}
║ 🏹 PVE:        ${pveProgress}
╚════════════════════════════════════════════════════════════╝
        `);
    }

    /**
     * Formats milliseconds into MM:SS string.
     */
    private formatCooldown(ms: number): string {
        if (ms <= 0) return 'Ready';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

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
                life: hpPercent, // Return percentage for logic compatibility
                maxLife: maxHp,
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

    /**
     * Parses the Server Time and Day from the UI.
     * Expected format: "Dia 19" and "21:06:37"
     */
    private async getServerTime(): Promise<{ day: number, time: string }> {
        try {
            // 1. Get Day
            const dayEl = this.page.locator(Selectors.Server.DayLabel).first();
            let day = 0;
            if (await dayEl.isVisible()) {
                const text = await dayEl.textContent();
                const match = text?.match(/Dia\s+(\d+)/i);
                if (match) {
                    day = parseInt(match[1], 10);
                }
            }

            // 2. Get Time
            const timeEl = this.page.locator(Selectors.Server.TimeWidget).first();
            let time = '00:00:00';
            if (await timeEl.isVisible()) {
                const text = await timeEl.textContent();
                const match = text?.match(/(\d{2}):(\d{2}):(\d{2})/);
                if (match) {
                    time = match[0];
                }
            }

            return { day, time };
        } catch (e: any) {
            if (Settings.notifications.debug) console.log(`[DEBUG] Failed to parse server time: ${e.message}`);
            return { day: 0, time: '00:00:00' };
        }
    }
}
