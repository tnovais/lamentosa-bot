import { Page } from 'playwright';

export interface ServerStatus {
    isOnline: boolean;
    playersOnline: number;
    serverLoad: string;
    lastChecked: number;
}

/**
 * StatusScraper
 * 
 * Monitors 'https://se.lamentosa.com/status/' for server health and global events.
 * This helps the bot avoid playing during maintenance or high-risk periods.
 */
import { Settings } from '../config/settings';

export class StatusScraper {
    private page: Page;
    private statusUrl = Settings.game.statusUrl;

    constructor(page: Page) {
        this.page = page;
    }

    /**
     * Checks the server status page.
     */
    async checkStatus(): Promise<ServerStatus> {
        try {
            console.log(`[StatusScraper] Checking ${this.statusUrl}...`);
            await this.page.goto(this.statusUrl, { waitUntil: 'domcontentloaded' });

            // Generic scraping logic - adjust selectors based on actual page structure
            // Assuming common patterns for status pages
            const bodyText = await this.page.textContent('body');
            const isOnline = !bodyText?.toLowerCase().includes('maintenance') && !bodyText?.toLowerCase().includes('offline');

            // Try to find a number representing players online
            // This is a guess, but a safe one to start with
            const playersMatch = bodyText?.match(/(\d+)\s+players/i) || bodyText?.match(/online:\s*(\d+)/i);
            const playersOnline = playersMatch ? parseInt(playersMatch[1], 10) : 0;

            return {
                isOnline,
                playersOnline,
                serverLoad: 'Unknown', // Placeholder until we know the UI
                lastChecked: Date.now()
            };

        } catch (error) {
            console.error('[StatusScraper] Failed to check status:', error);
            return {
                isOnline: false,
                playersOnline: 0,
                serverLoad: 'Error',
                lastChecked: Date.now()
            };
        }
    }
}
