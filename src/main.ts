import cli from './cli'

cli.parse(process.argv)

console.debug(cli.opts())
