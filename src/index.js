const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const fetch = require('node-fetch')
const secrets = require('./config/secrets')
const fs = require('fs')
const moment = require('moment')

app.use(bodyParser.json())

const api = 'https://api.put.io/v2'

function getAuthRedirectURL() {
  const url = 'oauth2/authenticate'
  const returnUrl = 'http://localhost:3000/login'
  const id = secrets.client_id
  const type = 'code'
  return `${api}/${url}?client_id=${id}&response_type=${type}&redirect_uri=${returnUrl}`
}

function getAccessTokenRedirectURL(code) {
  const url = 'oauth2/access_token'
  const id = secrets.client_id
  const client = secrets.client_secret
  const type = 'authorization_code'
  const returnUrl = 'http://localhost:3000/welcome'
  return `${api}/${url}?client_id=${id}&client_secret=${client}&grant_type=${type}&redirect_uri=${returnUrl}&code=${code}`
}

function write(fileName, text) {
  fs.writeFile(fileName, text, function(err) {
    if(err) {
        return console.error(err)
    }
  })
}

function read(fileName) {
  return fs.readFileSync(fileName, 'utf8')
}

function downloadedFileExists(name) {
  return fs.existsSync(`./downloads/${name}`)
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

app.get('/files', (req, res) => {
  const code = readAccessToken()
  if (!code) {
    res.redirect('/login')
    return
  }

  getFiles(code)
  .then(json => {
    res.setHeader('Content-Type', 'application/json')
    res.send(json)
  })
})

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

function getDownloadLink(code, fileId) {
  const url = `files/${fileId}/download`
  return fetch(`${api}/${url}?oauth_token=${code}`)
    .then(result => {
      return result.text()
    })
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
        if (file) {
          getDownloadLink(code, event.fileId)
          .then(link => {
            console.log('--')
          })
        }
      })
      res.send(files)
    })
  })
  .catch(e => {
    console.error(e.toString())
    res.send(e)
  })
})

app.use('/', express.static('src/www'))

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
