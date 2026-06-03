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
let db = {
  mediadores: {}, 
  filaMediadores: [], // Guarda as IDs dos mediadores na fila por ordem
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

// Armazenamento temporário de IDs para quando a senha for enviada separada
const aguardandoSenha = new Map();

client.once("ready", () => {
  console.log(`🚀 Sistema Org Alfa operacional: ${client.user.tag}`);
});

// ==========================================
// 💬 COMANDOS TEXTUAIS ADMINISTRATIVOS
// ==========================================
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Configuração básica do Bot
  if (command === "!setcanalid") {
    if (!message.member.permissions.has("Administrator")) return;
    const partes = args.join(" ").split("|");
    if (partes.length < 2) return message.reply("❌ Formato: `!setcanalid Categoria | ID`");
    db.canaisIdSenha[partes[0].trim().toUpperCase()] = partes[1].trim();
    saveDB();
    return message.reply(`✅ Categoria **${partes[0].trim().toUpperCase()}** configurada.`);
  }

  if (command === "!setcargo") {
    if (!message.member.permissions.has("Administrator")) return;
    db.cargoId = args[0];
    saveDB();
    return message.reply(`✅ Cargo de atendimento definido: <@&${db.cargoId}>`);
  }

  if (command === "!setvitorias") {
    if (!message.member.permissions.has("Administrator")) return;
    db.canalVitorias = args[0];
    saveDB();
    return message.reply(`✅ Canal de vitórias definido para <#${db.canalVitorias}>`);
  }

  // Painel de Cadastro PIX (Igual ao print 45758_2.png)
  if (command === "!painelcadastro") {
    if (!message.member.permissions.has("Administrator")) return;
    await message.delete().catch(() => {});
    const embed = new EmbedBuilder()
        .setTitle("Painel de Cadastro PIX Mediador")
        .setDescription("Clique nos botões abaixo para verificar ou cadastrar sua chave PIX.")
        .setColor("#cca43b"); // Borda amarelada/dourada como o print
        
    const botoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("med_cadastrar").setLabel("Cadastrar Pix").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("med_verificar").setLabel("Verificar Cadastro").setStyle(ButtonStyle.Secondary)
    );
    return message.channel.send({ embeds: [embed], components: [botoes] });
  }

  // Painel de Fila de Atendimento (Igual ao print 45755_2.png)
  if (command === "!painelfila") {
    if (!message.member.permissions.has("Administrator")) return;
    await message.delete().catch(() => {});
    
    const embedFila = gerarEmbedFila();
    const botoesFila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("fila_entrar").setLabel("Entrar na fila").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("fila_sair").setLabel("Sair da fila").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("fila_ajuda").setLabel("Ajuda").setStyle(ButtonStyle.Secondary)
    );
    return message.channel.send({ embeds: [embedFila], components: [botoesFila] });
  }

  // Painel de Vagas dos Jogadores
  if (command === "!painelvagas") {
    if (!message.member.permissions.has("Administrator")) return;
    await message.delete().catch(() => {});
    const embedVaga = new EmbedBuilder()
        .setTitle("🏆 INSCRIÇÕES DIÁRIO ALFA")
        .setDescription("Clique no botão abaixo para comprar sua vaga e entrar no chaveamento automático.")
        .setColor("#2b2d31");
    const botaoComprar = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("player_abrir_ticket").setLabel("🟢 Comprar Vaga").setStyle(ButtonStyle.Success)
    );
    return message.channel.send({ embeds: [embedVaga], components: [botaoComprar] });
  }

  // Gerenciamento Manual de Partidas
  if (command === "!win") {
    if (db.cargoId && !message.member.roles.cache.has(db.cargoId) && !message.member.permissions.has("Administrator")) return;
    const vencedor = message.mentions.users.first();
    if (!vencedor) return message.reply("❌ Mencione o vencedor. Ex: `!win @User`");

    if (!message.channel.isThread()) return message.reply("❌ Use este comando dentro do tópico da partida!");

    const categoria = Object.keys(db.canaisIdSenha).find(cat => db.canaisIdSenha[cat] === message.channel.parentId);
    if (!categoria || !db.torneios[categoria]) return message.reply("❌ Nenhum torneio ativo mapeado para este canal.");

    const torneio = db.torneios[categoria];
    if (!torneio.vencedoresRodada.includes(vencedor.id)) {
        torneio.vencedoresRodada.push(vencedor.id);
        message.channel.send(`🎉 **${vencedor.username}** avançou para a próxima fase!`);
    }
    return verificarAvancoRodada(message.channel.parent, categoria, torneio);
  }

  if (command === "!lose") {
    if (db.cargoId && !message.member.roles.cache.has(db.cargoId) && !message.member.permissions.has("Administrator")) return;
    const perdedor = message.mentions.users.first();
    if (!perdedor) return message.reply("❌ Mencione quem perdeu. Ex: `!lose @User`");
    if (!message.channel.isThread()) return message.reply("❌ Use este comando dentro do tópico.");

    await message.channel.members.remove(perdedor.id).catch(() => {});
    return message.reply(`📉 O jogador **${perdedor.username}** foi removido do tópico.`);
  }

  // !sw @user -> Suprema Win com Embed Zika para o Hall da Fama
  if (command === "!sw") {
    if (db.cargoId && !message.member.roles.cache.has(db.cargoId) && !message.member.permissions.has("Administrator")) return;
    const campeao = message.mentions.members.first();
    if (!campeao) return message.reply("❌ Use: `!sw @user`");

    const canalVitorias = message.guild.channels.cache.get(db.canalVitorias);
    if (!canalVitorias) return message.reply("❌ Canal de vitórias não configurado. Use `!setvitorias ID`.");

    const embedVitoria = new EmbedBuilder()
        .setTitle("🏆 CAMPEÃO SUPREMO — DIÁRIO ALFA")
        .setDescription(`O jogador ${campeao} acaba de conquistar a **Suprema Win** e garantiu a premiação máxima!`)
        .setThumbnail(campeao.user.displayAvatarURL({ dynamic: true }))
        .setColor("#cca43b")
        .addFields(
            { name: "👑 Campeão", value: `${campeao}`, inline: true },
            { name: "📅 Data", value: new Date().toLocaleDateString('pt-BR'), inline: true },
            { name: "⚡ Status", value: "Premiação Paga e Verificada ✅", inline: false }
        )
        .setImage("https://media.giphy.com/media/6Z3D5t3vtZdoSCSH0L/giphy.gif")
        .setFooter({ text: "Org Alfa - Onde os lendários são feitos" })
        .setTimestamp();

    await canalVitorias.send({ content: `📢 **SUPREMA WIN!** ${campeao}`, embeds: [embedVitoria] });
    return message.reply(`✅ Suprema Win registrada para ${campeao.user.username}!`);
  }

  // ==========================================
  // 📥 CAPTURA AUTOMÁTICA DE ID E SENHA (SEM COMANDO)
  // ==========================================
  if (message.channel.isThread()) {
    const eStaff = db.cargoId ? message.member.roles.cache.has(db.cargoId) : false;
    const eAdmin = message.member.permissions.has("Administrator");

    if (eStaff || eAdmin) {
        const apenasNumeros = message.content.trim().match(/\d+/g);

        if (apenasNumeros) {
            let idSala = null;
            let senhaSala = null;

            // Caso envie os dois juntos: "2928298 22"
            if (apenasNumeros.length >= 2) {
                idSala = apenasNumeros[0];
                senhaSala = apenasNumeros[1];
                await message.delete().catch(() => {});
            } 
            // Caso envie separado (ID primeiro, Senha depois)
            else if (apenasNumeros.length === 1) {
                const numeroEnviado = apenasNumeros[0];
                await message.delete().catch(() => {});

                if (aguardandoSenha.has(message.channel.id)) {
                    idSala = aguardandoSenha.get(message.channel.id);
                    senhaSala = numeroEnviado;
                    aguardandoSenha.delete(message.channel.id);
                } else {
                    aguardandoSenha.set(message.channel.id, numeroEnviado);
                    const dica = await message.channel.send(`⏳ ID \`${numeroEnviado}\` anotado. Envie a senha...`);
                    setTimeout(() => dica.delete().catch(() => {}), 3000);
                    return;
                }
            }

            if (idSala && senhaSala) {
                const membrosTopico = await message.channel.members.fetch();
                const jogadores = membrosTopico
                    .filter(m => m.id !== client.user.id && (db.cargoId ? !message.guild.members.cache.get(m.id)?.roles.cache.has(db.cargoId) : true) && !message.guild.members.cache.get(m.id)?.permissions.has("Administrator"))
                    .map(m => `<@${m.id}>`)
                    .join(", ");

                const embedCard = new EmbedBuilder()
                    .setTitle("🏆 A Sala Foi Criada!")
                    .setDescription(`A sala já foi criada, por favor entrem: ${jogadores || "@jogadores"}\n\n⏱️ **A partida vai ser iniciada em 5 minutos!**`)
                    .setColor("#2b2d31")
                    .addFields(
                        { name: "📋 Status:", value: "Aguardando os jogadores entrarem na sala.", inline: false },
                        { name: "🎮 Formato:", value: "4x4, Full UMP & XM8, Gel Normal (0x), 1 emu", inline: false }
                    )
                    .setFooter({ text: "Org Alfa - Sistema Automático" });

                const botoes = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`revelar_id_${idSala}`).setLabel("Copiar ID").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`revelar_senha_${senhaSala}`).setLabel("Copiar Senha").setStyle(ButtonStyle.Secondary)
                );

                return message.channel.send({ content: `🔔 ${jogadores || "@jogadores"}`, embeds: [embedCard], components: [botoes] });
            }
        }
    }
  }
});

