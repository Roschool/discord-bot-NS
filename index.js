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

// Laad opgeslagen map (indien aanwezig)
function loadMap() {
  if (fs.existsSync(mapFile)) {
    Object.assign(channelMap, JSON.parse(fs.readFileSync(mapFile)));
    console.log(`✅ Loaded channel map met ${Object.keys(channelMap).length} entries`);
  }
}

// Sla map op
function saveMap() {
  fs.writeFileSync(mapFile, JSON.stringify(channelMap, null, 2));
  console.log('💾 Channel map opgeslagen');
}

loadMap();

// Slash command registratie
const commands = [{
  name: 'ns-commands',
  description: 'Stel het kanaal in waar Roblox berichten naartoe moeten',
  options: [
    {
      name: 'kanaal',
      type: 7, // CHANNEL type
      description: 'Kies een tekstkanaal',
      required: true
    }
  ]
}];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Registreer command globaal (kan ook per guild, maar globaal is makkelijker hier)
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
  console.log(`🤖 Bot is online als ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'ns-commands') return;

  const kanaal = interaction.options.getChannel('kanaal');
  if (!kanaal.isTextBased()) {
    return interaction.reply({ content: '❌ Kies een tekstkanaal!', ephemeral: true });
  }

  const guildId = interaction.guildId;
  channelMap[guildId] = kanaal.id;
  saveMap();

  await interaction.reply({
    content: `✅ Roblox meldingen gaan naar <#${kanaal.id}>.\n📡 Gebruik deze URL in Roblox:\n\`https://${process.env.RENDER_URL}/roblox/${guildId}\``,
    ephemeral: true
  });
});

// HTTP-server voor Roblox berichten
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/roblox/')) {
    const guildId = req.url.split('/')[2];
    let body = '';

    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const message = data.message;
        const kanaalId = channelMap[guildId];

        if (!kanaalId) {
          res.writeHead(404);
          return res.end('Kanaal niet ingesteld voor deze server');
        }

        const kanaal = await client.channels.fetch(kanaalId);
        if (!kanaal) {
          res.writeHead(404);
          return res.end('Kanaal niet gevonden in Discord');
        }

        await kanaal.send(`📨 Roblox zegt:\n${message}`);

        res.writeHead(200);
        res.end('Bericht verzonden naar Discord');
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

client.login(process.env.DISCORD_TOKEN);
