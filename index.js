const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
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

  // 1. TRATAMENTO DOS MENUS SELETORES
  if (interaction.isStringSelectMenu() && customId === "menu_gerenciamento") {
    if (!interaction.member.permissions.has("Administrator")) {
        return interaction.reply({ content: "❌ Apenas administradores podem usar o painel.", ephemeral: true });
    }

    const valor = interaction.values[0];

    if (valor === "config_logs") {
        const embedLogs = new EmbedBuilder()
            .setTitle("⚙️ Configuração do Sistema de Logs")
            .setDescription(`Gerencie o canal onde o bot enviará as notificações do ecossistema.\n\n📌 **Canal de Logs Atual:** ${config.canais.logs ? `<#${config.canais.logs}>` : "*Não Definido*"}`)
            .setColor("#2b2d31");

        const rowCanais = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("voltar_painel").setLabel("⬅️ Voltar para o Menu").setStyle(ButtonStyle.Secondary)
        );
        return interaction.update({ embeds: [embedLogs], components: [rowCanais] });
    }

    if (valor === "config_ss") {
        const embedSS = new EmbedBuilder()
            .setTitle("🔍 Gerenciador de Auditoria SS")
            .setDescription(`Salas de triagem configuradas:\n\n📱 **SS Mobile:** ${config.canais.ssMob ? `<#${config.canais.ssMob}>` : "*Não definido*"}\n💻 **SS Emulador:** ${config.canais.ssEmu ? `<#${config.canais.ssEmu}>` : "*Não definido*"}\n👮 **Cargo SS:** ${config.staffSS ? `<@&${config.staffSS}>` : "*Não definido*"}`)
            .setColor("#2b2d31");

        const rowSS = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("voltar_painel").setLabel("⬅️ Voltar para o Menu").setStyle(ButtonStyle.Secondary)
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
                { name: "💬 Instruções", value: config.pix.msg }
            )
            .setColor("#2b2d31");

        const rowPix = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("abrir_modal_pix").setLabel("📝 Editar via Formulário").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("voltar_painel").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Secondary)
        );
        return interaction.update({ embeds: [embedPix], components: [rowPix] });
    }
  }

  // 2. TRATAMENTO DOS BOTÕES E MODAIS
  if (interaction.isButton()) {
    if (customId === "voltar_painel") {
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
                    { label: "Faturamento PIX", description: "领 Atualizar chaves e dados de faturamento.", value: "config_pix", emoji: "💳" }
                ])
        );
        return interaction.update({ embeds: [embedPrincipal], components: [menu] });
    }

    // Gatilho para abrir a janela pop-up (Modal) de configuração do PIX
    if (customId === "abrir_modal_pix") {
        const modal = new ModalBuilder().setCustomId("modal_config_pix").setTitle("Configurar Dados de Recebimento");

        const inputNome = new TextInputBuilder().setCustomId("pix_nome").setLabel("Nome do Titular").setStyle(TextInputStyle.Short).setValue(config.pix.nome);
        const inputBanco = new TextInputBuilder().setCustomId("pix_banco").setLabel("Nome do Banco").setStyle(TextInputStyle.Short).setValue(config.pix.banco);
        const inputChave = new TextInputBuilder().setCustomId("pix_chave").setLabel("Chave PIX").setStyle(TextInputStyle.Short).setValue(config.pix.chave);
        const inputMsg = new TextInputBuilder().setCustomId("pix_msg").setLabel("Instruções de Pagamento").setStyle(TextInputStyle.Paragraph).setValue(config.pix.msg);

        modal.addComponents(
            new ActionRowBuilder().addComponents(inputNome),
            new ActionRowBuilder().addComponents(inputBanco),
            new ActionRowBuilder().addComponents(inputChave),
            new ActionRowBuilder().addComponents(inputMsg)
        );

        return interaction.showModal(modal);
    }
  }

  // Recebimento e processamento dos dados digitados no Modal
  if (interaction.isModalSubmit() && customId === "modal_config_pix") {
    config.pix.nome = interaction.fields.getTextInputValue("pix_nome");
    config.pix.banco = interaction.fields.getTextInputValue("pix_banco");
    config.pix.chave = interaction.fields.getTextInputValue("pix_chave");
    config.pix.msg = interaction.fields.getTextInputValue("pix_msg");
    saveDB();

    return interaction.reply({ content: "✅ **Configurações de faturamento salvas e sincronizadas com sucesso!**", ephemeral: true });
  }
});

// =========================
// 💬 SVE DE COMANDOS DE TEXTO DIRETOS
// =========================
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  // Processamento limpo independente de espaços extras
  if (message.content.toLowerCase().startsWith("!paineladm")) {
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
                { label: "Faturamento PIX", description: "Atualizar chaves e dados de faturamento.", value: "config_pix", emoji: "💳" }
            ])
    );

    await message.channel.send({ embeds: [embedPrincipal], components: [menu] });
    return message.delete().catch(() => {});
  }

  // Atalhos Rápidos para canais via comando de texto clássico alternativo
  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "!setup") {
    if (!message.member.permissions.has("Administrator")) return;
    const salas = message.mentions.channels.first();
    const logs = message.mentions.channels.toJSON()[1];
    const ssmob = message.mentions.channels.toJSON()[2];
    const ssemu = message.mentions.channels.toJSON()[3];
    const cargo = message.mentions.roles.first();

    if (!salas || !logs || !ssmob || !ssemu || !cargo) return;

    config.canais.salas = salas.id; config.canais.logs = logs.id; config.canais.ssMob = ssmob.id; config.canais.ssEmu = ssemu.id; config.staffSS = cargo.id;
    saveDB();
    return message.reply("✅ Canais salvos na memória do sistema.");
  }
});

client.login(process.env.DISCORD_TOKEN);

