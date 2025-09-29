// Elements
const timeDisplay = document.getElementById('time-display');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');

const workBtn = document.getElementById('work-btn');
const shortBreakBtn = document.getElementById('short-break-btn');
const longBreakBtn = document.getElementById('long-break-btn');

const workInput = document.getElementById('work-duration');
const shortBreakInput = document.getElementById('short-break-duration');
const longBreakInput = document.getElementById('long-break-duration');

const sessionHistoryList = document.getElementById('session-history');
const statsMessage = document.getElementById('stats-message');

const alarmAudio = document.getElementById('alarm-audio');

const dailyChartCanvas = document.getElementById('daily-chart');
const weeklyChartCanvas = document.getElementById('weekly-chart');

const progressCircle = document.querySelector('.circle-progress');
const radius = 54;
const circumference = 2 * Math.PI * radius;

progressCircle.style.strokeDasharray = `${circumference}`;
progressCircle.style.strokeDashoffset = 0;

// Timer state
let timerInterval = null;
let timeLeft = 0;
let totalTime = 0;
let isRunning = false;
let currentMode = 'work'; // modes: 'work', 'shortBreak', 'longBreak'
let sessionStartTime = null;

// Session data storage key
const STORAGE_KEY = 'pomodoroSessions_v1';
let sessions = [];

// Chart.js global options will be set dynamically
// We will load Chart.js from CDN dynamically because no initial library included
let dailyChart, weeklyChart;

function loadChartJs() {
  return new Promise((resolve, reject) => {
    if (window.Chart) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Chart.js'));
    document.head.appendChild(script);
  });
}

// Utility to format seconds as mm:ss
function formatTime(seconds) {
  let m = Math.floor(seconds / 60);
  let s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Timer update progress circle
function updateProgressCircle() {
  const fraction = timeLeft / totalTime;
  const offset = circumference * (1 - fraction);
  progressCircle.style.strokeDashoffset = offset;
}

// Set timer for current mode
function setTimerForMode(mode) {
  currentMode = mode;
  clearInterval(timerInterval);
  isRunning = false;
  pauseBtn.disabled = true;
  startBtn.disabled = false;

  switch (mode) {
    case 'work':
      totalTime = parseInt(workInput.value, 10) * 60;
      break;
    case 'shortBreak':
      totalTime = parseInt(shortBreakInput.value, 10) * 60;
      break;
    case 'longBreak':
      totalTime = parseInt(longBreakInput.value, 10) * 60;
      break;
  }
  timeLeft = totalTime;

  timeDisplay.textContent = formatTime(timeLeft);
  updateProgressCircle();

  // Update active mode button style
  workBtn.classList.toggle('active', mode === 'work');
  shortBreakBtn.classList.toggle('active', mode === 'shortBreak');
  longBreakBtn.classList.toggle('active', mode === 'longBreak');
}

// Start timer function
function startTimer() {
  if (isRunning) return;

  isRunning = true;
  pauseBtn.disabled = false;
  startBtn.disabled = true;
  sessionStartTime = new Date();

  timerInterval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      timeDisplay.textContent = formatTime(timeLeft);
      updateProgressCircle();
    } else {
      clearInterval(timerInterval);
      isRunning = false;
      pauseBtn.disabled = true;
      startBtn.disabled = false;

      alarmAudio.play();
      saveSession();
      loadSessions();
      updateCharts();
      alert(`Time's up for ${currentMode === 'work' ? 'work session' : 'break'}!`);
    }
  }, 1000);
}

// Pause timer
function pauseTimer() {
  if (!isRunning) return;
  clearInterval(timerInterval);
  isRunning = false;
  pauseBtn.disabled = true;
  startBtn.disabled = false;
}

// Reset timer
function resetTimer() {
  clearInterval(timerInterval);
  isRunning = false;
  pauseBtn.disabled = true;
  startBtn.disabled = false;
  setTimerForMode(currentMode);
}

// Save completed session data
function saveSession() {
  const endTime = new Date();
  const durationSeconds = totalTime;

  const session = {
    mode: currentMode,
    start: sessionStartTime.toISOString(),
    end: endTime.toISOString(),
    duration: durationSeconds,
    date: sessionStartTime.toISOString().split('T')[0], // YYYY-MM-DD
  };

  sessions.push(session);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

// Load session data from localStorage
function loadSessions() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    sessions = JSON.parse(stored);
  } else {
    sessions = [];
  }

  renderSessionHistory();
}

