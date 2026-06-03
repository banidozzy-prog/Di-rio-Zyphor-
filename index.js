const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder 
} = require("discord.js");
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

const DB_FILE = "./database.json";
let config = {
  pix: { nome: "Não definido", banco: "Não definido", chave: "Não definido", msg: "Não definido", img: "" },
  canais: { ssMob: null, ssEmu: null, logs: null, salas: null },
  staffSS: null,
  blacklist: {},
  coins: {},
  dadosSalas: {}
};

if (fs.existsSync(DB_FILE)) {
  try { config = JSON.parse(fs.readFileSync(DB_FILE, "utf-8")); } catch (e) {}
}
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(config, null, 4)); }

client.once("clientReady", () => {
  console.log(`🚀 Central Zyphor Premium Online: ${client.user.tag}`);
});

// =========================
// 🎛️ CENTRAL DE INTERAÇÕES
// =========================
client.on("interactionCreate", async (interaction) => {
  const { guild, user, channel, customId } = interaction;

  // 1. TRATAMENTO DOS MENUS SELETORES (SELECT MENUS)
  if (interaction.isStringSelectMenu()) {
    if (!interaction.member.permissions.has("Administrator")) {
        return interaction.reply({ content: "❌ Apenas administradores podem usar o painel.", ephemeral: true });
    }

    if (customId === "menu_gerenciamento") {
        const valor = interaction.values[0];

        if (valor === "config_logs") {
            const embedLogs = new EmbedBuilder()
                .setTitle("⚙️ Configuração do Sistema de Logs")
                .setDescription(`Selecione abaixo os canais onde o bot enviará as notificações do ecossistema.\n\n📌 **Canal Atual:** ${config.canais.logs ? `<#${config.canais.logs}>` : "*Não Definido*"}`)
                .setColor("#2f3136");

            const rowCanais = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("set_canal_logs").setLabel("💼 Definir Canal de Logs").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("voltar_painel").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Secondary)
            );

            return interaction.update({ embeds: [embedLogs], components: [rowCanais] });
        }

        if (valor === "config_ss") {
            const embedSS = new EmbedBuilder()
                .setTitle("🔍 Gerenciador de Auditoria SS")
                .setDescription(`Configure as salas de triagem para Mobile e Emulador.\n\n📱 **SS Mobile:** ${config.canais.ssMob ? `<#${config.canais.ssMob}>` : "*Não definido*"}\n💻 **SS Emulador:** ${config.canais.ssEmu ? `<#${config.canais.ssEmu}>` : "*Não definido*"}\n👮 **Cargo SS:** ${config.staffSS ? `<@&${config.staffSS}>` : "*Não definido*"}`)
                .setColor("#2f3136");

            const rowSS = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("set_ss_mob").setLabel("📱 Config Mob").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("set_ss_emu").setLabel("💻 Config Emu").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("set_cargo_ss").setLabel("👮 Cargo Staff").setStyle(ButtonStyle.Success)
            );

            return interaction.update({ embeds: [embedSS], components: [rowSS] });
        }

        if (valor === "config_pix") {
            const embedPix = new EmbedBuilder()
                .setTitle("💳 Configuração de Faturamento PIX")
                .addFields(
                    { name: "👑 Titular", value: config.pix.nome, inline: true },
                    { name: "🏦 Banco", value: config.pix.banco, inline: true },
                    { name: "🔑 Chave", value: `\`${config.pix.chave}\``, inline: false },
                    { name: "💬 Mensagem", value: config.pix.msg }
                )
                .setColor("#2f3136");

            const rowPix = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("editar_pix").setLabel("📝 Editar Dados do PIX").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("voltar_painel").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Secondary)
            );

            return interaction.update({ embeds: [embedPix], components: [rowPix] });
        }
    }
  }

  // 2. TRATAMENTO DOS BOTÕES
  if (interaction.isButton()) {
    // Botão Voltar para a Central Principal
    if (customId === "voltar_painel") {
        const embedPrincipal = new EmbedBuilder()
            .setTitle("🗃️ Central de Gerenciamento - Zyphor")
            .setDescription("Configure todos os módulos de salas, logs, pagamentos e SS usando o seletor nativo abaixo.")
            .setColor("#5865f2");

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("menu_gerenciamento")
                .setPlaceholder("Escolha o módulo para configurar...")
                .addOptions([
                    { label: "Sistema de Logs", description: "Definir canais de logs e auditoria.", value: "config_logs", emoji: "📋" },
                    { label: "Gerenciador de SS (Telas)", description: "Configurar canais Mobile, Emu e Cargos.", value: "config_ss", emoji: "🔎" },
                    { label: "Faturamento PIX", description: "Atualizar chaves e dados de pagamento.", value: "config_pix", emoji: "💳" }
                ])
        );
        return interaction.update({ embeds: [embedPrincipal], components: [menu] });
    }

    // Coleta as ações de clique para configurar (Simulação por instrução assistida para evitar travamento de modais complexos)
    if (["set_canal_logs", "set_ss_mob", "set_ss_emu", "set_cargo_ss", "editar_pix"].includes(customId)) {
        return interaction.reply({ 
            content: `💡 **Menu Interativo:** Para definir este parâmetro específico, basta digitar o comando de atalho rápido no chat.\n\n• Para canais/cargos use:\n\`!setup #canal-salas #canal-logs #canal-ssmob #canal-ssemu @CargoStaff\`\n\n• Para o PIX use:\n\`!setpix Nome | Banco | Chave | Instruções\``, 
            ephemeral: true 
        });
    }

    // --- LOGICA DE COMPRA DE VAGAS ---
    if (customId.startsWith("buy_")) {
        if (config.blacklist[user.id]) return interaction.reply({ content: "❌ Você está na Blacklist.", ephemeral: true });
        
        const thread = await channel.threads.create({
            name: `🛒・${user.username}`,
            autoArchiveDuration: 60,
        });
        await thread.members.add(user.id);

        const pixEmbed = new EmbedBuilder()
            .setTitle("💳 PAGAMENTO DA VAGA")
            .setDescription(config.pix.msg)
            .addFields(
                { name: "Titular", value: config.pix.nome, inline: true },
                { name: "Banco", value: config.pix.banco, inline: true },
                { name: "Chave PIX", value: `\`${config.pix.chave}\``, inline: false }
            ).setColor("#2ecc71");

        const rowAprovacao = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`aprovar_${user.id}`).setLabel("✅ Aprovar (Staff)").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`recusar_${user.id}`).setLabel("❌ Recusar").setStyle(ButtonStyle.Danger)
        );

        await thread.send({ content: `Olá ${user}, envie o comprovante de transferência neste painel.`, embeds: [pixEmbed], components: [rowAprovacao] });
        return interaction.reply({ content: `🛒 Ticket criado com sucesso: ${thread}`, ephemeral: true });
    }

    if (customId.startsWith("aprovar_")) {
        if (!interaction.member.permissions.has("ManageMessages")) return;
        return interaction.reply({ content: `✅ Vaga aprovada com sucesso para <@${customId.split("_")[1]}>!` });
    }
    if (customId.startsWith("recusar_")) {
        if (!interaction.member.permissions.has("ManageMessages")) return;
        return interaction.reply({ content: "❌ Inscrição indeferida pela administração." });
    }
  }
});

