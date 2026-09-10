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

// ✅ Route to Add an Event (Now as a Request)
app.post('/add-event', async (req, res) => {
    try {
        console.log("Received appointment request:", req.body);
        const { name, email, date, problem, location } = req.body;
        if (!name || !email || !date || !problem || !location) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        // Validate that weekdays from 8 AM to 5 PM are not available
        try {
            const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false, weekday: 'short' }).formatToParts(new Date(date));
            const weekday = parts.find(p => p.type === 'weekday')?.value;
            const hour = parseInt(parts.find(p => p.type === 'hour')?.value, 10);
            const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday);

            if (isWeekday && (hour >= 8 && hour < 17)) {
                return res.status(400).json({ error: "Weekdays from 8:00 AM to 5:00 PM are unavailable. Please choose after 5:00 PM or on weekends." });
            }
        } catch (tzErr) {
            console.warn("Timezone validation error:", tzErr);
        }

        // Attempt Google Calendar event creation without letting failure block emails
        let eventId = null;
        let calendarSynced = false;
        try {
            const event = {
                summary: `[PENDING] Tech Support - ${name}`,
                description: `CUSTOMER_EMAIL: ${email}\nProblem: ${problem}\nLocation: ${location}`,
                location: location, 
                start: { dateTime: date, timeZone: 'America/New_York' },
                end: { dateTime: new Date(new Date(date).getTime() + 60 * 60000), timeZone: 'America/New_York' },
                reminders: { useDefault: true },
                colorId: '5' // Yellow/Orange for pending
            };

            const calResponse = await calendar.events.insert({ calendarId: 'primary', resource: event });
            eventId = calResponse.data?.id;
            calendarSynced = true;
            console.log('Pending Event Created in Google Calendar:', eventId);
        } catch (calError) {
            console.warn('Google Calendar sync skipped/failed (OAuth issue or offline). Proceeding with email notification:', calError.message || calError);
        }

        const formattedDate = new Date(date).toLocaleString('en-US', {
            timeZone: 'America/New_York',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        // 📧 1. Send "Request Received" email to Customer
        const customerMailOptions = {
            from: `"Cole at Determan Tech Help" <${process.env.EMAIL_USER}>`,
            to: email,
            replyTo: process.env.EMAIL_USER,
            subject: `Appointment Request Received - Determan Tech Help`,
            text: `Hi ${name},\n\nI've received your appointment request for ${formattedDate}.\n\n⚠️ Please note: This is an appointment request, NOT a confirmed booking yet. I will review my schedule and send you a final confirmation shortly.\n\nDetails:\n📍 Location: ${location}\n📝 Service/Problem: ${problem}\n\nIf you need immediate assistance or have questions, reply directly to this email or call/text (571) 279-8040.\n\nBest,\nCole Determan\nDeterman Tech Help\nhttps://determantechhelp.com`
        };

        // 📧 2. Send "Action Required" notification email to Cole (Owner at determantechhelp@gmail.com)
        let actionLinks = '';
        if (eventId) {
            const confirmLink = `https://determantechhelp.com/confirm-appointment?id=${eventId}&token=${process.env.ADMIN_TOKEN || 'secret'}`;
            const denyLink = `https://determantechhelp.com/deny-appointment?id=${eventId}&token=${process.env.ADMIN_TOKEN || 'secret'}`;
            actionLinks = `\n\n✅ 1-CLICK CALENDAR CONFIRM: ${confirmLink}\n\n❌ 1-CLICK CALENDAR DENY: ${denyLink}`;
        } else {
            actionLinks = `\n\n⚠️ Calendar Note: Google Calendar sync was skipped (refresh token expired/disabled). Reply directly to this email to contact ${name}, or add manually to your calendar.`;
        }
        
        const ownerMailOptions = {
            from: `"Determan Tech Help Notifications" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            replyTo: email, // Directly reply to customer from Gmail
            subject: `🚨 NEW APPOINTMENT REQUEST: ${name} (${formattedDate})`,
            text: `New appointment request received from website:\n\n👤 Name: ${name}\n✉️ Email: ${email}\n📅 Requested Time: ${formattedDate}\n📍 Location: ${location}\n📝 Service/Problem: ${problem}${actionLinks}`
        };

        const emailResults = await Promise.allSettled([
            transporter.sendMail(customerMailOptions),
            transporter.sendMail(ownerMailOptions)
        ]);

        if (emailResults[0].status === 'fulfilled') {
            console.log('Customer notification email sent successfully:', emailResults[0].value?.messageId);
        } else {
            console.error('Failed to send customer notification email:', emailResults[0].reason);
        }

        if (emailResults[1].status === 'fulfilled') {
            console.log('Owner notification email sent successfully:', emailResults[1].value?.messageId);
        } else {
            console.error('Failed to send owner notification email:', emailResults[1].reason);
        }

        res.json({
            message: 'Request submitted! Please check your email for updates.',
            eventId: eventId || null,
            calendarSynced
        });

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
        const events = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            maxResults: 50,
            singleEvents: true,
            orderBy: 'startTime'
        });

        const busyTimes = (events.data.items || []).map(event => ({
            title: 'Busy',
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            backgroundColor: '#ff0000',
            borderColor: '#ff0000',
            display: 'background'
        }));

        res.json(busyTimes);
    } catch (error) {
        console.warn('Google Calendar get-busy-times unavailable (using defaults):', error.message || error);
        res.json([]);
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

            const publicReviewsFile = path.join(__dirname, 'public', 'reviews.json');
            fs.writeFile(publicReviewsFile, JSON.stringify(reviews, null, 2), () => {});

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
