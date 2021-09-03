export type Config = {
  network: Network[]
}

export type Network = {
  name: string
  index: {
    baseURL: string
  }
}

const config: Config = {
  network: [
    {
      name: 'main',
      index: {
        baseURL: 'https://index.xe.network'
      }
    },
    {
      name: 'test',
      index: {
        baseURL: 'https://index.test.networkinternal.com'
      }
    }
  ]
}

export default config

export const selectNetwork = (name: string): Network => {
  const network = config.network.find(n => n.name === name)
  if (network === undefined) throw new Error(`unknown network "${name}"`)
  return network
}
