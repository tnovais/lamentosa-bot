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
        PasswordInput: 'input#id_password',
        LoginButton: 'button[type="submit"]',
        LogoutLink: 'a[href*="/logout/"]',
    },

    // Main Interface
    UI: {
        // Profile Stats
        Level: '.g-level .value',
        Gold: '.g-gold .value',
        Life: '.g-life .value',
        MaxLife: '.g-life .full-life-value',
        HastePotions: ['.g-hastes', '.haste-count'],

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
        ResultText: 'body',
        CooldownTimer: ['#busyTimer', '.timer[data-countdown-active="true"]', 'h2:has-text("Tempo de descanso")', '.countdown'],
    },

    // PvE / Creatures
    PvE: {
        CreatureList: 'div:has(button:has-text("Atacar!"))',
        DifficultyLabel: '*',
        AttackButton: `button:has-text("${Settings.game.text.attack}")`,
    },

    // Inventory / Items
    Inventory: {
        HastePotion: '.img-item[alt*="Poção de Haste"]',
        ConfirmUse: ['.btn-confirm', '.confirm-button', `button:has-text("${Settings.game.text.confirm}")`],
    },

    // Captcha
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
        TimeWidget: '#server-time',
        DayLabel: 'div.season-clock strong',
    },

    // Battle Logs
    BattleLog: {
        UrlPart: '/battlefield/battle-log/',
        Container: '.battle-log, .log-container, body',
        ResultHeader: 'body',
        Gold: '.gold-value, body',
        Winner: '.winner',
        Resume: 'div.battle-resume'
    },

    // Ranking
    Ranking: {
        UrlPart: '/ranking/pvp/daily-list/',
        Rows: 'table.table tbody tr',
        Wins: 'td:nth-child(3)',
        FooterStats: 'div.daily-pvp-info'
    },

    // Status Page
    Status: {
        CharacterName: 'div.col-sm-9',
        CharacterLevel: 'li:has-text("Lv") span',
        CharacterImage: 'a.drawer-toggle img',
        Hp: 'li:has-text("/") span',
        Gold: 'li:has-text("Ouro") span'
    },
};
