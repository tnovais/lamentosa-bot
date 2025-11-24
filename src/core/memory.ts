import { PrismaClient, Prisma } from '@prisma/client';
import { Settings } from '../config/settings';

const prisma = new PrismaClient();

export class MemoryManager {

    constructor() {
        // Prisma client is global/static
    }

    /**
     * Updates daily stats in MySQL.
     */
    async updateDailyStats(accountId: string, _serverDay: number, resultOrStats: any, gold?: number) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to midnight

        const updateData: any = {};
        let initialGold = 0;

        // Handle legacy call signature (object) vs new (result string)
        if (typeof resultOrStats === 'string') {
            const result = resultOrStats; // 'WIN', 'LOSS', 'DRAW'
            if (result === 'WIN') updateData.pvpWins = { increment: 1 };
            else if (result === 'LOSS') updateData.pvpLosses = { increment: 1 };
            // Draws are not explicitly tracked in schema yet

            if (gold !== undefined) {
                updateData.gold = { increment: gold };
                initialGold = gold;
            }
        } else {
            // Legacy object { gold, win, pveIncrement }
            const stats = resultOrStats;
            if (stats.gold) {
                updateData.gold = { increment: stats.gold };
                initialGold = stats.gold;
            }
            if (stats.pveIncrement) updateData.pveCount = { increment: stats.pveIncrement };
            if (stats.win !== undefined) {
                if (stats.win) updateData.pvpWins = { increment: 1 };
                else updateData.pvpLosses = { increment: 1 };
            }
        }

