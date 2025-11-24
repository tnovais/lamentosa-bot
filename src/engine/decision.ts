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

export interface DecisionResult {
    action: Decision;
    score: number;
    reason: string;
}

export class DecisionEngine {
    private memory: MemoryManager;

    constructor(memory: MemoryManager) {
        this.memory = memory;
    }

    /**
     * Decides the next action based on the current world state.
     */
    async decide(state: WorldState, accountId: string): Promise<DecisionResult> {
        // 1. Emergency Overrides
        if (state.isCaptchaPresent) return { action: Decision.SOLVE_CAPTCHA, score: 1000, reason: 'Captcha detected' };

        // 2. Calculate Scores
        const scores = {
            [Decision.ATTACK]: await this.scoreAttack(state),
            [Decision.HEAL]: await this.scoreHeal(state),
            [Decision.FLEE]: await this.scoreFlee(state),
            [Decision.HUNT]: await this.scoreHunt(state, accountId),
            [Decision.DUNGEON]: await this.scoreDungeon(state),
            [Decision.CHECK_RANKING]: await this.scoreCheckRanking(state, accountId),
            [Decision.IDLE]: Settings.weights.idle,
            [Decision.SOLVE_CAPTCHA]: Settings.weights.captcha,
        };

        // 3. Add Random Noise
        for (const key of Object.keys(scores)) {
            const k = key as Decision;
            scores[k] = scores[k] * (Settings.weights.noise.base + Math.random() * Settings.weights.noise.random);
        }

        // 4. Select Best Action
        let bestAction = Decision.IDLE;
        let bestScore = -Infinity;

        for (const [action, score] of Object.entries(scores)) {
            if (score > bestScore) {
                bestScore = score;
                bestAction = action as Decision;
            }
        }

        return { action: bestAction, score: bestScore, reason: 'Highest score' };
    }

    private async scoreAttack(state: WorldState): Promise<number> {
        if (!state.isInCombat) return 0;
        if (state.stats.life < Settings.weights.attack.baseHpThreshold) return 0;
        return Settings.weights.attack.highScore;
    }

    private async scoreHeal(state: WorldState): Promise<number> {
        if (state.stats.life < Settings.weights.heal.criticalHp) return 100;
        if (state.stats.life < Settings.weights.heal.hpCurveMax) return 50;
        return 0;
    }

    private async scoreFlee(state: WorldState): Promise<number> {
        if (state.isInCombat && state.stats.life < Settings.weights.flee.hpCritical) return 200;
        return 0;
    }

    private async scoreHunt(state: WorldState, accountId: string): Promise<number> {
        if (state.isBusy) return 0;
        if (state.isInCombat) return 0;
        if (state.pvpCooldown > 0) return 0; // Shared cooldown

        // Check Daily Limit
        const pveCount = await this.memory.getDailyActionCount(accountId, 'HUNT', state.serverDay);
        if (pveCount >= Settings.weights.farm.dailyLimit) return 0;

        return Settings.weights.farm.normalScore;
    }

    private async scoreDungeon(state: WorldState): Promise<number> {
        // Placeholder for Dungeon logic
        return 0;
    }

    private async scoreCheckRanking(state: WorldState, accountId: string): Promise<number> {
        // TODO: Implement ranking check logic
        return 0;
    }
}
