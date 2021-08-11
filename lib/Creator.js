const chalk = require('chalk')
const execa = require('execa')
const inquirer = require('inquirer')
const EventEmitter = require('events')
const loadRemotePreset = require('../lib/utils/loadRemotePreset')
const writeFileTree = require('../lib/utils/writeFileTree')
const copyFile = require('../lib/utils/copyFile')
const generateReadme = require('../lib/utils/generateReadme')
const { installDeps } = require('../lib/utils/installDeps')
const { generateFile } = require('./utils/generateFile')
const { merge } = require('webpack-merge')

const {
  defaults
} = require('../lib/options')

const {
  log,
  error,
  hasYarn,
  hasGit,
  hasProjectGit,
  logWithSpinner,
  clearConsole,
  stopSpinner,
  exit
} = require('../lib/utils/common')

module.exports = class Creator extends EventEmitter {
  constructor(name, context) {
    super()

    this.name = name
    this.context = context

    this.run = this.run.bind(this)
  }

  async create(cliOptions = {}, preset = null) {
    const { run, name, context } = this
    
    if (cliOptions.preset) {
      preset = await this.resolvePreset(cliOptions.preset, cliOptions.clone)
    } else {
      preset = await this.resolvePreset(defaults.presets.default, cliOptions.clone)
    }
    console.log(preset);
    
    await clearConsole()
    log(chalk.blue.bold(`V-CLI v${require('../package.json').version}`))
    logWithSpinner(`✨`, `正在创建项目 ${chalk.yellow(context)}.`)
    // this.emit('creation', { event: 'creating' })

    stopSpinner()
    const { pkgName, pkgVers, pkgDes,pkgEslint } = await inquirer.prompt([
      {
        name: 'pkgName',
        message: `请输入项目名字`,
        default: 'vue-template',
      },
      {
        name: 'pkgVers',
        message: `请输入项目版本号`,
        default: '1.0.0',
      },
      {
        name: 'pkgDes',
        message: `请输入项目简介`,
        default: 'project created by v-cli',
      },
      {
        name: 'pkgEslint',
        message: `是否使用eslint`,
        default: 'yes',
        type: 'confirm'
      }
    ])
    let pkgConfig = {
      version: pkgVers,
      description: pkgDes,
      name: pkgName,
    }

    if(pkgEslint){
      generateFile(preset.tmpdir, '.eslintignore')
      generateFile(preset.tmpdir, '.eslintrc.js')
      
      pkgConfig = merge(pkgConfig, {
        scripts: {
          "lint": "eslint --quiet --no-error-on-unmatched-pattern --fix \"src/**/*.{ts,js,vue,tsx}\" && npm run lint:style",
        },
        devDependencies: {
          "@typescript-eslint/eslint-plugin": "^4.1.1",
          "@typescript-eslint/parser": "^4.1.1",
          "@vue/eslint-config-prettier": "^6.0.0",
          "@vue/eslint-config-typescript": "^5.0.2",
          "eslint": "^6.7.2",
          "eslint-plugin-prettier": "^3.1.3",
          "eslint-plugin-vue": "^7.0.0-0",
        }
      })
    }
    // 将下载的临时文件拷贝到项目中
    const pkgJson = await copyFile(preset.tmpdir, preset.targetDir)
    const pkg = merge(pkgJson, pkgConfig)

    // write package.json
    log()
    logWithSpinner('📄', `生成 ${chalk.yellow('package.json')} 等模板文件`)
    await writeFileTree(context, {
      'package.json': JSON.stringify(pkg, null, 2)
    })

    // 包管理
    const packageManager = (
      (hasYarn() ? 'yarn' : null) ||
      (hasPnpm3OrLater() ? 'pnpm' : 'npm')
    )
    await writeFileTree(context, {
      'README.md': generateReadme(pkg, packageManager)
    })

    const shouldInitGit = this.shouldInitGit(cliOptions)
    if (shouldInitGit) {
      logWithSpinner(`🗃`, `初始化Git仓库`)
      this.emit('creation', { event: 'git-init' })
      await run('git init')
    }
    
    // 安装依赖
    stopSpinner()
    log()
    logWithSpinner(`⚙`, `安装依赖`)
    // log(`⚙  安装依赖中，请稍等...`)
    
    await installDeps(context, packageManager, cliOptions.registry)

    // commit initial state
    let gitCommitFailed = false
    if (shouldInitGit) {
      await run('git add -A')
      const msg = typeof cliOptions.git === 'string' ? cliOptions.git : 'init'
      try {
        await run('git', ['commit', '-m', msg])
      } catch (e) {
        gitCommitFailed = true
      }
    }
      
    // log instructions
    stopSpinner()
    log()
    log(`🎉  项目创建成功 ${chalk.yellow(name)}.`)
    if (!cliOptions.skipGetStarted) {
      log(
        `👉  请按如下命令，开始愉快开发吧！\n\n` +
        (this.context === process.cwd() ? `` : chalk.cyan(` ${chalk.gray('$')} cd ${name}\n`)) +
        chalk.cyan(` ${chalk.gray('$')} ${packageManager === 'yarn' ? 'yarn start' : packageManager === 'pnpm' ? 'pnpm run start' : 'npm start'}`)
      )
    }
    log()
    this.emit('creation', { event: 'done' })

    if (gitCommitFailed) {
      warn(
        `因您的git username或email配置不正确，无法为您初始化git commit，\n` +
        `请稍后自行git commit。\n`
      )
    }
  }

  async resolvePreset (name, clone) {
    let preset
    logWithSpinner(`Fetching remote preset ${chalk.cyan(name)}...`)
    this.emit('creation', { event: 'fetch-remote-preset' })
    try {
      preset = await loadRemotePreset(name, this.context, clone)
      console.log('tmpdir',preset);
      stopSpinner()
    } catch (e) {
      stopSpinner()
      error(`Failed fetching remote preset ${chalk.cyan(name)}:`)
      throw e
    }

    // 默认使用default参数
    if (name === 'default' && !preset) {
      preset = defaults.presets.default
    }
    if (!preset) {
      error(`preset "${name}" not found.`)
      exit(1)
    }
    return preset
  }

  run (command, args) {
    if (!args) { [command, ...args] = command.split(/\s+/) }
    return execa(command, args, { cwd: this.context })
  }

  getName() {
    const originName = this.name
    const tailName = originName.slice(1)
    const upperName = originName.charAt(0).toUpperCase() + tailName
    const lowerName = originName.charAt(0).toLowerCase() + tailName
    return {
      upperName,
      lowerName
    }
  }
  shouldInitGit (cliOptions) {
    if (!hasGit()) {
      return false
    }
    // --git
    if (cliOptions.forceGit) {
      return true
    }
    // --no-git
    if (cliOptions.git === false || cliOptions.git === 'false') {
      return false
    }
    // default: true unless already in a git repo
    return !hasProjectGit(this.context)
  }
}