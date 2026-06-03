const { Client, GatewayIntentBits, Partials, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require("discord.js");
require("dotenv").config();
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User]
});

// =========================
// 🗄️ BANCO DE DADOS LOCAL (JSON)
// =========================
const DB_FILE = "./database.json";
let config = {
  pix: { nome: "", banco: "", chave: "", msg: "", img: "" },
  canais: { ssMob: null, ssEmu: null, logs: null, salas: null },
  staffSS: null, // ID do Cargo da Staff
  blacklist: {},
  coins: {},
  dadosSalas: {} // Guarda o ID e Senha de cada confronto de forma oculta
};

if (fs.existsSync(DB_FILE)) {
  try { config = JSON.parse(fs.readFileSync(DB_FILE, "utf-8")); } catch (e) { console.log("Criando banco de dados novo."); }
}
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(config, null, 4)); }

client.once("ready", () => {
  console.log(`🚀 Zyphor Diário operacional como ${client.user.tag}`);
});

// =========================
// 🛒 INTERAÇÕES DE BOTÕES
// =========================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const { guild, user, channel, customId } = interaction;
  const [action, arg1, arg2] = customId.split("_");

  // Botão: Adquirir vaga / Escolher Modo
  if (action === "buy") {
    if (config.blacklist[user.id]) {
      return interaction.reply({ content: "❌ Você está banido da Blacklist do Zyphor.", ephemeral: true });
    }

    const thread = await channel.threads.create({
      name: `🛒・${user.username}`,
      autoArchiveDuration: 60,
    });

    await thread.members.add(user.id);

    const pixEmbed = new EmbedBuilder()
      .setTitle("💳 PAGAMENTO DA VAGA")
      .setDescription(`${config.pix.msg || "Envie o comprovante após o PIX."}`)
      .addFields(
        { name: "Titular", value: config.pix.nome || "Não configurado", inline: true },
        { name: "Banco", value: config.pix.banco || "Não configurado", inline: true },
        { name: "Chave PIX", value: `\`${config.pix.chave || "Não configurado"}\``, inline: false }
      )
      .setColor("#2b2d31");

    if (config.pix.img) pixEmbed.setImage(config.pix.img);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`aprovar_${user.id}`).setLabel("Aprovar Vaga (Staff)").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`recusar_${user.id}`).setLabel("Recusar").setStyle(ButtonStyle.Danger)
    );

    await thread.send({ content: `Olá ${user}, realize o pagamento e envie o comprovante neste chat.`, embeds: [pixEmbed], components: [row] });
    return interaction.reply({ content: `🛒 Canal de compra criado: ${thread}`, ephemeral: true });
  }

  // Staff aprova vaga do jogador
  if (action === "aprovar") {
    if (!interaction.member.permissions.has("ManageMessages")) return interaction.reply({ content: "❌ Apenas a Staff pode aprovar.", ephemeral: true });
    const playerID = arg1;
    return interaction.reply({ content: `✅ Vaga aprovada para <@${playerID}>! Use os comandos de horários (Ex: \`!14h\`).` });
  }

  if (action === "recusar") {
    if (!interaction.member.permissions.has("ManageMessages")) return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
    return interaction.reply({ content: "❌ Inscrição recusada pela Staff." });
  }

  // Revelar dados da sala individualmente por segurança
  if (action === "show") {
    const tipo = arg1; // "id" ou "pass"
    const threadId = channel.id;
    const dados = config.dadosSalas[threadId];

    if (!dados) return interaction.reply({ content: "⚠️ Dados da sala indisponíveis.", ephemeral: true });

    const textoRevelado = tipo === "id" ? `🆔 ID da Sala: \`${dados.id}\`` : `🔑 Senha da Sala: \`${dados.senha}\``;
    return interaction.reply({ content: textoRevelado, ephemeral: true });
  }

  // Staff assume o chamado de SS
  if (customId === "assumir_ss") {
    if (config.staffSS && !interaction.member.roles.cache.has(config.staffSS)) {
      return interaction.reply({ content: "❌ Você não possui o cargo de Staff SS.", ephemeral: true });
    }

    const embedAtual = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor("#e67e22")
      .addFields({ name: "👮 Atendido por", value: `${user.username}`, inline: true });

    return interaction.update({ content: `🚨 **SS EM ANDAMENTO COM ${user}**`, embeds: [embedAtual], components: [] });
  }
});

