require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(cors());

// Google Calendar Setup
const { OAuth2 } = google.auth;
const oauth2Client = new OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// Google Sheets Setup for Reviews
const sheets = google.sheets({ version: 'v4', auth: new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
})});

// Email Setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ✅ Route to Add an Event to Google Calendar
app.post('/add-event', async (req, res) => {
    try {
        const { name, email, date, problem, location } = req.body;

        const event = {
            summary: `Tech Help with ${name}`,
            description: `Problem: ${problem}\nLocation: ${location}\nEmail: ${email}`,
            start: { dateTime: date, timeZone: 'America/New_York' },
            end: { dateTime: new Date(new Date(date).getTime() + 60 * 60000), timeZone: 'America/New_York' },
            reminders: { useDefault: true }
        };

        const response = await calendar.events.insert({ calendarId: 'primary', resource: event });

        // Send Confirmation Email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: `Appointment Confirmation - Determan Tech Help`,
            text: `Hi ${name},\n\nYour appointment has been scheduled!\n\n📅 Date & Time: ${new Date(date).toLocaleString()}
            📍 Location: ${location}
            📝 Problem: ${problem}\n\nThanks!\nDeterman Tech Help`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) console.error("Error sending email:", error);
            else console.log("Email sent:", info.response);
        });

        res.json({ message: 'Appointment added to Google Calendar!', eventId: response.data.id });
    } catch (error) {
        console.error('Error adding event:', error);
        res.status(500).json({ error: 'Error adding event' });
    }
});

// ✅ Route to Fetch Busy Times from Google Calendar
app.get('/get-busy-times', async (req, res) => {
    try {
        const events = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            maxResults: 50,
            singleEvents: true,
            orderBy: 'startTime'
        });

        const busyTimes = events.data.items.map(event => ({
            title: 'Busy',
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            backgroundColor: '#ff0000',
            borderColor: '#ff0000',
            display: 'background'
        }));

        res.json(busyTimes);
    } catch (error) {
        console.error('Error fetching busy times:', error);
        res.status(500).json({ error: 'Error fetching busy times' });
    }
});

// ✅ Route to Add a Review to Google Sheets
app.post('/add-review', async (req, res) => {
    try {
        const { name, review } = req.body;
        console.log("Received request body:", req.body);
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SHEETS_ID,
            range: 'Sheet1!A:B',
            valueInputOption: 'RAW',
            requestBody: { values: [[name, review]] }
        });

        res.json({ message: 'Review added successfully!' });
    } catch (error) {
        console.error('Error adding review:', error);
        res.status(500).json({ error: 'Error adding review' });
    }
});

// ✅ Route to Fetch Reviews from Google Sheets
app.get('/get-reviews', async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SHEETS_ID,
            range: 'Sheet1!A:B'
        });

        const reviews = response.data.values.map(row => ({ name: row[0], review: row[1] }));
        res.json(reviews);
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ error: 'Error fetching reviews' });
    }
});

// Start Server
const PORT = 5001;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
