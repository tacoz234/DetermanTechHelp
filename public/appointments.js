// appointments.js for determantechhelp.com (same logic as mcintoshpowerwash, API endpoints updated)

document.addEventListener('DOMContentLoaded', async function () {
    const calendarEl = document.getElementById('calendar');
    const loadingOverlay = document.getElementById('loading-overlay');
    const appointmentForm = document.getElementById('appointmentForm');
  
    if (loadingOverlay) {
      loadingOverlay.style.display = 'block';
    }
  
    if (calendarEl) {
      try {
        const res = await fetch('https://determantechhelp.com/get-busy-times');
        const busyTimes = await res.json();
  
        const busyDays = new Set();
        busyTimes.forEach(slot => {
          const date = new Date(slot.start).toISOString().split('T')[0];
          busyDays.add(date);
        });
  
        const events = busyTimes.map(slot => {
          const start = new Date(slot.start);
          const end = new Date(slot.end);
          // Add one more block (e.g., 1 hour) after the appointment
          const extendedEnd = new Date(end.getTime() + 60 * 60 * 1000); // adjust block size as needed
          return {
            start: start.toISOString(),
            end: extendedEnd.toISOString(),
            display: 'background',
            color: '#ff9999'
          };
        });
  
        const calendar = new FullCalendar.Calendar(calendarEl, {
          initialView: 'timeGridWeek',
          selectable: true,
          slotMinTime: '09:00:00',
          slotMaxTime: '20:00:00',
          allDaySlot: false,
          height: 'auto',
          expandRows: true,
          weekends: true,
          dayHeaderFormat: { weekday: 'short' },
          events,
          select: function (info) {
            // Only check for overlap with events
            const overlapping = events.some(event => {
              return (
                info.start < new Date(event.end) &&
                info.end > new Date(event.start)
              );
            });
            if (overlapping) {
              alert("❌ This time slot is unavailable.");
              calendar.unselect();
              return;
            }
  
            const options = { hour: 'numeric', minute: 'numeric', hour12: true };
            const startTime = info.start.toLocaleTimeString('en-US', options);
            const endTime = info.end.toLocaleTimeString('en-US', options);
            const selectedDateStr = info.start.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
            const timeDisplayString = `Selected Slot: ${selectedDateStr}, ${startTime} - ${endTime}`;
            const selectedTimeDisplay = document.getElementById('selected-time-display');
            if (selectedTimeDisplay) {
              selectedTimeDisplay.innerHTML = timeDisplayString;
            }
  
            const bookingForm = document.getElementById('booking-form');
            if (bookingForm) {
              bookingForm.style.display = 'block';
            }
            const selectedDateInput = document.getElementById('selected-date');
            if (selectedDateInput) {
              selectedDateInput.value = info.startStr;
            }
          }
        });
  
        calendar.render();
      } catch (error) {
        console.error("Error loading calendar or busy times:", error);
        calendarEl.innerHTML = "<p>Could not load appointment calendar. Please try refreshing the page.</p>";
      } finally {
        if (loadingOverlay) {
          loadingOverlay.style.display = 'none';
        }
      }
    } else if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
    }
  
    if (appointmentForm) {
      appointmentForm.addEventListener('submit', async function (e) {
        e.preventDefault();
  
        const formData = {
          name: document.getElementById('name').value,
          email: document.getElementById('email').value,
          date: document.getElementById('selected-date').value,
          service: document.getElementById('service').value,
          notes: document.getElementById('questions').value,
          location: document.getElementById('location').value,
        };
  
        const start = formData.date;
        const end = new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
  
        const response = await fetch('https://determantechhelp.com/add-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            date: start, // send as 'date' not 'start'
            problem: formData.notes, // backend expects 'problem', not 'notes'
            location: formData.location
          })                    
        });
  
        const message = await response.text();
        // Build appointment details for confirmation
        const confirmationDiv = document.getElementById('confirmation-message');
        if (confirmationDiv) {
          // Parse the selected date/time for display and Google Calendar link
          const startDate = new Date(formData.date);
          const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
          const pad = n => n.toString().padStart(2, '0');
          const formatForGCal = d =>
            d.getUTCFullYear() +
            pad(d.getUTCMonth() + 1) +
            pad(d.getUTCDate()) + 'T' +
            pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
          const gcalStart = formatForGCal(startDate);
          const gcalEnd = formatForGCal(endDate);
          const gcalUrl =
            'https://calendar.google.com/calendar/render?action=TEMPLATE' +
            '&text=' + encodeURIComponent('Tech Support Appointment: Cole Determan') +
            '&dates=' + gcalStart + '/' + gcalEnd +
            '&details=' + encodeURIComponent('Service: ' + formData.service + '\nProblem: ' + formData.notes + '\nLocation: ' + formData.location) +
            '&location=' + encodeURIComponent(formData.location) +
            '&sf=true&output=xml';
          confirmationDiv.innerHTML =
            `<div class="alert alert-success"><h4>Appointment Booked!</h4>
            <p><strong>Name:</strong> ${formData.name}<br>
            <strong>Email:</strong> ${formData.email}<br>
            <strong>Date & Time:</strong> ${startDate.toLocaleString()}<br>
            <strong>Location:</strong> ${formData.location}<br>
            <strong>Service:</strong> ${formData.service}<br>
            <strong>Questions/Comments:</strong> ${formData.notes}</p>
            <a href="${gcalUrl}" target="_blank" class="btn btn-success">Add to Google Calendar</a>
            </div>`;
          confirmationDiv.style.display = 'block';
        }
        const bookingForm = document.getElementById('booking-form');
        if (bookingForm) {
          bookingForm.style.display = 'none';
        }
      });
    }
  });
  
  async function loadGooglePlacesScript() {
    const res = await fetch('https://api.determantechhelp.com:8443/get-google-api-key');
    const data = await res.json();
    const apiKey = data.apiKey;
  
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap`;
    script.async = true;
    script.defer = true;
  
    window.initMap = function () {
      const locationInput = document.getElementById('location');
      if (locationInput && window.google && window.google.maps && window.google.maps.places) {
        new google.maps.places.Autocomplete(locationInput, {
          types: ['address'],
          componentRestrictions: { country: 'us' }
        });
      }
      delete window.initMap;
    };
  
    document.head.appendChild(script);
  }
  
  document.addEventListener('DOMContentLoaded', function () {
    loadGooglePlacesScript();
  });
  