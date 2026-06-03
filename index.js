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
  pix: { nome: "Não definido", banco: "Não definido", chave: "Não definido", msg: "Não definido" },
  canais: { logs: null, vendas: null }
};

if (fs.existsSync(DB_FILE)) {
  try { config = JSON.parse(fs.readFileSync(DB_FILE, "utf-8")); } catch (e) {}
}
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(config, null, 4)); }

client.once("ready", () => {
  console.log(`🚀 Central Zyphor Limpa Online: ${client.user.tag}`);
});

// ==========================================
// 💬 APENAS OS DOIS COMANDOS ESSENCIAIS DIRETOS (!)
// ==========================================
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // 1. COMANDO: !paineladm (Para você gerenciar o painel visual)
  if (command === "!paineladm") {
    if (!message.member.permissions.has("Administrator")) return;

    await message.delete().catch(() => {});

    const embedPrincipal = new EmbedBuilder()
        .setTitle("🗃️ Central de Gerenciamento - Zyphor")
        .setDescription("Configure todos os módulos do seu bot usando o seletor nativo abaixo.")
        .setColor("#5865f2");

    const menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("menu_gerenciamento")
            .setPlaceholder("Escolha o módulo para configurar...")
            .addOptions([
                { label: "Sistema de Logs", description: "Definir canais de logs.", value: "config_logs", emoji: "📋" },
                { label: "Faturamento PIX", description: "Atualizar chaves e dados de faturamento.", value: "config_pix", emoji: "💳" }
            ])
    );

    return message.channel.send({ embeds: [embedPrincipal], components: [menu] });
  }

  // 2. COMANDO: !setpix Nome | Banco | Chave | Instruções (Para atualizar os dados salvos)
  if (command === "!setpix") {
    if (!message.member.permissions.has("Administrator")) return;
    const partes = args.join(" ").split("|");
    if (partes.length < 4) return message.reply("❌ Formato: `!setpix Nome | Banco | Chave | Instruções`");

    config.pix = { nome: partes[0].trim(), banco: partes[1].trim(), chave: partes[2].trim(), msg: partes[3].trim() };
    saveDB();
    return message.reply("✅ **Dados do PIX atualizados com sucesso!**");
  }
});

// ==========================================
// 🎛️ INTERAÇÕES NATIVAS DOS MENUS DO PAINEL
// ==========================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.guild) return;

  const { customId } = interaction;

  if (interaction.isStringSelectMenu() && customId === "menu_gerenciamento") {
    const valor = interaction.values[0];

    if (valor === "config_pix") {
        const embedPix = new EmbedBuilder()
            .setTitle("💳 Configuração de Faturamento PIX")
            .setDescription("Para alterar esses valores rapidamente, use o comando:\n`!setpix Nome | Banco | Chave | Mensagem`")
            .addFields(
                { name: "👑 Titular", value: config.pix.nome, inline: true },
                { name: "🏦 Banco", value: config.pix.banco, inline: true },
                { name: "🔑 Chave", value: `\`${config.pix.chave}\``, inline: false },
                { name: "💬 Instruções", value: config.pix.msg }
            )
            .setColor("#2b2d31");

        const rowPix = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("voltar_painel").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Secondary)
        );
        return interaction.update({ embeds: [embedPix], components: [rowPix] });
    }

    if (valor === "config_logs") {
        const embedLogs = new EmbedBuilder()
            .setTitle("⚙️ Módulo de Logs de Auditoria")
            .setDescription("Sistema pronto e monitorando as atividades do servidor.")
            .setColor("#2b2d31");

        const rowLogs = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("voltar_painel").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Secondary)
        );
        return interaction.update({ embeds: [embedLogs], components: [rowLogs] });
    }
  }

  if (interaction.isButton() && customId === "voltar_painel") {
    const embedPrincipal = new EmbedBuilder()
        .setTitle("🗃️ Central de Gerenciamento - Zyphor")
        .setDescription("Configure todos os módulos do seu bot usando o seletor nativo abaixo.")
        .setColor("#5865f2");

    const menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("menu_gerenciamento")
            .setPlaceholder("Escolha o módulo para configurar...")
            .addOptions([
                { label: "Sistema de Logs", description: "Definir canais de logs.", value: "config_logs", emoji: "📋" },
                { label: "Faturamento PIX", description: "Atualizar chaves e dados de faturamento.", value: "config_pix", emoji: "💳" }
            ])
    );
    return interaction.update({ embeds: [embedPrincipal], components: [menu] });
  }
});
client.login(process.env.DISCORD_TOKEN);
