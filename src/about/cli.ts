// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as repl from '../repl'
import { Command } from 'commander'

/** Display community & further reading links in CLI. */
const community = async () => {
  repl.echon(`
Browse public Edge code on GitHub:
  https://github.com/edge

Chat with the community on Discord, Telegram, or Reddit:
  https://discord.gg/edge-network
  https://t.me/edgenetwork
  https://reddit.com/r/edgenetwork

Follow Edge on Twitter or Facebook:
  https://twitter.com/edgenetwork
  https://www.facebook.com/edgenetworktech

Keep up with Edge on Medium or sign up to the mailing list:
  https://edge.medium.com
  https://edge.press
`)
}

/** Create about commands. */
export const commands = (): Command[] => [
  new Command('community').description('show community links').action(community)
]
