import { EmbedBuilder, Message } from 'discord.js'
import XPs from '../schemas/XPs'
import getRandomNum from './getRandomNum'
import Modules from '../schemas/Modules'
import { t } from 'i18next'
import ModulesRanking from '../schemas/Modules.Ranking'

const cd = new Set<string>()

export const addXp = async (message: Message) => {
  if (!message.member || !message.guild || message.author.bot || cd.has(message.author.id)) return

  const data = await Modules.findOne({ guildId: message.guild.id })
  if (
    !data ||
    !data.leveling?.status ||
    data.leveling.ignoredChannels.includes(message.channel.id) ||
    data.leveling.ignoredRoles.some((role) => message.member?.roles.cache.get(role))
  )
    return (
      cd.add(message.author.id),
      setTimeout(() => {
        cd.delete(message.author.id)
      }, 2000)
    )

  cd.add(message.author.id)

  setTimeout(() => {
    cd.delete(message.author.id)
  }, data.leveling?.cooldown || 15000)

  const xpToGive = getRandomNum(data.leveling?.minXp, data.leveling?.maxXp)

  const updated = await XPs.findOneAndUpdate(
    { memberId: message.author.id, guildId: message.guild.id },
    { $inc: { xp: xpToGive } },
    { upsert: true, new: true }
  )

  if (data.leveling?.notifications?.onLvlUp && Math.floor(updated.xp / 100) > Math.floor((updated.xp - xpToGive) / 100)) {
    const lng = message.guild.preferredLocale

    const embed = new EmbedBuilder()
      .setAuthor({ name: t('xp.notifications.lvlUp.author', { lng: lng }) })
      .setDescription(t('xp.notifications.lvlUp.description', { lng: lng, xp: updated.xp, level: Math.floor(updated.xp / 100) }))
      .setColor('Fuchsia')

    const msg = await message.reply({ embeds: [embed] }).catch((err) => console.error(`Error while replying: ${err.message}`))

    setTimeout(() => {
      if (msg) msg.delete().catch((err) => err)
    }, 5000)

    const ranks = await ModulesRanking.find({ guildId: message.guild.id, lvl: { $lte: Math.floor(updated.xp / 100) } })
    ranks.forEach((r) => {
      const role = message.guild?.roles.cache.get(r.roleId)
      if (role) message.member?.roles.add(role).catch((err: Error) => console.error(`Unable to give ranked role: ${err.message}`))
    })
  }
}
