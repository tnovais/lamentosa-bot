# Lamentosa Elite Bot 2.0 🤖⚔️

**Advanced, undetectable automation agent for Lamentosa.**

This bot is designed to automate gameplay actions in Lamentosa with a focus on human-like behavior, stealth, and efficiency.

## 🚀 Features

*   **🧠 Smart Decision Engine**: Uses Fuzzy Logic to prioritize actions (Attack, Heal, Farm, Dungeon) dynamically based on HP, Gold, and Cooldowns.
*   **🛡️ Anti-Detection System**:
    *   **Fingerprint Spoofing**: Generates unique browser fingerprints.
    *   **Humanized Inputs**: Mouse movements and typing are randomized to mimic human behavior.
    *   **Global Captcha Solver**: Automatically detects and solves captchas using 2Captcha API (Direct integration).
*   **⚔️ Combat & Farming**:
    *   **PvP**: Automatically finds targets and attacks. Handles cooldowns intelligently.
    *   **PvE**: Hunts creatures prioritizing difficulty (Medium > Easy).
    *   **Dungeons**: Explores dungeons when other actions are on cooldown.
*   **🏥 Auto-Healing**: Visits the temple or uses potions when HP is critical.
*   **⚡ Performance**: Runs multiple accounts concurrently with low resource usage.

## 🛠️ Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/tnovais/lamentosa-bot.git
    cd lamentosa-bot
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment**:
    *   Copy `.env.example` to `.env` (create it if it doesn't exist).
    *   Add your accounts and API keys.

    ```env
    # .env
    ACCOUNTS=[{"id":"1","username":"your_email","password":"your_password","active":true}]
    CAPTCHA_API_KEY=your_2captcha_key
    ```

## 🏃‍♂️ Usage

Start the bot:

```bash
npm start
```

## 🏗️ Architecture

*   **Core**: `src/core` (Browser, Inputs, Stealth, Captcha)
*   **Game**: `src/game` (Actions, State, Selectors)
*   **Engine**: `src/engine` (Decision Logic, Scheduler)
*   **Config**: `src/config` (Settings, Weights)

## ⚠️ Disclaimer

This bot is for educational purposes only. Use at your own risk. The authors are not responsible for any bans or penalties incurred.
