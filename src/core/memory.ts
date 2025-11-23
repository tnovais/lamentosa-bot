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
                PRIMARY KEY (date, account_id)
            );
        `);
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
     * Useful for avoiding loops (e.g., "Don't visit the temple 5 times in 10 minutes").
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
     * Checks how many times an action was performed today (since midnight).
     */
    getDailyActionCount(accountId: string, actionType: string): number {
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
