require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const http = require('http');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const channelMap = {}; // guildId → kanaalId

client.once('ready', async () => {
  console.log(`✅ Ingelogd als ${client.user.tag}`);

  const command = new SlashCommandBuilder()
    .setName('ns-commands')
    .setDescription('Stel het kanaal in voor Roblox meldingen')
    .addChannelOption(option =>
      option.setName('kanaal')
        .setDescription('Kanaal voor meldingen')
        .setRequired(true)
    );

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const guilds = await client.guilds.fetch();

  for (const guild of guilds.values()) {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, guild.id),
      { body: [command.toJSON()] }
    );
    console.log(`🔧 Command geregistreerd voor ${guild.name}`);
  }
});

// Slash command handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'ns-commands') return;

  const kanaal = interaction.options.getChannel('kanaal');
  const guildId = interaction.guildId;

  channelMap[guildId] = kanaal.id;

  await interaction.reply({
    content: `✅ Roblox meldingen gaan naar <#${kanaal.id}>\n📡 Gebruik deze URL in Roblox:\n\`http://<JOUW-IP>:3000/roblox/${guildId}\``,
    ephemeral: true
  });
});

// HTTP server om berichten van Roblox te ontvangen
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/roblox/')) {
    const guildId = req.url.split('/')[2];

    let body = '';
    req.on('data', chunk => { body += chunk });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const message = data.message;
        const kanaalId = channelMap[guildId];

        if (!kanaalId) {
          res.writeHead(404);
          return res.end('Kanaal niet ingesteld');
        }

        const kanaal = client.channels.cache.get(kanaalId);
        if (kanaal) kanaal.send(`📨 Roblox zegt:\n${message}`);
        
        res.writeHead(200);
        res.end('Verzonden naar Discord');
      } catch (err) {
        console.error(err);
        res.writeHead(400);
        res.end('Fout in JSON');
      }
    });
  } else {
    res.writeHead(404);
    res.end('Niet gevonden');
  }
});

server.listen(3000, () => {
  console.log('🌐 Server luistert op poort 3000');
});

client.login(process.env.DISCORD_TOKEN);
