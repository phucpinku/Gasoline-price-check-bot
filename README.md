# ⛽ Discord Gasoline Price Bot (Vietnam)

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-blue.svg)](https://nodejs.org/)
[![Discord.js Version](https://img.shields.io/badge/discord.js-v14.16.2-blue.svg)](https://discord.js.org/)
[![License](https://img.shields.io/badge/license-GPLv3-green.svg)](LICENSE)

A Discord bot that provides daily gasoline price updates in Vietnam by scraping data from Petrolimex via `giaxanghomnay.com`. It features automatic daily notifications upon price changes and supports multi-server setup with granular configuration commands.

---

##  Features

- **Daily Automatic Updates (Cron):** Checks for price updates at a scheduled time (default: 8:00 AM UTC+7 / Asia/Ho_Chi_Minh).
- **Smart Alerts (Only on Price Changes):** The scheduled task *only* broadcasts messages when a price change is detected compared to the last recorded prices, avoiding unnecessary channel spam.
- **On-demand Query:** Anyone can query the latest prices instantly by typing `!gas` or `!xang`.
- **Dynamic Price Comparison:** Automatically calculates price changes and displays visually distinct indicators:
  - ↗️ `(+Price)` for increases.
  - ↘️ `(-Price)` for decreases.
  - Compares prices for both **Zone 1** (Vùng 1) and **Zone 2** (Vùng 2).
- **Multi-Server Configuration:** Guild administrators can configure the bot for their server directly via chat commands. Configs are stored locally in JSON format.
- **Bilingual Interface Support:** Commands are optimized for Vietnamese users.

---

##  Discord Bot Command Reference

| Command | Arguments | Description | Permission Required |
| :--- | :--- | :--- | :--- |
| `!gas` or `!xang` | None | Fetches and displays the latest gasoline prices in an embed. | Everyone |
| `!setup` | `#channel-mention` `[@role-mention]` | Sets up the channel for automatic daily updates and optionally pings a role. | `Manage Server` or `Administrator` |
| `!setup` | `off` or `disable` or `reset` | Disables automatic price updates for the current server. | `Manage Server` or `Administrator` |
| `!config` or `!status`| None | Shows current bot configuration (target channel and role) for the server. | Everyone |

### Setup Examples:
- `!setup #gia-xang @everyone` — Sends updates to `#gia-xang` and pings `@everyone`.
- `!setup #announcements @PetrolAlerts` — Sends updates to `#announcements` and pings `@PetrolAlerts`.
- `!setup #general` — Sends updates to `#general` with no role ping.
- `!setup off` — Turns off daily updates for the server.

---

##  How It Works Behind the Scenes

1. **Scraping:** The bot uses `axios` and `cheerio` to fetch and parse the front-page table of `https://giaxanghomnay.com/` for specific fuel types:
   - *Xăng RON 95-V*
   - *Xăng RON 95-III*
   - *Xăng E5 RON 92-II*
   - *Xăng E10 RON 95-III*
2. **State Management:** Price data is saved inside `data/prices.json`.
3. **Comparison:** When fetching prices:
   - The bot compares current scraped prices against the data inside `data/prices.json`.
   - If there is a price mismatch, it formats delta changes (e.g., `↗️ (+300)`).
   - If triggered by the cron scheduler and no changes are found, the update is skipped to avoid spam.
4. **Guild Settings:** Server settings (target channel and ping role) are saved inside `data/config.json`.

---

##  Setup Guide

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Node.js** (v16.11.0 or higher is recommended)
- **npm** (Node Package Manager)
- A Discord account with administrative access to a server for testing.

### 2. Clone and Install
Clone this repository to your local system or server and run:
```bash
git clone https://github.com/phucpinku/Gasoline-price-check-bot.git
cd Gasoline-price-check-bot
npm install
```

### 3. Create a Discord Bot Application
Before running the bot, you need to register it on the Discord Developer Portal:
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** in the top right corner. Name it (e.g., `Gasoline Price Alert`).
3. Go to the **Bot** section in the left sidebar and click **Add Bot**.
4. Click **Reset Token**, copy the token string, and keep it safe. You will need it for the `.env` file.
5. **CRITICAL STEP:** Scroll down to the **Privileged Gateway Intents** section:
   - Enable **Message Content Intent** (This allows the bot to read commands like `!gas` and `!setup`).
   - Click **Save Changes**.

### 4. Invite the Bot to Your Server
1. In the Developer Portal, go to **OAuth2** -> **URL Generator** on the left menu.
2. Under **Scopes**, select `bot`.
3. Under **Bot Permissions**, select the following:
   - `Send Messages`
   - `Embed Links`
   - `Read Message History`
4. Copy the generated URL at the bottom of the page.
5. Paste it into your browser, select your Discord server, and click **Authorize**.

### 5. Configure Environment Variables
Create a file named `.env` in the root directory. You can copy the template provided:
```bash
cp .env.example .env
```
Open `.env` and fill in the values:
```env
DISCORD_TOKEN=your_discord_bot_token_here

# Cron schedule (default: 0 8 * * * matches 8:00 AM everyday in Vietnam timezone GMT+7)
CRON_SCHEDULE=0 8 * * *

# (Optional Default Fallbacks)
CHANNEL_ID=
ROLE_ID=
```
> [!NOTE]
> Server configurations created using the `!setup` command take precedence over `CHANNEL_ID` and `ROLE_ID` specified in `.env`. The `.env` fallback values are only used if a server doesn't have a configuration stored in `data/config.json` yet.
---

##  Project Structure

```text
Gasoline-price-check-bot/
├── data/
│   ├── config.json          # Persisted server-specific configurations (created at runtime)
│   └── prices.json          # Cached prices for comparison (created at runtime)
├── src/
│   ├── gasoline.js          # Web scraper code (scrapes giaxanghomnay.com)
│   └── index.js             # Main discord.js bot logic and cron jobs
├── .env.example             # Configuration file template
├── package.json             # Node dependencies and scripts
└── README.md                # Project documentation (this file)
```
---

## 📄 License
Project này được phân phối dưới giấy phép **GNU General Public License v3.0**. Xem chi tiết tại tệp [LICENSE](LICENSE).
