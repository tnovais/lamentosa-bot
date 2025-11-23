import { Page } from 'playwright';
import { randomDelay } from './stealth';

/**
 * InputManager
 * 
 * Handles human-like input simulation using Playwright's native mouse API
 * with randomized movements and delays to mimic human behavior.
 * Replaces ghost-cursor to avoid compatibility issues.
 */
export class InputManager {
    private page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    /**
     * Initializes the input manager (placeholder for compatibility).
     */
    async init() {
        // No-op for native implementation
    }

    /**
     * Moves the mouse to a specific selector and clicks it.
     * Simulates human movement by using 'steps' and random offsets.
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
            const x = box.x + (Math.random() * (box.width * 0.8)) + (box.width * 0.1);
            const y = box.y + (Math.random() * (box.height * 0.8)) + (box.height * 0.1);

            // Move with "steps" to simulate movement speed
            // Steps = distance / speed. We'll just pick a random step count for now.
            await this.page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });

            // Small pause before clicking
            await randomDelay(50, 150);

            await this.page.mouse.down();
            await randomDelay(30, 100); // Hold click briefly
            await this.page.mouse.up();

        } catch (error) {
            // console.warn(`Failed to human-click selector: ${selector}`, error);
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

        const x = Math.random() * viewport.width;
        const y = Math.random() * viewport.height;

        await this.page.mouse.move(x, y, { steps: Math.floor(Math.random() * 20) + 10 });
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
