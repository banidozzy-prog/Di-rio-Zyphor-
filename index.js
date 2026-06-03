const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ChannelType,
    REST,
    Routes
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
let db = {
  mediadores: {}, 
  filaMediadores: [], 
  valores: { "1X1": "R$3,90", "2X2": "R$5,90", "3X3": "R$7,90", "4X4": "R$9,90" },
  canaisIdSenha: {}, 
  cargoId: null,
  canalVitorias: null,
  torneios: {} 
};

if (fs.existsSync(DB_FILE)) {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8")); } catch (e) {}
}
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 4)); }

const aguardandoSenha = new Map();

// ==========================================
// 🛰️ REGISTRO DOS COMANDOS DE BARRA (/)
// ==========================================
client.once("ready", async () => {
  console.log(`🚀 Diário Zyphor operacional: ${client.user.tag}`);

  const commands = [
    {
        name: "configurar",
        description: "⚙️ Painel de configuração rápida por menus (Canais e Cargos)."
    },
    {
        name: "paineis",
        description: "📢 Envia os painéis de Fila, Cadastro PIX ou Vagas no canal atual.",
        options: [
            {
                name: "tipo",
                description: "Selecione qual painel enviar",
                type: 3, // STRING
                required: true,
                choices: [
                    { name: "Fila de Mediadores", value: "fila" },
                    { name: "Cadastro PIX Mediador", value: "cadastro" },
                    { name: "Inscrições (Vagas)", value: "vagas" }
                ]
            }
        ]
    },
    {
        name: "sw",
        description: "🏆 Registra a Suprema Win de um jogador no Hall da Fama.",
        options: [
            {
                name: "jogador",
                description: "O jogador campeão",
                type: 6, // USER
                required: true
            }
        ]
    }
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log("🔄 Atualizando comandos de barra (/) do Diário Zyphor...");
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Comandos de barra carregados com sucesso!");
  } catch (error) { console.error(error); }
});

// ==========================================
// 🎛️ COLETOR DE COMANDOS DE BARRA (/)
// ==========================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options, member, guild, channel } = interaction;

  // Comando /configurar (Abre o Menu de Seleção de canais/cargos)
  if (commandName === "configurar") {
    if (!member.permissions.has("Administrator")) {
        return interaction.reply({ content: "❌ Permissão negada.", ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setTitle("⚙️ Painel de Configuração — Diário Zyphor")
        .setDescription("Selecione abaixo o que você deseja configurar. O bot vai abrir o menu certo para você clicar e salvar automaticamente!")
        .setColor("#cca43b");

    const menuOpcoes = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("menu_config_principal")
            .setPlaceholder("Escolha o que configurar...")
            .addOptions([
                { label: "Definir Cargo da Staff", value: "cfg_cargo", description: "Escolha o cargo de mediadores" },
                { label: "Definir Canal de Vitórias", value: "cfg_vitorias", description: "Canal onde sai a Suprema Win" },
                { label: "Mapear Categorias (ID/Senha)", value: "cfg_categorias", description: "Vincular 1x1, 2x2, 4x4 a uma categoria" }
            ])
    );

    return interaction.reply({ embeds: [embed], components: [menuOpcoes], ephemeral: true });
  }

  // Comando /paineis (Envia os cards nos canais certos)
  if (commandName === "paineis") {
    if (!member.permissions.has("Administrator")) return interaction.reply({ content: "❌ Permissão negada.", ephemeral: true });
    const tipo = options.getString("tipo");

    if (tipo === "cadastro") {
        const embed = new EmbedBuilder().setTitle("Painel de Cadastro PIX Mediador").setDescription("Clique nos botões abaixo para verificar ou cadastrar sua chave PIX.").setColor("#cca43b");
        const botoes = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("med_cadastrar").setLabel("Cadastrar Pix").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("med_verificar").setLabel("Verificar Cadastro").setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({ content: "✅ Painel enviado!", ephemeral: true });
        return channel.send({ embeds: [embed], components: [botoes] });
    }

    if (tipo === "fila") {
        const embedFila = gerarEmbedFila();
        const botoesFila = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("fila_entrar").setLabel("Entrar na fila").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("fila_sair").setLabel("Sair da fila").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("fila_ajuda").setLabel("Ajuda").setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({ content: "✅ Painel enviado!", ephemeral: true });
        return channel.send({ embeds: [embedFila], components: [botoesFila] });
    }

    if (tipo === "vagas") {
        const embedVaga = new EmbedBuilder().setTitle("🏆 INSCRIÇÕES DIÁRIO ALFA").setDescription("Clique no botão abaixo para comprar sua vaga e entrar no chaveamento automático.").setColor("#2b2d31");
        const botaoComprar = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("player_abrir_ticket").setLabel("🟢 Comprar Vaga").setStyle(ButtonStyle.Success));
        await interaction.reply({ content: "✅ Painel enviado!", ephemeral: true });
        return channel.send({ embeds: [embedVaga], components: [botaoComprar] });
    }
  }

  // Comando /sw (Suprema Win via barra)
  if (commandName === "sw") {
    const eStaff = db.cargoId ? member.roles.cache.has(db.cargoId) : false;
    if (!eStaff && !member.permissions.has("Administrator")) {
        return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
    }

    const campeao = options.getMember("jogador");
    const canalVitorias = guild.channels.cache.get(db.canalVitorias);
    if (!canalVitorias) return interaction.reply({ content: "❌ Canal de vitórias não configurado no bot.", ephemeral: true });

    const embedVitoria = new EmbedBuilder()
        .setTitle("🏆 CAMPEÃO SUPREMO — DIÁRIO ALFA")
        .setDescription(`O jogador ${campeao} conquistou a **Suprema Win**!`)
        .setThumbnail(campeao.user.displayAvatarURL({ dynamic: true }))
        .setColor("#cca43b")
        .addFields(
            { name: "👑 Campeão", value: `${campeao}`, inline: true },
            { name: "📅 Data", value: new Date().toLocaleDateString('pt-BR'), inline: true }
        )
        .setImage("https://media.giphy.com/media/6Z3D5t3vtZdoSCSH0L/giphy.gif");

    await canalVitorias.send({ content: `📢 **SUPREMA WIN!** ${campeao}`, embeds: [embedVitoria] });
    return interaction.reply({ content: `✅ Vitória registrada para ${campeao.user.username}!`, ephemeral: true });
  }
});

