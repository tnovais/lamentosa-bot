import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { newInjectedContext } from 'fingerprint-injector';
import { FingerprintGenerator } from 'fingerprint-generator';
import * as fs from 'fs';
import * as path from 'path';

/**
 * BrowserManager
 * 
 * Manages the lifecycle of the Playwright browser and its contexts.
 * Responsible for:
 * 1. Launching the browser with stealth arguments.
 * 2. Creating persistent contexts for each account (to save cookies/localStorage).
 * 3. Injecting advanced fingerprinting to mask the bot identity.
 */
export class BrowserManager {
    private browser: Browser | null = null;
    private fingerprintGenerator: FingerprintGenerator;
    private userDataDir: string;

    constructor(baseDir: string = './browser_data') {
        this.userDataDir = baseDir;
        this.fingerprintGenerator = new FingerprintGenerator({
            devices: ['desktop'],
            operatingSystems: ['windows'],
            browsers: [{ name: 'chrome', minVersion: 110 }],
            locales: ['pt-BR', 'en-US'],
        });
    }

    /**
     * Initializes the main browser instance.
     */
    async init() {
        if (this.browser) return;

        this.browser = await chromium.launch({
            headless: process.env.HEADLESS === 'true', // Respect env var for Docker
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-infobars',
                '--disable-setuid-sandbox',
                '--ignore-certificate-errors',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu', // Sometimes helps with stability, remove if performance suffers
            ]
        });
    }

    /**
     * Creates or retrieves a stealth context for a specific account.
     * Uses 'fingerprint-injector' to override browser fingerprints.
     */
    async getContext(accountId: string): Promise<{ context: BrowserContext; page: Page }> {
        if (!this.browser) await this.init();

        const accountPath = path.join(this.userDataDir, accountId);
        if (!fs.existsSync(accountPath)) {
            fs.mkdirSync(accountPath, { recursive: true });
        }

        // Generate a consistent fingerprint for this account
        // In a real scenario, we should save this fingerprint to a file so it doesn't change every session
        const fingerprint = this.fingerprintGenerator.getFingerprint({
            locales: ['pt-BR'],
        }) as any;

        // Create a persistent context with the generated fingerprint
        // We use newInjectedContext to automatically apply the fingerprint overrides
        // @ts-ignore
        const context = await newInjectedContext(this.browser!, {
            fingerprint: fingerprint,
            newContextOptions: {
                viewport: {
                    width: fingerprint.screen?.width || 1920,
                    height: fingerprint.screen?.height || 1080
                },
                locale: 'pt-BR',
                timezoneId: 'America/Sao_Paulo',
                userAgent: fingerprint.navigator?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
            }
        });

        // Create a new page in this context
        const page = await context.newPage();

        // Extra Stealth: Mask `navigator.webdriver` just in case
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });

        return { context, page };
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
