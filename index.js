// Carrega as variáveis de ambiente em segurança
require('dotenv').config();

const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

// --- BANCO DE DADOS LOCAL (JSON) ---
const DB_FILE = './database.json';
let db = {
    config: {},
    fila: [],
    diarios: {}, 
    vagas_compradas: {}, 
    blacklist: {},
    coins: {},
    ss_atendimentos: {} 
};

if (fs.existsSync(DB_FILE)) {
    try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); } catch (e) { console.log("DB Novo criado."); }
}
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 4)); }

// --- COOLDOWN DIVU ---
const divuCooldown = new Set();

client.once('ready', async () => {
    console.log(`🚀 Zyphor Diário operacional como ${client.user.tag}`);
    
    // Registrar Comandos Slash de Configuração
    const guildId = client.guilds.cache.first()?.id;
    if (guildId) {
        const guild = client.guilds.cache.get(guildId);
        await guild.commands.set([
            {
                name: 'configurar',
                description: 'Configura os canais do ecossistema Zyphor',
                options: [
                    { name: 'salas', description: 'Canal de criação de salas privadas', type: 7, required: true },
                    { name: 'logs', description: 'Canal de logs gerais', type: 7, required: true },
                    { name: 'ssmob', description: 'Canal de chamado SS Mobile', type: 7, required: true },
                    { name: 'ssemu', description: 'Canal de chamado SS Emulador', type: 7, required: true },
                    { name: 'staff_ss', description: 'Cargo permitido para gerenciar SS/Blacklist', type: 8, required: true }
                ]
            },
            {
                name: 'pix',
                description: 'Configura os dados de pagamento do diário',
                options: [
                    { name: 'nome', description: 'Nome do titular', type: 3, required: true },
                    { name: 'banco', description: 'Nome do Banco', type: 3, required: true },
                    { name: 'chave', description: 'Chave PIX', type: 3, required: true },
                    { name: 'mensagem', description: 'Instruções adicionais', type: 3, required: true },
                    { name: 'imagem', description: 'URL de um QR Code ou Banner (Opcional)', type: 3, required: false }
                ]
            }
        ]);
    }
});

