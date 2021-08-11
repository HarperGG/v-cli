const fs = require('fs-extra')

const remotePresetMap = {
  'vue-ts': 'HarperGG/tamplete-vite-ts#main',
}

module.exports = async function (name, targetDir, clone) {
  const os = require('os')
  const path = require('path')
  const download = require('download-git-repo')
  const tmpdir = path.join(os.tmpdir(), 'vue-ts')

  await fs.remove(tmpdir)
  await new Promise((resolve, reject) => {
    download(remotePresetMap[name], tmpdir,
      clone, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
  return {
    targetDir,
    tmpdir
  }
}