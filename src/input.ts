import { Writable } from 'stream'
import { readFileSync } from 'fs'
import readline from 'readline'

export const readValue = (question: string, name: string, required: boolean): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!process.stdout.isTTY) return reject(new Error(`${name} required`))
    const rl = readline.createInterface(process.stdin, process.stdout)
    let valueAnswer = ''
    rl.on('close', () => {
      if (required && valueAnswer.length === 0) return reject(new Error(`${name} required`))
      return resolve(valueAnswer)
    })
    rl.question(question, answer => {
      valueAnswer = answer
      rl.close()
    })
  })

export const readSecureValue = (question: string, name: string, required = true) =>
  (file: string | undefined): Promise<string> =>
    new Promise((resolve, reject) => {
      // read secure value from file if set
      if (file !== undefined) {
        if (file.length === 0) return reject(new Error(`no path to ${name} file`))
        try {
          const data = readFileSync(file)
          return resolve(data.toString())
        }
        catch (err) {
          return reject(err)
        }
      }

      // try interactive prompt
      if (!process.stdout.isTTY) return reject(new Error(`${name} required`))
      const invisible = new Writable({
        write: (_chunk, _encoding, callback) => callback()
      })
      const rl = readline.createInterface(process.stdin, invisible, undefined, true)
      let valueAnswer = ''
      rl.on('close', () => {
        process.stdout.write('\n')
        if (required && valueAnswer.length === 0) return reject(new Error(`${name} required`))
        return resolve(valueAnswer)
      })
      process.stdout.write(question)
      rl.question('', answer => {
        valueAnswer = answer
        rl.close()
      })
    })
