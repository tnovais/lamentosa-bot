import 'dotenv/config';

export const Settings = {
    // Accounts to run (Parsed from JSON env var)
    accounts: JSON.parse(process.env.ACCOUNTS || '[]'),

    // Global limits
    limits: {
        maxDailyFarms: Number(process.env.MAX_DAILY_FARMS) || 100,
        maxDailyPve: Number(process.env.MAX_DAILY_PVE) || 18,
        maxDailyPlaytimeMinutes: Number(process.env.MAX_DAILY_PLAYTIME_MINUTES) || 480,
    },

    // Game Configuration
    game: {
        baseUrl: process.env.GAME_BASE_URL || 'https://se.lamentosa.com',
        statusUrl: process.env.GAME_STATUS_URL || 'https://se.lamentosa.com/status/',
        paths: {
            pvp: '/battlefield/enemies-g/?no-scroll=1',
            pvpBase: '/battlefield/',
            inventory: '/items/inventory/',
            jobs: '/cemetery/jobs/',
            dungeons: '/dungeons/start/',
            temple: '/temple/main-room/',
            ranking: '/ranking/pvp/daily-list/',
            pve: '/battlefield/creatures/'
        },
        text: {
            confirm: 'Confirmar',
            explore: 'Explorar',
            fight: 'Lutar',
            attack: 'Atacar!',
            work: 'Trabalhar',
            pray: 'Recuperar'
        },
        errors: {
            captchaDetected: 'CAPTCHA_DETECTED',
            navigationFailed: 'Navigation click did not change URL'
        }
    },

    // Delays (in milliseconds)
    // Delays (in milliseconds)
    delays: {
        navigation: {
            min: Number(process.env.DELAY_NAV_MIN) || 1000,
            max: Number(process.env.DELAY_NAV_MAX) || 3000
        },
        navigationRetry: {
            min: Number(process.env.DELAY_NAV_RETRY_MIN) || 1000,
            max: Number(process.env.DELAY_NAV_RETRY_MAX) || 2000
        },
        click: {
            min: Number(process.env.DELAY_CLICK_MIN) || 500,
            max: Number(process.env.DELAY_CLICK_MAX) || 1500
        },
        combat: {
            min: Number(process.env.DELAY_COMBAT_MIN) || 2000,
            max: Number(process.env.DELAY_COMBAT_MAX) || 4000
        },
        networkIdle: Number(process.env.DELAY_NETWORK_IDLE) || 5000,
    },

    // Decision Engine Weights (Fuzzy Logic)
    weights: {
        attack: {
            baseHpThreshold: Number(process.env.WEIGHT_ATTACK_HP_THRESHOLD) || 50,
            highScore: 1000.0, // SUPER High priority: Always attack if possible
            lowScore: Number(process.env.WEIGHT_ATTACK_LOW) || 20,
        },
        heal: {
            hpCurveMax: Number(process.env.WEIGHT_HEAL_CURVE_MAX) || 100,
            potionBoost: Number(process.env.WEIGHT_HEAL_POTION_BOOST) || 20,
            criticalHp: Number(process.env.WEIGHT_HEAL_CRITICAL_HP) || 40, // Trigger for Temple visit
            criticalBoost: 50,
        },
        flee: {
            hpCritical: Number(process.env.WEIGHT_FLEE_HP_CRITICAL) || 20,
            score: Number(process.env.WEIGHT_FLEE_SCORE) || 90,
        },
        farm: {
            boredomThreshold: Number(process.env.WEIGHT_FARM_BOREDOM_THRESHOLD) || 5,
            boredomScore: Number(process.env.WEIGHT_FARM_BOREDOM_SCORE) || 30,
            normalScore: Number(process.env.WEIGHT_FARM_NORMAL_SCORE) || 60,
            dailyLimit: Number(process.env.LIMIT_DAILY_FARMS) || 1000,
            dungeonBoost: 20,
        },
        pve: {
            difficulties: ['Medium', 'Easy'] // Priority order
        },
        ranking: {
            checkIntervalMinutes: Number(process.env.RANKING_CHECK_INTERVAL_MINUTES) || 15,
        },
        noise: {
            base: 0.9,
            random: 0.2
        },
        idle: 1,
        captcha: 0
    },

    // Notification settings
    notifications: {
        enabled: true,
        logLevel: process.env.LOG_LEVEL || 'info',
        debug: process.env.DEBUG_MODE === 'true'
    }
};
