# Discord Gasoline Bot (Vietnam)

A Discord bot that provides daily gasoline price updates in Vietnam by scraping data from `giaxanghomnay.com`.

## Features
-   **Daily Automatic Updates:** Sends the latest gasoline prices to a specific channel at a scheduled time (default: 8:00 AM).
-   **On-demand Command:** Use `!gas` or `!xang` to get current prices anytime.
-   **Formatted Output:** Prices are presented in a clean Discord Embed table.

## Setup

1.  **Clone the repository** (or copy the files).
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Configure environment variables:**
    -   Copy `.env.example` to `.env`.
    -   Fill in your `DISCORD_TOKEN` (get it from [Discord Developer Portal](https://discord.com/developers/applications)).
    -   Fill in the `CHANNEL_ID` of the channel where you want daily updates.
    -   (Optional) Adjust `CRON_SCHEDULE`.
4.  **Run the bot:**
    ```bash
    node src/index.js
    ```

## Dependencies
-   `discord.js`: To interact with the Discord API.
-   `axios` & `cheerio`: For web scraping gasoline prices.
-   `node-cron`: For scheduling daily tasks.
-   `dotenv`: For managing environment variables.
