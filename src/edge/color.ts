import chalk from 'chalk'

const error = (str: string): string => chalk.red(str)
const info = (str: string): string => chalk.green(str)
const warn = (str: string): string => chalk.yellow(str)

export default {
  error,
  info,
  warn
}
