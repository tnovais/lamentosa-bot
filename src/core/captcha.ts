import { Solver } from '2captcha';
import { Page } from 'playwright';
import { Settings } from '../config/settings';
import * as fs from 'fs';

/**
 * CaptchaSolver
 * 
 * Handles CAPTCHA resolution using 2Captcha service.
 * Takes a screenshot of the captcha image and sends it for solving.
 */
export class CaptchaSolver {
    private solver: Solver;
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.CAPTCHA_API_KEY || '';
        this.solver = new Solver(this.apiKey);
    }

    /**
     * Solves the captcha on the current page.
     * @param page Playwright page instance
     * @param selector Selector for the captcha image
     */
    async solve(page: Page, containerSelector: string, inputSelector: string): Promise<boolean> {
        if (!this.apiKey) {
            console.warn('No CAPTCHA_API_KEY provided. Skipping solver.');
            return false;
        }

        try {
            console.log('Attempting to solve CAPTCHA (Direct API)...');

            // [DEBUG] Dump HTML to verify structure
            const fs = require('fs');
            fs.writeFileSync('debug_captcha_page.html', await page.content());

            // 1. Wait for the captcha container and images
            try {
                await page.waitForSelector(containerSelector, { state: 'visible', timeout: 5000 });
                await page.waitForSelector(`${containerSelector} img`, { state: 'visible', timeout: 5000 });
                await page.waitForTimeout(1000);
            } catch (e) {
                console.error(`Captcha container (${containerSelector}) or images not visible/found.`);
                return false;
            }

            // 2. Get the element handle
            const captchaElement = await page.$(containerSelector);
            if (!captchaElement) {
                console.error('Captcha container element handle is null');
                return false;
            }

            let imageBuffer: Buffer;

            // [FIX] Scroll into view and ensure bounding box
            await captchaElement.scrollIntoViewIfNeeded();
            const box = await captchaElement.boundingBox();

            if (!box || box.width === 0 || box.height === 0) {
                console.error('Captcha element has 0 dimensions or is not visible.');
                if (containerSelector === '.im') {
                    console.log('Retrying with parent .antibot selector...');
                    const parent = await page.$('.antibot');
                    if (parent) {
                        imageBuffer = await parent.screenshot();
                    } else {
                        return false;
                    }
                } else {
                    return false;
                }
            } else {
                imageBuffer = await captchaElement.screenshot();
            }

            if (imageBuffer!.length < 1000) {
                console.warn('[DEBUG] Screenshot too small. Taking FULL PAGE screenshot as fallback.');
                imageBuffer = await page.screenshot({ fullPage: true });
            }

            const imageBase64 = imageBuffer!.toString('base64');
            console.log(`[DEBUG] Base64 length: ${imageBase64.length}`);

            // 4. Send to 2Captcha (Direct API)
            const uploadUrl = 'http://2captcha.com/in.php';
            const response = await page.request.post(uploadUrl, {
                form: {
                    key: this.apiKey,
                    method: 'base64',
                    body: imageBase64,
                    json: 1,
                    numeric: 1,
                    min_len: 4,
                    max_len: 5
                }
            });

            const uploadResult = await response.json();
            console.log(`[DEBUG] Upload Result:`, uploadResult);

            if (uploadResult.status !== 1) {
                console.error(`Failed to upload captcha: ${uploadResult.request}`);
                return false;
            }

            const captchaId = uploadResult.request;
            console.log(`[DEBUG] Captcha ID: ${captchaId}. Waiting for solution...`);

            // 5. Poll for solution
            const pollUrl = 'http://2captcha.com/res.php';
            let attempts = 0;
            while (attempts < 20) {
                await page.waitForTimeout(2000);
                const pollResponse = await page.request.get(pollUrl, {
                    params: {
                        key: this.apiKey,
                        action: 'get',
                        id: captchaId,
                        json: 1
                    }
                });
                const pollResult = await pollResponse.json();

                if (pollResult.status === 1) {
                    const solution = pollResult.request;
                    console.log(`Captcha solved: ${solution}`);
                    await page.fill(inputSelector, solution);
                    await page.keyboard.press('Enter');
                    return true;
                }

                if (pollResult.request !== 'CAPCHA_NOT_READY') {
                    console.error(`Polling error: ${pollResult.request}`);
                    return false;
                }
                attempts++;
            }
            console.error('Captcha solve timed out.');

        } catch (error) {
            console.error('Failed to solve captcha:', error);
        }

        return false;
    }
}
