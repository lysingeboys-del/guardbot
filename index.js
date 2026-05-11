require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

// Data storage
const warnings = {};
const badWords = ['badword1', 'badword2', 'scam'];
const notes = {};
const afkUsers = {};
const slowmodeChannels = {};
const tickets = {};

// Helper: is mod
const isMod = (member) => member.permissions.has(PermissionFlagsBits.ModerateMembers);
const isAdmin = (member) => member.permissions.has(PermissionFlagsBits.Administrator);

client.once('clientReady', () => {
  console.log(`✅ GuardBot is online as ${client.user.tag}`);
  client.user.setActivity('🛡️ Protecting the server', { type: 3 });
});

// Auto mod
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const content = message.content.toLowerCase();

  // AFK check
  if (afkUsers[message.author.id]) {
    delete afkUsers[message.author.id];
    message.reply(`👋 Welcome back ${message.author}! I removed your AFK status.`);
  }

  // Mention AFK user
  message.mentions.users.forEach(user => {
    if (afkUsers[user.id]) {
      message.reply(`💤 **${user.username}** is AFK: ${afkUsers[user.id]}`);
    }
  });

  // Bad word filter
  if (badWords.some(word => content.includes(word))) {
    await message.delete();
    return message.channel.send(`⚠️ ${message.author}, watch your language!`);
  }

  // Spam detection
  if ((content.match(/!/g) || []).length > 5) {
    await message.delete();
    return message.channel.send(`⚠️ ${message.author}, no spamming!`);
  }

  if (!content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ==================== MODERATION ====================

  // !warn
  if (command === 'warn') {
    if (!isMod(message.member)) return message.reply('❌ No permission!');
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mention a user!');
    const reason = args.slice(1).join(' ') || 'No reason';
    if (!warnings[target.id]) warnings[target.id] = [];
    warnings[target.id].push({ reason, date: new Date() });
    const embed = new EmbedBuilder().setColor('#ff9900').setTitle('⚠️ Warning Issued')
      .addFields({ name: 'User', value: target.user.tag, inline: true }, { name: 'Reason', value: reason, inline: true }, { name: 'Total Warnings', value: `${warnings[target.id].length}`, inline: true }).setTimestamp();
    return message.channel.send({ embeds: [embed] });
  }

  // !kick
  if (command === 'kick') {
    if (!isMod(message.member)) return message.reply('❌ No permission!');
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mention a user!');
    const reason = args.slice(1).join(' ') || 'No reason';
    await target.kick(reason);
    const embed = new EmbedBuilder().setColor('#ff0000').setTitle('👢 User Kicked')
      .addFields({ name: 'User', value: target.user.tag, inline: true }, { name: 'Reason', value: reason, inline: true }).setTimestamp();
    return message.channel.send({ embeds: [embed] });
  }

  // !ban
  if (command === 'ban') {
    if (!isMod(message.member)) return message.reply('❌ No permission!');
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mention a user!');
    const reason = args.slice(1).join(' ') || 'No reason';
    await target.ban({ reason });
    const embed = new EmbedBuilder().setColor('#ff0000').setTitle('🔨 User Banned')
      .addFields({ name: 'User', value: target.user.tag, inline: true }, { name: 'Reason', value: reason, inline: true }).setTimestamp();
    return message.channel.send({ embeds: [embed] });
  }

  // !unban
  if (command === 'unban') {
    if (!isAdmin(message.member)) return message.reply('❌ No permission!');
    const userId = args[0];
    if (!userId) return message.reply('❌ Provide a user ID!');
    await message.guild.members.unban(userId);
    return message.reply(`✅ User \`${userId}\` has been unbanned!`);
  }

  // !mute
  if (command === 'mute') {
    if (!isMod(message.member)) return message.reply('❌ No permission!');
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mention a user!');
    const duration = parseInt(args[1]) || 10;
    await target.timeout(duration * 60 * 1000, 'Muted by moderator');
    return message.reply(`🔇 ${target.user.tag} muted for ${duration} minutes!`);
  }

  // !unmute
  if (command === 'unmute') {
    if (!isMod(message.member)) return message.reply('❌ No permission!');
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mention a user!');
    await target.timeout(null);
    return message.reply(`🔊 ${target.user.tag} has been unmuted!`);
  }

  // !warnings
  if (command === 'warnings') {
    const target = message.mentions.members.first() || message.member;
    const userWarnings = warnings[target.id] || [];
    const embed = new EmbedBuilder().setColor('#ff9900').setTitle(`⚠️ Warnings for ${target.user.tag}`)
      .setDescription(userWarnings.length === 0 ? 'No warnings!' : userWarnings.map((w, i) => `${i + 1}. ${w.reason}`).join('\n')).setTimestamp();
    return message.channel.send({ embeds: [embed] });
  }

  // !clearwarnings
  if (command === 'clearwarnings') {
    if (!isAdmin(message.member)) return message.reply('❌ No permission!');
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mention a user!');
    warnings[target.id] = [];
    return message.reply(`✅ Cleared all warnings for ${target.user.tag}!`);
  }

  // !purge
  if (command === 'purge') {
    if (!isMod(message.member)) return message.reply('❌ No permission!');
    const amount = parseInt(args[0]);
    if (!amount || amount < 1 || amount > 100) return message.reply('❌ Provide a number between 1-100!');
    await message.channel.bulkDelete(amount + 1, true);
    const msg = await message.channel.send(`🗑️ Deleted ${amount} messages!`);
    setTimeout(() => msg.delete(), 3000);
  }

  // !slowmode
  if (command === 'slowmode') {
    if (!isMod(message.member)) return message.reply('❌ No permission!');
    const seconds = parseInt(args[0]) || 0;
    await message.channel.setRateLimitPerUser(seconds);
    return message.reply(`⏱️ Slowmode set to ${seconds} seconds!`);
  }

  // !lock
  if (command === 'lock') {
    if (!isMod(message.member)) return message.reply('❌ No permission!');
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
    return message.reply('🔒 Channel locked!');
  }

  // !unlock
  if (command === 'unlock') {
    if (!isMod(message.member)) return message.reply('❌ No permission!');
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
    return message.reply('🔓 Channel unlocked!');
  }

  // !nickname
  if (command === 'nickname' || command === 'nick') {
    if (!isMod(message.member)) return message.reply('❌ No permission!');
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mention a user!');
    const newNick = args.slice(1).join(' ') || null;
    await target.setNickname(newNick);
    return message.reply(`✅ Nickname updated for ${target.user.tag}!`);
  }

  // !addrole
  if (command === 'addrole') {
    if (!isAdmin(message.member)) return message.reply('❌ No permission!');
    const target = message.mentions.members.first();
    const roleName = args.slice(1).join(' ');
    const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
    if (!role) return message.reply('❌ Role not found!');
    await target.roles.add(role);
    return message.reply(`✅ Added ${role.name} to ${target.user.tag}!`);
  }

  // !removerole
  if (command === 'removerole') {
    if (!isAdmin(message.member)) return message.reply('❌ No permission!');
    const target = message.mentions.members.first();
    const roleName = args.slice(1).join(' ');
    const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
    if (!role) return message.reply('❌ Role not found!');
    await target.roles.remove(role);
    return message.reply(`✅ Removed ${role.name} from ${target.user.tag}!`);
  }

  // ==================== INFO COMMANDS ====================

  // !userinfo
  if (command === 'userinfo') {
    const target = message.mentions.members.first() || message.member;
    const embed = new EmbedBuilder().setColor('#5865F2').setTitle(`👤 User Info: ${target.user.tag}`)
      .setThumbnail(target.user.displayAvatarURL())
      .addFields(
        { name: 'ID', value: target.id, inline: true },
        { name: 'Nickname', value: target.nickname || 'None', inline: true },
        { name: 'Joined Server', value: target.joinedAt.toDateString(), inline: true },
        { name: 'Account Created', value: target.user.createdAt.toDateString(), inline: true },
        { name: 'Roles', value: target.roles.cache.filter(r => r.name !== '@everyone').map(r => r.name).join(', ') || 'None' }
      ).setTimestamp();
    return message.channel.send({ embeds: [embed] });
  }

  // !serverinfo
  if (command === 'serverinfo') {
    const guild = message.guild;
    const embed = new EmbedBuilder().setColor('#5865F2').setTitle(`🌐 Server Info: ${guild.name}`)
      .setThumbnail(guild.iconURL())
      .addFields(
        { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'Members', value: `${guild.memberCount}`, inline: true },
        { name: 'Channels', value: `${guild.channels.cache.size}`, inline: true },
        { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
        { name: 'Created', value: guild.createdAt.toDateString(), inline: true },
        { name: 'Boost Level', value: `Level ${guild.premiumTier}`, inline: true }
      ).setTimestamp();
    return message.channel.send({ embeds: [embed] });
  }

  // !avatar
  if (command === 'avatar') {
    const target = message.mentions.users.first() || message.author;
    const embed = new EmbedBuilder().setColor('#5865F2').setTitle(`🖼️ Avatar: ${target.tag}`)
      .setImage(target.displayAvatarURL({ size: 512 }));
    return message.channel.send({ embeds: [embed] });
  }

  // !ping
  if (command === 'ping') {
    const embed = new EmbedBuilder().setColor('#00ff00').setTitle('🏓 Pong!')
      .addFields({ name: 'Bot Latency', value: `${Date.now() - message.createdTimestamp}ms`, inline: true },
        { name: 'API Latency', value: `${Math.round(client.ws.ping)}ms`, inline: true });
    return message.channel.send({ embeds: [embed] });
  }

  // !botinfo
  if (command === 'botinfo') {
    const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🤖 GuardBot Info')
      .addFields(
        { name: 'Version', value: '1.0.0', inline: true },
        { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Uptime', value: `${Math.floor(process.uptime() / 60)} minutes`, inline: true },
        { name: 'Commands', value: '50+', inline: true }
      ).setTimestamp();
    return message.channel.send({ embeds: [embed] });
  }

  // !roleinfo
  if (command === 'roleinfo') {
    const roleName = args.join(' ');
    const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
    if (!role) return message.reply('❌ Role not found!');
    const embed = new EmbedBuilder().setColor(role.hexColor).setTitle(`🎭 Role Info: ${role.name}`)
      .addFields(
        { name: 'ID', value: role.id, inline: true },
        { name: 'Color', value: role.hexColor, inline: true },
        { name: 'Members', value: `${role.members.size}`, inline: true },
        { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
        { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true }
      ).setTimestamp();
    return message.channel.send({ embeds: [embed] });
  }

  // ==================== FUN COMMANDS ====================

  // !8ball
  if (command === '8ball') {
    const responses = ['Yes!', 'No!', 'Maybe...', 'Definitely!', 'Absolutely not!', 'Ask again later', 'Without a doubt!', 'Very doubtful', 'Signs point to yes', 'My sources say no'];
    const question = args.join(' ');
    if (!question) return message.reply('❌ Ask a question!');
    const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🎱 Magic 8-Ball')
      .addFields({ name: 'Question', value: question }, { name: 'Answer', value: responses[Math.floor(Math.random() * responses.length)] });
    return message.channel.send({ embeds: [embed] });
  }

  // !coinflip
  if (command === 'coinflip') {
    return message.reply(`🪙 **${Math.random() < 0.5 ? 'Heads' : 'Tails'}!**`);
  }

  // !dice
  if (command === 'dice') {
    const sides = parseInt(args[0]) || 6;
    return message.reply(`🎲 You rolled a **${Math.floor(Math.random() * sides) + 1}** out of ${sides}!`);
  }

  // !rps
  if (command === 'rps') {
    const choices = ['rock', 'paper', 'scissors'];
    const userChoice = args[0]?.toLowerCase();
    if (!choices.includes(userChoice)) return message.reply('❌ Choose rock, paper, or scissors!');
    const botChoice = choices[Math.floor(Math.random() * 3)];
    let result = '';
    if (userChoice === botChoice) result = "It's a tie!";
    else if ((userChoice === 'rock' && botChoice === 'scissors') || (userChoice === 'paper' && botChoice === 'rock') || (userChoice === 'scissors' && botChoice === 'paper')) result = '🎉 You win!';
    else result = '🤖 Bot wins!';
    return message.reply(`You chose **${userChoice}**, I chose **${botChoice}**. ${result}`);
  }

  // !joke
  if (command === 'joke') {
    const jokes = [
      'Why don\'t scientists trust atoms? Because they make up everything!',
      'Why did the scarecrow win an award? Because he was outstanding in his field!',
      'I told my wife she was drawing her eyebrows too high. She looked surprised.',
      'What do you call a fake noodle? An impasta!',
      'Why did the math book look sad? Because it had too many problems!'
    ];
    return message.reply(`😂 ${jokes[Math.floor(Math.random() * jokes.length)]}`);
  }

  // !roast
  if (command === 'roast') {
    const target = message.mentions.users.first() || message.author;
    const roasts = [
      `${target} you're like a cloud. When you disappear, it's a beautiful day!`,
      `${target} I'd roast you, but my mom said I'm not allowed to burn trash.`,
      `${target} You're the reason they put instructions on shampoo.`,
      `${target} I'd explain it to you, but I don't have crayons with me.`,
      `${target} You're not stupid, you just have bad luck thinking.`
    ];
    return message.reply(roasts[Math.floor(Math.random() * roasts.length)]);
  }

  // !compliment
  if (command === 'compliment') {
    const target = message.mentions.users.first() || message.author;
    const compliments = [
      `${target} you light up every room you walk into! ✨`,
      `${target} is an absolute legend! 🌟`,
      `${target} is one of the most awesome people I've ever seen! 🎉`,
      `${target} has the best vibes! 💫`,
      `${target} is genuinely amazing! 🌈`
    ];
    return message.reply(compliments[Math.floor(Math.random() * compliments.length)]);
  }

  // !ship
  if (command === 'ship') {
    const user1 = message.mentions.users.first();
    const user2 = message.mentions.users.last();
    if (!user1 || user1 === user2) return message.reply('❌ Mention two different users!');
    const percent = Math.floor(Math.random() * 101);
    const bar = '█'.repeat(Math.floor(percent / 10)) + '░'.repeat(10 - Math.floor(percent / 10));
    const embed = new EmbedBuilder().setColor('#ff69b4').setTitle('💘 Ship Calculator')
      .setDescription(`**${user1.username}** + **${user2.username}**\n\n${bar} **${percent}%**`);
    return message.channel.send({ embeds: [embed] });
  }

  // !poll
  if (command === 'poll') {
    const question = args.join(' ');
    if (!question) return message.reply('❌ Provide a question!');
    const embed = new EmbedBuilder().setColor('#5865F2').setTitle('📊 Poll').setDescription(question)
      .setFooter({ text: `Poll by ${message.author.tag}` });
    const pollMsg = await message.channel.send({ embeds: [embed] });
    await pollMsg.react('👍');
    await pollMsg.react('👎');
    message.delete();
  }

  // !say
  if (command === 'say') {
    if (!isMod(message.member)) return message.reply('❌ No permission!');
    const text = args.join(' ');
    if (!text) return message.reply('❌ Provide text!');
    message.delete();
    return message.channel.send(text);
  }

  // !embed
  if (command === 'embed') {
    if (!isMod(message.member)) return message.reply('❌ No permission!');
    const text = args.join(' ');
    if (!text) return message.reply('❌ Provide text!');
    const embed = new EmbedBuilder().setColor('#5865F2').setDescription(text).setFooter({ text: `By ${message.author.tag}` });
    message.delete();
    return message.channel.send({ embeds: [embed] });
  }

  // !choose
  if (command === 'choose') {
    const options = args.join(' ').split(',').map(o => o.trim());
    if (options.length < 2) return message.reply('❌ Provide at least 2 options separated by commas!');
    const choice = options[Math.floor(Math.random() * options.length)];
    return message.reply(`🎯 I choose: **${choice}**`);
  }

  // !reverse
  if (command === 'reverse') {
    const text = args.join(' ');
    if (!text) return message.reply('❌ Provide text!');
    return message.reply(`🔄 ${text.split('').reverse().join('')}`);
  }

  // !countdown
  if (command === 'countdown') {
    const from = parseInt(args[0]) || 5;
    if (from > 10) return message.reply('❌ Max countdown is 10!');
    let count = from;
    const msg = await message.reply(`⏳ **${count}**`);
    const interval = setInterval(async () => {
      count--;
      if (count <= 0) {
        clearInterval(interval);
        return msg.edit('🎉 **BLAST OFF!**');
      }
      msg.edit(`⏳ **${count}**`);
    }, 1000);
  }

  // ==================== UTILITY COMMANDS ====================

  // !afk
  if (command === 'afk') {
    const reason = args.join(' ') || 'AFK';
    afkUsers[message.author.id] = reason;
    return message.reply(`💤 You are now AFK: **${reason}**`);
  }

  // !note
  if (command === 'note') {
    const note = args.join(' ');
    if (!note) return message.reply('❌ Provide a note!');
    if (!notes[message.author.id]) notes[message.author.id] = [];
    notes[message.author.id].push(note);
    return message.reply(`📝 Note saved! You have ${notes[message.author.id].length} note(s).`);
  }

  // !notes
  if (command === 'notes') {
    const userNotes = notes[message.author.id] || [];
    if (userNotes.length === 0) return message.reply('📝 You have no notes!');
    const embed = new EmbedBuilder().setColor('#5865F2').setTitle('📝 Your Notes')
      .setDescription(userNotes.map((n, i) => `${i + 1}. ${n}`).join('\n'));
    return message.channel.send({ embeds: [embed] });
  }

  // !clearnotes
  if (command === 'clearnotes') {
    notes[message.author.id] = [];
    return message.reply('🗑️ All your notes have been cleared!');
  }

  // !remindme
  if (command === 'remindme') {
    const minutes = parseInt(args[0]);
    const reminder = args.slice(1).join(' ');
    if (!minutes || !reminder) return message.reply('❌ Usage: !remindme [minutes] [reminder]');
    message.reply(`⏰ I'll remind you about "${reminder}" in ${minutes} minute(s)!`);
    setTimeout(() => {
      message.author.send(`⏰ Reminder: **${reminder}**`).catch(() => {
        message.channel.send(`⏰ ${message.author} Reminder: **${reminder}**`);
      });
    }, minutes * 60 * 1000);
  }

  // !calculate
  if (command === 'calculate' || command === 'calc') {
    const expr = args.join(' ');
    if (!expr) return message.reply('❌ Provide an expression!');
    try {
      const result = eval(expr.replace(/[^0-9+\-*/().% ]/g, ''));
      return message.reply(`🧮 **${expr} = ${result}**`);
    } catch {
      return message.reply('❌ Invalid expression!');
    }
  }

  // !uppercase
  if (command === 'uppercase') {
    return message.reply(args.join(' ').toUpperCase());
  }

  // !lowercase
  if (command === 'lowercase') {
    return message.reply(args.join(' ').toLowerCase());
  }

  // !wordcount
  if (command === 'wordcount') {
    const text = args.join(' ');
    return message.reply(`📊 **${text.split(' ').length}** words, **${text.length}** characters`);
  }

  // !membercount
  if (command === 'membercount') {
    return message.reply(`👥 This server has **${message.guild.memberCount}** members!`);
  }

  // !channelinfo
  if (command === 'channelinfo') {
    const channel = message.mentions.channels.first() || message.channel;
    const embed = new EmbedBuilder().setColor('#5865F2').setTitle(`📢 Channel Info: #${channel.name}`)
      .addFields(
        { name: 'ID', value: channel.id, inline: true },
        { name: 'Type', value: `${channel.type}`, inline: true },
        { name: 'Created', value: channel.createdAt.toDateString(), inline: true }
      );
    return message.channel.send({ embeds: [embed] });
  }

  // !inviteinfo  
  if (command === 'invites') {
    const invites = await message.guild.invites.fetch();
    const memberInvites = invites.filter(inv => inv.inviter?.id === (message.mentions.users.first()?.id || message.author.id));
    const total = memberInvites.reduce((acc, inv) => acc + inv.uses, 0);
    return message.reply(`📨 **${message.mentions.users.first()?.username || message.author.username}** has **${total}** invites!`);
  }

  // !announce
  if (command === 'announce') {
    if (!isAdmin(message.member)) return message.reply('❌ No permission!');
    const text = args.join(' ');
    if (!text) return message.reply('❌ Provide announcement text!');
    const embed = new EmbedBuilder().setColor('#ff9900').setTitle('📢 Announcement').setDescription(text)
      .setFooter({ text: `By ${message.author.tag}` }).setTimestamp();
    message.delete();
    return message.channel.send({ embeds: [embed] });
  }

  // !giveaway (simple)
  if (command === 'giveaway') {
    if (!isMod(message.member)) return message.reply('❌ No permission!');
    const prize = args.join(' ');
    if (!prize) return message.reply('❌ Provide a prize!');
    const embed = new EmbedBuilder().setColor('#ff9900').setTitle('🎉 GIVEAWAY!')
      .setDescription(`**Prize:** ${prize}\n\nReact with 🎉 to enter!\n\nEnds in 1 minute!`)
      .setFooter({ text: `Hosted by ${message.author.tag}` }).setTimestamp();
    const giveawayMsg = await message.channel.send({ embeds: [embed] });
    await giveawayMsg.react('🎉');
    setTimeout(async () => {
      const reactions = giveawayMsg.reactions.cache.get('🎉');
      const users = await reactions.users.fetch();
      const eligible = users.filter(u => !u.bot);
      if (eligible.size === 0) return message.channel.send('❌ No one entered the giveaway!');
      const winner = eligible.random();
      message.channel.send(`🎉 Congratulations ${winner}! You won **${prize}**!`);
    }, 60000);
  }

  // !rules
  if (command === 'rules') {
    const embed = new EmbedBuilder().setColor('#5865F2').setTitle('📜 Server Rules')
      .setDescription('1. Be respectful\n2. No spam\n3. No NSFW content\n4. Follow Discord ToS\n5. Listen to staff\n6. No self-promotion\n7. Have fun!')
      .setFooter({ text: message.guild.name });
    return message.channel.send({ embeds: [embed] });
  }

  // !ticket
  if (command === 'ticket') {
    if (tickets[message.author.id]) {
      return message.reply(`❌ You already have an open ticket! <#${tickets[message.author.id]}>`);
    }
    const ticketChannel = await message.guild.channels.create({
      name: `ticket-${message.author.username}`,
      type: 0,
      permissionOverwrites: [
        { id: message.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: message.author.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ]
    });
    const modRole = message.guild.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.ModerateMembers));
    if (modRole) await ticketChannel.permissionOverwrites.create(modRole, { ViewChannel: true, SendMessages: true });
    tickets[message.author.id] = ticketChannel.id;
    const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🎫 Ticket Opened!')
      .setDescription(`Welcome ${message.author}! Please describe your issue and a staff member will assist you shortly.\n\nType \`!close\` to close this ticket.`)
      .setFooter({ text: 'GuardBot Ticket System' }).setTimestamp();
    await ticketChannel.send({ embeds: [embed] });
    return message.reply(`✅ Your ticket has been created! ${ticketChannel}`);
  }

  // !close
  if (command === 'close') {
    const isTicketChannel = Object.values(tickets).includes(message.channel.id);
    if (!isTicketChannel) return message.reply('❌ This is not a ticket channel!');
    const embed = new EmbedBuilder().setColor('#ff0000').setTitle('🎫 Ticket Closing')
      .setDescription('This ticket will be deleted in 5 seconds...').setTimestamp();
    await message.channel.send({ embeds: [embed] });
    const userId = Object.keys(tickets).find(k => tickets[k] === message.channel.id);
    delete tickets[userId];
    setTimeout(() => message.channel.delete(), 5000);
  }

  // !addmod
  if (command === 'addmod') {
    const isTicketChannel = Object.values(tickets).includes(message.channel.id);
    if (!isTicketChannel) return message.reply('❌ This is not a ticket channel!');
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mention a user!');
    await message.channel.permissionOverwrites.create(target, { ViewChannel: true, SendMessages: true });
    return message.reply(`✅ Added ${target.user.tag} to this ticket!`);
  }

  // !help
  if (command === 'help') {
    const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🛡️ GuardBot Commands')
      .setDescription('Here are all available commands:')
      .addFields(
        { name: '🔨 Moderation', value: '`!warn` `!kick` `!ban` `!unban` `!mute` `!unmute` `!warnings` `!clearwarnings` `!purge` `!slowmode` `!lock` `!unlock` `!nickname` `!addrole` `!removerole`' },
        { name: '📋 Info', value: '`!userinfo` `!serverinfo` `!avatar` `!ping` `!botinfo` `!roleinfo` `!channelinfo` `!membercount` `!invites`' },
        { name: '🎮 Fun', value: '`!8ball` `!coinflip` `!dice` `!rps` `!joke` `!roast` `!compliment` `!ship` `!poll` `!say` `!embed` `!choose` `!reverse` `!countdown`' },
        { name: '🛠️ Utility', value: '`!afk` `!note` `!notes` `!clearnotes` `!remindme` `!calc` `!uppercase` `!lowercase` `!wordcount` `!announce` `!giveaway` `!rules`' },
        { name: '🎫 Tickets', value: '`!ticket` `!close` `!addmod`' }
      )
      .setFooter({ text: 'GuardBot 🛡️ | 50+ commands' }).setTimestamp();
    return message.channel.send({ embeds: [embed] });
  }

});

client.login(process.env.DISCORD_TOKEN);