// Render list of completed sessions
function renderSessionHistory() {
  sessionHistoryList.innerHTML = '';
  if (sessions.length === 0) {
    statsMessage.style.display = 'block';
    sessionHistoryList.style.display = 'none';
    return;
  }
  statsMessage.style.display = 'none';
  sessionHistoryList.style.display = 'block';

  // Show last 10 sessions
  const lastSessions = sessions.slice(-10).reverse();

  lastSessions.forEach((sess) => {
    const li = document.createElement('li');

    const modeText = sess.mode === 'work' ? 'Work' : (sess.mode === 'shortBreak' ? 'Short Break' : 'Long Break');
    const startTime = new Date(sess.start);
    const formattedDate = startTime.toLocaleString(undefined, {dateStyle: 'short', timeStyle: 'short'});
    const minutes = Math.floor(sess.duration / 60);

    li.textContent = `${modeText} - ${minutes} min - Started: ${formattedDate}`;
    sessionHistoryList.appendChild(li);
  });
}

// Get daily productivity data (work sessions only)
function getDailyData() {
  const dailyMap = {};

  sessions.forEach(sess => {
    if (sess.mode === 'work') {
      const day = sess.date;
      if (!dailyMap[day]) dailyMap[day] = 0;
      dailyMap[day] += sess.duration / 60; // minutes
    }
  });

  // Get last 7 days ordered
  const last7Days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = d.toISOString().slice(0,10);
    last7Days.push(key);
  }

  const minutesData = last7Days.map(day => dailyMap[day] || 0);

  return { labels: last7Days, data: minutesData };
}

// Get weekly productivity data aggregated by week (ISO week numbers)
function getWeeklyData() {
  // Helper to get ISO week string
  function getISOWeekString(date) {
    const tempDate = new Date(date.getTime());
    tempDate.setHours(0,0,0,0);
    // Thursday in current week decides the year.
    tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
    // January 4 is always in week 1.
    const week1 = new Date(tempDate.getFullYear(),0,4);
    // Adjust to Thursday in week 1 and count number of weeks from week1 to tempDate
    const weekNumber = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000
      - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${tempDate.getFullYear()}-W${weekNumber.toString().padStart(2,'0')}`;
  }

  const weeklyMap = {};
  sessions.forEach(sess => {
    if (sess.mode === 'work') {
      const weekStr = getISOWeekString(new Date(sess.date));
      if (!weeklyMap[weekStr]) weeklyMap[weekStr] = 0;
      weeklyMap[weekStr] += sess.duration / 60;
    }
  });

  // Get last 6 weeks (ISO week strings) ordered by date ascending
  const today = new Date();
  const weeks = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (i * 7));
    const wStr = getISOWeekString(d);
    weeks.push(wStr);
  }

  const minutesData = weeks.map(w => weeklyMap[w] || 0);
  return { labels: weeks, data: minutesData };
}

// Draw charts using Chart.js
function drawCharts() {
  loadChartJs().then(() => {
    const dailyData = getDailyData();
    const weeklyData = getWeeklyData();

    if (dailyChart) dailyChart.destroy();
    if (weeklyChart) weeklyChart.destroy();

    dailyChart = new Chart(dailyChartCanvas, {
      type: 'bar',
      data: {
        labels: dailyData.labels,
        datasets: [{
          label: 'Work Minutes per Day',
          data: dailyData.data,
          backgroundColor: '#b7410e88',
          borderColor: '#b7410e',
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Minutes' }
          },
          x: {
            title: { display: true, text: 'Date' }
          }
        },
        plugins: {
          legend: { display: false },
        },
      }
    });

    weeklyChart = new Chart(weeklyChartCanvas, {
      type: 'line',
      data: {
        labels: weeklyData.labels,
        datasets: [{
          label: 'Work Minutes per Week',
          data: weeklyData.data,
          backgroundColor: '#b7410e44',
          borderColor: '#b7410e',
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointHoverRadius: 8,
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Minutes' }
          },
          x: {
            title: { display: true, text: 'Week' }
          }
        },
        plugins: {
          legend: { display: false },
        },
      }
    });
  }).catch(console.error);
}

// Update charts after new sessions loaded
function updateCharts() {
  drawCharts();
}

// Event listeners
workBtn.addEventListener('click', () => {
  if (isRunning) return;
  setTimerForMode('work');
});
shortBreakBtn.addEventListener('click', () => {
  if (isRunning) return;
  setTimerForMode('shortBreak');
});
longBreakBtn.addEventListener('click', () => {
  if (isRunning) return;
  setTimerForMode('longBreak');
});

startBtn.addEventListener('click', () => {
  startTimer();
});

pauseBtn.addEventListener('click', () => {
  pauseTimer();
});

resetBtn.addEventListener('click', () => {
  resetTimer();
});

// Update timer values if inputs changed and timer is not running
[workInput, shortBreakInput, longBreakInput].forEach(input => {
  input.addEventListener('change', () => {
    if (isRunning) return;
    // Clamp input values
    if (input.value < input.min) input.value = input.min;
    if (input.value > input.max) input.value = input.max;

    setTimerForMode(currentMode);
  });
});

// Init
function init() {
  loadSessions();
  setTimerForMode('work');
  updateCharts();
}

init();
