require('dotenv').config();
const fs = require('fs');
const http = require('http');
const { Client, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const PORT = process.env.PORT || 3000;
const mapFile = './channelMap.json';
const channelMap = {};

function loadMap() {
  if (fs.existsSync(mapFile)) {
    Object.assign(channelMap, JSON.parse(fs.readFileSync(mapFile)));
    console.log(`✅ Loaded channel map met ${Object.keys(channelMap).length} guilds`);
  }
}

function saveMap() {
  fs.writeFileSync(mapFile, JSON.stringify(channelMap, null, 2));
  console.log('💾 Channel map opgeslagen');
}

loadMap();

const commands = [
  {
    name: 'weather',
    description: 'Stel het kanaal in voor weather meldingen',
    options: [{ name: 'kanaal', type: 7, description: 'Kies een tekstkanaal', required: true }]
  },
  {
    name: 'playerjoined',
    description: 'Stel het kanaal in voor Roblox speler join meldingen',
    options: [{ name: 'kanaal', type: 7, description: 'Kies een tekstkanaal', required: true }]
  },
  {
    name: 'nextupdate',
    description: 'Stel het kanaal in voor Roblox volgende update meldingen',
    options: [{ name: 'kanaal', type: 7, description: 'Kies een tekstkanaal', required: true }]
  },
  {
    name: 'ping',
    description: 'Test of de bot online is'
  }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('⚙️ Registreren slash commands...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Commands geregistreerd');
  } catch (error) {
    console.error(error);
  }
})();

client.once('ready', () => {
  console.log(`🤖 Bot online als ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guildId;
  const command = interaction.commandName;

  if (command === 'ping') {
    return interaction.reply({ content: 'Pong!', flags: 64 });
  }

  if (['weather', 'playerjoined', 'nextupdate'].includes(command)) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'Deze command kan alleen in een server gebruikt worden.', flags: 64 });
    }

    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: '❌ Alleen de eigenaar van de server mag dit commando uitvoeren.', flags: 64 });
    }

    const kanaal = interaction.options.getChannel('kanaal');
    if (!kanaal.isTextBased()) {
      return interaction.reply({ content: '❌ Kies een tekstkanaal!', flags: 64 });
    }

    if (!channelMap[guildId]) channelMap[guildId] = {};

    if (command === 'weather') {
      channelMap[guildId].weather = kanaal.id;
    } else if (command === 'playerjoined') {
      channelMap[guildId].playerJoined = kanaal.id;
    } else if (command === 'nextupdate') {
      channelMap[guildId].nextUpdate = kanaal.id;
    }

    saveMap();

    await interaction.reply({
      content: `✅ Kanaal <#${kanaal.id}> is ingesteld voor \`${command}\`.`,
      flags: 64
    });
  }
});

// HTTP-server voor Roblox meldingen
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/roblox') {
    let body = '';

    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { type, message } = data;

        if (!type || !message) {
          res.writeHead(400);
          return res.end('JSON moet type en message bevatten');
        }

        for (const [guildId, chans] of Object.entries(channelMap)) {
          const kanaalId = chans[type];
          if (!kanaalId) continue;

          try {
            const kanaal = await client.channels.fetch(kanaalId);
            if (kanaal) {
              let prefix = '';
              if (type === 'playerJoined') prefix = '👥 Speler joined melding:\n';
              else if (type === 'nextUpdate') prefix = '🚀 Volgende update:\n';

              await kanaal.send(prefix + message);
            }
          } catch (err) {
            console.warn(`Kon kanaal ${kanaalId} in guild ${guildId} niet bereiken: ${err.message}`);
          }
        }

        res.writeHead(200);
        res.end('Bericht verzonden');
      } catch (err) {
        res.writeHead(400);
        res.end('Fout bij verwerken JSON');
      }
    });
  } else {
    res.writeHead(404);
    res.end('Niet gevonden');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Server luistert op poort ${PORT}`);
});

// DM-reactie systeem
const greetings = {
  nl: 'Hoi!',
  en: 'Hi!',
  de: 'Hallo!',
  fr: 'Salut !',
  es: '¡Hola!',
  it: 'Ciao!',
  pt: 'Olá!',
  sv: 'Hej!',
  fi: 'Hei!',
  pl: 'Cześć!',
  tr: 'Merhaba!',
  ru: 'Привет!',
  ja: 'こんにちは！',
  zh: '你好！',
  ar: 'مرحبًا!',
  hi: 'नमस्ते!',
  id: 'Hai!',
  ko: '안녕하세요!',
  uk: 'Привіт!',
  ro: 'Salut!',
};

const donotunderstand = {
  nl: 'Ik begrijp het niet.',
  en: 'I don’t understand.',
  de: 'Ich verstehe nicht.',
  fr: 'Je ne comprends pas.',
  es: 'No entiendo.',
  it: 'Non capisco.',
  pt: 'Não entendo.',
  sv: 'Jag förstår inte.',
  fi: 'En ymmärrä.',
  pl: 'Nie rozumiem.',
  tr: 'Anlamıyorum.',
  ru: 'Я не понимаю.',
  ja: 'わかりません。',
  zh: '我不明白。',
  ar: 'أنا لا أفهم.',
  hi: 'मुझे समझ नहीं आया।',
  id: 'Saya tidak mengerti.',
  ko: '이해하지 못했어요.',
  uk: 'Я не розумію.',
  ro: 'Nu înțeleg.',
};

const gamePromo = {
  nl: 'Speel nu Noobstalgia op Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
  en: 'Play Noobstalgia now on Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
  de: 'Spiele jetzt Noobstalgia auf Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
  fr: 'Joue à Noobstalgia sur Roblox : https://www.roblox.com/games/105849170127619/Noobstalgia',
  es: 'Juega a Noobstalgia en Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
  it: 'Gioca a Noobstalgia su Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
  pt: 'Jogue Noobstalgia no Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
  sv: 'Spela Noobstalgia på Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
  fi: 'Pelaa Noobstalgia Robloxissa: https://www.roblox.com/games/105849170127619/Noobstalgia',
  pl: 'Zagraj w Noobstalgia na Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
  tr: 'Roblox’ta Noobstalgia oyna: https://www.roblox.com/games/105849170127619/Noobstalgia',
  ru: 'Играй в Noobstalgia на Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
  ja: 'RobloxでNoobstalgiaをプレイ: https://www.roblox.com/games/105849170127619/Noobstalgia',
  zh: '在Roblox上玩Noobstalgia: https://www.roblox.com/games/105849170127619/Noobstalgia',
  ar: 'العب Noobstalgia على Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
  hi: 'Roblox पर Noobstalgia खेलें: https://www.roblox.com/games/105849170127619/Noobstalgia',
  id: 'Mainkan Noobstalgia di Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
  ko: 'Roblox에서 Noobstalgia 플레이하기: https://www.roblox.com/games/105849170127619/Noobstalgia',
  uk: 'Грай у Noobstalgia на Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
  ro: 'Joacă Noobstalgia pe Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
};

client.on('messageCreate', async message => {
  if (message.author.bot || message.guild) return;

  const msg = message.content.toLowerCase();

  if (msg === 'hoi') {
    const response = Object.values(greetings).join('\n');
    return message.reply(response);
  }

  if (msg === '/game' || msg === 'gamenaam' || msg.includes('noobstalgia')) {
    const response = Object.values(gamePromo).join('\n');
    return message.reply(response);
  }

  const response = Object.values(donotunderstand).join('\n');
  return message.reply(response);
});

client.login(process.env.DISCORD_TOKEN);
