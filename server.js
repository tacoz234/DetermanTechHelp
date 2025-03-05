require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
app.use(express.json());
app.use(cors()); // ✅ Allows frontend requests

const { OAuth2 } = google.auth;

const oauth2Client = new OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);

oauth2Client.setCredentials({
    refresh_token: process.env.REFRESH_TOKEN
});

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your email
        pass: process.env.EMAIL_PASS  // Your app password (not regular password)
    }
});



// ✅ Route to Add an Event
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

        console.log('Event Created:', response.data);

        // 📧 Send confirmation email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: `Appointment Confirmation - Determan Tech Help`,
            text: `Hi ${name},\n\nYour appointment has been scheduled!\n\n📅 Date & Time: ${new Date(date).toLocaleString()}
            📍 Location: ${location}
            📝 Problem: ${problem}\n\nIf you have any questions, feel free to reply to this email.\n\nThanks!\nDeterman Tech Help`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending email:", error);
            } else {
                console.log("Email sent:", info.response);
            }
        });

        res.json({
            message: 'Appointment added to Google Calendar!',
            eventId: response.data.id
        });

    } catch (error) {
        console.error('Error adding event:', error);
        res.status(500).json({ error: 'Error adding event' });
    }

    const event = {
        summary: `Tech Help with ${name}`,
        description: `Problem: ${problem}\nEmail: ${email}`,
        location: location, // ✅ Now correctly saves the selected location
        start: { dateTime: date, timeZone: 'America/New_York' },
        end: { dateTime: new Date(new Date(date).getTime() + 60 * 60000), timeZone: 'America/New_York' },
        reminders: { useDefault: true }
    };
    
});


// ✅ Route to Fetch Busy Times
app.get('/get-busy-times', async (req, res) => {
    try {
        console.log("Fetching busy times...");

        const events = await calendar.events.list({
            calendarId: 'primary',  // Ensure it's using the correct calendar
            timeMin: new Date().toISOString(),
            maxResults: 50,
            singleEvents: true,
            orderBy: 'startTime'
        });

        console.log("Fetched events:", events.data.items); // Log all fetched events

        const busyTimes = events.data.items.map(event => ({
            title: 'Busy',
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            backgroundColor: '#ff0000',
            borderColor: '#ff0000',
            display: 'background'
        }));

        console.log("Returning busy times:", busyTimes);
        res.json(busyTimes);
    } catch (error) {
        console.error('Error fetching busy times:', error);
        res.status(500).json({ error: 'Error fetching busy times' });
    }
});



app.listen(5001, () => console.log('Server running on port 5001'));
