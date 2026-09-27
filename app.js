/* ============================================
   75 HARD — Challenge Tracker App
   ============================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
    initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
    doc, onSnapshot, setDoc, deleteDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const firebaseApp = initializeApp({
    apiKey: 'AIzaSyB6LhdpiV_9JTjO0hxHnJvroXUtH5H5NFo',
    authDomain: 'meda-guza.firebaseapp.com',
    projectId: 'meda-guza',
    storageBucket: 'meda-guza.firebasestorage.app',
    messagingSenderId: '380147860953',
    appId: '1:380147860953:web:eedae895c904281c8c85c8'
});
const auth = getAuth(firebaseApp);
const db = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const EMAIL_DOMAIN = 'meda-guza.app';
const USERS = {
    guka: { displayName: 'Guka', partner: 'guza' },
    guza: { displayName: 'Guza', partner: 'guka' }
};

const TASKS = ['diet', 'water', 'workout', 'book', 'pic'];
const TASK_LABELS = { diet: 'Diet', water: 'Water', workout: 'Workout', book: 'Reading', pic: 'Progress Pic' };
const TOTAL_DAYS = 75;

let currentUser = null;
let selectedDay = null;
let store = {};
let loaded = {};
let unsubscribers = [];

const $ = (id) => document.getElementById(id);

Object.keys(localStorage)
    .filter(k => k.startsWith('75hard_'))
    .forEach(k => localStorage.removeItem(k));

// ============================================
// DATA
// ============================================
function getData(user) {
    return store[user] || { startDate: null, days: {} };
}

function emptyDay() {
    return { diet: false, water: false, workout: false, book: false, pic: false };
}

async function saveData(data) {
    store[currentUser] = data;
    render();
    try {
        await setDoc(doc(db, 'progress', currentUser), {
            startDate: data.startDate,
            days: data.days,
            updatedAt: serverTimestamp()
        });
    } catch (e) {
        showToast('Could not save — check your connection');
        console.error(e);
    }
}

function subscribe(user) {
    return onSnapshot(doc(db, 'progress', user), (snap) => {
        store[user] = snap.exists() ? snap.data() : null;
        loaded[user] = true;
        render();
    }, (err) => {
        console.error(err);
        showToast('Sync error — try signing in again');
    });
}

// ============================================
// DATES & STATS
// ============================================
function dateToStr(d) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}

function parseLocalDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function rawDayNumber(startDate) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((now - parseLocalDate(startDate)) / 86400000) + 1;
}

function dateOfDay(startDate, dayNum) {
    const d = parseLocalDate(startDate);
    d.setDate(d.getDate() + dayNum - 1);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function doneCount(dayData) {
    return dayData ? TASKS.filter(t => dayData[t]).length : 0;
}

function computeStats(data) {
    const raw = rawDayNumber(data.startDate);
    const current = Math.min(Math.max(raw, 1), TOTAL_DAYS);
    const finishedPeriod = raw > TOTAL_DAYS;

    let completed = 0;
    let missed = 0;
    for (let i = 1; i <= current; i++) {
        const n = doneCount(data.days[`day_${i}`]);
        if (n === TASKS.length) completed++;
        else if (i < current || finishedPeriod) missed++;
    }

    let streak = 0;
    let i = doneCount(data.days[`day_${current}`]) === TASKS.length ? current : current - 1;
    while (i >= 1 && doneCount(data.days[`day_${i}`]) === TASKS.length) {
        streak++;
        i--;
    }

    return {
        current,
        completed,
        missed,
        streak,
        finishedPeriod,
        daysLeft: finishedPeriod ? 0 : TOTAL_DAYS - current + 1,
        percent: Math.round((completed / TOTAL_DAYS) * 100)
    };
}

// ============================================
// AUTH & SCREENS
// ============================================
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
}

let toastTimer = null;
function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
}

function usernameFromEmail(email) {
    const name = (email || '').split('@')[0];
    return USERS[name] ? name : null;
}

onAuthStateChanged(auth, (user) => {
    unsubscribers.forEach(u => u());
    unsubscribers = [];
    store = {};
    loaded = {};
    selectedDay = null;

    currentUser = user ? usernameFromEmail(user.email) : null;
    if (!currentUser) {
        $('login-form').reset();
        showScreen('login-screen');
        return;
    }

    showScreen('dashboard-screen');
    render();
    unsubscribers = [subscribe(currentUser), subscribe(USERS[currentUser].partner)];
});

$('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('username').value.trim().toLowerCase();
    const password = $('password').value.trim();
    const btn = $('login-form').querySelector('.btn-login');
    $('login-error').textContent = '';

    if (!USERS[username]) {
        $('login-error').textContent = 'Invalid username or password';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
        await signInWithEmailAndPassword(auth, `${username}@${EMAIL_DOMAIN}`, password);
    } catch (err) {
        const messages = {
            'auth/network-request-failed': 'No internet connection',
            'auth/too-many-requests': 'Too many attempts — wait a minute and try again'
        };
        $('login-error').textContent = messages[err.code] || 'Invalid username or password';
        $('password').value = '';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
    }
});

$('btn-logout').addEventListener('click', () => signOut(auth));

// ============================================
// RENDER
// ============================================
function render() {
    if (!currentUser) return;
    $('greeting').textContent = `Welcome back, ${USERS[currentUser].displayName}`;

    const ready = loaded[currentUser];
    $('dashboard-loading').hidden = Boolean(ready);
    $('dashboard-content').hidden = !ready;
    if (!ready) return;

    const data = getData(currentUser);
    const started = Boolean(data.startDate);
    $('start-date-section').hidden = started;
    ['today-section', 'calendar-section', 'rules-section', 'settings-section']
        .forEach(id => { $(id).hidden = !started; });
    $('partner-section').hidden = false;
    renderPartner();

    if (!started) {
        renderHero(null);
        const input = $('start-date-input');
        const today = dateToStr(new Date());
        input.max = today;
        if (!input.value || input.value > today) input.value = today;
        return;
    }

    const stats = computeStats(data);
    if (selectedDay === null || selectedDay > stats.current) selectedDay = stats.current;

    renderHero(stats);
    renderTasks(data, stats);
    renderCalendar(data, stats);
    $('settings-start-date').textContent = parseLocalDate(data.startDate)
        .toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderHero(stats) {
    $('stat-day').textContent = stats ? stats.current : 0;
    $('stat-completed').textContent = stats ? stats.completed : 0;
    $('stat-percent').textContent = `${stats ? stats.percent : 0}%`;
    $('stat-remaining').textContent = stats ? stats.daysLeft : TOTAL_DAYS;
    $('streak-badge').textContent = `🔥 ${stats ? stats.streak : 0}`;
    $('progress-bar').style.width = `${stats ? stats.percent : 0}%`;

    const banner = $('status-banner');
    if (stats && stats.finishedPeriod) {
        banner.hidden = false;
        banner.className = `status-banner ${stats.completed === TOTAL_DAYS ? 'success' : 'warning'}`;
        banner.textContent = stats.completed === TOTAL_DAYS
            ? '🏆 75 HARD COMPLETE — all 75 days done. Legendary.'
            : `The 75 days are over — ${stats.completed}/75 completed. Reset below to go again.`;
    } else if (stats && stats.missed > 0) {
        banner.hidden = false;
        banner.className = 'status-banner warning';
        banner.textContent = `${stats.missed} missed day${stats.missed > 1 ? 's' : ''}. Official rules say restart from Day 1 — use Reset Challenge below if you want to.`;
    } else {
        banner.hidden = true;
    }
}

function renderTasks(data, stats) {
    const dayData = data.days[`day_${selectedDay}`] || emptyDay();
    const isToday = selectedDay === stats.current && !stats.finishedPeriod;

    $('today-heading').textContent = isToday ? "Today's Tasks" : 'Editing';
    $('today-label').textContent = `Day ${selectedDay}`;
    $('today-date').textContent = dateOfDay(data.startDate, selectedDay);
    $('btn-back-today').hidden = selectedDay === stats.current;

    document.querySelectorAll('.task-card').forEach(card => {
        const cb = card.querySelector('input');
        cb.checked = Boolean(dayData[card.dataset.task]);
        card.classList.toggle('done', cb.checked);
    });

    const n = doneCount(dayData);
    $('day-progress-text').textContent = n === TASKS.length ? 'Day complete 💎' : `${n} / ${TASKS.length} done`;
    $('day-progress').classList.toggle('complete', n === TASKS.length);
}

function renderCalendar(data, stats) {
    const grid = $('calendar-grid');
    grid.innerHTML = '';
    const raw = rawDayNumber(data.startDate);

    for (let i = 1; i <= TOTAL_DAYS; i++) {
        const dayData = data.days[`day_${i}`];
        const n = doneCount(dayData);
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cal-day';
        cell.dataset.day = i;
        cell.textContent = i;

        if (i > stats.current) {
            cell.classList.add('future');
            cell.disabled = true;
        } else if (n === TASKS.length) {
            cell.classList.add('complete');
        } else if (i < raw) {
            cell.classList.add(n > 0 ? 'partial' : 'missed');
        } else {
            cell.classList.add(n > 0 ? 'partial' : 'empty');
        }

        if (i === stats.current && !stats.finishedPeriod) cell.classList.add('today');
        if (i === selectedDay) cell.classList.add('selected');

        const tooltip = document.createElement('span');
        tooltip.className = 'day-tooltip';
        tooltip.innerHTML = i > stats.current
            ? `<strong>Day ${i}</strong><br>Upcoming`
            : `<strong>Day ${i}</strong><br>` +
              TASKS.map(t => `${dayData && dayData[t] ? '✅' : '❌'} ${TASK_LABELS[t]}`).join('<br>');
        cell.appendChild(tooltip);

        grid.appendChild(cell);
    }
}

function renderPartner() {
    const partnerId = USERS[currentUser].partner;
    const partner = USERS[partnerId];
    const container = $('partner-stats');
    $('partner-title').textContent = `${partner.displayName}'s Progress`;

    if (!loaded[partnerId]) {
        container.innerHTML = `<div class="partner-stat glass partner-empty"><p>Loading…</p></div>`;
        return;
    }

    const data = getData(partnerId);
    if (!data.startDate) {
        container.innerHTML = `
            <div class="partner-stat glass partner-empty">
                <p>${partner.displayName} hasn't started the challenge yet.</p>
            </div>`;
        return;
    }

    const stats = computeStats(data);
    const today = doneCount(data.days[`day_${stats.current}`]);
    container.innerHTML = `
        <div class="partner-stat glass"><div class="stat-number">${stats.current}</div><div class="stat-label">Day</div></div>
        <div class="partner-stat glass"><div class="stat-number">${stats.completed}</div><div class="stat-label">Days Done</div></div>
        <div class="partner-stat glass"><div class="stat-number">🔥 ${stats.streak}</div><div class="stat-label">Streak</div></div>
        <div class="partner-stat glass"><div class="stat-number">${today}/5</div><div class="stat-label">Today</div></div>`;
}

// ============================================
// INTERACTIONS
// ============================================
$('btn-set-date').addEventListener('click', () => {
    const val = $('start-date-input').value;
    if (!val) return;
    selectedDay = null;
    saveData({ startDate: val, days: {} });
});

document.querySelectorAll('.task-card').forEach(card => {
    const cb = card.querySelector('input');

    cb.addEventListener('change', () => {
        const data = structuredClone(getData(currentUser));
        const key = `day_${selectedDay}`;
        data.days[key] = data.days[key] || emptyDay();
        data.days[key][card.dataset.task] = cb.checked;
        if (navigator.vibrate && cb.checked) navigator.vibrate(15);
        saveData(data);
    });

    card.addEventListener('click', (e) => {
        if (e.target.closest('.toggle')) return;
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
    });
});

$('calendar-grid').addEventListener('click', (e) => {
    const cell = e.target.closest('.cal-day');
    if (!cell || cell.disabled) return;
    selectedDay = Number(cell.dataset.day);
    render();
    $('today-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('btn-back-today').addEventListener('click', () => {
    selectedDay = null;
    render();
});

const modal = $('reset-modal');
$('btn-reset').addEventListener('click', () => { modal.hidden = false; });
$('btn-reset-cancel').addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });
$('btn-reset-confirm').addEventListener('click', async () => {
    modal.hidden = true;
    selectedDay = null;
    $('start-date-input').value = '';
    store[currentUser] = null;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
        await deleteDoc(doc(db, 'progress', currentUser));
    } catch (e) {
        showToast('Could not reset — check your connection');
        console.error(e);
    }
});

let lastSeenDate = dateToStr(new Date());
document.addEventListener('visibilitychange', () => {
    if (document.hidden || !currentUser) return;
    const today = dateToStr(new Date());
    if (today !== lastSeenDate) {
        lastSeenDate = today;
        selectedDay = null;
    }
    render();
});
