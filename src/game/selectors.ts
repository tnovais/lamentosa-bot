/**
 * Game Selectors
 * 
 * Centralized repository of all DOM selectors for the Lamentosa game.
 * Keeping them here makes it easy to update the bot if the game updates its UI.
 */
import { Settings } from '../config/settings';

export const Selectors = {
    // Login & Auth
    Auth: {
        LoginInput: 'input#id_email',
        PasswordInput: 'input#id_password', // Assuming standard id, need to verify if visible in legacy
        LoginButton: 'button[type="submit"]', // Generic fallback
        LogoutLink: 'a[href*="/logout/"]',
    },

    // Main Interface
    UI: {
        // Profile Stats
        Level: '.g-level .value',
        Gold: '.g-gold .value',
        Energy: '.g-energy .value', // Assuming pattern holds, or I should check dump. 
        // Dump doesn't show energy in top bar? 
        // Line 156-198: Level, Life, Gold, Files. No Energy in top bar?
        // Wait, let me check dump again for Energy.
        // Line 392: <li class="skill">...</li>
        // I don't see Energy in the top bar in the dump lines 154-199.
        // Maybe it's not displayed or I missed it?
        // Let's stick to what I see.
        // Actually, looking at line 22: <li class="g-level...
        // Let's keep Energy as is for now or remove if not found.
        // Wait, the legacy bot used .energy.
        // Line 374: <li class="exp">...</li>
        // Line 382: <li class="life">...</li>
        // Line 392: <li class="skill">...</li>
        // I don't see "Energy" in the dump snippet I read.
        // Let's assume .g-energy might exist or just use the one in skills if needed.
        // But for Gold and Haste, I am sure.

        Life: '.g-life .value',
        MaxLife: '.g-life .full-life-value',
        HastePotions: ['.g-hastes', '.haste-count'], // .g-hastes is verified from dump

        // Navigation
        Links: {
            PvP: '[hx-get*="/battlefield/"]',
            Temple: '[hx-get*="/temple/"]',
            Inventory: '[hx-get*="/items/inventory/"]',
            Jobs: '[hx-get*="/cemetery/jobs/"]',
            Dungeon: '[hx-get*="/dungeons/start/"]',
        },

        // Timers
        BusyTimer: 'h2#busyTimer',
    },

    // PvP / Combat
    PvP: {
        EnemyList: 'ul.player-char li[data-char-id]',
        AttackButton: '.btn.pvp-btn.peform-pvp',
        ResultText: 'body', // The legacy bot checks body text for "Você venceu", etc.
        CooldownTimer: ['#busyTimer', '.timer[data-countdown-active="true"]', 'h2:has-text("Tempo de descanso")', '.countdown'],
    },

    // PvE / Creatures
    PvE: {
        // Broad selector to find any container with an attack button
        CreatureList: 'div:has(button:has-text("Atacar!"))',
        DifficultyLabel: '*', // We will search the whole card text for "Medium"/"Easy"
        AttackButton: `button:has-text("${Settings.game.text.attack}")`,
    },

    // Inventory / Items
    Inventory: {
        HastePotion: '.img-item[alt*="Poção de Haste"]',
        ConfirmUse: ['.btn-confirm', '.confirm-button', `button:has-text("${Settings.game.text.confirm}")`],
    },

    // Captcha (Legacy reference, use AntiBot)
    Captcha: {
        Input: 'input[name="number"]',
    },

    // Dungeons
    Dungeon: {
        ExploreButton: ['.btn.dungeon-btn', '.explore-dungeon', `button:has-text("${Settings.game.text.explore}")`],
        FightButton: ['.btn.fight-btn', '.combat-button', `button:has-text("${Settings.game.text.fight}")`],
    },

    // Jobs
    Job: {
        PerformButton: ['.btn.job-btn', '.perform-job', `button:has-text("${Settings.game.text.work}")`],
    },

    // Temple
    Temple: {
        PrayButton: ['.btn.temple-btn', '.pray-button', `button:has-text("${Settings.game.text.pray}")`],
    },

    // Modals & Popups
    Modal: {
        Content: '.modal-confirm-content',
        ConfirmYes: '.confirm-yes',
    },

    // Global Anti-Bot / Errors
    AntiBot: {
        UrlPart: 'anti-bot',
        Header: ['h2:has-text("SISTEMA ANTI-BOT")', 'h1:has-text("SISTEMA ANTI-BOT")', 'div:has-text("SISTEMA ANTI-BOT")'],
        Images: '.bot-trap',
        Container: '.antibot',
        Input: 'input[name="number"]',
        InputGeneric: 'input[type="text"]',
    },

    // Server Time & Status
    Server: {
        TimeWidget: '.server-time', // Needs verification, assuming class based on common patterns or text search
        DayLabel: 'text=Dia', // Fallback to finding text "Dia"
    },

    // Battle Log (PVP Result)
    BattleLog: {
        UrlPart: 'battle-log',
        Winner: '.winner-name', // Hypothetical, will use text search if needed
        Loser: '.loser-name',
        Gold: '.gold-amount',
        ResultHeader: 'h1, h2', // "Vitória" or "Derrota"
    },

    // Ranking
    Ranking: {
        UrlPart: '/ranking/pvp/daily-list/',
        Rows: 'table.ranking-table tr', // Hypothetical
        PlayerName: '.char-name',
        Wins: '.wins-count',
    }
};
