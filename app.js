/* ============================================
   75 HARD — Challenge Tracker App
   ============================================ */

const USERS = {
    guka: { password: 'gukaguza', displayName: 'Guka', partner: 'guza' },
    guza: { password: 'gukaguza', displayName: 'Guza', partner: 'guka' }
};

const TASKS = ['diet', 'water', 'workout', 'book', 'pic'];

let currentUser = null;

// ============================================
// STORAGE HELPERS
// ============================================
function getStorageKey(user, key) {
    return `75hard_${user}_${key}`;
}

function getUserData(user) {
    const raw = localStorage.getItem(getStorageKey(user, 'data'));
    return raw ? JSON.parse(raw) : null;
}

function setUserData(user, data) {
    localStorage.setItem(getStorageKey(user, 'data'), JSON.stringify(data));
}

function initUserData(user) {
    let data = getUserData(user);
    if (!data) {
        data = {
            startDate: null,
            days: {}
        };
        setUserData(user, data);
    }
    return data;
}

// ============================================
// DATE HELPERS
// ============================================
function dateToStr(date) {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
}

function getDayNumber(startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    return diff + 1;
}

function getDateForDay(startDate, dayNum) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + dayNum - 1);
    return d;
}

// ============================================
// LOGIN
// ============================================
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value;

    if (USERS[username] && USERS[username].password === password) {
        currentUser = username;
        loginError.textContent = '';
        loginScreen.classList.remove('active');
        dashboardScreen.classList.add('active');
        initDashboard();
    } else {
        loginError.textContent = 'Invalid username or password';
        document.getElementById('password').value = '';
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    currentUser = null;
    dashboardScreen.classList.remove('active');
    loginScreen.classList.add('active');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
});

// ============================================
// DASHBOARD INIT
// ============================================
function initDashboard() {
    const data = initUserData(currentUser);
    const user = USERS[currentUser];

    document.getElementById('greeting').textContent =
        `Welcome back, ${user.displayName}`;

    if (data.startDate) {
        showTracker(data);
    } else {
        showStartDatePicker();
    }
}

function showStartDatePicker() {
    document.getElementById('start-date-section').style.display = 'block';
    document.getElementById('today-section').style.display = 'none';
    document.getElementById('calendar-section').style.display = 'none';
    document.getElementById('rules-section').style.display = 'none';
    document.getElementById('partner-section').style.display = 'none';

    const dateInput = document.getElementById('start-date-input');
    dateInput.value = dateToStr(new Date());

    document.getElementById('btn-set-date').onclick = () => {
        const val = dateInput.value;
        if (!val) return;
        const data = getUserData(currentUser);
        data.startDate = val;
        setUserData(currentUser, data);
        showTracker(data);
    };

    updateHeroStats(0, 0);
}

function showTracker(data) {
    document.getElementById('start-date-section').style.display = 'none';
    document.getElementById('today-section').style.display = 'block';
    document.getElementById('calendar-section').style.display = 'block';
    document.getElementById('rules-section').style.display = 'block';
    document.getElementById('partner-section').style.display = 'block';

    const dayNum = getDayNumber(data.startDate);
    const clampedDay = Math.min(Math.max(dayNum, 1), 75);
    const todayKey = `day_${clampedDay}`;

    document.getElementById('today-label').textContent = `Day ${clampedDay}`;

    if (!data.days[todayKey]) {
        data.days[todayKey] = { diet: false, water: false, workout: false, book: false, pic: false };
        setUserData(currentUser, data);
    }

    const checkboxes = document.querySelectorAll('.task-card input[type="checkbox"]');
    checkboxes.forEach(cb => {
        const task = cb.dataset.task;
        cb.checked = data.days[todayKey][task] || false;
        updateTaskCardState(cb);

        cb.onchange = () => {
            const d = getUserData(currentUser);
            d.days[todayKey][task] = cb.checked;
            setUserData(currentUser, d);
            updateTaskCardState(cb);
            refreshStats();
        };
    });

    const taskCards = document.querySelectorAll('.task-card');
    taskCards.forEach(card => {
        card.onclick = (e) => {
            if (e.target.tagName === 'INPUT') return;
            const cb = card.querySelector('input[type="checkbox"]');
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event('change'));
        };
    });

    refreshStats();
    renderCalendar();
    renderPartnerProgress();
}

function updateTaskCardState(checkbox) {
    const card = checkbox.closest('.task-card');
    if (checkbox.checked) {
        card.classList.add('done');
    } else {
        card.classList.remove('done');
    }
}

// ============================================
// STATS
// ============================================
function refreshStats() {
    const data = getUserData(currentUser);
    if (!data || !data.startDate) return;

    const dayNum = getDayNumber(data.startDate);
    const clampedDay = Math.min(Math.max(dayNum, 1), 75);

    let completedDays = 0;
    let streak = 0;
    let streakBroken = false;

    for (let i = clampedDay; i >= 1; i--) {
        const key = `day_${i}`;
        const dayData = data.days[key];
        if (dayData && TASKS.every(t => dayData[t])) {
            if (!streakBroken) streak++;
            completedDays++;
        } else {
            if (i < clampedDay) streakBroken = true;
            if (dayData && TASKS.some(t => dayData[t])) {
                // partial — not completed
            }
        }
    }

    // Also count completed days that might not be consecutive
    completedDays = 0;
    for (let i = 1; i <= 75; i++) {
        const key = `day_${i}`;
        const dayData = data.days[key];
        if (dayData && TASKS.every(t => dayData[t])) {
            completedDays++;
        }
    }

    const percent = Math.round((completedDays / 75) * 100);
    const remaining = 75 - completedDays;

    updateHeroStats(clampedDay, completedDays, percent, remaining);
    document.getElementById('streak-badge').textContent = `🔥 ${streak}`;
    document.getElementById('progress-bar').style.width = `${percent}%`;
}

