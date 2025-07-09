require('dotenv').config();
const fs = require('fs');
const http = require('http');
const { Client, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel]
});

const PORT = process.env.PORT || 3000;
const mapFile = './channelMap.json';
const channelMap = {};

// Laden en opslaan van kanaalkaart
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

// Slash commands
const commands = [
  { name: 'weather', description: 'Stel kanaal in voor weather meldingen', options: [{ name: 'kanaal', type: 7, description: 'Tekstkanaal', required: true }] },
  { name: 'playerjoined', description: 'Kanaal voor Roblox speler join meldingen', options: [{ name: 'kanaal', type: 7, required: true }] },
  { name: 'nextupdate', description: 'Kanaal voor Roblox volgende update', options: [{ name: 'kanaal', type: 7, required: true }] },
  { name: 'ping', description: 'Test of de bot online is' }
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

client.once('ready', () => console.log(`🤖 Bot online als ${client.user.tag}`));

// Serverside slash command handling
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const guildId = interaction.guildId, cmd = interaction.commandName;

  if (cmd === 'ping') {
    return interaction.reply({ content: 'Pong!', flags: 64 });
  }

  if (['weather', 'playerjoined', 'nextupdate'].includes(cmd)) {
    if (!interaction.guild) return interaction.reply({ content: 'Deze command kan alleen in een server gebruikt worden.', flags: 64 });
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: '❌ Alleen de eigenaar van de server mag dit commando uitvoeren.', flags: 64 });
    }

    const kanaal = interaction.options.getChannel('kanaal');
    if (!kanaal.isTextBased()) {
      return interaction.reply({ content: '❌ Kies een tekstkanaal!', flags: 64 });
    }

    if (!channelMap[guildId]) channelMap[guildId] = {};
    channelMap[guildId][cmd] = kanaal.id;
    saveMap();

    return interaction.reply({ content: `✅ Kanaal <#${kanaal.id}> is ingesteld voor \`${cmd}\`.`, flags: 64 });
  }
});

// Roblox HTTP-endpoint
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/roblox') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { type, message } = JSON.parse(body);
        if (!type || !message) return res.writeHead(400).end('JSON moet type en message bevatten');

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
          } catch (e) {
            console.warn(`Kon kanaal ${kanaalId} in guild ${guildId} niet bereiken: ${e.message}`);
          }
        }
        res.writeHead(200);
        res.end('Bericht verzonden');
      } catch {
        res.writeHead(400);
        res.end('Fout bij verwerken JSON');
      }
    });
  } else {
    res.writeHead(404);
    res.end('Niet gevonden');
  }
}).listen(PORT, () => console.log(`🌐 Server luistert op poort ${PORT}`));

// DM-reacties: begroetingen, game-detectie en instructie
client.on('messageCreate', async message => {
  if (message.author.bot || message.guild) return;
  const msg = message.content.trim().toLowerCase();

  const greetingToLang = {
    hoi: 'nl', hello: 'en', hi: 'en', hey: 'en',
    bonjour: 'fr', salut: 'fr', hallo: 'de', servus: 'de',
    ciao: 'it', hola: 'es', hej: 'sv', hei: 'fi',
    olá: 'pt', ahoj: 'cs', czesc: 'pl', merhaba: 'tr',
    привет: 'ru', こんにちは: 'ja', 你好: 'zh', مرحبا: 'ar',
    नमस्ते: 'hi', halo: 'id', 안녕하세요: 'ko', salutare: 'ro'
  };

  const greetings = {
    nl: 'Hoi!', en: 'Hello!', fr: 'Salut !', de: 'Hallo!',
    it: 'Ciao!', es: '¡Hola!', sv: 'Hej!', fi: 'Hei!',
    pt: 'Olá!', cs: 'Ahoj!', pl: 'Cześć!', tr: 'Merhaba!',
    ru: 'Привет!', ja: 'こんにちは！', zh: '你好！',
    ar: 'مرحبًا!', hi: 'नमस्ते!', id: 'Hai!', ko: '안녕하세요!', ro: 'Salutare!'
  };

  const gameWords = ['game', 'spel', 'jeu', 'spiel', 'gioco', 'juego', 'noobstalgia',
                     'oyun', 'игра', 'ゲーム', '游戏', 'اللعبة', 'खेल', 'permainan', '게임', 'joc'];

  const gamePromo = {
    nl: '🎮 Speel nu Noobstalgia op Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
    en: '🎮 Play Noobstalgia now on Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
    fr: '🎮 Joue à Noobstalgia sur Roblox : https://www.roblox.com/games/105849170127619/Noobstalgia',
    de: '🎮 Spiele jetzt Noobstalgia auf Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
    es: '🎮 Juega a Noobstalgia en Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
    it: '🎮 Gioca a Noobstalgia su Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
    sv: '🎮 Spela Noobstalgia på Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
    pl: '🎮 Zagraj w Noobstalgia na Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
    pt: '🎮 Jogue Noobstalgia no Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
    ru: '🎮 Играй в Noobstalgia на Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
    ja: '🎮 RobloxでNoobstalgiaをプレイ: https://www.roblox.com/games/105849170127619/Noobstalgia',
    zh: '🎮 在Roblox上玩Noobstalgia: https://www.roblox.com/games/105849170127619/Noobstalgia',
    ar: '🎮 العب Noobstalgia على Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
    hi: '🎮 Roblox पर Noobstalgia खेलें: https://www.roblox.com/games/105849170127619/Noobstalgia',
    id: '🎮 Mainkan Noobstalgia di Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
    ko: '🎮 Roblox에서 Noobstalgia 플레이하기: https://www.roblox.com/games/105849170127619/Noobstalgia',
    ro: '🎮 Joacă Noobstalgia pe Roblox: https://www.roblox.com/games/105849170127619/Noobstalgia',
  };

  const unknownMessages = {
    nl: '❓ Sorry, ik begrijp dat niet.',
    en: '❓ Sorry, I don’t understand.',
    fr: '❓ Désolé, je ne comprends pas.',
    de: '❓ Sorry, ich verstehe das nicht.',
    it: '❓ Scusa, non capisco.',
    es: '❓ Lo siento, no entiendo.',
    sv: '❓ Förlåt, jag förstår inte.',
    fi: '❓ Anteeksi, en ymmärrä.',
    pt: '❓ Desculpa, não entendo.',
    cs: '❓ Promiň, nerozumím.',
    pl: '❓ Przepraszam, nie rozumiem.',
    tr: '❓ Üzgünüm, anlamıyorum.',
    ru: '❓ Извините, я не понимаю.',
    ja: '❓ ごめんなさい、わかりません。',
    zh: '❓ 对不起，我不明白。',
    ar: '❓ عذرًا، لا أفهم.',
    hi: '❓ माफ़ कीजिए, मैं नहीं समझा।',
    id: '❓ Maaf, saya tidak mengerti.',
    ko: '❓ 죄송해요, 이해하지 못했어요.',
    ro: '❓ Scuze, nu înțeleg.'
  };

  const lang = greetingToLang[msg] || 'en';

  if (greetingToLang[msg]) {
    return message.reply(greetings[lang]);
  }

  if (gameWords.some(w => msg.includes(w))) {
    return message.reply(gamePromo[lang] || gamePromo.en);
  }

  return message.reply(unknownMessages[lang] || unknownMessages.en);
});

client.login(process.env.DISCORD_TOKEN);
