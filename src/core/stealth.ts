/**
 * Stealth Configuration
 * 
 * Centralized settings for anti-detection measures.
 */

export const StealthConfig = {
    // Fingerprint generation settings
    fingerprint: {
        devices: ['desktop'],
        operatingSystems: ['windows'],
        browsers: [{ name: 'chrome', minVersion: 110 }],
        locales: ['pt-BR', 'en-US'],
    },

    // Behavior settings
    behavior: {
        // Probability of taking a short break (0-1)
        shortBreakChance: 0.05,
        // Duration of short break in ms
        shortBreakDuration: { min: 30000, max: 120000 },

        // Probability of "fatigue" affecting speed
        fatigueChance: 0.1,
    },

    // Viewport options
    viewport: {
        width: 1920,
        height: 1080,
    }
};

/**
 * Helper to generate a random delay between min and max ms.
 */
export function randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}
