// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const app = express();
app.enable('trust proxy');
app.use(express.json());
const corsOptions = {
    origin: 'https://determantechhelp.com', // only allow your frontend
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
  };
  app.use(cors(corsOptions));
  
// ✅ Force HTTPS Redirection
app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https' && req.header('x-forwarded-proto') !== undefined) {
        return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }
    next();
});

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

// ✅ Route to Add an Event (Now as a Request)
app.post('/add-event', async (req, res) => {
    try {
        console.log("Received appointment request:", req.body);
        const { name, email, date, problem, location } = req.body;
        if (!name || !email || !date || !problem || !location) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        const event = {
            summary: `[PENDING] Tech Support - ${name}`,
            description: `CUSTOMER_EMAIL: ${email}\nProblem: ${problem}\nLocation: ${location}`,
            location: location, 
            start: { dateTime: date, timeZone: 'America/New_York' },
            end: { dateTime: new Date(new Date(date).getTime() + 60 * 60000), timeZone: 'America/New_York' },
            reminders: { useDefault: true },
            colorId: '5' // Yellow/Orange for pending
        };

        const response = await calendar.events.insert({ calendarId: 'primary', resource: event });
        const eventId = response.data.id;
        console.log('Pending Event Created:', eventId);

        // 📧 1. Send "Request Received" email to Customer
        const customerMailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: `Appointment Request Received - Determan Tech Help`,
            text: `Hi ${name},\n\nI've received your appointment request for ${new Date(date).toLocaleString()}.\n\n⚠️ Please note: This is NOT a confirmed appointment yet. I will review my schedule and send you a final confirmation shortly.\n\nDetails:\n📍 Location: ${location}\n📝 Problem: ${problem}\n\nThanks!\nCole Determan`
        };

        // 📧 2. Send "Action Required" email to Cole (Owner)
        const confirmLink = `https://determantechhelp.com/confirm-appointment?id=${eventId}&token=${process.env.ADMIN_TOKEN || 'secret'}`;
        const denyLink = `https://determantechhelp.com/deny-appointment?id=${eventId}&token=${process.env.ADMIN_TOKEN || 'secret'}`;
        
        const ownerMailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: `🚨 NEW APPOINTMENT REQUEST: ${name}`,
            text: `New request from ${name} (${email})\n\nTime: ${new Date(date).toLocaleString()}\nLocation: ${location}\nProblem: ${problem}\n\n✅ CONFIRM: ${confirmLink}\n\n❌ DENY: ${denyLink}`
        };

        transporter.sendMail(customerMailOptions);
        transporter.sendMail(ownerMailOptions);

        res.json({ message: 'Request submitted! Please check your email for updates.', eventId: eventId });

    } catch (error) {
        console.error('Error adding event:', error);
        res.status(500).json({ error: 'Error submitting request', details: error.message });
    }
});

// ✅ Route to Confirm an Appointment
app.get('/confirm-appointment', async (req, res) => {
    const { id, token } = req.query;
    if (token !== (process.env.ADMIN_TOKEN || 'secret')) {
        return res.status(403).send("Unauthorized");
    }

    try {
        const event = await calendar.events.get({ calendarId: 'primary', eventId: id });
        const description = event.data.description;
        const customerEmail = description.match(/CUSTOMER_EMAIL: (.*)\n/)?.[1];
        const name = event.data.summary.replace('[PENDING] Tech Support - ', '');

        // Update Calendar Event
        await calendar.events.patch({
            calendarId: 'primary',
            eventId: id,
            resource: {
                summary: `CONFIRMED: Tech Support - ${name}`,
                colorId: '10' // Green for confirmed
            }
        });

        // 📧 Send Real Confirmation to Customer
        if (customerEmail) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: customerEmail,
                subject: `Confirmed: Your Appointment with Determan Tech Help`,
                text: `Hi ${name},\n\nGreat news! Your appointment has been CONFIRMED for ${new Date(event.data.start.dateTime).toLocaleString()}.\n\nSee you then!\n\nCole Determan\n(571) 279-8040`
            };
            transporter.sendMail(mailOptions);
        }

        res.send(`<h1>Appointment Confirmed!</h1><p>Confirmation email sent to ${customerEmail}.</p>`);
    } catch (error) {
        console.error("Confirm error:", error);
        res.status(500).send("Error confirming appointment.");
    }
});

// ✅ Route to Deny an Appointment
app.get('/deny-appointment', async (req, res) => {
    const { id, token } = req.query;
    if (token !== (process.env.ADMIN_TOKEN || 'secret')) {
        return res.status(403).send("Unauthorized");
    }

    try {
        const event = await calendar.events.get({ calendarId: 'primary', eventId: id });
        const description = event.data.description;
        const customerEmail = description.match(/CUSTOMER_EMAIL: (.*)\n/)?.[1];
        const name = event.data.summary.replace('[PENDING] Tech Support - ', '');

        // Delete Event
        await calendar.events.delete({ calendarId: 'primary', eventId: id });

        // 📧 Send Denial to Customer
        if (customerEmail) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: customerEmail,
                subject: `Update regarding your appointment request`,
                text: `Hi ${name},\n\nI'm sorry, but I won't be able to make the requested time for your tech support appointment. Please feel free to book another time on the website or reply to this email to find a different slot.\n\nBest,\nCole Determan`
            };
            transporter.sendMail(mailOptions);
        }

        res.send(`<h1>Appointment Denied</h1><p>The event has been removed and the customer notified.</p>`);
    } catch (error) {
        console.error("Deny error:", error);
        res.status(500).send("Error denying appointment.");
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

// ✅ Route to Handle Contact Form
app.post('/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        
        if (!name || !email || !message) {
            return res.status(400).json({ error: "Missing required fields (name, email, message)." });
        }

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Send to yourself
            replyTo: email,
            subject: `New Contact Form Message: ${subject || 'No Subject'}`,
            text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending contact email:", error);
                return res.status(500).json({ error: "Failed to send message." });
            }
            console.log("Contact email sent:", info.response);
            res.json({ message: "Your message has been sent successfully!" });
        });

    } catch (error) {
        console.error("Contact route error:", error);
        res.status(500).json({ error: "Server error." });
    }
});

// ✅ Start Server
app.listen(5001, '0.0.0.0', () => console.log('Server running on port 5001'));
