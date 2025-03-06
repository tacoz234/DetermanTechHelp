const { google } = require('googleapis');
const express = require('express');

const app = express();
const port = 5001;

const oauth2Client = new google.auth.OAuth2(
    '873336302236-unf5uq3hb2p1j736njf1tl9nod2opu2u.apps.googleusercontent.com',
    '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',
    'http://localhost:5001/oauth2callback' // Make sure this matches your Google Cloud redirect URI
);

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent',
    include_granted_scopes: true,
});

console.log('Authorize this app by visiting this URL:', authUrl);

// Listen for Google OAuth callback
app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    
    if (!code) {
        return res.send('Error: Authorization code not found.');
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        console.log('Your Refresh Token:', tokens.refresh_token);

        res.send('Authentication successful! You can close this tab.');
    } catch (error) {
        console.error('Error retrieving access token', error);
        res.send('Error retrieving access token.');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
