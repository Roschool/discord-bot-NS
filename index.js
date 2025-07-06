require('dotenv').config();
const fs = require('fs');
const http = require('http');
const { Client, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

const PORT = process.env.PORT || 3000;
const mapFile = './channelMap.json';

const channelMap = {};
// structuur:
// {
//   guildId: {
//      nsCommands: "kanaalId",
//      playerJoined: "kanaalId",
//      nextUpdate: "kanaalId"
//   },
//   ...
// }

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
    name: 'ns-commands',
    description: 'Stel het kanaal in voor Roblox NS meldingen',
    options: [
      {
        name: 'kanaal',
        type: 7,
        description: 'Kies een tekstkanaal',
        required: true
      }
    ]
  },
  {
    name: 'playerjoined',
    description: 'Stel het kanaal in voor Roblox speler join meldingen',
    options: [
      {
        name: 'kanaal',
        type: 7,
        description: 'Kies een tekstkanaal',
        required: true
      }
    ]
  },
  {
    name: 'nextupdate',
    description: 'Stel het kanaal in voor Roblox volgende update meldingen',
    options: [
      {
        name: 'kanaal',
        type: 7,
        description: 'Kies een tekstkanaal',
        required: true
      }
    ]
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
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
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

  // Alleen server owner mag onderstaande commands gebruiken
  if (command === 'ns-commands' || command === 'playerjoined' || command === 'nextupdate') {
    if (!interaction.guild) return interaction.reply({ content: 'Deze command kan alleen in een server gebruikt worden.', flags: 64 });

    // Check of de gebruiker de owner is
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: '❌ Alleen de eigenaar van de server mag dit commando uitvoeren.', flags: 64 });
    }

    const kanaal = interaction.options.getChannel('kanaal');
    if (!kanaal.isTextBased()) {
      return interaction.reply({ content: '❌ Kies een tekstkanaal!', flags: 64 });
    }

    if (!channelMap[guildId]) channelMap[guildId] = {};

    if (command === 'ns-commands') {
      channelMap[guildId].nsCommands = kanaal.id;
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

// HTTP-server voor Roblox berichten
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/roblox') {
    let body = '';

    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);

        // Verwacht object { type: "nsCommands"|"playerJoined"|"nextUpdate", message: "tekst" }
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
              if (type === 'nsCommands') prefix = '📨 Roblox NS zegt:\n';
              else if (type === 'playerJoined') prefix = '👥 Speler joined melding:\n';
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

// Bot invite link genereren
const inviteLink = `https://discord.com/oauth2/authorize?client_id=1391367723589570731&permissions=2048&scope=bot%20applications.commands`;

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Invite de Bot</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #2c2f33;
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            flex-direction: column;
          }
          a.button {
            background-color: #7289da;
            color: white;
            padding: 15px 30px;
            border-radius: 8px;
            text-decoration: none;
            font-size: 20px;
            font-weight: bold;
            transition: background-color 0.3s ease;
          }
          a.button:hover {
            background-color: #5b6eae;
          }
        </style>
      </head>
      <body>
        <h1>Welkom bij mijn Discord Bot</h1>
        <p>Klik op de knop hieronder om de bot toe te voegen aan je server:</p>
        <a class="button" href="${inviteLink}" target="_blank" rel="noopener noreferrer">Invite de Bot</a>
      </body>
    </html>
  `);
});


server.listen(PORT, () => {
  console.log(`🌐 Server luistert op poort ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