// --- INTERAÇÕES (SLASH COMMANDS & BOTÕES) ---
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName, options, guild, member } = interaction;

        if (commandName === 'configurar') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Apenas Administradores podem usar este comando.', ephemeral: true });
            }
            db.config.salas = options.getChannel('salas').id;
            db.config.logs = options.getChannel('logs').id;
            db.config.ssmob = options.getChannel('ssmob').id;
            db.config.ssemu = options.getChannel('ssemu').id;
            db.config.cargo_ss = options.getRole('staff_ss').id;
            saveDB();

            return interaction.reply({ content: '✅ **Configuração Zyphor atualizada com sucesso!**', ephemeral: true });
        }

        if (commandName === 'pix') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
            }
            db.config.pix = {
                nome: options.getString('nome'),
                banco: options.getString('banco'),
                chave: options.getString('chave'),
                msg: options.getString('mensagem'),
                img: options.getString('imagem') || null
            };
            saveDB();
            return interaction.reply({ content: '✅ **Dados de faturamento PIX salvos!**', ephemeral: true });
        }
    }

    if (interaction.isButton()) {
        const [action, arg1, arg2] = interaction.customId.split('_');
        const { guild, user, channel } = interaction;

        if (action === 'comprarvaga') {
            if (db.blacklist[user.id]) {
                return interaction.reply({ content: '❌ Você está banido da lista negra (Blacklist) do Zyphor.', ephemeral: true });
            }

            const thread = await channel.threads.create({
                name: `🛒-vaga-${user.username}`,
                autoArchiveDuration: 60,
                type: ChannelType.PrivateThread,
                reason: 'Compra de vaga diário'
            });

            await thread.members.add(user.id);

            const pix = db.config.pix;
            if (!pix) {
                return interaction.reply({ content: '❌ O PIX não foi configurado pela administração.', ephemeral: true });
            }

            const embedPix = new EmbedBuilder()
                .setTitle('💳 Pagamento da Vaga - Zyphor')
                .setDescription(`${pix.msg}\n\n**Banco:** ${pix.banco}\n**Nome:** ${pix.nome}\n**Chave PIX:** \`${pix.chave}\``)
                .setColor('#2f3136');
            if (pix.img) embedPix.setImage(pix.img);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`aprovarvaga_${user.id}`).setLabel('Aprovar Comprovante (ADM)').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`recusarvaga_${user.id}`).setLabel('Recusar').setStyle(ButtonStyle.Danger)
            );

            await thread.send({ content: `Olá ${user}, envie o comprovante neste chat para análise da Staff.`, embeds: [embedPix], components: [row] });
            return interaction.reply({ content: `🛒 Thread de compra criada: ${thread}`, ephemeral: true });
        }

        if (action === 'aprovarvaga') {
            const playerID = arg1;
            db.vagas_compradas[playerID] = { aprovado: true, horario: null };
            saveDB();

            await interaction.reply({ content: `✅ Vaga aprovada para <@${playerID}>! Escolha o horário usando os comandos de confirmação (Ex: \`!14h\` ou \`!00h\`).` });
            
            sendLog(guild, '📥 Vaga Aprovada', `Staff: ${user}\nJogador: <@${playerID}>\nStatus: Aguardando Escolha de Horário`);
            try { channel.setArchived(true); } catch(e){}
        }

        if (action === 'recusarvaga') {
            const playerID = arg1;
            await interaction.reply({ content: `❌ Compra recusada para <@${playerID}>.` });
            try { channel.setArchived(true); } catch(e){}
        }

        if (action === 'versala') {
            const horario = arg1;
            const sala = db.diarios[horario]?.sala;
            if (!sala) return interaction.reply({ content: 'Dados da sala indisponíveis.', ephemeral: true });

            const rowCopy = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`copyid_${horario}`).setLabel('Copiar ID').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`copypass_${horario}`).setLabel('Copiar Senha').setStyle(ButtonStyle.Secondary)
            );

            return interaction.reply({
                content: `🔑 **Dados de Acesso (Privado):**\n**ID:** \`${sala.id}\`\n**Senha:** \`${sala.senha}\``,
                components: [rowCopy],
                ephemeral: true
            });
        }

        if (action === 'copyid' || action === 'copypass') {
            const horario = arg1;
            const sala = db.diarios[horario]?.sala;
            if (!sala) return interaction.reply({ content: 'Erro ao buscar dados.', ephemeral: true });
            const text = action === 'copyid' ? sala.id : sala.senha;
            return interaction.reply({ content: `${text}`, ephemeral: true });
        }

        if (action === 'assumirss') {
            if (!interaction.member.roles.cache.has(db.config.cargo_ss)) {
                return interaction.reply({ content: '❌ Apenas Staff SS pode assumir!', ephemeral: true });
            }

            const staffId = user.id;
            const atual = db.ss_atendimentos[staffId] || 0;
            if (atual >= 2) {
                return interaction.reply({ content: '❌ Você já possui 2 atendimentos SS simultâneos em andamento.', ephemeral: true });
            }

            db.ss_atendimentos[staffId] = atual + 1;
            saveDB();

            const embedUpdate = EmbedBuilder.from(interaction.message.embeds[0])
                .addFields({ name: '⚡ Staff Responsável', value: `${user.username}`, inline: true })
                .setColor('#e67e22');

            await interaction.update({ 
                content: `**🚨 SS ASSUMIDA POR ${user}**\n*Regra de 20 minutos ativa. O jogador deve responder imediatamente.*`, 
                embeds: [embedUpdate], 
                components: [] 
            });

            sendLog(guild, '🔎 SS Em Andamento', `Staff: ${user}\nCanal: ${channel}\nHorário de início: <t:${Math.floor(Date.now()/1000)}:R>`);

            setTimeout(async () => {
                db.ss_atendimentos[staffId] = Math.max(0, (db.ss_atendimentos[staffId] || 1) - 1);
                saveDB();
                try {
                    await channel.send(`⚠️ **Tempo Limite Excedido (20 Minutos):** Caso o jogador não tenha comparecido, proceda com a análise de infração e use !exposed caso necessário.`);
                } catch(e){}
            }, 20 * 60 * 1000);
        }
    }
});

