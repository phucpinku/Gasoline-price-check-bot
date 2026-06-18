require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { getGasolinePrices } = require('./gasoline');

const PRICES_FILE = path.join(__dirname, '../data/prices.json');
const CONFIG_FILE = path.join(__dirname, '../data/config.json');

// Helper to load previous prices for comparison
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

// Helper to save current prices for next comparison
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

// Helper to load all guild configurations
function loadConfigs() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {
      console.error('Error loading config:', e);
    }
  }
  return {};
}

// Helper to save a specific guild's configuration
function saveConfig(guildId, guildConfig) {
  try {
    const configs = loadConfigs();
    configs[guildId] = {
      ...configs[guildId],
      ...guildConfig
    };
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

// Helper to get configuration for a guild with .env fallbacks
function getGuildConfig(guildId) {
  const configs = loadConfigs();
  const config = configs[guildId] || {};

  // Fallback to .env values if they exist and match the guild
  const defaultChannelId = process.env.CHANNEL_ID;
  const defaultRoleId = process.env.ROLE_ID;

  if (!config.channelId && defaultChannelId) {
    const guild = client.guilds.cache.get(guildId);
    if (guild && guild.channels.cache.has(defaultChannelId)) {
      config.channelId = defaultChannelId;
      config.roleId = defaultRoleId || null;
    }
  }
  return config;
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
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 8 * * *';

client.once('ready', () => {
  console.log(`Bot logged in as ${client.user.tag}`);

  // Schedule daily gasoline price update
  cron.schedule(CRON_SCHEDULE, async () => {
    console.log('Checking for daily gasoline price update...');
    await sendGasolinePrices(null, true);
  }, { timezone: "Asia/Ho_Chi_Minh"});
});

// Welcoming guide when the bot joins a new server (guild)
client.on('guildCreate', async (guild) => {
  console.log(`Joined new guild: ${guild.name} (id: ${guild.id})`);
  
  // Find first channel where the bot has permission to send messages
  const targetChannel = guild.systemChannel || guild.channels.cache.find(ch => 
    ch.type === ChannelType.GuildText && 
    ch.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages)
  );

  if (targetChannel) {
    try {
      const welcomeEmbed = new EmbedBuilder()
        .setTitle('⛽ Xin chào! Mình là Bot Cập Nhật Giá Xăng Dầu')
        .setDescription('Cảm ơn bạn đã thêm mình vào máy chủ! Dưới đây là các bước để thiết lập và sử dụng mình:')
        .setColor('#FFD700')
        .addFields(
          { 
            name: '🛠️ Thiết lập thông báo tự động', 
            value: 'Để bot tự động gửi thông báo giá xăng hàng ngày, hãy dùng lệnh:\n`!setup #tên-kênh @vai-trò`\n*Ví dụ: `!setup #giá-xăng @everyone` hoặc `!setup #general @Thành viên`*'
          },
          { 
            name: '⛽ Lệnh xem giá trực tiếp', 
            value: 'Bất kỳ thành viên nào cũng có thể gõ `!gas` hoặc `!xang` để xem giá xăng dầu Petrolimex mới nhất ngay lập tức.'
          },
          {
            name: 'ℹ️ Trạng thái cấu hình hiện tại',
            value: 'Bạn có thể gõ `!status` hoặc `!config` để kiểm tra cấu hình hiện tại của máy chủ này.'
          }
        )
        .setTimestamp();

      await targetChannel.send({ embeds: [welcomeEmbed] });
    } catch (e) {
      console.error(`Failed to send welcome message to guild ${guild.id}:`, e.message);
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.toLowerCase();

  // Command to get gasoline prices on-demand
  if (content === '!gas' || content === '!xang') {
    await message.channel.sendTyping();
    await sendGasolinePrices(message.channel, false);
  }

  // Configuration setup command
  if (message.content.startsWith('!setup')) {
    // Check if user has permissions to manage server (Guild) or is administrator
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild) && 
        !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('❌ Bạn cần quyền **Quản lý máy chủ (Manage Server)** hoặc **Quản trị viên (Administrator)** để thiết lập bot.');
    }

    const args = message.content.split(/\s+/).slice(1);
    if (args.length === 0) {
      return message.reply('❌ Cú pháp lệnh: `!setup #tên-kênh @vai-trò` hoặc `!setup off` để tắt thông báo.');
    }

    // Command to disable automatic notifications
    if (args[0].toLowerCase() === 'off' || args[0].toLowerCase() === 'disable' || args[0].toLowerCase() === 'reset') {
      saveConfig(message.guild.id, {
        channelId: null,
        roleId: null
      });
      return message.reply('✅ Đã tắt thông báo tự động cho máy chủ này.');
    }

    const channel = message.mentions.channels.first();
    if (!channel) {
      return message.reply('❌ Vui lòng gắn thẻ (mention) kênh bạn muốn gửi thông báo. Ví dụ: `!setup #kênh-của-bạn @vai-trò`');
    }

    // Verify channel type is GuildText
    if (channel.type !== ChannelType.GuildText) {
      return message.reply('❌ Kênh được chọn phải là kênh văn bản (text channel).');
    }

    // Verify bot permissions inside the target channel
    const botMember = message.guild.members.me;
    const permissions = channel.permissionsFor(botMember);
    if (!permissions.has(PermissionsBitField.Flags.SendMessages) || !permissions.has(PermissionsBitField.Flags.EmbedLinks)) {
      return message.reply(`❌ Bot không có đủ quyền gửi tin nhắn hoặc chèn liên kết trong kênh ${channel}. Vui lòng cấp quyền cho bot.`);
    }

    // Parse role mention (support @role and @everyone)
    let roleId = null;
    const role = message.mentions.roles.first();
    if (role) {
      roleId = role.id;
    } else if (message.content.includes('@everyone')) {
      roleId = message.guild.id; // Guild ID is the ID of the @everyone role
    }

    saveConfig(message.guild.id, {
      channelId: channel.id,
      roleId: roleId
    });

    const configEmbed = new EmbedBuilder()
      .setTitle('✅ Thiết lập thành công!')
      .setColor('#4CAF50')
      .setDescription(`Bot đã được cấu hình thành công cho máy chủ **${message.guild.name}**!`)
      .addFields(
        { name: 'Kênh nhận thông báo', value: `<#${channel.id}>`, inline: true },
        { name: 'Vai trò được nhắc đến', value: roleId ? (roleId === message.guild.id ? '@everyone' : `<@&${roleId}>`) : 'Không gắn thẻ', inline: true }
      )
      .setTimestamp();
    
    await message.reply({ embeds: [configEmbed] });
  }

  // Configuration check command
  if (content === '!config' || content === '!status') {
    const config = getGuildConfig(message.guild.id);

    const configEmbed = new EmbedBuilder()
      .setTitle('⚙️ Cấu hình Bot tại máy chủ')
      .setColor('#FFD700')
      .setTimestamp();

    if (config && config.channelId) {
      configEmbed.addFields(
        { name: 'Kênh nhận thông báo', value: `<#${config.channelId}>`, inline: true },
        { name: 'Vai trò được nhắc đến', value: config.roleId ? (config.roleId === message.guild.id ? '@everyone' : `<@&${config.roleId}>`) : 'Không gắn thẻ', inline: true }
      );
    } else {
      configEmbed.setDescription('Bot chưa được thiết lập kênh nhận thông báo tự động trên máy chủ này.\nHãy dùng lệnh: `!setup #tên-kênh @vai-trò` để cài đặt.');
    }

    await message.reply({ embeds: [configEmbed] });
  }
});

async function sendGasolinePrices(targetChannel = null, isScheduled = false) {
  const currentPrices = await getGasolinePrices();

  if (!currentPrices || currentPrices.length === 0) {
    if (!isScheduled && targetChannel) {
      return targetChannel.send('❌ Could not fetch gasoline prices at this time.');
    }
    return;
  }

  const previousPrices = loadPreviousPrices();
  let hasChange = !previousPrices;

  if (previousPrices) {
    for (const item of currentPrices) {
      const prevItem = previousPrices.find(p => p.name === item.name);
      if (!prevItem) {
        hasChange = true;
        break;
      }
      if (parsePrice(item.zone1) !== parsePrice(prevItem.zone1) || 
          parsePrice(item.zone2) !== parsePrice(prevItem.zone2)) {
        hasChange = true;
        break;
      }
    }
  }

  if (isScheduled && !hasChange) {
    console.log('No price change detected. Skipping scheduled update.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('⛽ GIÁ XĂNG DẦU PETROLIMEX HÔM NAY')
    .setURL('https://www.petrolimex.com.vn/')
    .setColor('#FFD700')
    .setTimestamp()
    .setFooter({ text: 'Dữ liệu được cập nhật tự động từ Petrolimex' });

  currentPrices.forEach(item => {
    const prevItem = previousPrices ? previousPrices.find(p => p.name === item.name) : null;

    let z1Display = item.zone1;
    let z2Display = item.zone2;

    if (prevItem) {
      const curZ1 = parsePrice(item.zone1);
      const prevZ1 = parsePrice(prevItem.zone1);
      const diffZ1 = curZ1 - prevZ1;

      const curZ2 = parsePrice(item.zone2);
      const prevZ2 = parsePrice(prevItem.zone2);
      const diffZ2 = curZ2 - prevZ2;

      if (diffZ1 !== 0) {
        const sign = diffZ1 > 0 ? '↗️' : '↘️';
        z1Display = `**${item.zone1}** ${sign} \`${formatDiff(diffZ1).trim()}\``;
      }

      if (diffZ2 !== 0) {
        const sign = diffZ2 > 0 ? '↗️' : '↘️';
        z2Display = `**${item.zone2}** ${sign} \`${formatDiff(diffZ2).trim()}\``;
      }
    }

    embed.addFields({
      name: `🔹 ${item.name}`,
      value: `Vùng 1: ${z1Display}\nVùng 2: ${z2Display}`,
      inline: false
    });
  });

  if (targetChannel) {
    let mention = '';
    if (targetChannel.guild) {
      const config = getGuildConfig(targetChannel.guild.id);
      if (config && config.roleId) {
        mention = config.roleId === targetChannel.guild.id ? '@everyone' : `<@&${config.roleId}>`;
      }
    }
    await targetChannel.send({ content: mention || undefined, embeds: [embed] });
  } else {
    // Scheduled update: send to all guilds
    const configs = loadConfigs();
    for (const guild of client.guilds.cache.values()) {
      const config = getGuildConfig(guild.id);
      if (config && config.channelId) {
        try {
          const channel = await client.channels.fetch(config.channelId);
          if (channel) {
            const mention = config.roleId ? (config.roleId === guild.id ? '@everyone' : `<@&${config.roleId}>`) : '';
            await channel.send({ content: mention || undefined, embeds: [embed] });
            console.log(`Sent update to guild ${guild.name} (${guild.id}), channel ${config.channelId}`);
          }
        } catch (e) {
          console.error(`Failed to send scheduled update to guild ${guild.name} (${guild.id}), channel ${config.channelId}:`, e.message);
        }
      }
    }
  }

  // Save for next comparison
  saveCurrentPrices(currentPrices);
}

client.login(TOKEN).catch(err => {
  console.error('Failed to log in to Discord:', err.message);
  console.error('Please make sure DISCORD_TOKEN is set correctly in .env');
});

