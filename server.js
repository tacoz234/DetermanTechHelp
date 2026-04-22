// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
const corsOptions = {
    origin: 'https://determantechhelp.com', // only allow your frontend
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
  };
  app.use(cors(corsOptions));
  

// ✅ Serve Static Files (Frontend)
app.use((req, res, next) => {
    console.log(`Request received: ${req.url}`);
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/images', express.static(path.join(__dirname, 'public/images')));

const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min window
  max: 50, // limit each IP to 50 requests per window
});

app.use(limiter); // apply globally

const helmet = require('helmet');
app.use(helmet());



// ✅ Handle Homepage Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Google OAuth Setup
const { OAuth2 } = google.auth;
const oauth2Client = new OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// ✅ Nodemailer Setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ✅ Route to Add an Event
app.post('/add-event', async (req, res) => {
    try {
        console.log("Received request:", req.body);
        const { name, email, date, problem, location } = req.body;
        if (!name || !email || !date || !problem || !location) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        const event = {
            summary: `Tech Support - ${name}`,
            description: `Problem: ${problem}\nLocation: ${location}\nEmail: ${email}`,
            location: location, 
            start: { dateTime: date, timeZone: 'America/New_York' },
            end: { dateTime: new Date(new Date(date).getTime() + 60 * 60000), timeZone: 'America/New_York' },
            reminders: { useDefault: true }
        };

        const response = await calendar.events.insert({ calendarId: 'primary', resource: event });
        console.log('Event Created:', response.data);

        // 📧 Send confirmation email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: `Appointment Confirmation - Determan Tech Help`,
            // Ensure the text is a single, clean string literal using \n for newlines
            text: `Hi ${name},\n\nYour appointment has been scheduled!\n\n📅 Date & Time: ${new Date(date).toLocaleString()}\n📍 Location: ${location}\n📝 Problem: ${problem}\n\nIf you have any questions, feel free to reply to this email.\n\nThanks!\nDeterman Tech Help`
        };

        // Explicitly format the callback with braces to ensure clarity and avoid subtle parsing issues
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending email:", error);
            } else {
                console.log("Email sent:", info.response);
            }
        });

        res.json({ message: 'Appointment added to Google Calendar!', eventId: response.data.id });

    } catch (error) {
        console.error('Error adding event:', error);
        res.status(500).json({ error: 'Error adding event', details: error.message });
    }
});

// ✅ Route to Fetch Busy Times
app.get('/get-busy-times', async (req, res) => {
    try {
        console.log("Fetching busy times...");
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
        console.error('Detailed error object:', error);
        res.status(500).json({ error: 'Error fetching busy times', details: error.message });
    }
});

const fs = require('fs');

const REVIEWS_FILE = path.join(__dirname, 'reviews.json');

// ✅ Route to Fetch Reviews
app.get('/get-reviews', (req, res) => {
    fs.readFile(REVIEWS_FILE, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading reviews:', err);
            return res.status(500).json({ error: 'Failed to load reviews' });
        }
        res.json(JSON.parse(data));
    });
});

// ✅ Route to Add a Review
app.post('/add-review', (req, res) => {
    const { name, text } = req.body;
    if (!name || !text) {
        return res.status(400).json({ error: "Missing name or review text" });
    }

    fs.readFile(REVIEWS_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to read file' });

        const reviews = JSON.parse(data);
        const newReview = { name, text };
        reviews.push(newReview);

        fs.writeFile(REVIEWS_FILE, JSON.stringify(reviews, null, 2), (err) => {
            if (err) return res.status(500).json({ error: 'Failed to save review' });

            res.json({ message: "Review added!", review: newReview });
        });
    });
});

// ✅ Route to Get Google API Key
app.get('/get-google-api-key', (req, res) => {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (apiKey) {
        res.json({ apiKey: apiKey });
    } else {
        res.status(500).json({ error: 'Google API key not configured on the server.' });
    }
});

// ✅ Start Server
app.listen(5001, '0.0.0.0', () => console.log('Server running on port 5001'));
