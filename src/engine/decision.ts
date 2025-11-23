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
            [Decision.IDLE]: 1,
            [Decision.SOLVE_CAPTCHA]: 0,
        };

        // 3. Add Random Noise
        for (const key of Object.keys(scores)) {
            const k = key as Decision;
            scores[k] = scores[k] * (0.9 + Math.random() * 0.2);
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

        if (state.stats.life > Settings.weights.attack.baseHpThreshold) return Settings.weights.attack.highScore;

        return Settings.weights.attack.lowScore;
    }

    private scoreHeal(state: WorldState): number {
        if (state.stats.life >= 100) return 0;
        let score = Settings.weights.heal.hpCurveMax - state.stats.life;
        if (state.stats.life < Settings.weights.heal.criticalHp) score += 50;
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

        // Check Daily PVE Limit (Max 18)
        const dailyHunts = this.memory.getDailyActionCount(accountId, 'HUNT');
        if (dailyHunts >= Settings.limits.maxDailyPve) {
            if (Settings.notifications.debug) console.log(`[DEBUG] PVE limit reached: ${dailyHunts}/${Settings.limits.maxDailyPve}`);
            return 0;
        }

        return Settings.weights.farm.normalScore;
    }

    private scoreDungeon(state: WorldState): number {
        if (state.isInCombat) return 0;

        // If PVP/PVE is on cooldown, Dungeon is the best option
        if (state.pvpCooldown > 0) {
            return Settings.weights.farm.normalScore + 20; // Boost score to prioritize over Idle
        }

        // Otherwise, it's a valid alternative
        return Settings.weights.farm.normalScore;
    }
}
