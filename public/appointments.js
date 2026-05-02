// appointments.js for determantechhelp.com (same logic as mcintoshpowerwash, API endpoints updated)

document.addEventListener('DOMContentLoaded', async function () {
    const calendarEl = document.getElementById('calendar');
    const loadingOverlay = document.getElementById('loading-overlay');
    const appointmentForm = document.getElementById('appointmentForm');
  
    if (loadingOverlay) {
      loadingOverlay.style.display = 'block';
    }
  
    // --- View Switching Logic ---
    const showSimpleBtn = document.getElementById('show-simple');
    const showCalendarBtn = document.getElementById('show-calendar');
    const simpleView = document.getElementById('simple-view');
    const calendarView = document.getElementById('calendar-view');

    if (showSimpleBtn && showCalendarBtn) {
      showSimpleBtn.addEventListener('click', () => {
        showSimpleBtn.classList.add('active');
        showCalendarBtn.classList.remove('active');
        simpleView.classList.add('active');
        calendarView.classList.remove('active');
      });

      showCalendarBtn.addEventListener('click', () => {
        showCalendarBtn.classList.add('active');
        showSimpleBtn.classList.remove('active');
        calendarView.classList.add('active');
        simpleView.classList.remove('active');
        // Trigger calendar resize/render when shown
        setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
      });
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
          const extendedEnd = new Date(end.getTime() + 60 * 60 * 1000);
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
  
            handleTimeSelection(info.start, info.end);
          }
        });
  
        calendar.render();

        // --- Simple View Date/Time Generation ---
        const dateCardsContainer = document.getElementById('date-cards');
        const timeSelection = document.getElementById('time-selection');
        const timeSlotsContainer = document.getElementById('time-slots');

        function generateDates() {
          dateCardsContainer.innerHTML = '';
          const today = new Date();
          for (let i = 1; i <= 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            
            const card = document.createElement('div');
            card.className = 'booking-card fade-in';
            card.innerHTML = `
              <h3>${date.toLocaleDateString('en-US', { weekday: 'short' })}</h3>
              <p>${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
            `;
            
            card.addEventListener('click', () => {
              document.querySelectorAll('.date-grid .booking-card').forEach(c => c.classList.remove('active'));
              card.classList.add('active');
              generateTimeSlots(date);
            });
            
            dateCardsContainer.appendChild(card);
          }
        }

        function generateTimeSlots(selectedDate) {
          timeSelection.style.display = 'block';
          timeSlotsContainer.innerHTML = '';
          
          const startHour = 9; // 9 AM
          const endHour = 19;  // 7 PM
          
          for (let hour = startHour; hour <= endHour; hour++) {
            const slotStart = new Date(selectedDate);
            slotStart.setHours(hour, 0, 0, 0);
            const slotEnd = new Date(slotStart);
            slotEnd.setHours(hour + 1, 0, 0, 0);

            // Check if this slot overlaps with any busy times
            const isBusy = events.some(event => {
              return (
                slotStart < new Date(event.end) &&
                slotEnd > new Date(event.start)
              );
            });

            if (!isBusy) {
              const btn = document.createElement('div');
              btn.className = 'booking-card fade-in';
              btn.style.padding = '1rem';
              btn.innerHTML = `<h3>${slotStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</h3>`;
              
              btn.addEventListener('click', () => {
                handleTimeSelection(slotStart, slotEnd);
              });
              
              timeSlotsContainer.appendChild(btn);
            }
          }
          
          timeSelection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function handleTimeSelection(start, end) {
          console.log("Time selected:", start);
          const options = { hour: 'numeric', minute: 'numeric', hour12: true };
          const startTime = start.toLocaleTimeString('en-US', options);
          const endTime = end.toLocaleTimeString('en-US', options);
          const selectedDateStr = start.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

          const timeDisplayString = `Selected Slot: ${selectedDateStr}, ${startTime} - ${endTime}`;
          const selectedTimeDisplay = document.getElementById('selected-time-display');
          if (selectedTimeDisplay) {
            selectedTimeDisplay.innerHTML = timeDisplayString;
          }

          const bookingForm = document.getElementById('booking-form');
          if (bookingForm) {
            bookingForm.style.display = 'block';
            bookingForm.scrollIntoView({ behavior: 'smooth' });
          }
          const selectedDateInput = document.getElementById('selected-date');
          if (selectedDateInput) {
            selectedDateInput.value = start.toISOString();
          }
        }

        console.log("Initializing Quick Book dates...");
        generateDates();

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
  
  // Open-source address autocomplete using Photon (OpenStreetMap)
  const locationInput = document.getElementById('location');
  const resultsContainer = document.getElementById('location-results');

  if (locationInput && resultsContainer) {
    let timeout = null;

    locationInput.addEventListener('input', () => {
      clearTimeout(timeout);
      const query = locationInput.value.trim();

      if (query.length < 3) {
        resultsContainer.style.display = 'none';
        return;
      }

      timeout = setTimeout(async () => {
        try {
          // Added lat/lon bias for Lake Barcroft, VA (38.85, -77.16) to prioritize local results
          const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=38.85&lon=-77.16&limit=5`);
          const data = await res.json();
          
          resultsContainer.innerHTML = '';
          if (data.features.length > 0) {
            data.features.forEach(feature => {
              const props = feature.properties;
              
              // Only show US results
              if (props.country !== 'United States' && props.countrycode !== 'US') return;

              // Build the address string: Prioritize House Number + Street
              const mainAddress = [props.housenumber, props.street || props.name]
                .filter(Boolean)
                .join(' ');
              
              const cityState = [props.city || props.town, props.state]
                .filter(Boolean)
                .join(', ');

              const fullAddress = [mainAddress, cityState].filter(Boolean).join(', ');
              
              const div = document.createElement('div');
              div.className = 'result-item';
              div.innerText = fullAddress;
              div.addEventListener('click', () => {
                locationInput.value = fullAddress;
                resultsContainer.style.display = 'none';
              });
              resultsContainer.appendChild(div);
            });
            resultsContainer.style.display = 'block';
          } else {
            resultsContainer.style.display = 'none';
          }
        } catch (err) {
          console.error('Autocomplete error:', err);
        }
      }, 300);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!locationInput.contains(e.target) && !resultsContainer.contains(e.target)) {
        resultsContainer.style.display = 'none';
      }
    });
  }
});
  