// --- COMANDOS DE MENSAGEM (PREFIXO !) ---
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'fila') {
        if (args[0] === 'entrar') {
            if (db.fila.includes(message.author.id)) return message.reply('Você já está na fila!');
            db.fila.push(message.author.id);
            saveDB();
            return message.reply(`📥 Adicionado à fila! Posição: **${db.fila.length}**`);
        }
        if (args[0] === 'proximo') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('Sem permissão.');
            if (db.fila.length === 0) return message.reply('Fila de organizadores vazia.');
            const org = db.fila.shift();
            saveDB();
            return message.reply(`👑 Próximo organizador da vez: <@${org}>! Assuma o próximo diário.`);
        }
        return message.reply(`📋 **Fila Atual:**\n${db.fila.map((id, index) => `${index + 1}° - <@${id}>`).join('\n') || 'Fila vazia. Use \`!fila entrar\`'}`);
    }

    if (command === 'divu') {
        if (divuCooldown.has(message.guild.id)) {
            return message.reply('⏳ Aguarde o Cooldown da divulgação ativa expirar.');
        }

        const modalidade = args[0] || '#Diário';
        divuCooldown.add(message.guild.id);

        message.channel.send(`📢 **DIÁRIO ZYPHOR COMPETITIVO EM ALTA [${modalidade}]**\n🔥 Vagas Abertas! Garanta seu slot via painel de compras.`);
        setTimeout(() => {
            message.channel.send(`🚀 **ÚLTIMAS VAGAS DISPONÍVEIS!** Use o sistema para garantir o PIX e a vaga automática.`);
        }, 2000);

        setTimeout(() => { divuCooldown.delete(message.guild.id); }, 5 * 60 * 1000);
        return;
    }

    if (command === 'painelcompra') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const embed = new EmbedBuilder()
            .setTitle('🏆 Inscrições - Diário Zyphor')
            .setDescription('Clique no botão abaixo para iniciar o processo de compra da sua vaga e envio do comprovante.')
            .setColor('#00ff00');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('comprarvaga').setLabel('🛒 Comprar Vaga').setStyle(ButtonStyle.Primary)
        );
        return message.channel.send({ embeds: [embed], components: [row] });
    }

    if (command.match(/^!\d{2}h$/)) {
        const horario = command.replace('!', '');
        const userId = message.author.id;

        if (!db.vagas_compradas[userId] || !db.vagas_compradas[userId].aprovado) {
            return message.reply('❌ Você precisa ter um pagamento aprovado pela administração antes de escolher horário.');
        }

        if (!db.diarios[horario]) {
            db.diarios[horario] = { jogadores: [], status: 'registro', sala: null };
        }

        if (db.diarios[horario].jogadores.length >= 8) {
            return message.reply(`❌ O diário de **${horario}** já atingiu o limite máximo de 8 vagas.`);
        }

        if (db.diarios[horario].jogadores.includes(userId)) {
            return message.reply('Você já está alocado neste horário.');
        }

        db.diarios[horario].jogadores.push(userId);
        delete db.vagas_compradas[userId]; 
        saveDB();

        message.reply(`✅ **Confirmado!** Você foi alocado no diário das **${horario}** [Slot ${db.diarios[horario].jogadores.length}/8]`);

        if (db.diarios[horario].jogadores.length === 8) {
            message.channel.send(`🔥 **Diário das ${horario} LOTADO!** Digite \`!iniciar ${horario}\` para criar as chaves.`);
        }
        return;
    }

    if (command === 'iniciar') {
        const horario = args[0];
        if (!horario || !db.diarios[horario]) return message.reply('Informe um horário ativo válido.');
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

        const salaCanalId = db.config.salas;
        if (!salaCanalId) return message.reply('Configure as salas primeiro via `/configurar`.');
        const canalSalas = message.guild.channels.cache.get(salaCanalId);

        const j = db.diarios[horario].jogadores;
        let partidaIndex = 1;
        for (let i = 0; i < j.length; i += 2) {
            if (!j[i+1]) break; 

            const p1 = j[i];
            const p2 = j[i+1];

            const threadPartida = await canalSalas.threads.create({
                name: `⚔️-${horario}-partida-${partidaIndex}`,
                autoArchiveDuration: 60,
                type: ChannelType.PrivateThread
            });

            await threadPartida.members.add(p1);
            await threadPartida.members.add(p2);

            const embedMódulo = new EmbedBuilder()
                .setTitle(`⚔️ Confronto Direto - Diário [${horario}]`)
                .setDescription(`**Jogador 1:** <@${p1}>\n**Jogador 2:** <@${p2}>\n\nAguardem o administrador enviar os dados de ID e senha da sala através do comando \`!sala\`.`)
                .setColor('#e74c3c');

            await threadPartida.send({ content: `<@${p1}> vs <@${p2}> | Staff Responsável: ${message.author}`, embeds: [embedMódulo] });
            partidaIndex++;
        }

        db.diarios[horario].status = 'jogando';
        saveDB();
        return message.reply(`🚀 Partidas do horário **${horario}** criadas e iniciadas com sucesso.`);
    }

    if (command === 'sala') {
        if (!message.channel.isThread()) return message.reply('Este comando deve ser executado dentro do tópico da partida.');
        const idSala = args[0];
        const senhaSala = args[1];

        if (!idSala || !senhaSala) return message.reply('Formato incorreto. Use: \`!sala <id> <senha>\`');

        const dectectHorario = message.channel.name.split('-')[1] || 'default';
        if (!db.diarios[dectectHorario]) db.diarios[dectectHorario] = {};
        db.diarios[dectectHorario].sala = { id: idSala, senha: senhaSala };
        saveDB();

        const embedProtegida = new EmbedBuilder()
            .setTitle('🔑 Sala Gerada com Sucesso!')
            .setDescription('Os dados de conexão foram protegidos por medidas de segurança. Clique no botão abaixo para visualizar seus dados de acesso individuais de forma segura.')
            .setColor('#3498db');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`versala_${dectectHorario}`).setLabel('👁️ Revelar ID e Senha').setStyle(ButtonStyle.Success)
        );

        await message.channel.send({ embeds: [embedProtegida], components: [row] });
        return message.delete().catch(() => {});
    }

    if (command === 'win' || command === 'lose' || command === 'sw') {
        const target = message.mentions.users.first() || message.author;
        
        if (command === 'win') {
            addCoin(target.id, 1);
            return message.reply(`🏆 Vitória computada para ${target}! (+1 Coin adicionado).`);
        }
        if (command === 'sw') {
            addCoin(target.id, 5);
            sendLog(message.guild, '👑 Campeão do Diário', `O jogador ${target} sagrou-se campeão Supremo (SW) e recebeu +5 Coins de bônus!`);
            return message.reply(`🎉 **SUPREMO WINNER!** ${target} destruiu tudo e faturou a premiação máxima com bônus maior!`);
        }
        if (command === 'lose') {
            return message.reply(`📉 Derrota registrada para ${target}. Mais sorte na próxima rodada competitiva.`);
        }
    }

    if (command === 'ss') {
        const sub = args[0];
        const alvo = message.mentions.members.first();

        if (!sub || !alvo) return message.reply('Formato incorreto. Use: \`!ss mob @user\` ou \`!ss emu @user\`');

        const tipoCanal = sub === 'mob' ? db.config.ssmob : db.config.ssemu;
        if (!tipoCanal) return message.reply('Canal de SS não configurado pelo administrador.');

        const canalDestino = message.guild.channels.cache.get(tipoCanal);
        
        const embedSS = new EmbedBuilder()
            .setTitle(`🔍 Rastreamento SS solicitado [${sub.toUpperCase()}]`)
            .setDescription(`**Suspeito:** ${alvo}\n**Solicitado por:** ${message.author}\n**Status:** 🟥 Aguardando Staff assumir`)
            .setTimestamp()
            .setColor('#f1c40f');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`assumirss_${alvo.id}`).setLabel('⚡ Assumir Caso').setStyle(ButtonStyle.Primary)
        );

        await canalDestino.send({ content: `<@&${db.config.cargo_ss || ''}>`, embeds: [embedSS], components: [row] });
        return message.reply(`🚨 Alerta de SS encaminhado diretamente ao setor de auditoria em ${canalDestino}.`);
    }

    if (command === 'blacklist') {
        if (!message.member.roles.cache.has(db.config.cargo_ss)) return message.reply('Apenas moderadores SS gerenciam a Blacklist.');
        const acao = args[0];
        const alvo = message.mentions.users.first() || { id: args[1] };

        if (!alvo.id) return message.reply('Especifique o usuário.');

        if (acao === 'add') {
            db.blacklist[alvo.id] = true;
            saveDB();
            sendLog(message.guild, '🚫 Usuário Banido (Blacklist)', `O jogador <@${alvo.id}> foi permanentemente banido de participar de qualquer diário competitivo.`);
            return message.reply(`🚫 <@${alvo.id}> foi inserido com sucesso no bloqueio global do sistema.`);
        }
        if (acao === 'remove') {
            delete db.blacklist[alvo.id];
            saveDB();
            return message.reply(`✅ <@${alvo.id}> removido da lista de restrições.`);
        }
    }

    if (command === 'exposed') {
        if (!message.member.roles.cache.has(db.config.cargo_ss)) return;
        const alvo = message.mentions.users.first();
        const motivo = args.slice(1).join(' ');

        if (!alvo || !motivo) return message.reply('Use: \`!exposed @user <motivo e links de provas>\`');

        const embedExposed = new EmbedBuilder()
            .setTitle('🚨 EXPOSED REGISTRADO - BANCO DE DADOS DE INFRAÇÕES')
            .setDescription(`**Infrator:** ${alvo}\n**Motivo/Provas:** ${motivo}\n\n*Este registro foi sincronizado no histórico permanente da guilda.*`)
            .setColor('#95a5a6')
            .setThumbnail(alvo.displayAvatarURL());

        sendLog(message.guild, '📸 Histórico de Exposed', `Infrator: ${alvo}\nEvidências anexadas: ${motivo}`);
        return message.channel.send({ embeds: [embedExposed] });
    }

    if (command === 'coin' || command === 'coins') {
        const sub = args[0];
        
        if (sub === 'ranking') {
            const sorted = Object.entries(db.coins).sort((a,b) => b[1] - a[1]).slice(0, 10);
            const rankingStr = sorted.map((entry, idx) => `**${idx+1}°** <@${entry[0]}> - \`${entry[1]} Zyphor Coins\``).join('\n');
            const embedRank = new EmbedBuilder()
                .setTitle('🏆 LEADERBOARD - ZYPHOR COINS')
                .setDescription(rankingStr || 'Nenhum dado computado ainda.')
                .setColor('#f39c12');
            return message.channel.send({ embeds: [embedRank] });
        }

        const alvo = message.mentions.users.first() || message.author;
        const balance = db.coins[alvo.id] || 0;

        const embedPerfil = new EmbedBuilder()
            .setTitle(`Perfil Competitivo de ${alvo.username}`)
            .setDescription(`🪙 **Saldo Atual:** \`${balance} Zyphor Coins\``)
            .setThumbnail(alvo.displayAvatarURL())
            .setColor('#3498db');
        return message.channel.send({ embeds: [embedPerfil] });
    }
});

function addCoin(userId, qtd) {
    if (!db.coins[userId]) db.coins[userId] = 0;
    db.coins[userId] += qtd;
    saveDB();
}

function sendLog(guild, titulo, txt) {
    const logId = db.config.logs;
    if (!logId) return;
    const canalLog = guild.channels.cache.get(logId);
    if (!canalLog) return;

    const embedLog = new EmbedBuilder()
        .setTitle(titulo)
        .setDescription(txt)
        .setTimestamp()
        .setColor('#1abc9c');
    canalLog.send({ embeds: [embedLog] });
}

// Vincula a inicialização com a variável oculta da ShardCloud
client.login(process.env.DISCORD_TOKEN);
