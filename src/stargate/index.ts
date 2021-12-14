import { Network } from '../'
import superagent from 'superagent'

export const getServiceVersion = async (network: Network, name: string): Promise<string> => {
  const res = await superagent.get(network.stargate.serviceURL(name))
  const data = res.body as { name: string, version: string }
  return data.version
}
