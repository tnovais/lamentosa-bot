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

/**
 * Generates a Bezier curve path for natural mouse movement.
 */
export function generateBezierPath(startX: number, startY: number, endX: number, endY: number, steps: number = 20): { x: number, y: number }[] {
    const path: { x: number, y: number }[] = [];

    // Control point: somewhere between start and end, with random offset
    const controlX = (startX + endX) / 2 + (Math.random() - 0.5) * 200;
    const controlY = (startY + endY) / 2 + (Math.random() - 0.5) * 200;

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        // Quadratic Bezier formula: (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
        const x = Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * controlX + Math.pow(t, 2) * endX;
        const y = Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * controlY + Math.pow(t, 2) * endY;
        path.push({ x, y });
    }

    return path;
}