// ==========================================
// 🎛️ PROCESSAMENTO DE INTERAÇÕES E BOTÕES
// ==========================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.guild) return;
  const { customId, user, channel } = interaction;

  // Lógica da Fila de Mediadores (Print 45755_2.png)
  if (interaction.isButton() && customId === "fila_entrar") {
    if (db.cargoId && !interaction.member.roles.cache.has(db.cargoId) && !interaction.member.permissions.has("Administrator")) {
        return interaction.reply({ content: "❌ Apenas mediadores autorizados podem entrar na fila.", ephemeral: true });
    }
    if (!db.mediadores[user.id]) {
        return interaction.reply({ content: "❌ Cadastre seu PIX antes de entrar na fila de atendimento!", ephemeral: true });
    }
    if (db.filaMediadores.includes(user.id)) {
        return interaction.reply({ content: "⚠️ Você já está posicionado na fila!", ephemeral: true });
    }

    db.filaMediadores.push(user.id);
    saveDB();
    await interaction.update({ embeds: [gerarEmbedFila()] });
    return;
  }

  if (interaction.isButton() && customId === "fila_sair") {
    db.filaMediadores = db.filaMediadores.filter(id => id !== user.id);
    saveDB();
    await interaction.update({ embeds: [gerarEmbedFila()] });
    return;
  }

  if (interaction.isButton() && customId === "fila_ajuda") {
    return interaction.reply({ content: "ℹ️ **Como funciona a fila:**\nEntre na fila quando estiver disponível para mediar. Quando um cliente abrir um ticket, o bot usará o PIX do primeiro da fila automaticamente e jogará esse mediador para o final dela.", ephemeral: true });
  }

  // Cadastro PIX via Modals
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
    return interaction.reply({ content: "✅ **Seu PIX foi configurado e salvo com sucesso!**", ephemeral: true });
  }

  if (interaction.isButton() && customId === "med_verificar") {
    const u = db.mediadores[user.id];
    if (!u) return interaction.reply({ content: "❌ Você não possui PIX cadastrado.", ephemeral: true });
    return interaction.reply({ content: `📋 **Seus Dados PIX:**\n**Titular:** ${u.nome}\n**Banco:** ${u.banco}\n**Chave:** \`${u.chave}\``, ephemeral: true });
  }

  // Cliente abre Ticket de Compra
  if (interaction.isButton() && customId === "player_abrir_ticket") {
    await interaction.deferReply({ ephemeral: true });
    
    if (db.filaMediadores.length === 0) {
        return interaction.editReply({ content: "❌ Não há nenhum mediador na fila de plantão no momento. Tente novamente mais tarde!" });
    }

    try {
        // Cria Tópico Totalmente Oculto/Privado (type: 12)
        const topicoPrivado = await channel.threads.create({ name: `🛒-vaga-${user.username}`, autoArchiveDuration: 60, type: 12 });
        await topicoPrivado.members.add(user.id);

        // Pega o primeiro mediador da Fila Atual (Roda a Fila)
        const proximoMediadorId = db.filaMediadores.shift(); 
        db.filaMediadores.push(proximoMediadorId); // Move para o fim da fila
        saveDB();

        // Atualiza visualmente o painel da fila no canal de controle
        const canalMensagens = await interaction.channel.messages.fetch();
        const painelFilaMsg = canalMensagens.find(m => m.embeds[0]?.title === "Fila de Mediadores");
        if (painelFilaMsg) {
            await painelFilaMsg.edit({ embeds: [gerarEmbedFila()] });
        }

        const dadosMed = db.mediadores[proximoMediadorId];
        await topicoPrivado.members.add(proximoMediadorId).catch(() => {});

        const opcoesMenu = Object.keys(db.valores).map(cat => ({
            label: `Diário ${cat} (${db.valores[cat]})`,
            value: `lancar_${user.id}_${cat}_${proximoMediadorId}`
        }));

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId("menu_selecao_diario").setPlaceholder("Mediador: Selecione a modalidade da compra...").addOptions(opcoesMenu)
        );

        const embedEspera = new EmbedBuilder()
            .setTitle("💳 PAGAMENTO DIÁRIO ALFA")
            .setDescription(`Atendimento iniciado!\n\n**Mediador Responsável:** <@${proximoMediadorId}>\n**Cliente:** ${user}\n\n*Aguardando o mediador selecionar a modalidade no menu abaixo...*`)
            .setColor("#2b2d31");

        await topicoPrivado.send({ content: `<@${proximoMediadorId}> | ${user}`, embeds: [embedEspera], components: [menu] });
        return interaction.editReply({ content: `✅ Seu ticket privado de compras foi gerado: ${topicoPrivado}` });
    } catch (e) { return interaction.editReply({ content: "❌ Falha crítica ao abrir tópico privado." }); }
  }

  // Seleção de Modalidade pelo Mediador da rodada
  if (interaction.isStringSelectMenu() && customId === "menu_selecao_diario") {
    const [action, compradorId, categoria, medId] = interaction.values[0].split("_");
    if (interaction.user.id !== medId) return interaction.reply({ content: "❌ Apenas o mediador escalado para este ticket pode mexer aqui.", ephemeral: true });

    await interaction.deferUpdate();
    const dadosMed = db.mediadores[medId];

    const embedPixFinal = new EmbedBuilder()
        .setTitle(`💳 PAGAMENTO DIÁRIO — ${categoria}`)
        .setDescription(`<@${compradorId}>, efetue o pagamento de **${db.valores[categoria]}** para garantir sua vaga no chaveamento.`)
        .addFields({ name: "👑 Chave PIX do Mediador", value: `\`${dadosMed.chave}\` (${dadosMed.banco} - ${dadosMed.nome})` })
        .setColor("#cca43b");

    const botoesFinais = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`slot_confirmar_${compradorId}_${categoria}`).setLabel("Confirmar Vaga e Chaveamento").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("slot_cancelar").setLabel("Fechar Ticket").setStyle(ButtonStyle.Danger)
    );

    return interaction.editReply({ content: `<@${compradorId}>`, embeds: [embedPixFinal], components: [botoesFinais] });
  }

  // Confirmação de Vaga
  if (interaction.isButton() && customId.startsWith("slot_confirmar_")) {
    await interaction.deferReply();
    const [, , compradorId, categoria] = customId.split("_");

    if (!db.torneios[categoria]) {
        db.torneios[categoria] = { jogadoresInscritos: [], partidasAtivas: [], vencedoresRodada: [], rodadaAtual: 1 };
    }

    const t = db.torneios[categoria];
    if (t.jogadoresInscritos.includes(compradorId)) {
        return interaction.editReply({ content: "⚠️ Esse jogador já está registrado na lista." });
    }

    t.jogadoresInscritos.push(compradorId);
    saveDB();

    const canalAlvoId = db.canaisIdSenha[categoria];
    const canalDestino = interaction.guild.channels.cache.get(canalAlvoId);

    await interaction.editReply({ content: `✅ Vaga confirmada com sucesso! (${t.jogadoresInscritos.length}/8 Jogadores).` });
    setTimeout(() => channel.delete().catch(() => {}), 3000);

    if (t.jogadoresInscritos.length === 8) {
        if (canalDestino) {
            await canalDestino.send(`🔥 **Chaveamento Completo (8/8)!** Gerando as salas privadas de ID/Senha do Diário **${categoria}**...`);
            await iniciarNovaRodada(canalDestino, categoria, t.jogadoresInscritos, t);
        }
    }
  }

  if (interaction.isButton() && customId === "slot_cancelar") {
    await interaction.reply({ content: "🔒 Encerrando atendimento..." });
    return setTimeout(() => channel.delete().catch(() => {}), 2000);
  }

  // ==========================================
  // 🔍 REVELAÇÃO EFÊMERA DE ID E SENHA (PRINT 45612_2.jpg)
  // ==========================================
  if (interaction.isButton() && customId.startsWith("revelar_id_")) {
    const idPuro = customId.split("_")[2];
    return interaction.reply({ content: `${idPuro}`, ephemeral: true });
  }

  if (interaction.isButton() && customId.startsWith("revelar_senha_")) {
    const senhaPura = customId.split("_")[2];
    return interaction.reply({ content: `${senhaPura}`, ephemeral: true });
  }
});

