const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const fetch = require('node-fetch')
const config = require('./config/config')
const fs = require('fs')
const moment = require('moment')
const mtd = require('zeltice-mt-downloader')
const cron = require('node-cron')
const AdmZip = require('adm-zip')

app.use(bodyParser.json())

const downloadDir = './downloads/';

const api = 'https://api.put.io/v2'

function getAuthRedirectURL() {
  const url = 'oauth2/authenticate'
  const returnUrl = `http://${config.hostname}:${config.port}/login`
  const id = config.client_id
  const type = 'code'
  return `${api}/${url}?client_id=${id}&response_type=${type}&redirect_uri=${returnUrl}`
}

function getAccessTokenRedirectURL(code) {
  const url = 'oauth2/access_token'
  const id = config.client_id
  const client = config.client_secret
  const type = 'authorization_code'
  const returnUrl = `http://${config.hostname}:${config.port}/welcome`
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

function unzip(path, fileName) {
  var zip = new AdmZip(path)
  zip.extractAllTo(downloadDir + fileName, /*overwrite*/true)
}

function downloadFromUrl (url, fileName, isZip) {
  const path = isZip ? downloadDir + 'zips/' + fileName : downloadDir + fileName
  // Create new downloader
  var downloader = new mtd(
    path,
    url,
    {
      onStart: function() {
        log(`Download Started: ${fileName}`)
      },
      // Triggered when the download is completed
      onEnd: function(err) {
        if (err) error(err)
        else log(`Download completed: ${fileName}`)

        if (isZip) {
          log(`Zip download completed: ${fileName}`)
          try {
            log(`Extracting ${fileName}`)
            unzip(path, fileName)
            log(`Extracted successfully ${fileName}`)
          } catch (e) {
            error(`Failed to extract ${fileName}`)
          } finally {

          }
        }
      }
    }
  )
  downloader.start()
}

function pollZipStatus (code, zipId, fileName) {
  const url = `zips/${zipId}`
  fetch(`${api}/${url}?oauth_token=${code}`)
    .then(response => {
      return response.text()
    })
    .then(text => {
      const result = JSON.parse(text)
      if (result.url) {
        log(`Zip ready for ${fileName}`)
        downloadFromUrl (result.url, fileName + '.zip', true)
      } else {
        log(`Zip status for ${fileName}: ${result.status}`)
        setTimeout(
          () => pollZipStatus(code, zipId, fileName),
          5000
        )
      }
    })
}

function createZip(code, fileId, fileName) {
  const url = 'zips/create'
  const params = `file_ids=${fileId}`
  fetch(
      `${api}/${url}?oauth_token=${code}`,
      {
        method: 'POST',
        body: params,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
      }
    )
    .then(response => {
      return response.text()
    })
    .then(text => {
      const result = JSON.parse(text)
      if (result.zip_id) {
        log(`Zip requested for ${fileName}, id ${result.zip_id}`)
        pollZipStatus(code, result.zip_id, fileName)
      } else {
        error(`An error occured creating zip for ${fileName}`)
      }
    })
    .catch(e => {
      error(e)
    })
}

function getDownloadLink(code, fileId, file) {
  const url = `files/${fileId}/download`
  return fetch(`${api}/${url}?oauth_token=${code}`)
}

app.get('/events', (req, res) => {
  const code = readAccessToken()
  if (!code) {
    res.redirect('/login')
    return
  }

  getTransferEventList(code)
  .then(events => {
    getFiles(code)
    .then(files => {
      events.map(event => {
        const file = files[event.fileId]
        if (file && !downloadedFileExists(file.name)) {
          if (file.type === 'application/x-directory') {
            // directories must be zipped before downloading
            log(`File ${file.name} is a directory`)
            createZip(code, event.fileId, file.name)
          } else {
            getDownloadLink(code, event.fileId, file)
            .then(result => {
              const link = result.url
              downloadFromUrl(link, file.name)
            })
            .catch((e) => {
              error(file.name)
              error(e)
            })
          }

        }
      })
    })
  })
  .catch(e => {
    console.error(e.toString())
    res.send(e)
  })

  res.redirect('/welcome.html?done=true')
})

app.use('/', express.static('src/www'))

app.listen(config.port, function () {
  console.log('get.io listening on port ' + config.port)
})
