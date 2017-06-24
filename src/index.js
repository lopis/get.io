const express = require('express')
const app = express()
const fetch = require('node-fetch')
const secrets = require('./config/secrets')

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

app.get('/login*', function (req, res) {
  if (!req.query.code) {
    // First oauth2 step
    res.redirect(getAuthRedirect());
  }

  // Second oauth2 step
  fetch(getAccessTokenRedirect(req.query.code))
    .then(result => {
      return result.text()
    })
    .then(text => {
      console.log(text);
      res.redirect('/');
    })
})

app.use('/', express.static('src/www'))

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
