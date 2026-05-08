// appointments.js for determantechhelp.com
document.addEventListener('DOMContentLoaded', async function () {
    const calendarEl = document.getElementById('calendar');
    const loadingOverlay = document.getElementById('loading-overlay');
    const appointmentForm = document.getElementById('appointmentForm');
    const dateCardsContainer = document.getElementById('date-cards');
    const timeSelection = document.getElementById('time-selection');
    const timeSlotsContainer = document.getElementById('time-slots');
    
    let calendarEvents = [];

    // --- Core Navigation ---
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
            setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
        });
    }

    // --- Common Functions ---
    function handleTimeSelection(start, end) {
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

    // --- Simple View Logic ---
    function generateDates() {
        if (!dateCardsContainer) {
            console.error("CRITICAL: date-cards container not found!");
            return;
        }
        console.log("Generating Quick Book dates for container:", dateCardsContainer);
        dateCardsContainer.innerHTML = '';
        const today = new Date();
        for (let i = 1; i <= 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            
            const card = document.createElement('div');
            card.className = 'booking-card'; // Removed fade-in to ensure immediate visibility
            card.style.border = '1px solid #0070f3'; // Forced bright border for debugging
            card.innerHTML = `
                <h3 style="color: white; margin-bottom: 5px;">${date.toLocaleDateString('en-US', { weekday: 'short' })}</h3>
                <p style="color: rgba(255,255,255,0.7); margin: 0;">${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
            `;
            
            card.addEventListener('click', () => {
                console.log("Date card clicked:", date);
                document.querySelectorAll('.date-grid .booking-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                
                // Hide form and clear previous selection when date changes
                const bookingForm = document.getElementById('booking-form');
                if (bookingForm) bookingForm.style.display = 'none';
                const selectedTimeDisplay = document.getElementById('selected-time-display');
                if (selectedTimeDisplay) selectedTimeDisplay.innerHTML = '';
                
                generateTimeSlots(date);
            });
            dateCardsContainer.appendChild(card);
        }
        console.log("Successfully appended 7 date cards.");
    }

    function generateTimeSlots(selectedDate) {
        if (!timeSelection || !timeSlotsContainer) return;
        timeSelection.style.display = 'block';
        timeSlotsContainer.innerHTML = '';
        
        const startHour = 9; 
        const endHour = 19;  
        
        for (let hour = startHour; hour <= endHour; hour++) {
            const slotStart = new Date(selectedDate);
            slotStart.setHours(hour, 0, 0, 0);
            const slotEnd = new Date(slotStart);
            slotEnd.setHours(hour + 1, 0, 0, 0);

            const isBusy = calendarEvents.some(event => {
                return (slotStart < new Date(event.end) && slotEnd > new Date(event.start));
            });

            if (!isBusy) {
                const btn = document.createElement('div');
                btn.className = 'booking-card'; // Removed fade-in to ensure immediate visibility
                btn.style.padding = '1rem';
                btn.innerHTML = `<h3>${slotStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</h3>`;
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.time-grid .booking-card').forEach(c => c.classList.remove('active'));
                    btn.classList.add('active');
                    handleTimeSelection(slotStart, slotEnd);
                });
                timeSlotsContainer.appendChild(btn);
            }
        }
        timeSelection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Load dates immediately!
    console.log("Attempting to load dates...");
    generateDates();
    
    // Backup: Try again after a split second in case the DOM was slow
    setTimeout(generateDates, 500);

    // --- Calendar & Busy Times Loading ---
    if (calendarEl) {
        if (loadingOverlay) loadingOverlay.style.display = 'block';
        try {
            const res = await fetch('/get-busy-times');
            const busyTimes = await res.json();
            
            calendarEvents = busyTimes.map(slot => {
                const start = new Date(slot.start);
                const end = new Date(slot.end);
                return {
                    start: start.toISOString(),
                    end: new Date(end.getTime() + 60 * 60 * 1000).toISOString(),
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
                events: calendarEvents,
                select: function (info) {
                    const isBusy = calendarEvents.some(event => {
                        return (info.start < new Date(event.end) && info.end > new Date(event.start));
                    });
                    if (isBusy) {
                        alert("❌ This time slot is unavailable.");
                        calendar.unselect();
                        return;
                    }
                    handleTimeSelection(info.start, info.end);
                }
            });
            calendar.render();
        } catch (error) {
            console.error("Error loading busy times:", error);
        } finally {
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }
    }

    // --- Form Submission ---
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

            const response = await fetch('/add-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    date: formData.date,
                    problem: formData.notes,
                    location: formData.location
                })                    
            });

            const confirmationDiv = document.getElementById('confirmation-message');
            if (confirmationDiv) {
                const startDate = new Date(formData.date);
                confirmationDiv.innerHTML = `
                    <div class="alert alert-success">
                        <h4>Request Submitted!</h4>
                        <p>Hi ${formData.name}, your request for <strong>${startDate.toLocaleString()}</strong> has been sent.</p>
                        <p style="color: #ffcc00; font-weight: bold;">⚠️ Note: This is NOT a confirmed appointment yet.</p>
                        <p>Cole will review your request and send a final confirmation email shortly.</p>
                    </div>`;
                confirmationDiv.style.display = 'block';
                const bookingForm = document.getElementById('booking-form');
                if (bookingForm) bookingForm.style.display = 'none';
            }
        });
    }

    // --- Location Autocomplete ---
    const locationInput = document.getElementById('location');
    const resultsContainer = document.getElementById('location-results');
    if (locationInput && resultsContainer) {
        let timeout = null;
        locationInput.addEventListener('input', () => {
            clearTimeout(timeout);
            const query = locationInput.value.trim();
            if (query.length < 3) { resultsContainer.style.display = 'none'; return; }
            timeout = setTimeout(async () => {
                try {
                    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=38.85&lon=-77.16&limit=5`);
                    const data = await res.json();
                    resultsContainer.innerHTML = '';
                    data.features.forEach(feature => {
                        const props = feature.properties;
                        if (props.country !== 'United States' && props.countrycode !== 'US') return;
                        const fullAddress = [([props.housenumber, props.street || props.name].filter(Boolean).join(' ')), ([props.city || props.town, props.state].filter(Boolean).join(', '))].filter(Boolean).join(', ');
                        const div = document.createElement('div');
                        div.className = 'result-item';
                        div.innerText = fullAddress;
                        div.addEventListener('click', () => { locationInput.value = fullAddress; resultsContainer.style.display = 'none'; });
                        resultsContainer.appendChild(div);
                    });
                    resultsContainer.style.display = data.features.length ? 'block' : 'none';
                } catch (err) { console.error('Autocomplete error:', err); }
            }, 300);
        });
        document.addEventListener('click', (e) => {
            if (!locationInput.contains(e.target) && !resultsContainer.contains(e.target)) resultsContainer.style.display = 'none';
        });
    }
    // Prevent zooming
    document.addEventListener('touchstart', function (event) {
        if (event.touches.length > 1) {
            event.preventDefault();
        }
    }, { passive: false });

    let lastTouchEnd = 0;
    document.addEventListener('touchend', function (event) {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
});