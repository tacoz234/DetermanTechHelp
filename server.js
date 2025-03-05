require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');

const app = express();
const port = 5001;

app.use(express.json());

// Set up OAuth2 client with stored credentials
const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// API to Add an Event to Google Calendar
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

      res.json({
          message: 'Appointment added to Google Calendar!',
          eventId: response.data.id,
          eventDetails: { name, email, date, problem, location }
      });

  } catch (error) {
      console.error('Error adding event:', error.response ? error.response.data : error);
      res.status(500).json({ error: 'Error adding event' });
  }
});


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
      res.status(500).send('Error fetching busy times');
  }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
