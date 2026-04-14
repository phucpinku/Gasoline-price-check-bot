require('dotenv').config();

const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(process.env.PORT || 3000);

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { getGasolinePrices } = require('./gasoline');

const PRICES_FILE = path.join(__dirname, '../data/prices.json');

function loadPreviousPrices() {
  if (fs.existsSync(PRICES_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PRICES_FILE, 'utf8'));
    } catch (e) {
      console.error('Error loading previous prices:', e);
    }
  }
  return null;
}

function saveCurrentPrices(prices) {
  try {
    const dir = path.dirname(PRICES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PRICES_FILE, JSON.stringify(prices, null, 2));
  } catch (e) {
    console.error('Error saving current prices:', e);
  }
}

function parsePrice(priceStr) {
  return parseInt(priceStr.replace(/\./g, '').replace(/,/g, '')) || 0;
}

function formatDiff(diff) {
  if (diff > 0) return ` (+${diff.toLocaleString('vi-VN')})`;
  if (diff < 0) return ` (${diff.toLocaleString('vi-VN')})`;
  return '';
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 8 * * *';

client.once('clientReady', () => {
  console.log(`Bot logged in as ${client.user.tag}`);

  // Schedule daily gasoline price update
  cron.schedule(CRON_SCHEDULE, async () => {
    console.log('Sending daily gasoline price update...');
    await sendGasolinePrices();
  }, { timezone: "Asia/Ho_Chi_Minh"});
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content.toLowerCase() === '!gas' || message.content.toLowerCase() === '!xang') {
    await message.channel.sendTyping();
    await sendGasolinePrices(message.channel);
  }
});

async function sendGasolinePrices(targetChannel = null) {
  const channel = targetChannel || client.channels.cache.get(CHANNEL_ID);

  if (!channel) {
    console.error(`Could not find channel with ID ${CHANNEL_ID}`);
    return;
  }

  const currentPrices = await getGasolinePrices();

  if (!currentPrices || currentPrices.length === 0) {
    return channel.send('❌ Could not fetch gasoline prices at this time.');
  }

  const previousPrices = loadPreviousPrices();
  
  const embed = new EmbedBuilder()
    .setTitle('⛽ GIÁ XĂNG DẦU PETROLIMEX HÔM NAY')
    .setURL('https://www.petrolimex.com.vn/')
    .setColor('#FFD700')
    .setTimestamp()
    .setFooter({ text: 'Dữ liệu được cập nhật tự động từ Petrolimex' });

  let description = '```\n' +
    'Sản phẩm             | Vùng 1         | Vùng 2\n' +
    '------------------------------------------------------------\n';

  currentPrices.forEach(item => {
    const prevItem = previousPrices ? previousPrices.find(p => p.name === item.name) : null;
    
    let z1Display = item.zone1;
    let z2Display = item.zone2;

    if (prevItem) {
      const curZ1 = parsePrice(item.zone1);
      const prevZ1 = parsePrice(prevItem.zone1);
      const diffZ1 = curZ1 - prevZ1;
      if (diffZ1 !== 0) z1Display += formatDiff(diffZ1);

      const curZ2 = parsePrice(item.zone2);
      const prevZ2 = parsePrice(prevItem.zone2);
      const diffZ2 = curZ2 - prevZ2;
      if (diffZ2 !== 0) z2Display += formatDiff(diffZ2);
    }

    const name = item.name.padEnd(20, ' ');
    const z1 = z1Display.padEnd(14, ' ');
    const z2 = z2Display.padEnd(14, ' ');
    description += `${name} | ${z1} | ${z2}\n`;
  });

  description += '```';
  embed.setDescription(description);

  await channel.send({ embeds: [embed] });

  // Save for next comparison
  saveCurrentPrices(currentPrices);
}

client.login(TOKEN).catch(err => {
  console.error('Failed to log in to Discord:', err.message);
  console.error('Please make sure DISCORD_TOKEN is set correctly in .env');
});
