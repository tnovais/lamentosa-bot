import { StealthConfig, randomDelay } from '../core/stealth';

/**
 * Scheduler
 * 
 * Manages the "human" aspect of time.
 * - Enforces breaks.
 * - Simulates fatigue (slowing down over time).
 * - Checks daily limits.
 */
export class Scheduler {
    private startTime: number;
    private actionsPerformed: number = 0;
    private fatigue: number = 0;

    constructor() {
        this.startTime = Date.now();
    }

    /**
     * Checks if the bot should take a break or stop.
     */
    async checkSchedule(): Promise<boolean> {
        // [DEBUG] Breaks disabled for mapping/testing
        return true;
    }

    /**
     * Calculates a "fatigue delay" to add to actions.
     * The longer the bot runs, the slower it reacts.
     */
    async applyFatigueDelay() {
        const runtimeMinutes = (Date.now() - this.startTime) / 1000 / 60;
        if (runtimeMinutes > 60) {
            // Add 100ms - 500ms extra delay per hour of runtime
            const extraDelay = Math.min(runtimeMinutes * 5, 2000);
            await randomDelay(0, extraDelay);
        }
    }
}
