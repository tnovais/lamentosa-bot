import { chromium } from 'playwright';
import * as fs from 'fs';

const CREDENTIALS = {
    email: "hyun.2pm@gmail.com",
    password: "354035"
};

async function dumpDashboard() {
    console.log('Dumping Dashboard HTML...');
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

        // Wait for level to ensure load
        try {
            await page.waitForSelector('.level', { timeout: 5000 });
        } catch { }

        const html = await page.content();
        fs.writeFileSync('dashboard_dump.html', html);
        console.log('Dashboard HTML saved to dashboard_dump.html');

    } catch (error) {
        console.error('Dump failed:', error);
    } finally {
        await browser.close();
    }
}

dumpDashboard().catch(console.error);
