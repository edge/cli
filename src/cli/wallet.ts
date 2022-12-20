import { Command } from 'commander'
import { Network } from '..'

export type WalletOption = {
  wallet: string
}

export const configure = (cmd: Command): void => {
  cmd.option('-w, --wallet <file>', 'wallet file path')
}

/** Get host wallet (file path) from command options. */
export const read = (parent: Command, network: Network): WalletOption => {
  const { wallet } = parent.opts<Partial<WalletOption>>()
  return { wallet: wallet || network.wallet.defaultFile }
}
