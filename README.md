# get.io

Custom put.io client

# Build

Star by registering your new app  put.io as described [here in Step 1](https://api.put.io/v2/docs/gettingstarted.html). Take note of the 3 codes provided .

Make a copy of `src/config/secrets.js.dist`

`cp src/config/secrets.js.dist src/config/secrets.js`

*Do not add this new file to git.* We are adding sensitive stuff to it. Edit the file `secrets.js` and replace `YOUR_SECRET`, `YOUR_ID` and `YOUR_TOKEN` respectively with the `client_secret`, `client_id` and `token` that you took note after you registered your app.

Install all dependencies:

`yarn`

# Run

`yarn dev`

The app should now be accessible via http://localhost:3000
