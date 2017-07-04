const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const fetch = require('node-fetch')
const config = require('./config/config')
const fs = require('fs')
const moment = require('moment')
const mtd = require('zeltice-mt-downloader')
const cron = require('node-cron')

app.use(bodyParser.json())

const downloadDir = './downloads/';

const api = 'https://api.put.io/v2'

function getAuthRedirectURL() {
  const url = 'oauth2/authenticate'
  const returnUrl = `http://${config.domain}:${config.port}/login`
  const id = config.client_id
  const type = 'code'
  return `${api}/${url}?client_id=${id}&response_type=${type}&redirect_uri=${returnUrl}`
}

function getAccessTokenRedirectURL(code) {
  const url = 'oauth2/access_token'
  const id = config.client_id
  const client = config.client_secret
  const type = 'authorization_code'
  const returnUrl = `http://${config.domain}:${config.port}/welcome`
  return `${api}/${url}?client_id=${id}&client_secret=${client}&grant_type=${type}&redirect_uri=${returnUrl}&code=${code}`
}

function write(fileName, text) {
  fs.writeFile(fileName, text, function(err) {
    if(err) {
        return console.error(err)
    }
  })
}

function log(msg) {
  const time = (new Date()).toLocaleString()
  fs.appendFile('get.io.log', `${time}\t${msg}\n`, () => {
    console.log(`${time}\t${msg}`)
  })
}
function error(msg) {
  const time = (new Date()).toLocaleString()
  fs.appendFile('error.log', `${time}\t${msg}\n`, () => {
    console.log(`${time}\t${msg}`)
  })
}

function read(fileName) {
  return fs.readFileSync(fileName, 'utf8')
}

function downloadedFileExists(name) {
  return fs.existsSync(`${downloadDir}${name}`)
}

function readAccessToken() {
  try {
    return read('src/config/code')
  } catch (e) {
    console.error(e.toString())
    return false
  }
}

function authenticate(code, res) {
  fetch(getAccessTokenRedirectURL(code))
    .then(result => {
      return result.text()
    })
    .then(json => {
      write('src/config/code', JSON.parse(json).access_token)
      log(`Auth code saved successfully`)
      res.redirect('/welcome.html')
    })
}

app.get('/login*', function (req, res) {
  // Check if we already have an access code
  const code = readAccessToken()
  if (code) {
    res.redirect('/welcome.html')

  } else if (req.query.code) {
    // Second oauth2 step
    authenticate(req.query.code, res)

  } else {
    // First oauth2 step
    res.redirect(getAuthRedirectURL())
  }
})

/*
 * Fetches the list of all files and directories in the root.
 */
function getFiles(code) {
  const url = 'files/list'
  return fetch(`${api}/${url}?oauth_token=${code}`)
    .then(result => {
      return result.text()
    })
    .then(json => {
      return files = JSON.parse(json).files.reduce((rest, file) => {
        rest[file.id] = {
          name: file.name,
          icon: file.icon,
          file_type: file.type,
          extension: file.extension,
          size: file.size,
          type: file.content_type
        }
        return rest
      }, {})
    })
}

// Gets the transfer events from the last day
function getTransferEventList(code) {
  const url = '/events/list'
  return fetch(`${api}/${url}?oauth_token=${code}`)
    .then(result => {
      return result.text()
    })
    .then(json => {
      const events = JSON.parse(json).events
      const transfers = events.reduce((rest, event) => {
        const isFromLastDay = moment(event.createdAt).subtract(1, 'day')
        if (event.type === 'transfer_completed' && isFromLastDay) {
          rest.push({
            name: event.transfer_name,
            size: event.transfer_size,
            fileId: event.file_id,
            createdAt: event.created_at
          })
        }
        return rest
      }, [])

      return transfers
    })
}

function getDownloadLink(code, fileId, file) {
  if (file.type === 'application/x-directory') {
    // directories must be zipped before downloading
    const zipUrl = '/zips/create'
    const params = {
      file_ids: [file]
    }
    fetch(zipUrl, { method: 'POST', body: params })
  }
  const url = `files/${fileId}/download`
  return fetch(`${api}/${url}?oauth_token=${code}`)
}

app.get('/events', (req, res) => {
  const code = readAccessToken()
  if (!code) {
    res.redirect('/login')
    return
  }

  let fileCounter = 0
  let connThreads = []

  getTransferEventList(code)
  .then(events => {
    getFiles(code)
    .then(files => {
      events.map(event => {
        const file = files[event.fileId]
        if (file && !downloadedFileExists(file.name)) {
          fileCounter++
          getDownloadLink(code, event.fileId, file)
          .then(result => {
            const link = result.url

            // Create new downloader
            var downloader = new mtd(
              downloadDir + file.name,
              link,
              {
                onStart: function(meta) {
                  log(`Download Started: ${file.name}`)
                  connThreads.push(meta)
                  fileCounter--
                  if (fileCounter <= 0) {
                    res.send({
                      files: files,
                      connThreads: connThreads
                    })
                  }
                },
                //Triggered when the download is completed
                onEnd: function(err, result) {
                  if (err) error(err)
                  else log(`Download completed: ${file.name}`)
                }
              }
            )
            downloader.start()
          })
        }
      })
    })
  })
  .catch(e => {
    console.error(e.toString())
    res.send(e)
  })
})

app.use('/', express.static('src/www'))

app.listen(config.port, function () {
  console.log('get.io listening on port ' + config.port)
})
