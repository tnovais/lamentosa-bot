import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import { Selectors } from '../src/game/selectors';

// User provided credentials
const CREDENTIALS = {
    email: "hyun.2pm@gmail.com",
    password: "354035"
};

async function scanSite() {
    console.log('Starting Authenticated Deep Reconnaissance Scan...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const findings = {
        scripts: [] as string[],
        cookies: [] as string[],
        hiddenElements: [] as string[],
        metaTags: [] as string[],
        selectorValidation: {} as Record<string, boolean>,
        localStorage: {} as any,
    };

    // 1. Intercept Network Requests
    page.on('request', request => {
        if (request.resourceType() === 'script') {
            findings.scripts.push(request.url());
        }
    });

    try {
        // --- LOGIN FLOW ---
        console.log('Navigating to login...');
        await page.goto('https://se.lamentosa.com/');

        // Check if login is needed
        if (await page.isVisible(Selectors.Auth.LoginInput)) {
            console.log('Logging in...');
            await page.fill(Selectors.Auth.LoginInput, CREDENTIALS.email);
            await page.fill(Selectors.Auth.PasswordInput, CREDENTIALS.password);
            await page.click(Selectors.Auth.LoginButton);
            await page.waitForLoadState('networkidle');
            console.log('Login submitted.');
        } else {
            console.log('Already logged in? (Unexpected for fresh browser)');
        }

        // Wait for dashboard or some logged-in element
        try {
            await page.waitForSelector(Selectors.UI.Level, { timeout: 10000 });
            console.log('Login successful! Accessing dashboard.');
        } catch (e) {
            console.error('Login failed or dashboard not loaded.');
            // Capture screenshot for debug
            await page.screenshot({ path: 'login_fail.png' });
        }

        // --- NAVIGATION & SCANNING ---
        const pagesToVisit = [
            { name: 'Dashboard', url: 'https://se.lamentosa.com/' },
            { name: 'Temple', url: 'https://se.lamentosa.com/temple/' },
            { name: 'Inventory', url: 'https://se.lamentosa.com/items/inventory/' },
            { name: 'Jobs', url: 'https://se.lamentosa.com/cemetery/jobs/' },
            { name: 'Dungeons', url: 'https://se.lamentosa.com/dungeons/start/' }
        ];

        for (const p of pagesToVisit) {
            console.log(`Scanning ${p.name}...`);
            await page.goto(p.url, { waitUntil: 'networkidle' });

            // Analyze DOM for hidden elements on this page
            const hiddenOnPage = await page.evaluate(() => {
                const hidden: string[] = [];
                document.querySelectorAll('*').forEach(el => {
                    const style = window.getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                        if (el.tagName === 'INPUT' || el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'SCRIPT') {
                            hidden.push(`${el.tagName}#${el.id}.${el.className} (Name: ${(el as any).name})`);
                        }
                    }
                });
                return hidden;
            });
            findings.hiddenElements.push(...hiddenOnPage.map(h => `[${p.name}] ${h}`));
        }

        // --- SELECTOR VERIFICATION ---
        console.log('Verifying Selectors...');
        // We go back to dashboard for UI stats
        await page.goto('https://se.lamentosa.com/');

        const checkSelector = async (name: string, selector: string | string[]) => {
            const sels = Array.isArray(selector) ? selector : [selector];
            let found = false;
            for (const s of sels) {
                if (await page.$(s)) {
                    found = true;
                    break;
                }
            }
            findings.selectorValidation[name] = found;
        };

        await checkSelector('UI.Level', Selectors.UI.Level);
        await checkSelector('UI.Gold', Selectors.UI.Gold);
        await checkSelector('UI.Life', Selectors.UI.Life);
        await checkSelector('UI.HastePotions', Selectors.UI.HastePotions);

        // Check specific pages for buttons
        await page.goto('https://se.lamentosa.com/temple/');
        await checkSelector('Temple.PrayButton', Selectors.Temple.PrayButton);

        await page.goto('https://se.lamentosa.com/cemetery/jobs/');
        await checkSelector('Job.PerformButton', Selectors.Job.PerformButton);

        // --- FINAL DATA COLLECTION ---
        // Cookies
        const cookies = await page.context().cookies();
        findings.cookies = cookies.map(c => `${c.name} (Domain: ${c.domain})`);

        // Meta Tags
        findings.metaTags = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('meta')).map(m =>
                `${m.getAttribute('name') || m.getAttribute('property')}: ${m.getAttribute('content')}`
            );
        });

        // Local Storage
        findings.localStorage = await page.evaluate(() => JSON.parse(JSON.stringify(localStorage)));

    } catch (error) {
        console.error('Scan failed:', error);
    } finally {
        await browser.close();
    }

    const report = `
--- AUTHENTICATED SCAN RESULTS ---

[SELECTOR VERIFICATION]
${Object.entries(findings.selectorValidation).map(([k, v]) => `${k}: ${v ? '✅ VALID' : '❌ INVALID'}`).join('\n')}

[SCRIPTS DETECTED]
${findings.scripts.join('\n')}

[SUSPICIOUS SCRIPTS]
${findings.scripts.filter(s => s.includes('fingerprint') || s.includes('captcha') || s.includes('analytics') || s.includes('tracker') || s.includes('sift')).join('\n') || 'None'}

[COOKIES]
${findings.cookies.join('\n')}

[HIDDEN ELEMENTS (Potential Traps)]
${findings.hiddenElements.join('\n')}

[META TAGS]
${findings.metaTags.join('\n')}

[LOCAL STORAGE]
${JSON.stringify(findings.localStorage, null, 2)}

--- END SCAN ---
    `;

    fs.writeFileSync('scan_results_auth.txt', report);
    console.log('Scan complete. Results saved to scan_results_auth.txt');
}

scanSite().catch(console.error);
