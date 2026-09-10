// appointments.js for determantechhelp.com
document.addEventListener('DOMContentLoaded', function () {
    const calendarEl = document.getElementById('calendar');
    const loadingOverlay = document.getElementById('loading-overlay');
    const appointmentForm = document.getElementById('appointmentForm');
    const dateCardsContainer = document.getElementById('date-cards');
    const timeSelection = document.getElementById('time-selection');
    const timeSlotsContainer = document.getElementById('time-slots');

    // --- Core Navigation ---
    const showSimpleBtn = document.getElementById('show-simple');
    const showCalendarBtn = document.getElementById('show-calendar');
    const simpleView = document.getElementById('simple-view');
    const calendarView = document.getElementById('calendar-view');

    let calendarEvents = [
        // Recurring unavailable block for Weekdays 8:00 AM - 5:00 PM
        {
            groupId: 'weekdayUnavailable',
            daysOfWeek: [1, 2, 3, 4, 5], // Monday through Friday
            startTime: '08:00:00',
            endTime: '17:00:00',
            display: 'background',
            color: '#fee2e2'
        }
    ];

    let calendar = null;
    let calendarInitialized = false;

    // Switch between Simple View and Calendar View
    function switchView(toCalendar) {
        if (toCalendar) {
            showCalendarBtn.classList.add('active');
            showSimpleBtn.classList.remove('active');
            calendarView.classList.add('active');
            simpleView.classList.remove('active');

            // Render calendar after container becomes visible
            if (!calendarInitialized) {
                initCalendar();
            } else if (calendar) {
                calendar.updateSize();
            }

            // Secondary resize trigger to guarantee proper dimension calculations
            setTimeout(() => {
                if (calendar) {
                    calendar.updateSize();
                }
            }, 60);
        } else {
            showSimpleBtn.classList.add('active');
            showCalendarBtn.classList.remove('active');
            simpleView.classList.add('active');
            calendarView.classList.remove('active');
        }
    }

    if (showSimpleBtn && showCalendarBtn) {
        showSimpleBtn.addEventListener('click', () => switchView(false));
        showCalendarBtn.addEventListener('click', () => switchView(true));
    }

    // --- Common Selection Handler ---
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

    // --- Simple View (Quick Book) ---
    function generateDates() {
        if (!dateCardsContainer) return;
        dateCardsContainer.innerHTML = '';
        const today = new Date();
        for (let i = 1; i <= 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            
            const card = document.createElement('div');
            card.className = 'booking-card';
            card.innerHTML = `
                <h3>${date.toLocaleDateString('en-US', { weekday: 'short' })}</h3>
                <p>${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
            `;
            
            card.addEventListener('click', () => {
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
    }

    function generateTimeSlots(selectedDate) {
        if (!timeSelection || !timeSlotsContainer) return;
        timeSelection.style.display = 'block';
        timeSlotsContainer.innerHTML = '';
        
        const day = selectedDate.getDay();
        const isWeekday = (day >= 1 && day <= 5); // Monday - Friday

        // Weekdays: 8:00 AM - 5:00 PM are unavailable. Available from 5:00 PM (17:00) to 8:00 PM.
        // Weekends: Available from 9:00 AM (9:00) to 8:00 PM.
        const startHour = isWeekday ? 17 : 9; 
        const endHour = 19; // Last slot starts at 7:00 PM, finishes at 8:00 PM
        let availableCount = 0;

        for (let hour = startHour; hour <= endHour; hour++) {
            const slotStart = new Date(selectedDate);
            slotStart.setHours(hour, 0, 0, 0);
            const slotEnd = new Date(slotStart);
            slotEnd.setHours(hour + 1, 0, 0, 0);

            // Safeguard: Do not offer slots between 8 AM and 5 PM on weekdays
            if (isWeekday && (hour >= 8 && hour < 17)) {
                continue;
            }

            const isBusy = calendarEvents.some(event => {
                if (!event.start || !event.end || event.display === 'background') return false;
                return (slotStart < new Date(event.end) && slotEnd > new Date(event.start));
            });

            if (!isBusy) {
                availableCount++;
                const btn = document.createElement('div');
                btn.className = 'booking-card';
                btn.innerHTML = `<h3>${slotStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</h3>`;
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.time-grid .booking-card').forEach(c => c.classList.remove('active'));
                    btn.classList.add('active');
                    handleTimeSelection(slotStart, slotEnd);
                });
                timeSlotsContainer.appendChild(btn);
            }
        }

        if (availableCount === 0) {
            timeSlotsContainer.innerHTML = `
                <div style="grid-column: 1 / -1; background: #fff; border: 1.5px solid var(--card-border); border-radius: var(--radius-md); padding: 2rem; text-align: center; color: var(--text-secondary);">
                    <p style="font-weight: 700; margin-bottom: 0.5rem; color: var(--text-primary);">No open slots remaining for this date.</p>
                    <p style="font-size: 0.95rem; margin: 0;">Weekdays are available from 5:00 PM – 8:00 PM. Please pick another day or call/text <a href="tel:5712798040" style="color: var(--accent-color); font-weight: 700;">(571) 279-8040</a>.</p>
                </div>
            `;
        }

        timeSelection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    generateDates();

    // --- FullCalendar Initialization ---
    function initCalendar() {
        if (!calendarEl || calendarInitialized) return;
        if (typeof FullCalendar === 'undefined') {
            console.error("FullCalendar library is not available.");
            return;
        }

        const isMobile = window.innerWidth < 768;
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: isMobile ? 'timeGridDay' : 'timeGridWeek',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: isMobile ? 'timeGridDay,listWeek' : 'timeGridWeek,timeGridDay'
            },
            businessHours: [
                {
                    daysOfWeek: [1, 2, 3, 4, 5],
                    startTime: '17:00',
                    endTime: '20:00'
                },
                {
                    daysOfWeek: [0, 6],
                    startTime: '09:00',
                    endTime: '20:00'
                }
            ],
            selectable: true,
            slotMinTime: '08:00:00',
            slotMaxTime: '20:00:00',
            allDaySlot: false,
            height: 'auto',
            expandRows: true,
            weekends: true,
            dayHeaderFormat: { weekday: 'short', month: 'numeric', day: 'numeric', omitCommas: true },
            events: calendarEvents,
            select: function (info) {
                const start = new Date(info.start);
                const day = start.getDay();
                const hour = start.getHours();
                const isWeekday = (day >= 1 && day <= 5);

                // Weekday 8 AM to 5 PM restriction
                if (isWeekday && (hour >= 8 && hour < 17)) {
                    alert("❌ Weekdays from 8:00 AM to 5:00 PM are unavailable. Please select after 5:00 PM or a weekend time.");
                    calendar.unselect();
                    return;
                }

                // Check busy events
                const isBusy = calendarEvents.some(event => {
                    if (!event.start || !event.end || event.display === 'background') return false;
                    return (info.start < new Date(event.end) && info.end > new Date(event.start));
                });
                if (isBusy) {
                    alert("❌ This time slot is unavailable. Please choose another time.");
                    calendar.unselect();
                    return;
                }
                handleTimeSelection(info.start, info.end);
            }
        });

        calendar.render();
        calendarInitialized = true;
    }

    // --- Asynchronous Busy Times Loading (Non-blocking) ---
    async function loadBusyTimes() {
        try {
            const res = await fetch('/get-busy-times');
            if (res.ok) {
                const busyTimes = await res.json();
                if (Array.isArray(busyTimes)) {
                    const mappedEvents = busyTimes.map(slot => {
                        const start = new Date(slot.start);
                        const end = new Date(slot.end);
                        return {
                            title: 'Busy',
                            start: start.toISOString(),
                            end: new Date(end.getTime() + 60 * 60 * 1000).toISOString(),
                            display: 'background',
                            color: '#fecaca'
                        };
                    });
                    calendarEvents = [...calendarEvents, ...mappedEvents];
                    if (calendar) {
                        mappedEvents.forEach(e => calendar.addEvent(e));
                    }
                }
            }
        } catch (error) {
            console.warn("Could not load Google Calendar busy times:", error);
        } finally {
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }
    }

    loadBusyTimes();

    // --- Form Submission ---
    if (appointmentForm) {
        appointmentForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const submitBtn = appointmentForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerText;
            submitBtn.disabled = true;
            submitBtn.innerText = "Submitting Request...";

            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                date: document.getElementById('selected-date').value,
                service: document.getElementById('service').value,
                notes: document.getElementById('questions').value,
                location: document.getElementById('location').value,
            };

            try {
                const response = await fetch('/add-event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: formData.name,
                        email: formData.email,
                        date: formData.date,
                        problem: formData.notes || formData.service,
                        location: formData.location
                    })                    
                });

                const confirmationDiv = document.getElementById('confirmation-message');
                if (confirmationDiv) {
                    const startDate = new Date(formData.date);
                    confirmationDiv.innerHTML = `
                        <div style="background: var(--success-light); border: 1.5px solid var(--success-border); border-radius: var(--radius-md); padding: 2.25rem 2rem; color: var(--text-primary); text-align: left; box-shadow: var(--shadow-md);">
                            <h3 style="color: var(--success-color); margin-bottom: 0.75rem; font-size: 1.4rem;">
                                ✅ Request Submitted Successfully!
                            </h3>
                            <p style="font-size: 1.15rem; margin-bottom: 1rem; color: var(--text-primary);">
                                Hi <strong>${formData.name}</strong>, your appointment request for <strong>${startDate.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</strong> has been received.
                            </p>
                            <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: var(--radius-sm); padding: 1rem 1.25rem; margin-bottom: 1.25rem; color: #92400e; font-weight: 700; font-size: 1rem;">
                                ⚠️ Important: This is an appointment request, not a confirmed booking yet.
                            </div>
                            <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                                Cole will review your details and send a confirmation email to <strong>${formData.email}</strong> shortly.
                            </p>
                            <p style="color: var(--text-secondary); margin: 0; font-size: 1rem;">
                                If you need urgent assistance, feel free to call or text <strong>(571) 279-8040</strong> directly.
                            </p>
                        </div>`;
                    confirmationDiv.style.display = 'block';
                    const bookingForm = document.getElementById('booking-form');
                    if (bookingForm) bookingForm.style.display = 'none';
                    confirmationDiv.scrollIntoView({ behavior: 'smooth' });
                }
            } catch (err) {
                console.error("Submission failed:", err);
                alert("An error occurred while submitting your appointment request. Please call or text (571) 279-8040.");
                submitBtn.disabled = false;
                submitBtn.innerText = originalBtnText;
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
});