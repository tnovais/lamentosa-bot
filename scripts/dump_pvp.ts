import { chromium } from 'playwright';
import * as fs from 'fs';

const CREDENTIALS = {
    email: "hyun.2pm@gmail.com",
    password: "354035"
};

async function dumpPvP() {
    console.log('Dumping PVP HTML...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto('https://se.lamentosa.com/');

        if (await page.isVisible('input#id_email')) {
            await page.fill('input#id_email', CREDENTIALS.email);
            await page.fill('input#id_password', CREDENTIALS.password);
            await page.click('button[type="submit"]');
            await page.waitForLoadState('networkidle');
        }

        // Navigate to PVP
        console.log('Navigating to PVP...');
        await page.goto('https://se.lamentosa.com/battlefield/enemies-g/?no-scroll=1', { waitUntil: 'networkidle' });

        // Wait for potential list to load
        await page.waitForTimeout(2000);

        const html = await page.content();
        fs.writeFileSync('pvp_dump.html', html);
        console.log('PVP HTML saved to pvp_dump.html');

    } catch (error) {
        console.error('Dump failed:', error);
    } finally {
        await browser.close();
    }
}

dumpPvP().catch(console.error);
