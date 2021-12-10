import { Command } from 'commander'

const communityAction = () => async () => {
  console.log([
    '\n',
    'Browse public Edge code on GitHub:\n',
    '  https://github.com/edge\n\n',
    'Chat with the community on Telegram, Discord, or Reddit:\n',
    '  https://t.me/edgenetwork\n',
    '  https://discord.gg/3sEvuYJ\n',
    '  https://reddit.com/r/edgenetwork\n\n',
    'Follow Edge on Twitter or Facebook:\n',
    '  https://twitter.com/edgenetwork\n',
    '  https://www.facebook.com/edgenetworktech\n\n',
    'Keep up with Edge on Medium or sign up to the mailing list:\n',
    '  https://medium.com/dadi\n',
    '  https://edge.network/en/'
  ].join(''))
}

export const commands = (): Command[] => {
  const community = new Command('community')
    .description('show community links')
    .action(communityAction())

  return [community]
}
