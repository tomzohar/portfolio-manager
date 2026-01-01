const { exec } = require('child_process');
const http = require('http');

const URL = 'http://localhost:5050';
const INTERVAL = 1000; // Check every 1 second
const MAX_ATTEMPTS = 30; // Wait up to 30 seconds
let attempts = 0;

function openBrowser() {
  const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
  console.log(`[pgAdmin] Opening ${URL}...`);
  exec(`${start} ${URL}`);
}

function checkAndOpen() {
  attempts++;
  http.get(URL, (res) => {
    // Port is responsive
    openBrowser();
  }).on('error', (err) => {
    if (attempts < MAX_ATTEMPTS) {
      console.log(`[pgAdmin] Waiting for ${URL} to be ready (attempt ${attempts}/${MAX_ATTEMPTS})...`);
      setTimeout(checkAndOpen, INTERVAL);
    } else {
      console.error(`[pgAdmin] Error: pgAdmin did not become ready at ${URL} after 30 seconds.`);
    }
  });
}

checkAndOpen();