        try {
            await prisma.dailyStats.upsert({
                where: {
                    accountId_date: {
                        accountId: accountId,
                        date: today
                    }
                },
                update: updateData,
                create: {
                    accountId: accountId,
                    date: today,
                    gold: initialGold,
                    pveCount: updateData.pveCount?.increment || 0,
                    pvpWins: updateData.pvpWins?.increment || 0,
                    pvpLosses: updateData.pvpLosses?.increment || 0
                }
            });
        } catch (e) {
            console.error('[MEMORY] Failed to update daily stats:', e);
        }
    }

    /**
     * Updates account status in MySQL.
     */
    async updateStatus(accountId: string, status: string, cooldownEndsAt?: Date) {
        try {
            const data: Prisma.AccountUpdateInput = {
                status,
                cooldownEndsAt
            };
            await prisma.account.update({
                where: { id: accountId },
                data
            });
        } catch (e) {
            console.error('[MEMORY] Failed to update status:', e);
        }
    }

    /**
     * Gets daily stats from MySQL.
     */
    async getDailyStats(accountId: string, serverDay: number) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            const stats = await prisma.dailyStats.findUnique({
                where: {
                    accountId_date: {
                        accountId: accountId,
                        date: today
                    }
                }
            });

            return {
                id: stats?.id, // Added ID return for recordAction
                gold_gained: stats?.gold || 0,
                pvp_wins: stats?.pvpWins || 0,
                pvp_losses: stats?.pvpLosses || 0,
                pve_count: stats?.pveCount || 0
            };
        } catch (e) {
            console.error('[MEMORY] Failed to get daily stats:', e);
            return { id: null, gold_gained: 0, pvp_wins: 0, pvp_losses: 0, pve_count: 0 };
        }
    }

    /**
     * Gets action count (PVE) from MySQL.
     */
    async getDailyActionCount(accountId: string, actionType: string, serverDay: number): Promise<number> {
        if (actionType === 'HUNT') {
            const stats = await this.getDailyStats(accountId, serverDay);
            return stats.pve_count;
        }
        return 0;
    }

    private rankingTarget: number = 10;

    /**
     * Sets the ranking target for the account.
     */
    async setRankingTarget(accountId: string, target: number) {
        this.rankingTarget = target;
        try {
            await prisma.account.update({
                where: { id: accountId },
                data: { rankingTarget: target }
            });
        } catch (e) {
            console.error('[MEMORY] Failed to update ranking target:', e);
        }
    }

    /**
     * Gets ranking target.
     */
    async getRankingTarget(accountId: string): Promise<number> {
        return this.rankingTarget;
    }

    /**
     * Records an action (e.g. CHECK_RANKING) to prevent spamming.
     * Overloaded to handle simple string actions or detailed battle stats.
     */
    async recordAction(accountId: string, actionOrServerDay: string | number, type?: 'PVP' | 'PVE', result?: 'WIN' | 'LOSS' | 'DRAW', gold?: number) {
        if (typeof actionOrServerDay === 'string') {
            console.log(`[MEMORY] Recorded action: ${actionOrServerDay}`);
            return;
        }

        const serverDay = actionOrServerDay;
        const stats = await this.getDailyStats(accountId, serverDay);

        if (!stats.id) {
            // If no stats exist yet, updateDailyStats will create them.
            // We can just call updateDailyStats directly for now to keep it simple
            await this.updateDailyStats(accountId, serverDay, result, gold);
            return;
        }

        const updates: any = {
            gold: { increment: gold || 0 },
            totalActions: { increment: 1 }
        };

        if (type === 'PVP') {
            updates.pvpCount = { increment: 1 };
            if (result === 'WIN') updates.pvpWins = { increment: 1 };
            if (result === 'LOSS') updates.pvpLosses = { increment: 1 };
        } else {
            updates.pveCount = { increment: 1 };
        }

        try {
            await prisma.dailyStats.update({
                where: { id: stats.id },
                data: updates
            });
        } catch (e) {
            console.error('[MEMORY] Failed to record detailed action:', e);
        }
    }

    /**
     * Synchronizes the PVP win count with the official game value.
     */
    async syncPvpWins(accountId: string, _serverDay: number, actualWins: number) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            await prisma.dailyStats.upsert({
                where: {
                    accountId_date: {
                        accountId: accountId,
                        date: today
                    }
                },
                update: {
                    pvpWins: actualWins
                },
                create: {
                    accountId: accountId,
                    date: today,
                    gold: 0,
                    pveCount: 0,
                    pvpWins: actualWins,
                    pvpLosses: 0
                }
            });
            console.log(`[MEMORY] Synced PVP wins to: ${actualWins}`);
        } catch (e) {
            console.error('[MEMORY] Failed to sync PVP wins:', e);
        }
    }

    /**
     * Updates character stats (Name, Level, Image, HP, Gold).
     */
    async updateCharacterStats(accountId: string, stats: {
        name?: string,
        level?: number,
        image?: string,
        currentHp?: number,
        maxHp?: number,
        currentGold?: number,
        lastServerTime?: string,
        serverDay?: number
    }) {
        const data: Prisma.AccountUpdateInput = {};
        if (stats.name !== undefined) data.characterName = stats.name;
        if (stats.level !== undefined) data.characterLevel = stats.level;
        if (stats.image !== undefined) data.characterImage = stats.image;
        if (stats.currentHp !== undefined) data.currentHp = stats.currentHp;
        if (stats.maxHp !== undefined) data.maxHp = stats.maxHp;
        if (stats.currentGold !== undefined) data.currentGold = stats.currentGold;
        if (stats.lastServerTime !== undefined) data.lastServerTime = stats.lastServerTime;
        if (stats.serverDay !== undefined) data.serverDay = stats.serverDay;

        if (Object.keys(data).length === 0) return;

        try {
            await prisma.account.update({
                where: { id: accountId },
                data
            });
        } catch (e) {
            console.error('[MEMORY] Failed to update character stats:', e);
        }
    }

    /**
     * Retrieves the stored character name.
     */
    async getCharacterName(accountId: string): Promise<string | null> {
        try {
            const account = await prisma.account.findUnique({
                where: { id: accountId },
                select: { characterName: true }
            });
            return account?.characterName || null;
        } catch (e) {
            console.error('[MEMORY] Failed to get character name:', e);
            return null;
        }
    }
}