// ==========================================
// 🔄 INTERAÇÕES COM OS INTERRUPTORES E MENUS
// ==========================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.guild) return;
  const { customId, user, channel } = interaction;

  // Filtro do Menu de Configuração Principal
  if (interaction.isStringSelectMenu() && customId === "menu_config_principal") {
    const escolha = interaction.values[0];

    if (escolha === "cfg_cargo") {
        const menuRole = new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder().setCustomId("select_cfg_cargo").setPlaceholder("Selecione o cargo dos Mediadores...")
        );
        return interaction.reply({ content: "🎯 Escolha o cargo na lista:", components: [menuRole], ephemeral: true });
    }

    if (escolha === "cfg_vitorias") {
        const menuCanal = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder().setCustomId("select_cfg_vitorias").setPlaceholder("Escolha o canal do Hall da Fama...").addChannelTypes(ChannelType.GuildText)
        );
        return interaction.reply({ content: "🎯 Selecione o canal de texto:", components: [menuCanal], ephemeral: true });
    }

    if (escolha === "cfg_categorias") {
        const menuModalidades = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("select_escolha_modalidade")
                .setPlaceholder("Selecione qual modalidade vai vincular...")
                .addOptions([
                    { label: "Modalidade 1X1", value: "1X1" },
                    { label: "Modalidade 2X2", value: "2X2" },
                    { label: "Modalidade 3X3", value: "3X3" },
                    { label: "Modalidade 4X4", value: "4X4" }
                ])
        );
        return interaction.reply({ content: "🎯 Escolha a modalidade primeiro:", components: [menuModalidades], ephemeral: true });
    }
  }

  // Salvando as configurações dos menus de seleção nativos
  if (interaction.isRoleSelectMenu() && customId === "select_cfg_cargo") {
    db.cargoId = interaction.values[0];
    saveDB();
    return interaction.reply({ content: `✅ Cargo de mediação definido com sucesso: <@&${db.cargoId}>`, ephemeral: true });
  }

  if (interaction.isChannelSelectMenu() && customId === "select_cfg_vitorias") {
    db.canalVitorias = interaction.values[0];
    saveDB();
    return interaction.reply({ content: `✅ Canal de vitórias definido com sucesso: <#${db.canalVitorias}>`, ephemeral: true });
  }

  if (interaction.isStringSelectMenu() && customId === "select_escolha_modalidade") {
    const modalidade = interaction.values[0];
    const menuCat = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId(`select_salvar_categoria_${modalidade}`)
            .setPlaceholder(`Selecione a Categoria para ${modalidade}...`)
            .addChannelTypes(ChannelType.GuildCategory) // Só mostra categorias!
    );
    return interaction.reply({ content: `🎯 Agora escolha a Categoria do Discord para o modo **${modalidade}**:`, components: [menuCat], ephemeral: true });
  }

  if (interaction.isChannelSelectMenu() && customId.startsWith("select_salvar_categoria_")) {
    const modalidade = customId.split("_")[3];
    db.canaisIdSenha[modalidade] = interaction.values[0];
    saveDB();
    return interaction.reply({ content: `✅ Categoria do modo **${modalidade}** configurada com sucesso!`, ephemeral: true });
  }

  // =======================================================
  // 👥 SISTEMA DE FILA, COMPRAS E EXIBIÇÃO EFÊMERA (REMANESCENTE)
  // =======================================================
  if (interaction.isButton() && customId === "fila_entrar") {
    if (db.cargoId && !interaction.member.roles.cache.has(db.cargoId) && !interaction.member.permissions.has("Administrator")) {
        return interaction.reply({ content: "❌ Apenas mediadores autorizados.", ephemeral: true });
    }
    if (!db.mediadores[user.id]) return interaction.reply({ content: "❌ Cadastre seu PIX antes de entrar na fila!", ephemeral: true });
    if (db.filaMediadores.includes(user.id)) return interaction.reply({ content: "⚠️ Você já está na fila!", ephemeral: true });

    db.filaMediadores.push(user.id); saveDB();
    return interaction.update({ embeds: [gerarEmbedFila()] });
  }

  if (interaction.isButton() && customId === "fila_sair") {
    db.filaMediadores = db.filaMediadores.filter(id => id !== user.id); saveDB();
    return interaction.update({ embeds: [gerarEmbedFila()] });
  }

  if (interaction.isButton() && customId === "fila_ajuda") {
    return interaction.reply({ content: "ℹ️ Os tickets usam o PIX do primeiro da fila e o jogam para o final.", ephemeral: true });
  }

  if (interaction.isButton() && customId === "med_cadastrar") {
    const modal = new ModalBuilder().setCustomId("modal_pix_med").setTitle("Seu PIX de Recebimento");
    const u = db.mediadores[user.id] || {};
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("m_nome").setLabel("Nome do Titular").setStyle(TextInputStyle.Short).setValue(u.nome || "")),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("m_banco").setLabel("Nome do Banco").setStyle(TextInputStyle.Short).setValue(u.banco || "")),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("m_chave").setLabel("Chave PIX").setStyle(TextInputStyle.Short).setValue(u.chave || ""))
    );
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && customId === "modal_pix_med") {
    db.mediadores[user.id] = { nome: interaction.fields.getTextInputValue("m_nome"), banco: interaction.fields.getTextInputValue("m_banco"), chave: interaction.fields.getTextInputValue("m_chave") };
    saveDB();
    return interaction.reply({ content: "✅ **Seu PIX foi configurado!**", ephemeral: true });
  }

  if (interaction.isButton() && customId === "med_verificar") {
    const u = db.mediadores[user.id];
    if (!u) return interaction.reply({ content: "❌ Sem PIX cadastrado.", ephemeral: true });
    return interaction.reply({ content: `📋 **Seu PIX:** \`${u.chave}\``, ephemeral: true });
  }

  if (interaction.isButton() && customId === "player_abrir_ticket") {
    await interaction.deferReply({ ephemeral: true });
    if (db.filaMediadores.length === 0) return interaction.editReply({ content: "❌ Nenhum mediador na fila de plantão." });

    try {
        const topicoPrivado = await channel.threads.create({ name: `🛒-vaga-${user.username}`, autoArchiveDuration: 60, type: 12 });
        await topicoPrivado.members.add(user.id);

        const proximoMediadorId = db.filaMediadores.shift(); 
        db.filaMediadores.push(proximoMediadorId); saveDB();

        const canalMensagens = await interaction.channel.messages.fetch();
        const painelFilaMsg = canalMensagens.find(m => m.embeds[0]?.title === "Fila de Mediadores");
        if (painelFilaMsg) await painelFilaMsg.edit({ embeds: [gerarEmbedFila()] });

        await topicoPrivado.members.add(proximoMediadorId).catch(() => {});

        const opcoesMenu = Object.keys(db.valores).map(cat => ({
            label: `Diário ${cat} (${db.valores[cat]})`,
            value: `lancar_${user.id}_${cat}_${proximoMediadorId}`
        }));

        const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("menu_selecao_diario").setPlaceholder("Escolha a modalidade...").addOptions(opcoesMenu));
        const embedEspera = new EmbedBuilder().setTitle("💳 PAGAMENTO DIÁRIO ALFA").setDescription(`Mediador: <@${proximoMediadorId}>\nCliente: ${user}`).setColor("#2b2d31");

        await topicoPrivado.send({ content: `<@${proximoMediadorId}> | ${user}`, embeds: [embedEspera], components: [menu] });
        return interaction.editReply({ content: `✅ Ticket criado: ${topicoPrivado}` });
    } catch (e) { return interaction.editReply({ content: "❌ Erro ao abrir tópico." }); }
  }

  if (interaction.isStringSelectMenu() && customId === "menu_selecao_diario") {
    const [action, compradorId, categoria, medId] = interaction.values[0].split("_");
    if (interaction.user.id !== medId) return interaction.reply({ content: "❌ Apenas o mediador escalado pode mexer.", ephemeral: true });

    await interaction.deferUpdate();
    const dadosMed = db.mediadores[medId];

    const embedPixFinal = new EmbedBuilder()
        .setTitle(`💳 PAGAMENTO DIÁRIO — ${categoria}`)
        .setDescription(`<@${compradorId}>, pague **${db.valores[categoria]}**.\n\nChave: \`${dadosMed.chave}\``)
        .setColor("#cca43b");

    const botoesFinais = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`slot_confirmar_${compradorId}_${categoria}`).setLabel("Confirmar Vaga").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("slot_cancelar").setLabel("Fechar Ticket").setStyle(ButtonStyle.Danger)
    );
    return interaction.editReply({ content: `<@${compradorId}>`, embeds: [embedPixFinal], components: [botoesFinais] });
  }

  if (interaction.isButton() && customId.startsWith("slot_confirmar_")) {
    await interaction.deferReply();
    const [, , compradorId, categoria] = customId.split("_");

    if (!db.torneios[categoria]) db.torneios[categoria] = { jogadoresInscritos: [], partidasAtivas: [], vencedoresRodada: [], rodadaAtual: 1 };
    const t = db.torneios[categoria];

    if (t.jogadoresInscritos.includes(compradorId)) return interaction.editReply({ content: "⚠️ Já inscrito." });
    t.jogadoresInscritos.push(compradorId); saveDB();

    const canalDestino = interaction.guild.channels.cache.get(db.canaisIdSenha[categoria]);
    await interaction.editReply({ content: `✅ Vaga confirmada! (${t.jogadoresInscritos.length}/8).` });
    setTimeout(() => channel.delete().catch(() => {}), 3000);

    if (t.jogadoresInscritos.length === 8 && canalDestino) {
        await canalDestino.send(`🔥 **Chaveamento Completo (8/8)!** Gerando as salas privadas...`);
        await iniciarNovaRodada(canalDestino, categoria, t.jogadoresInscritos, t);
    }
  }

  if (interaction.isButton() && customId === "slot_cancelar") {
    await interaction.reply({ content: "🔒 Fechando..." });
    return setTimeout(() => channel.delete().catch(() => {}), 2000);
  }

  if (interaction.isButton() && customId.startsWith("revelar_id_")) {
    return interaction.reply({ content: `${customId.split("_")[2]}`, ephemeral: true });
  }
  if (interaction.isButton() && customId.startsWith("revelar_senha_")) {
    return interaction.reply({ content: `${customId.split("_")[2]}`, ephemeral: true });
  }
});

