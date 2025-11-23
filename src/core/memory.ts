import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

/**
 * MemoryManager
 * 
 * Handles long-term memory using SQLite.
 * Stores action history to prevent repetitive patterns and allow for "smart" decisions.
 */
export class MemoryManager {
    private db: Database.Database;

    constructor(dataDir: string = './data') {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        this.db = new Database(path.join(dataDir, 'bot_memory.db'));
        this.init();
    }

    private init() {
        // Create tables if they don't exist
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id TEXT,
                action_type TEXT,
                timestamp INTEGER,
                details TEXT
            );
            
            CREATE TABLE IF NOT EXISTS daily_stats (
                date TEXT,
                account_id TEXT,
                xp_gained INTEGER DEFAULT 0,
                gold_gained INTEGER DEFAULT 0,
                actions_count INTEGER DEFAULT 0,
                pvp_wins INTEGER DEFAULT 0,
                pvp_losses INTEGER DEFAULT 0,
                pve_count INTEGER DEFAULT 0,
                PRIMARY KEY (date, account_id)
            );

            CREATE TABLE IF NOT EXISTS kv_store (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `);

        // Auto-migration: Add missing columns for existing databases
        this.safeAddColumn('daily_stats', 'pvp_wins', 'INTEGER DEFAULT 0');
        this.safeAddColumn('daily_stats', 'pvp_losses', 'INTEGER DEFAULT 0');
        this.safeAddColumn('daily_stats', 'gold_gained', 'INTEGER DEFAULT 0');
        this.safeAddColumn('daily_stats', 'pve_count', 'INTEGER DEFAULT 0');

        console.log('[Memory] Database initialized and schema verified.');
    }

    /**
     * Safely adds a column to a table if it doesn't exist.
     */
    private safeAddColumn(table: string, column: string, definition: string) {
        try {
            this.db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
        } catch (error: any) {
            // Ignore error if column already exists
            if (!error.message.includes('duplicate column name')) {
                // console.warn(`[DB] Migration warning for ${table}.${column}:`, error.message);
            }
        }
    }

    /**
     * Records an action in the database.
     */
    recordAction(accountId: string, actionType: string, details: any = {}) {
        const stmt = this.db.prepare(`
            INSERT INTO actions (account_id, action_type, timestamp, details)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(accountId, actionType, Date.now(), JSON.stringify(details));
    }

    /**
     * Checks how many times an action was performed in the last N minutes.
     */
    getRecentActionCount(accountId: string, actionType: string, minutes: number): number {
        const cutoff = Date.now() - (minutes * 60 * 1000);
        const stmt = this.db.prepare(`
            SELECT COUNT(*) as count FROM actions 
            WHERE account_id = ? AND action_type = ? AND timestamp > ?
        `);
        const result = stmt.get(accountId, actionType, cutoff) as { count: number };
        return result.count;
    }

    /**
     * Gets the timestamp of the last occurrence of an action.
     */
    getLastActionTime(accountId: string, actionType: string): number {
        const stmt = this.db.prepare(`
            SELECT timestamp FROM actions 
            WHERE account_id = ? AND action_type = ? 
            ORDER BY timestamp DESC LIMIT 1
        `);
        const result = stmt.get(accountId, actionType) as { timestamp: number };
        return result ? result.timestamp : 0;
    }

    /**
     * Checks how many times an action was performed today (or on a specific server day).
     */
    getDailyActionCount(accountId: string, actionType: string, serverDay?: number): number {
        if (serverDay) {
            // Optimization: If checking HUNT (PVE), try reading from daily_stats first
            if (actionType === 'HUNT') {
                const stats = this.getDailyStats(accountId, serverDay);
                if (stats && stats.pve_count !== undefined) {
                    return stats.pve_count;
                }
            }

            // Fallback: Filter by serverDay in details JSON
            // Note: This is a text search, ensure details includes "serverDay": X
            const stmt = this.db.prepare(`
                SELECT COUNT(*) as count FROM actions 
                WHERE account_id = ? AND action_type = ? AND details LIKE ?
            `);
            const result = stmt.get(accountId, actionType, `%"serverDay":${serverDay}%`) as { count: number };
            return result.count;
        } else {
            // Fallback to 24h (local time)
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const stmt = this.db.prepare(`
                SELECT COUNT(*) as count FROM actions 
                WHERE account_id = ? AND action_type = ? AND timestamp > ?
            `);
            const result = stmt.get(accountId, actionType, startOfDay.getTime()) as { count: number };
            return result.count;
        }
    }

    /**
     * Updates daily stats (Gold, Wins, Losses, PVE Count).
     */
    updateDailyStats(accountId: string, serverDay: number, stats: { gold?: number, win?: boolean, pveIncrement?: number }) {
        const dateKey = `Day ${serverDay}`;

        // Ensure row exists
        this.db.prepare(`
            INSERT OR IGNORE INTO daily_stats (date, account_id) VALUES (?, ?)
        `).run(dateKey, accountId);

        if (stats.gold) {
            this.db.prepare(`
                UPDATE daily_stats SET gold_gained = gold_gained + ? WHERE date = ? AND account_id = ?
            `).run(stats.gold, dateKey, accountId);
        }

        if (stats.win !== undefined) {
            if (stats.win) {
                this.db.prepare(`
                    UPDATE daily_stats SET pvp_wins = pvp_wins + 1 WHERE date = ? AND account_id = ?
                `).run(dateKey, accountId);
            } else {
                this.db.prepare(`
                    UPDATE daily_stats SET pvp_losses = pvp_losses + 1 WHERE date = ? AND account_id = ?
                `).run(dateKey, accountId);
            }
        }

        if (stats.pveIncrement) {
            this.db.prepare(`
                UPDATE daily_stats SET pve_count = pve_count + ? WHERE date = ? AND account_id = ?
            `).run(stats.pveIncrement, dateKey, accountId);
        }
    }

    /**
     * Gets daily stats.
     */
    getDailyStats(accountId: string, serverDay: number) {
        const dateKey = `Day ${serverDay}`;
        const stmt = this.db.prepare(`
            SELECT * FROM daily_stats WHERE date = ? AND account_id = ?
        `);
        return stmt.get(dateKey, accountId) as { gold_gained: number, pvp_wins: number, pvp_losses: number, pve_count: number } | undefined;
    }

    // KV Store for Ranking Target
    setRankingTarget(accountId: string, winsNeeded: number) {
        const key = `ranking_target_${accountId}`;
        this.db.prepare(`
            INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)
        `).run(key, winsNeeded.toString());
    }

    getRankingTarget(accountId: string): number {
        const key = `ranking_target_${accountId}`;
        const result = this.db.prepare(`SELECT value FROM kv_store WHERE key = ?`).get(key) as { value: string };
        return result ? parseInt(result.value, 10) : 0;
    }
}
