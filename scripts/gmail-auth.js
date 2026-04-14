/**
 * Script pour obtenir le Gmail Refresh Token
 * Usage: node scripts/gmail-auth.js
 */

const { google } = require('googleapis');
const readline = require('readline');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const CLIENT_ID     = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI  = 'urn:ietf:wg:oauth:2.0:oob';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',
});

console.log('\n======================================');
console.log('🔐 Gmail OAuth — IntraClaw');
console.log('======================================');
console.log('\n1. Ouvre ce lien dans ton navigateur :\n');
console.log(authUrl);
console.log('\n2. Connecte-toi avec intra.web.site1@gmail.com');
console.log('3. Accepte les permissions');
console.log('4. Copie le code affiché et colle-le ici\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('→ Colle le code ici : ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log('\n✅ Refresh Token obtenu !');
    console.log('\nAjoute cette ligne dans ton .env :');
    console.log(`\nGMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  } catch (err) {
    console.error('❌ Erreur :', err.message);
  }
});
