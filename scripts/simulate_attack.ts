import { chromium } from 'playwright';
import { Selectors } from '../src/game/selectors';

const CREDENTIALS = {
    email: "hyun.2pm@gmail.com",
    password: "354035"
};

async function simulateAttack() {
    console.log('Starting Attack Simulation...');
    const browser = await chromium.launch({ headless: true }); // Headless true for speed, or false to watch? User said "simulate", usually implies running it.
    // Let's keep headless true but log heavily.
    const page = await browser.newPage();

    try {
        // Login
        console.log('Logging in...');
        await page.goto('https://se.lamentosa.com/');
        if (await page.isVisible(Selectors.Auth.LoginInput)) {
            await page.fill(Selectors.Auth.LoginInput, CREDENTIALS.email);
            await page.fill(Selectors.Auth.PasswordInput, CREDENTIALS.password);
            await page.click(Selectors.Auth.LoginButton);
            await page.waitForLoadState('networkidle');
        }

        // Go to PVP
        console.log('Navigating to PVP...');
        await page.goto('https://se.lamentosa.com/battlefield/enemies-g/?no-scroll=1');

        // Find Enemy
        const enemy = await page.$(Selectors.PvP.EnemyList);
        if (!enemy) {
            console.log('No enemies found!');
            return;
        }

        const enemyName = await enemy.$eval('.name a', el => el.textContent?.trim());
        console.log(`Target found: ${enemyName}`);

        // Find Attack Button
        const attackBtn = await enemy.$(Selectors.PvP.AttackButton);
        if (!attackBtn) {
            console.log('Attack button not found for this enemy.');
            return;
        }

        console.log('Hovering over attack button...');
        await attackBtn.hover();
        await page.waitForTimeout(500);

        console.log('CLICKING ATTACK...');
        await attackBtn.click();

        // Wait for reaction
        await page.waitForTimeout(2000);

        // Check for modal
        const modal = await page.$('.modal-confirm-content');
        if (modal && await modal.isVisible()) {
            console.log('Confirmation modal detected!');
            const text = await modal.textContent();
            console.log(`Modal text: ${text}`);

            // Confirm
            console.log('Confirming attack...');
            await page.click('.confirm-yes');
            await page.waitForLoadState('networkidle');
        } else {
            console.log('No modal detected. Checking for redirect or result...');
        }

        // Check result
        const content = await page.content();
        if (content.includes('You won') || content.includes('Você venceu')) {
            console.log('RESULT: VICTORY');
        } else if (content.includes('You lost') || content.includes('Você perdeu')) {
            console.log('RESULT: DEFEAT');
        } else {
            console.log('RESULT: Unknown (Check screenshot)');
        }

        await page.screenshot({ path: 'attack_result.png' });
        console.log('Screenshot saved to attack_result.png');

    } catch (error) {
        console.error('Simulation failed:', error);
    } finally {
        await browser.close();
    }
}

simulateAttack().catch(console.error);