function updateHeroStats(day, completed, percent = 0, remaining = 75) {
    document.getElementById('stat-day').textContent = day;
    document.getElementById('stat-completed').textContent = completed;
    document.getElementById('stat-percent').textContent = `${percent}%`;
    document.getElementById('stat-remaining').textContent = remaining;
}

// ============================================
// CALENDAR
// ============================================
function renderCalendar() {
    const data = getUserData(currentUser);
    if (!data || !data.startDate) return;

    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    const dayNum = getDayNumber(data.startDate);

    for (let i = 1; i <= 75; i++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day';
        cell.textContent = i;

        const key = `day_${i}`;
        const dayData = data.days[key];

        if (i > dayNum) {
            cell.classList.add('future');
        } else if (dayData) {
            const doneCount = TASKS.filter(t => dayData[t]).length;
            if (doneCount === 5) {
                cell.classList.add('complete');
            } else if (doneCount > 0) {
                cell.classList.add('partial');
            } else {
                cell.classList.add('empty');
            }
        } else {
            cell.classList.add('empty');
        }

        if (i === Math.min(Math.max(dayNum, 1), 75)) {
            cell.classList.add('today');
        }

        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'day-tooltip';
        if (dayData) {
            const items = TASKS.map(t => `${dayData[t] ? '✅' : '❌'} ${t.charAt(0).toUpperCase() + t.slice(1)}`);
            tooltip.innerHTML = `<strong>Day ${i}</strong><br>${items.join('<br>')}`;
        } else {
            tooltip.innerHTML = `<strong>Day ${i}</strong><br>${i > dayNum ? 'Upcoming' : 'Not started'}`;
        }
        cell.appendChild(tooltip);

        // Click to navigate to that day (only past/current days)
        if (i <= dayNum && i >= 1 && i <= 75) {
            cell.addEventListener('click', () => openDayEditor(i));
        }

        grid.appendChild(cell);
    }
}

// ============================================
// DAY EDITOR (click calendar day)
// ============================================
function openDayEditor(dayNum) {
    const data = getUserData(currentUser);
    const key = `day_${dayNum}`;

    if (!data.days[key]) {
        data.days[key] = { diet: false, water: false, workout: false, book: false, pic: false };
        setUserData(currentUser, data);
    }

    const currentDay = Math.min(Math.max(getDayNumber(data.startDate), 1), 75);

    document.getElementById('today-label').textContent = `Day ${dayNum}${dayNum === currentDay ? ' (Today)' : ''}`;

    const checkboxes = document.querySelectorAll('.task-card input[type="checkbox"]');
    checkboxes.forEach(cb => {
        const task = cb.dataset.task;
        cb.checked = data.days[key][task] || false;
        updateTaskCardState(cb);

        cb.onchange = () => {
            const d = getUserData(currentUser);
            if (!d.days[key]) {
                d.days[key] = { diet: false, water: false, workout: false, book: false, pic: false };
            }
            d.days[key][task] = cb.checked;
            setUserData(currentUser, d);
            updateTaskCardState(cb);
            refreshStats();
            renderCalendar();
        };
    });

    document.getElementById('today-section').scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// PARTNER PROGRESS
// ============================================
function renderPartnerProgress() {
    const partnerId = USERS[currentUser].partner;
    const partnerData = getUserData(partnerId);
    const container = document.getElementById('partner-stats');
    const partnerName = USERS[partnerId].displayName;

    if (!partnerData || !partnerData.startDate) {
        container.innerHTML = `
            <div class="partner-stat glass" style="grid-column: span 4;">
                <p style="color: var(--text-secondary); font-size: 14px;">
                    ${partnerName} hasn't started the challenge yet.
                </p>
            </div>
        `;
        return;
    }

    const dayNum = getDayNumber(partnerData.startDate);
    const clampedDay = Math.min(Math.max(dayNum, 1), 75);

    let completedDays = 0;
    for (let i = 1; i <= 75; i++) {
        const key = `day_${i}`;
        const dayData = partnerData.days[key];
        if (dayData && TASKS.every(t => dayData[t])) {
            completedDays++;
        }
    }

    const percent = Math.round((completedDays / 75) * 100);
    const remaining = 75 - completedDays;

    // Today's tasks for partner
    const todayKey = `day_${clampedDay}`;
    const todayData = partnerData.days[todayKey];
    let todayDone = 0;
    if (todayData) {
        todayDone = TASKS.filter(t => todayData[t]).length;
    }

    container.innerHTML = `
        <div class="partner-stat glass">
            <div class="stat-number">${clampedDay}</div>
            <div class="stat-label">${partnerName}'s Day</div>
        </div>
        <div class="partner-stat glass">
            <div class="stat-number">${completedDays}</div>
            <div class="stat-label">Days Done</div>
        </div>
        <div class="partner-stat glass">
            <div class="stat-number">${percent}%</div>
            <div class="stat-label">Progress</div>
        </div>
        <div class="partner-stat glass">
            <div class="stat-number">${todayDone}/5</div>
            <div class="stat-label">Today's Tasks</div>
        </div>
    `;
}

// ============================================
// AUTO-LOGIN CHECK (session persistence)
// ============================================
(function checkSession() {
    const saved = sessionStorage.getItem('75hard_session');
    if (saved && USERS[saved]) {
        currentUser = saved;
        loginScreen.classList.remove('active');
        dashboardScreen.classList.add('active');
        initDashboard();
    }
})();

// Save session on login
const origSubmit = loginForm.onsubmit;
loginForm.addEventListener('submit', () => {
    if (currentUser) {
        sessionStorage.setItem('75hard_session', currentUser);
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    sessionStorage.removeItem('75hard_session');
});
