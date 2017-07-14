# get.io

Custom put.io client that I developed to use as a put.io download box. My goal is that I can add any file to put.io's queue from my phone and have it be downloaded to my home server by the time I get back home.

# Instructions

1. Star by registering a new app put.io as described [here in Step 1](https://api.put.io/v2/docs/gettingstarted.html). The name, description and website of your app can be whatever you want. The callback URL has to be exactly `http://<YOUR_IP>/welcome` where `<YOUR_IP>` is the location of the machine where the app is running. In my case, I'm running `get.io` on my Pi through `192.168.123.123:3000` so that's what I use. If you run it in your local machine, just use `localhost:3000`.

Take note of the 3 codes provided.

2. Make a copy of `src/config/secrets.js.dist`

`cp src/config/secrets.js.dist src/config/secrets.js`

*Do not add this new file to git.* We are adding sensitive stuff to it. Edit the new file `secrets.js` and replace `YOUR_SECRET`, `YOUR_ID` and `YOUR_TOKEN` respectively with the `client_secret`, `client_id` and `token` that you took note after you registered your app.

3. Install all dependencies:

`yarn`


4. Run the app. You might want to set it up as a service.

`yarn dev`

The app should now be accessible via `http://<YOUR_IP>:3000`

5. Follow the link to login via oauth2 in `put.io`. Afterwards You'll be redirected back to the local app.

Now, navigate to `http://localhost:3000/events` and your files will start to download.

6. Now that the app is running and you've logged in, the cron job will stay running and download new transfered files regularly.

# Version 1.0:

 - [x] Authenticate
 - [x] Download simple files
 - [x] Download directories as zips
 - [x] Unzip directories when download finishes
 - [ ] Setup regular job to check for new files

# Version 1.1:
 - [ ] Download icons for each file
 - [ ] Keep a list of active downloads to easily resume and see progress
 - [ ] Make a (web) page with the list of movies that are ready to watch
 - [ ] Adapt @GizmoXomziG's script (see /scripts directory) to navigate the page with the TV remote.

# Futher notes

Using a samsung tv remote to control the Pi.
https://ubuntu-mate.community/t/controlling-raspberry-pi-with-tv-remote-using-hdmi-cec/4250

Just run
`export DISPLAY=":0"`
`cec-client | ~/cecremote.sh`

Playing video on the pi:
https://www.raspberrypi.org/documentation/usage/video/