// ==========================================
// 🛠️ FUNÇÕES DE SUPORTE E CONTROLE AUXILIAR
// ==========================================
function gerarEmbedFila() {
    let listaMembros = "A fila está vazia no momento.";
    if (db.filaMediadores.length > 0) {
        listaMembros = db.filaMediadores.map((id, index) => `${index + 1}. <@${id}>`).join("\n");
    }
    return new EmbedBuilder()
        .setTitle("Fila de Mediadores")
        .setDescription(listaMembros)
        .setColor("#cca43b");
}

async function iniciarNovaRodada(canalPai, categoria, listaJogadores, torneio) {
    if (torneio.rodadaAtual === 1) {
        listaJogadores.sort(() => Math.random() - 0.5);
    }

    torneio.partidasAtivas = [];
    torneio.vencedoresRodada = [];
    saveDB();

    let countPartida = 1;
    for (let i = 0; i < listaJogadores.length; i += 2) {
        const j1 = listaJogadores[i];
        const j2 = listaJogadores[i + 1];
        if (!j1 || !j2) break;

        // Cria Tópico Invisível (Type 12)
        const threadPartida = await canalPai.threads.create({
            name: `🔒-partida-${countPartida}-rodada-${torneio.rodadaAtual}`,
            autoArchiveDuration: 60,
            type: 12 
        });

        await threadPartida.members.add(j1).catch(() => {});
        await threadPartida.members.add(j2).catch(() => {});

        const embedConfronto = new EmbedBuilder()
            .setTitle(`⚔️ CONFRONTO PRIVADO — RODADA ${torneio.rodadaAtual}`)
            .setDescription(`**Partida:** <@${j1}> **X** <@${j2}>\n\nAguardando o Mediador enviar o ID e a Senha da sala.\n\n*Instruções Staff: Envie apenas os números ou use !win / !lose.*`)
            .setColor("#e74c3c");

        await threadPartida.send({ content: `<@${j1}> vs <@${j2}>`, embeds: [embedConfronto] });
        torneio.partidasAtivas.push(threadPartida.id);
        countPartida++;
    }
    saveDB();
}