// =========================
// 🔎 SISTEMA DE COMANDOS (PREFIXO !)
// =========================
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // !setup #canal-salas #canal-logs #canal-ssmob #canal-ssemu @CargoStaffSS
  if (command === "setup") {
    if (!message.member.permissions.has("Administrator")) return;
    const salas = message.mentions.channels.first();
    const logs = message.mentions.channels.toJSON()[1];
    const ssmob = message.mentions.channels.toJSON()[2];
    const ssemu = message.mentions.channels.toJSON()[3];
    const cargo = message.mentions.roles.first();

    if (!salas || !logs || !ssmob || !ssemu || !cargo) {
      return message.reply("❌ **Formato incorreto!** Use:\n`!setup #canal-salas #canal-logs #canal-ssmob #canal-ssemu @CargoStaffSS`");
    }

    config.canais.salas = salas.id;
    config.canais.logs = logs.id;
    config.canais.ssMob = ssmob.id;
    config.canais.ssEmu = ssemu.id;
    config.staffSS = cargo.id;
    saveDB();

    return message.reply("✅ **Configuração dos canais do ecossistema salva!**");
  }

  // !setpix Nome Titular | Nome Banco | Chave Pix | Instruções / Mensagem | Link Foto Opcional
  if (command === "setpix") {
    if (!message.member.permissions.has("Administrator")) return;
    const partes = args.join(" ").split("|");

    if (partes.length < 4) {
      return message.reply("❌ **Use o separador |**:\n`!setpix Nome | Banco | Chave | Instruções de Envio | Link Foto (Opcional)`");
    }

    config.pix = {
      nome: partes[0].trim(),
      banco: partes[1].trim(),
      chave: partes[2].trim(),
      msg: partes[3].trim(),
      img: partes[4] ? partes[4].trim() : ""
    };
    saveDB();

    return message.reply("✅ **Dados de faturamento PIX atualizados no Banco de Dados!**");
  }

  // Envia o painel de inscrição com botões
  if (command === "painelcompra") {
    if (!message.member.permissions.has("ManageMessages")) return;

    const embed = new EmbedBuilder()
      .setTitle("🏆 INSCRIÇÕES COPA ZYPHOR")
      .setDescription("Selecione abaixo a modalidade do diário competitivo que deseja adquirir:")
      .setColor("#00ff00");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("buy_Mobile").setLabel("📱 Comprar Vaga Mobile").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("buy_Emulador").setLabel("💻 Comprar Vaga Emulador").setStyle(ButtonStyle.Secondary)
    );

    return message.channel.send({ embeds: [embed], components: [row] });
  }

  // !ss mob/emu @user
  if (command === "ss") {
    const tipo = args[0];
    const alvo = message.mentions.users.first();

    if (!tipo || !alvo || (tipo !== "mob" && tipo !== "emu")) {
      return message.reply("❌ Use: `!ss mob @user` ou `!ss emu @user`");
    }

    const canalId = tipo === "mob" ? config.canais.ssMob : config.canais.ssEmu;
    const canalDestino = message.guild.channels.cache.get(canalId);

    if (!canalDestino) return message.reply("❌ Canal de destino de SS não configurado no setup.");

    const embed = new EmbedBuilder()
      .setTitle("🔎 RASTREAMENTO SS SOLICITADO")
      .setDescription(`👤 **Suspeito:** ${alvo}\n👮 **Solicitado por:** ${message.author}\n🎮 **Plataforma:** ${tipo.toUpperCase()}`)
      .setColor("#f1c40f");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("assumir_ss").setLabel("👮 Atender Chamado").setStyle(ButtonStyle.Success)
    );

    await canalDestino.send({ content: config.staffSS ? `<@&${config.staffSS}>` : null, embeds: [embed], components: [row] });
    return message.reply(`🚨 Alerta de SS enviado com sucesso para ${canalDestino}.`);
  }

  // !sala <ID> <Senha> (Executado dentro do tópico privado da partida)
  if (command === "sala") {
    if (!message.channel.isThread()) return message.reply("❌ Este comando deve ser usado em um canal de partida (Thread).");
    const id = args[0];
    const senha = args[1];

    if (!id || !senha) return message.reply("❌ Use: `!sala <ID> <Senha>`");

    // Salva de forma oculta associando ao canal atual
    config.dadosSalas[message.channel.id] = { id, senha };
    saveDB();

    const embed = new EmbedBuilder()
      .setTitle("🏆 SALA PRIVADA LIBERADA")
      .setDescription("Os dados de conexão foram camuflados por segurança. Clique nos botões abaixo para obter o ID e senha individuais.")
      .setColor("#2ecc71");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("show_id").setLabel("📋 Ver ID").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("show_pass").setLabel("🔑 Ver Senha").setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    return message.delete().catch(() => {});
  }

  // 🏆 SISTEMA DE PREMIAÇÃO E COINS
  if (command === "win") {
    if (!message.member.permissions.has("ManageMessages")) return;
    const user = message.mentions.users.first() || message.author;

    if (!config.coins[user.id]) config.coins[user.id] = 0;
    config.coins[user.id] += 1;
    saveDB();

    return message.channel.send(`🏆 Vitória registrada para ${user}!\n🪙 +1 Zyphor Coin adicionado.`);
  }

  if (command === "lose") {
    if (!message.member.permissions.has("ManageMessages")) return;
    const user = message.mentions.users.first() || message.author;
    return message.channel.send(`❌ Derrota registrada para ${user}.`);
  }

  if (command === "sw") {
    if (!message.member.permissions.has("ManageMessages")) return;
    const user = message.mentions.users.first() || message.author;

    if (!config.coins[user.id]) config.coins[user.id] = 0;
    config.coins[user.id] += 5;
    saveDB();

    return message.channel.send(`👑 **SUPREMO WINNER:** ${user}\n💰 Destruiu o diário e faturou +5 Zyphor Coins de bônus!`);
  }

  if (command === "coin" || command === "coins") {
    const user = message.mentions.users.first() || message.author;
    const total = config.coins[user.id] || 0;
    return message.reply(`🪙 O saldo competitivo atual de ${user.username} é de \`${total} coins\`.`);
  }

  // Gerenciamento simples de Blacklist por texto
  if (command === "blacklist") {
    if (!message.member.permissions.has("ManageMessages")) return;
    const acao = args[0];
    const alvo = message.mentions.users.first();

    if (!acao || !alvo) return message.reply("❌ Use: `!blacklist add @user` ou `!blacklist remove @user`");

    if (acao === "add") {
      config.blacklist[alvo.id] = true; saveDB();
      return message.reply(`🚫 ${alvo} foi inserido na Blacklist.`);
    }
    if (acao === "remove") {
      delete config.blacklist[alvo.id]; saveDB();
      return message.reply(`✅ ${alvo} removido da lista de bloqueio.`);
    }
  }
});

// Vincula o login do bot de forma 100% segura à variável da ShardCloud
client.login(process.env.DISCORD_TOKEN);

