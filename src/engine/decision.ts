import { WorldState } from '../game/state';
import { MemoryManager } from '../core/memory';
import { Settings } from '../config/settings';

export enum Decision {
    IDLE = 'IDLE',
    ATTACK = 'ATTACK',
    HEAL = 'HEAL',
    FLEE = 'FLEE',
    HUNT = 'HUNT',       // PVE (Shares cooldown with PVP)
    DUNGEON = 'DUNGEON', // Independent cooldown
    SOLVE_CAPTCHA = 'SOLVE_CAPTCHA',
    CHECK_RANKING = 'CHECK_RANKING',
}

/**
 * DecisionEngine
 * 
 * Uses "Fuzzy Logic" to determine the best course of action.
 */
export class DecisionEngine {
    private memory: MemoryManager;

    constructor(memory: MemoryManager) {
        this.memory = memory;
    }

    /**
     * Decides the next action based on the current world state.
     */
    decide(state: WorldState, accountId: string): Decision {
        // 1. Emergency Overrides
        if (state.isCaptchaPresent) return Decision.SOLVE_CAPTCHA;

        // 2. Calculate Scores
        const scores = {
            [Decision.ATTACK]: this.scoreAttack(state),
            [Decision.HEAL]: this.scoreHeal(state),
            [Decision.FLEE]: this.scoreFlee(state),
            [Decision.HUNT]: this.scoreHunt(state, accountId),
            [Decision.DUNGEON]: this.scoreDungeon(state),
            [Decision.CHECK_RANKING]: this.scoreCheckRanking(state, accountId),
            [Decision.IDLE]: Settings.weights.idle,
            [Decision.SOLVE_CAPTCHA]: Settings.weights.captcha,
        };

        // 3. Add Random Noise
        for (const key of Object.keys(scores)) {
            const k = key as Decision;
            scores[k] = scores[k] * (Settings.weights.noise.base + Math.random() * Settings.weights.noise.random);
        }

        // 4. Pick Winner
        let bestAction = Decision.IDLE;
        let maxScore = -Infinity;

        if (Settings.notifications.debug) {
            console.log(`[DEBUG] Decision Scores: ${JSON.stringify(scores)}`);
        }

        for (const [action, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                bestAction = action as Decision;
            }
        }

        return bestAction;
    }

    private scoreAttack(state: WorldState): number {
        if (state.isInCombat) return Settings.weights.attack.highScore;

        // PVP Cooldown blocks Attack
        if (state.pvpCooldown > 0) return 0;

        // Cycle Management: Max 3 attacks (PVE + PVP) per cooldown cycle
        // We need to track how many attacks we've done since the last cooldown reset.
        // Since we don't have a direct "cycle" tracker in state yet, we can infer it 
        // by checking recent actions within the last COOLDOWN_MINUTES * 2 (safety margin)
        // BUT, the game enforces the cooldown. If we are NOT on cooldown, it means we have "slots" or the cycle reset.
        // The user says "Max 3 attacks until cooldown". 
        // So if we are here, and cooldown is 0, we can attack.
        // However, we should prioritize PVE if time is tight.

        if (state.stats.life > Settings.weights.attack.baseHpThreshold) return Settings.weights.attack.highScore;

        return Settings.weights.attack.lowScore;
    }

    private scoreHeal(state: WorldState): number {
        if (state.stats.life >= 100) return 0;
        let score = Settings.weights.heal.hpCurveMax - state.stats.life;
        if (state.stats.life < Settings.weights.heal.criticalHp) score += Settings.weights.heal.criticalBoost;
        return score;
    }

    private scoreFlee(state: WorldState): number {
        if (!state.isInCombat) return 0;
        if (state.stats.life < Settings.weights.flee.hpCritical) return Settings.weights.flee.score;
        return 0;
    }

    private scoreHunt(state: WorldState, accountId: string): number {
        if (state.isInCombat) return 0;

        // SHARED COOLDOWN: If PVP is on cooldown, PVE is also on cooldown.
        if (state.pvpCooldown > 0) return 0;

        // 1. Check Daily PVE Limit
        const dailyHunts = this.memory.getDailyActionCount(accountId, 'HUNT', state.serverDay);
        const pveLimit = Settings.weights.farm.dailyLimit;

        if (dailyHunts >= pveLimit) {
            return 0; // Done for the day
        }

        // 2. Day Planning (Time Management)
        // Calculate time needed to finish PVE quota
        const remainingHunts = pveLimit - dailyHunts;
        const attacksPerCycle = Settings.limits.attacksPerCycle; // 3
        const cooldownMinutes = Settings.limits.cooldownMinutes; // 20

        const cyclesNeeded = Math.ceil(remainingHunts / attacksPerCycle);
        const timeNeededMinutes = cyclesNeeded * cooldownMinutes;

        // Calculate time left in server day
        // Server time is "HH:MM:SS". We need to parse it.
        const [h, m, s] = state.serverTime.split(':').map(Number);
        const currentMinutes = h * 60 + m;
        const totalDayMinutes = 24 * 60;
        const minutesLeftInDay = totalDayMinutes - currentMinutes;

        // 3. Prioritize PVE if time is tight
        // If we have just enough time (with a buffer), FORCE PVE.
        const bufferMinutes = 60; // 1 hour buffer
        if (minutesLeftInDay < (timeNeededMinutes + bufferMinutes)) {
            if (Settings.notifications.debug) console.log(`[PLANNER] Time tight! Need ${timeNeededMinutes}m for ${remainingHunts} hunts. Left: ${minutesLeftInDay}m.`);
            return 1500; // Higher than PVP (1000)
        }

        return Settings.weights.farm.normalScore;
    }

    private scoreDungeon(state: WorldState): number {
        if (state.isInCombat) return 0;

        // If PVP/PVE is on cooldown, Dungeon is the best option
        if (state.pvpCooldown > 0) {
            return Settings.weights.farm.normalScore + Settings.weights.farm.dungeonBoost; // Boost score to prioritize over Idle
        }

        // Otherwise, it's a valid alternative
        return Settings.weights.farm.normalScore;
    }

    private scoreCheckRanking(state: WorldState, accountId: string): number {
        if (state.isInCombat) return 0;
        if (state.pvpCooldown > 0) return 0; // Don't check ranking if we are resting? Actually we can.
        // But maybe better to do it when free.

        const lastCheck = this.memory.getLastActionTime(accountId, 'CHECK_RANKING');
        const elapsedMinutes = (Date.now() - lastCheck) / 1000 / 60;

        if (elapsedMinutes >= Settings.weights.ranking.checkIntervalMinutes) {
            return 2000; // Very high priority to ensure we check it
        }

        return 0;
    }
}
