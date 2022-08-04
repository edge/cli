// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'

/**
 * Display community/further reading links in CLI.
 */
const communityAction = () => async () => {
  console.log([
    'Browse public Edge code on GitHub:\n',
    '  https://github.com/edge\n\n',
    'Chat with the community on Discord, Telegram, or Reddit:\n',
    '  https://discord.gg/edge-network\n',
    '  https://t.me/edgenetwork\n',
    '  https://reddit.com/r/edgenetwork\n\n',
    'Follow Edge on Twitter or Facebook:\n',
    '  https://twitter.com/edgenetwork\n',
    '  https://www.facebook.com/edgenetworktech\n\n',
    'Keep up with Edge on Medium or sign up to the mailing list:\n',
    '  https://edge.medium.com\n',
    '  https://edge.press'
  ].join(''))
}

/** Configure about commands. */
export const commands = (): Command[] => {
  const community = new Command('community')
    .description('show community links')
    .action(communityAction())

  return [community]
}
