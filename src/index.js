require('dotenv').config();

const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(process.env.PORT || 3000);

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const { getGasolinePrices } = require('./gasoline');

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

client.once('ready', () => {
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

  const prices = await getGasolinePrices();

  if (!prices || prices.length === 0) {
    return channel.send('❌ Could not fetch gasoline prices at this time.');
  }

  const embed = new EmbedBuilder()
    .setTitle('⛽ GIÁ XĂNG DẦU PETROLIMEX HÔM NAY')
    .setURL('https://www.petrolimex.com.vn/')
    .setColor('#FFD700')
    .setTimestamp()
    .setFooter({ text: 'Dữ liệu được cập nhật tự động từ Petrolimex' });

  let description = '```\n' +
    'Sản phẩm             | Vùng 1   | Vùng 2\n' +
    '------------------------------------------\n';

  prices.forEach(item => {
    const name = item.name.padEnd(20, ' ');
    const z1 = item.zone1.padStart(8, ' ');
    const z2 = item.zone2.padStart(8, ' ');
    description += `${name} | ${z1} | ${z2}\n`;
  });

  description += '```';
  embed.setDescription(description);

  await channel.send({ embeds: [embed] });
}

client.login(TOKEN).catch(err => {
  console.error('Failed to log in to Discord:', err.message);
  console.error('Please make sure DISCORD_TOKEN is set correctly in .env');
});