// ==========================================
// 📥 LEITURA DIRETA DE MENSAGENS (ID/SENHA SOLTOS)
// ==========================================
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild || !message.channel.isThread()) return;

  const eStaff = db.cargoId ? message.member.roles.cache.has(db.cargoId) : false;
  if (!eStaff && !message.member.permissions.has("Administrator")) return;

  const apenasNumeros = message.content.trim().match(/\d+/g);
  if (apenasNumeros) {
    let idSala = null, senhaSala = null;

    if (apenasNumeros.length >= 2) {
        idSala = apenasNumeros[0]; senhaSala = apenasNumeros[1];
        await message.delete().catch(() => {});
    } else if (apenasNumeros.length === 1) {
        const num = apenasNumeros[0]; await message.delete().catch(() => {});
        if (aguardandoSenha.has(message.channel.id)) {
            idSala = aguardandoSenha.get(message.channel.id); senhaSala = num;
            aguardandoSenha.delete(message.channel.id);
        } else {
            aguardandoSenha.set(message.channel.id, num);
            const d = await message.channel.send(`⏳ ID \`${num}\` anotado. Envie a senha...`);
            return setTimeout(() => d.delete().catch(() => {}), 3000);
        }
    }

    if (idSala && senhaSala) {
        const membrosTopico = await message.channel.members.fetch();
        const jogadores = membrosTopico.filter(m => m.id !== client.user.id && (db.cargoId ? !message.guild.members.cache.get(m.id)?.roles.cache.has(db.cargoId) : true) && !message.guild.members.cache.get(m.id)?.permissions.has("Administrator")).map(m => `<@${m.id}>`).join(", ");

        const embedCard = new EmbedBuilder()
            .setTitle("🏆 A Sala Foi Criada!")
            .setDescription(`A sala já foi criada, por favor entrem: ${jogadores || "@jogadores"}\n\n⏱️ **A partida vai ser iniciada em 5 minutos!**`)
            .setColor("#2b2d31")
            .addFields({ name: "🎮 Formato:", value: "4x4, Full UMP & XM8, Gel Normal (0x), 1 emu" });

        const botoes = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`revelar_id_${idSala}`).setLabel("Copiar ID").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`revelar_senha_${senhaSala}`).setLabel("Copiar Senha").setStyle(ButtonStyle.Secondary)
        );
        return message.channel.send({ content: `🔔 ${jogadores}`, embeds: [embedCard], components: [botoes] });
    }
  }
});

