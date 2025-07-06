import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits, Partials, Routes, ChannelType } from 'discord.js';
import { REST } from '@discordjs/rest';
import express from 'express';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const PORT = process.env.PORT || 3000;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

const rest = new REST({ version: '10' }).setToken(TOKEN);

const app = express();
app.use(express.json());

const guildChannels = new Map();

const commands = [
  {
    name: 'ping',
    description: 'Geeft pong terug',
  },
  {
    name: 'setjoinedchannel',
    description: 'Stel het kanaal in waar joined berichten worden gestuurd',
    options: [
      {
        name: 'channel',
        description: 'Kanaal om joined berichten te sturen',
        type: 7,
        required: true,
        channel_types: [ChannelType.GuildText],
      },
    ],
  },
  {
    name: 'setnextupdatechannel',
    description: 'Stel het kanaal in waar next update berichten worden gestuurd',
    options: [
      {
        name: 'channel',
        description: 'Kanaal om next update berichten te sturen',
        type: 7,
        required: true,
        channel_types: [ChannelType.GuildText],
      },
    ],
  },
];

(async () => {
  try {
    console.log('Commands registreren...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Commands geregistreerd');
  } catch (error) {
    console.error(error);
  }
})();

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.user.id !== interaction.guild.ownerId) {
    return interaction.reply({ content: 'Alleen de eigenaar van deze server mag deze commands gebruiken.', ephemeral: true });
  }

  try {
    if (interaction.commandName === 'ping') {
      await interaction.reply({ content: 'Pong!', ephemeral: true });

    } else if (interaction.commandName === 'setjoinedchannel') {
      const channel = interaction.options.getChannel('channel');
      guildChannels.set(interaction.guildId + '_joined', channel.id);
      await interaction.reply({ content: `Joined berichten worden nu gestuurd naar ${channel}`, ephemeral: true });

    } else if (interaction.commandName === 'setnextupdatechannel') {
      const channel = interaction.options.getChannel('channel');
      guildChannels.set(interaction.guildId + '_nextupdate', channel.id);
      await interaction.reply({ content: `Next update berichten worden nu gestuurd naar ${channel}`, ephemeral: true });
    }

  } catch (error) {
    console.error(error);
    if (!interaction.replied) {
      await interaction.reply({ content: 'Er is iets misgegaan.', ephemeral: true });
    }
  }
});

app.post('/roblox-message', async (req, res) => {
  const { type, message } = req.body;
  if (!type || !message) {
    return res.status(400).send('Type en message zijn verplicht');
  }

  for (const [guildId] of client.guilds.cache) {
    const channelId = guildChannels.get(guildId + '_' + type);
    if (!channelId) continue;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;

    try {
      const channel = await guild.channels.fetch(channelId);
      if (!channel || channel.type !== ChannelType.GuildText) continue;

      await channel.send(message);
    } catch (e) {
      console.error(`Fout bij sturen bericht naar guild ${guildId}`, e);
    }
  }

  res.send('Bericht verzonden');
});

// Bot invite link genereren
const inviteLink = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=2048&scope=bot%20applications.commands`;

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


client.once('ready', () => {
  console.log(`Bot is ingelogd als ${client.user.tag}`);
  app.listen(PORT, () => {
    console.log(`Express server draait op poort ${PORT}`);
  });
});

client.login(TOKEN);
