const chalk = require('chalk')
const path = require('path')
const fs = require('fs-extra')
const nunjucks = require('nunjucks')

const {
  stopSpinner,
} = require('./common')

const tempPath = path.resolve(__dirname, '../../temp/lint')

async function generateFile(context, fileName) {
  const pageTempPath = path.resolve(tempPath, fileName)
  const ioTemp = await fs.readFile(pageTempPath)
  const ioContent = nunjucks.renderString(ioTemp.toString(), { fileName })
  await fs.writeFile(path.resolve(context, `./${fileName}`), ioContent, {flag: 'a'})
  stopSpinner()
}

module.exports = {
  generateFile
}