function gerarEmbedFila() {
    let listaMembros = "A fila está vazia no momento.";
    if (db.filaMediadores.length > 0) listaMembros = db.filaMediadores.map((id, index) => `${index + 1}. <@${id}>`).join("\n");
    return new EmbedBuilder().setTitle("Fila de Mediadores").setDescription(listaMembros).setColor("#cca43b");
}

async function iniciarNovaRodada(canalPai, categoria, listaJogadores, torneio) {
    if (torneio.rodadaAtual === 1) listaJogadores.sort(() => Math.random() - 0.5);
    torneio.partidasAtivas = []; torneio.vencedoresRodada = []; saveDB();

    let countPartida = 1;
    for (let i = 0; i < listaJogadores.length; i += 2) {
        const j1 = listaJogadores[i], j2 = listaJogadores[i + 1];
        if (!j1 || !j2) break;

        const threadPartida = await canalPai.threads.create({ name: `🔒-partida-${countPartida}-rodada-${torneio.rodadaAtual}`, autoArchiveDuration: 60, type: 12 });
        await threadPartida.members.add(j1).catch(() => {}); await threadPartida.members.add(j2).catch(() => {});

        const embedConfronto = new EmbedBuilder().setTitle(`⚔️ CONFRONTO PRIVADO — RODADA ${torneio.rodadaAtual}`).setDescription(`**Partida:** <@${j1}> **X** <@${j2}>`).setColor("#e74c3c");
        await threadPartida.send({ content: `<@${j1}> vs <@${j2}>`, embeds: [embedConfronto] });
        torneio.partidasAtivas.push(threadPartida.id); countPartida++;
    }
    saveDB();
}

async function apagarTopicosAntigos(canalPai, idsTopicos) {
    for (const id of idsTopicos) { const thread = canalPai.threads.cache.get(id); if (thread) await thread.delete().catch(() => {}); }
}

client.login(process.env.DISCORD_TOKEN);

