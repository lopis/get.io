const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const fetch = require('node-fetch')
const secrets = require('./config/secrets')
const fs = require('fs');

app.use(bodyParser.json());

function getAuthRedirect() {
  const host = 'https://api.put.io/v2/oauth2/authenticate'
  const returnUrl = 'http://localhost:3000/login'
  const id = secrets.client_id
  const type = 'code'
  return `${host}?client_id=${id}&response_type=${type}&redirect_uri=${returnUrl}`
}

function getAccessTokenRedirect(code) {
  const host = 'https://api.put.io/v2/oauth2/access_token'
  const id = secrets.client_id
  const client = secrets.client_secret
  const type = 'authorization_code'
  const returnUrl = 'http://localhost:3000/welcome'
  return `${host}?client_id=${id}&client_secret=${client}&grant_type=${type}&redirect_uri=${returnUrl}&code=${code}`
}

function write(fileName, text) {
  fs.writeFile(fileName, text, function(err) {
    if(err) {
        return console.log(err);
    }

    console.log("The file was saved!");
  });
}

function read(fileName) {
  return fs.readFileSync(fileName, 'utf8')
}

function authenticate(code, res) {
  console.log("code:", code);
  console.log(getAccessTokenRedirect(code));

  fetch(getAccessTokenRedirect(code))
    .then(result => {
      return result.text()
    })
    .then(json => {
      write('src/config/code', JSON.parse(json).access_token)
      res.redirect('/welcome.html');
    })
}

app.get('/login*', function (req, res) {
  // Check if we already have an access code
  const code = read('src/config/code')
  if (code) {
    res.redirect('/welcome.html')

  } else if (req.query.code) {
    // Second oauth2 step
    authenticate(req.query.code, res)

  } else {
    // First oauth2 step
    res.redirect(getAuthRedirect())
  }
})

app.use('/', express.static('src/www'))

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
