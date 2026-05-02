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
        const res = await fetch('/get-busy-times');
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
  
        const response = await fetch('/add-event', {
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
  
        const result = await response.json();
        // Build appointment details for confirmation
        const confirmationDiv = document.getElementById('confirmation-message');
        if (confirmationDiv) {
          const startDate = new Date(formData.date);
          confirmationDiv.innerHTML =
            `<div class="alert alert-success">
                <h4>Request Submitted!</h4>
                <p>Hi ${formData.name}, your request for <strong>${startDate.toLocaleString()}</strong> has been sent.</p>
                <p style="color: #ffcc00; font-weight: bold;">⚠️ Note: This is NOT a confirmed appointment yet.</p>
                <p>Cole will review your request and send a final confirmation email shortly.</p>
                <hr style="border-top: 1px solid var(--glass-border); margin: 1rem 0;">
                <p style="font-size: 0.9rem; opacity: 0.8;">
                    <strong>Location:</strong> ${formData.location}<br>
                    <strong>Problem:</strong> ${formData.notes}
                </p>
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
    try {
      const res = await fetch('/get-google-api-key');
      if (!res.ok) throw new Error('Failed to fetch API key');
      const data = await res.json();
      const apiKey = data.apiKey;
    
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap&loading=async`;
      script.async = true;
      script.defer = true;
      script.onerror = () => console.warn("Google Maps failed to load, address autocomplete disabled.");
    
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
    } catch (err) {
      console.warn("Could not initialize Google Places:", err);
    }
  }
  
  document.addEventListener('DOMContentLoaded', function () {
    loadGooglePlacesScript();
  });
  