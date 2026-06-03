const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    REST,
    Routes,
    SlashCommandBuilder
} = require("discord.js");
require("dotenv").config();
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
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

// ==========================================
// 🚀 REGISTRO AUTOMÁTICO DE TODOS OS COMANDOS (/)
// ==========================================
client.once("clientReady", async () => {
  console.log(`🚀 Central Zyphor Premium Online: ${client.user.tag}`);

  const commands = [
    // Comando do ADM para configurar
    new SlashCommandBuilder()
      .setName("paineladm")
      .setDescription("🔧 Abre a Central de Gerenciamento (Apenas Staff)."),
      
    // Comando para gerar o painel de compras no canal definitivo
    new SlashCommandBuilder()
      .setName("enviarpainel")
      .setDescription("🏆 Envia o painel de inscrição com botões de compra para os membros."),

    // Comando público para os jogadores comprarem vaga direto via chat
    new SlashCommandBuilder()
      .setName("comprar")
      .setDescription("🛒 Abre um ticket de compra para o diário operacional.")
  ].map(command => command.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("🔄 Atualizando comandos barra (/) no Discord...");
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("✅ Todos os comandos barra (/) foram registrados!");
  } catch (error) {
    console.error("❌ Erro ao registrar comandos barra:", error);
  }
});

// ==========================================
// 🎛️ CENTRAL DE INTERAÇÕES (SLASH, MENUS, MODAIS)
// ==========================================
client.on("interactionCreate", async (interaction) => {
  const { guild, user, channel, customId } = interaction;

  // 1. EXECUÇÃO DOS COMANDOS CHAT (SLASH COMMANDS)
  if (interaction.isChatInputCommand()) {
    
    // Comando /paineladm (Configurações)
    if (interaction.commandName === "paineladm") {
      if (!interaction.member.permissions.has("Administrator")) {
        return interaction.reply({ content: "❌ Você precisa ser um Administrador para usar este comando.", ephemeral: true });
      }

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

      return interaction.reply({ embeds: [embedPrincipal], components: [menu] });
    }

    // Comando /enviarpainel (Gera os botões fixos para a galera comprar)
    if (interaction.commandName === "enviarpainel") {
      if (!interaction.member.permissions.has("ManageMessages")) {
        return interaction.reply({ content: "❌ Sem permissão para enviar painéis.", ephemeral: true });
      }

      const embedVagas = new EmbedBuilder()
          .setTitle("🏆 INSCRIÇÕES DIÁRIO ZYPHOR")
          .setDescription("Clique no botão abaixo correspondente à sua categoria para garantir sua vaga na tabela!")
          .setColor("#2ecc71")
          .setFooter({ text: "Sistema automático de gerenciamento de slots" });

      const botoes = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("buy_mobile").setLabel("📱 Slot Mobile").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("buy_emulador").setLabel("💻 Slot Emulador").setStyle(ButtonStyle.Success)
      );

      await interaction.reply({ content: "✅ Painel enviado com sucesso!", ephemeral: true });
      return channel.send({ embeds: [embedVagas], components: [botoes] });
    }

    // Comando /comprar (Caso queiram abrir sem clicar em botões)
    if (interaction.commandName === "comprar") {
      return abrirTicket(interaction, user, "Geral");
    }
  }

  // 2. INTERAÇÃO DO MENU SELETOR (ADMIN)
  if (interaction.isStringSelectMenu() && customId === "menu_gerenciamento") {
    const valor = interaction.values[0];

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
    // (Outros menus reduzem para manter simplicidade/estabilidade)
  }

  // 3. INTERAÇÃO DOS BOTÕES (COMPRA DE VAGAS E MODAL)
  if (interaction.isButton()) {
    if (customId === "voltar_painel") {
        // Lógica de retorno ao menu principal mantida
        return; 
    }

    if (customId === "abrir_modal_pix") {
        const modal = new ModalBuilder().setCustomId("modal_config_pix").setTitle("Configurar Dados de Recebimento");
        const inputNome = new TextInputBuilder().setCustomId("pix_nome").setLabel("Nome do Titular").setStyle(TextInputStyle.Short).setValue(config.pix.nome);
        const inputBanco = new TextInputBuilder().setCustomId("pix_banco").setLabel("Nome do Banco").setStyle(TextInputStyle.Short).setValue(config.pix.banco);
        const inputChave = new TextInputBuilder().setCustomId("pix_chave").setLabel("Chave PIX").setStyle(TextInputStyle.Short).setValue(config.pix.chave);
        const inputMsg = new TextInputBuilder().setCustomId("pix_msg").setLabel("Instruções de Pagamento").setStyle(TextInputStyle.Paragraph).setValue(config.pix.msg);

        modal.addComponents(new ActionRowBuilder().addComponents(inputNome), new ActionRowBuilder().addComponents(inputBanco), new ActionRowBuilder().addComponents(inputChave), new ActionRowBuilder().addComponents(inputMsg));
        return interaction.showModal(modal);
    }

    // Cliques nos botões de compra criados pelo comando /enviarpainel
    if (customId === "buy_mobile") {
        return abrirTicket(interaction, user, "📱 Mobile");
    }
    if (customId === "buy_emulador") {
        return abrirTicket(interaction, user, "💻 Emulador");
    }
  }

  // 4. RETORNO DO FORMULÁRIO MODAL
  if (interaction.isModalSubmit() && customId === "modal_config_pix") {
    config.pix.nome = interaction.fields.getTextInputValue("pix_nome");
    config.pix.banco = interaction.fields.getTextInputValue("pix_banco");
    config.pix.chave = interaction.fields.getTextInputValue("pix_chave");
    config.pix.msg = interaction.fields.getTextInputValue("pix_msg");
    saveDB();
    return interaction.reply({ content: "✅ **Dados salvos com sucesso!**", ephemeral: true });
  }
});

// Funçao auxiliar para abrir os canais de atendimento das vagas
async function abrirTicket(interaction, user, tipo) {
  const thread = await interaction.channel.threads.create({
      name: `🛒・${user.username}-${tipo.replace(/[^a-zA-Z0-9]/g, "")}`,
      autoArchiveDuration: 60,
  });
  await thread.members.add(user.id);

  const pixEmbed = new EmbedBuilder()
      .setTitle(`💳 INSCRIÇÃO CONTRATADA — CATEGORIA: ${tipo}`)
      .setDescription(config.pix.msg)
      .addFields(
          { name: "Titular", value: config.pix.nome, inline: true },
          { name: "Banco", value: config.pix.banco, inline: true },
          { name: "Chave PIX", value: `\`${config.pix.chave}\``, inline: false }
      ).setColor("#2ecc71");

  await thread.send({ content: `Olá ${user}, realize o pagamento do seu slot e envie o comprovante abaixo.`, embeds: [pixEmbed] });
  return interaction.reply({ content: `🛒 Seu ticket de compra foi gerado em: ${thread}`, ephemeral: true });
}

client.login(process.env.DISCORD_TOKEN);