async function verificarAvancoRodada(canalPai, categoria, torneio) {
    let necessarios = torneio.rodadaAtual === 1 ? 4 : torneio.rodadaAtual === 2 ? 2 : 1;

    if (torneio.vencedoresRodada.length >= necessarios) {
        if (torneio.rodadaAtual === 3) {
            const campeao = torneio.vencedoresRodada[0];
            await canalPai.send(`🏆🎉 **FIM DO DIÁRIO!** O jogador <@${campeao}> é o grande campeão da categoria **${categoria}**!`);
            await apagarTopicosAntigos(canalPai, torneio.partidasAtivas);
            delete db.torneios[categoria];
            saveDB();
            return;
        }

        await canalPai.send(`📢 **Rodada ${torneio.rodadaAtual} finalizada.** Avançando e montando novas chaves...`);
        await apagarTopicosAntigos(canalPai, torneio.partidasAtivas);

        torneio.rodadaAtual += 1;
        const proximos = [...torneio.vencedoresRodada];
        await iniciarNovaRodada(canalPai, categoria, proximos, torneio);
    }
}

async function apagarTopicosAntigos(canalPai, idsTopicos) {
    for (const id of idsTopicos) {
        const thread = canalPai.threads.cache.get(id);
        if (thread) await thread.delete().catch(() => {});
    }
}

client.login(process.env.DISCORD_TOKEN);

