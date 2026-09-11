// server.js
// WHAT IS THIS FILE?
//   The starting point of the whole backend. Run this file to start
//   the application ("node backend/server.js" or "npm start").
// WHY DO WE NEED IT?
//   Every Node/Express app needs one file that wires everything
//   together: web server, routes, and startup tasks.
// WHAT DOES IT DO?
//   1. Starts an Express web server.
//   2. Serves the frontend (the HTML/CSS/JS the employee sees).
//   3. Mounts the /api/... routes from orderRoutes.js.
//   4. On startup, immediately checks for any reminders that were
//      due while the server was off, so nothing is missed after a
//      restart or redeploy.
// DO I NEED TO CHANGE ANYTHING?
//   No, unless you're customizing ports or paths.

const path = require('path');
const express = require('express');
const cors = require('cors');

const config = require('./config/config');
const orderRoutes = require('./routes/orderRoutes');
const reminderService = require('./services/reminderService');

const app = express();

app.use(cors());
app.use(express.json());

// Serve the frontend (index.html, style.css, app.js) as plain static files.
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use('/api', orderRoutes);

// Simple health check - also useful as the URL an external "uptime"
// service can ping to keep a free-tier host awake.
app.get('/api/health', (req, res) => {
  res.json({ ok: true, store: config.store.name, time: new Date().toISOString() });
});

app.listen(config.port, () => {
  console.log(`Ganesha Order System running on port ${config.port}`);
  console.log(`Timezone: ${config.timezone}`);
  console.log(`Messaging provider: ${config.messaging.provider}`);

  // Step 1-4 of the "restart recovery" requirement: as soon as we come
  // back up, immediately look for any reminder that was due while the
  // server was off (or has just become due), and send it.
  reminderService
    .checkAndSendDueReminders()
    .then((result) => {
      if (result.sent.length > 0) {
        console.log('[startup] Sent overdue reminders for:', result.sent.join(', '));
      }
    })
    .catch((err) => console.error('[startup] reminder recovery check failed:', err.message));

  // Handy if you run this on a PC/laptop that stays on all the time.
  // If you deploy to a free host like Render, set up the external
  // cron pinger described in README.md instead (this internal timer
  // does nothing useful while the app is asleep).
  reminderService.startInternalScheduler(5);
});
