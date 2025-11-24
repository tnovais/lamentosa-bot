import Redis from 'ioredis';
import { Settings } from '../config/settings';

export interface BotCommand {
    type: 'START' | 'STOP' | 'PAUSE' | 'FORCE_PVP' | 'FORCE_SLEEP' | 'UPDATE_CONFIG';
    payload?: any;
}

export class CommunicationManager {
    private pub: Redis;
    private sub: Redis;
    private accountId: string;
    private commandCallback: ((cmd: BotCommand) => void) | null = null;

    constructor(accountId: string) {
        this.accountId = accountId;
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

        this.pub = new Redis(redisUrl);
        this.sub = new Redis(redisUrl);

        // Subscribe to this bot's specific channel
        this.sub.subscribe(`bot:${this.accountId}:commands`, (err) => {
            if (err) console.error('[REDIS] Failed to subscribe:', err);
            else console.log(`[REDIS] Subscribed to bot:${this.accountId}:commands`);
        });

        this.sub.on('message', (channel, message) => {
            if (channel === `bot:${this.accountId}:commands`) {
                try {
                    const cmd = JSON.parse(message) as BotCommand;
                    console.log(`[REDIS] Received command: ${cmd.type}`);
                    if (this.commandCallback) this.commandCallback(cmd);
                } catch (e) {
                    console.error('[REDIS] Failed to parse command:', e);
                }
            }
        });
    }

    public onCommand(callback: (cmd: BotCommand) => void) {
        this.commandCallback = callback;
    }

    public async publishState(state: any) {
        try {
            await this.pub.publish(`bot:${this.accountId}:state`, JSON.stringify(state));
        } catch (e) {
            console.error('[REDIS] Failed to publish state:', e);
        }
    }

    public async publishLog(level: 'info' | 'warn' | 'error', message: string) {
        try {
            const logEntry = {
                accountId: this.accountId,
                level,
                message,
                timestamp: new Date().toISOString()
            };
            // Publish to a global logs channel or specific bot logs
            await this.pub.publish(`bot:${this.accountId}:logs`, JSON.stringify(logEntry));
        } catch (e) {
            console.error('[REDIS] Failed to publish log:', e);
        }
    }
}
