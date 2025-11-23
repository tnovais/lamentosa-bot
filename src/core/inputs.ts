import { Page } from 'playwright';
import { randomDelay, generateBezierPath } from './stealth';

/**
 * InputManager
 * 
 * Handles human-like input simulation using Playwright's native mouse API
 * with randomized movements and delays to mimic human behavior.
 * Replaces ghost-cursor to avoid compatibility issues.
 */
export class InputManager {
    private page: Page;
    private lastX: number = 0;
    private lastY: number = 0;

    constructor(page: Page) {
        this.page = page;
    }

    /**
     * Initializes the input manager.
     */
    async init() {
        const viewport = this.page.viewportSize();
        if (viewport) {
            this.lastX = Math.random() * viewport.width;
            this.lastY = Math.random() * viewport.height;
        }
    }

    /**
     * Moves the mouse to a specific selector and clicks it.
     * Simulates human movement using Bezier curves.
     */
    async click(selector: string) {
        try {
            const box = await this.getBoundingBox(selector);
            if (!box) {
                // Fallback if element is not visible or found
                await this.page.click(selector);
                return;
            }

            // Calculate a random point within the element
            const targetX = box.x + (Math.random() * (box.width * 0.8)) + (box.width * 0.1);
            const targetY = box.y + (Math.random() * (box.height * 0.8)) + (box.height * 0.1);

            // Generate human-like path
            const path = generateBezierPath(this.lastX, this.lastY, targetX, targetY, 25);

            // Execute movement along the path
            for (const point of path) {
                await this.page.mouse.move(point.x, point.y);
                // Tiny random delay between some steps for realism? 
                // Actually, continuous movement is better, maybe just one delay mid-path?
                // Let's keep it fluid for now.
            }

            this.lastX = targetX;
            this.lastY = targetY;

            // Small pause before clicking
            await randomDelay(50, 150);

            await this.page.mouse.down();
            await randomDelay(30, 100); // Hold click briefly
            await this.page.mouse.up();

        } catch (error) {
            // Fallback to standard click
            try {
                await this.page.click(selector, { timeout: 5000 });
            } catch (fallbackError) {
                throw new Error(`Failed to click ${selector} (Human & Fallback failed)`);
            }
        }
    }

    /**
     * Types text into a field with variable speed and occasional pauses.
     */
    async type(selector: string, text: string) {
        // Click first to focus
        await this.click(selector);

        // Type with random delays between keystrokes (50ms to 150ms)
        await this.page.type(selector, text, {
            delay: Math.floor(Math.random() * 100) + 50
        });
    }

    /**
     * Moves the mouse to a random location on the screen to simulate "idle" behavior.
     */
    async moveRandomly() {
        const viewport = this.page.viewportSize();
        if (!viewport) return;

        const targetX = Math.random() * viewport.width;
        const targetY = Math.random() * viewport.height;

        const path = generateBezierPath(this.lastX, this.lastY, targetX, targetY, 30);

        for (const point of path) {
            await this.page.mouse.move(point.x, point.y);
        }

        this.lastX = targetX;
        this.lastY = targetY;
    }

    /**
     * Helper to get bounding box of an element.
     */
    private async getBoundingBox(selector: string) {
        const element = await this.page.$(selector);
        if (!element) return null;
        return await element.boundingBox();
    }
}