// =========================
// 💬 COMANDOS VIA TEXTO
// =========================
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // COMANDO PARA INVOCAR A CENTRAL VISUAL IGUAL AO PRINT
  if (command === "paineladm") {
    if (!message.member.permissions.has("Administrator")) return;

    const embedPrincipal = new EmbedBuilder()
        .setTitle("🗃️ Central de Gerenciamento - Zyphor")
        .setDescription("Configure todos os módulos do seu bot usando os seletores nativos abaixo.")
        .setColor("#5865f2");

    const menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("menu_gerenciamento")
            .setPlaceholder("Escolha o módulo para configurar...")
            .addOptions([
                { label: "Sistema de Logs", description: "Definir canais de logs e auditoria.", value: "config_logs", emoji: "📋" },
                { label: "Gerenciador de SS (Telas)", description: "Configurar canais Mobile, Emu e Cargos.", value: "config_ss", emoji: "🔎" },
                { label: "Faturamento PIX", description: "Atualizar chaves e dados de pagamento.", value: "config_pix", emoji: "💳" }
            ])
    );

    return message.channel.send({ embeds: [embedPrincipal], components: [menu] });
  }

  // Comandos de Processamento de Dados em Segundo Plano
  if (command === "setup") {
    if (!message.member.permissions.has("Administrator")) return;
    const salas = message.mentions.channels.first();
    const logs = message.mentions.channels.toJSON()[1];
    const ssmob = message.mentions.channels.toJSON()[2];
    const ssemu = message.mentions.channels.toJSON()[3];
    const cargo = message.mentions.roles.first();

    if (!salas || !logs || !ssmob || !ssemu || !cargo) return message.reply("❌ Use completo: `!setup #salas #logs #ssmob #ssemu @Cargo`");

    config.canais.salas = salas.id; config.canais.logs = logs.id; config.canais.ssMob = ssmob.id; config.canais.ssEmu = ssemu.id; config.staffSS = cargo.id;
    saveDB();
    return message.reply("✅ **Dados sincronizados com a Central Interativa!**");
  }

  if (command === "setpix") {
    if (!message.member.permissions.has("Administrator")) return;
    const partes = args.join(" ").split("|");
    if (partes.length < 4) return message.reply("❌ Use: `!setpix Nome | Banco | Chave | Instruções`");

    config.pix = { nome: partes[0].trim(), banco: partes[1].trim(), chave: partes[2].trim(), msg: partes[3].trim() };
    saveDB();
    return message.reply("✅ **Dados de faturamento PIX sincronizados!**");
  }

  if (command === "painelcompra") {
    if (!message.member.permissions.has("ManageMessages")) return;
    const embed = new EmbedBuilder()
      .setTitle("🏆 INSCRIÇÕES COPA ZYPHOR")
      .setDescription("Escolha a categoria do seu slot competitivos abaixo:")
      .setColor("#2ecc71");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("buy_Mobile").setLabel("📱 Vaga Mobile").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("buy_Emulador").setLabel("💻 Vaga Emulador").setStyle(ButtonStyle.Secondary)
    );
    return message.channel.send({ embeds: [embed], components: [row] });
  }
});

client.login(process.env.DISCORD_TOKEN);

