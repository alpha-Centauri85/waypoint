import { createApp } from './app.js';
import { config } from './config.js';
import { runReminders } from './models/notifications.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Waypoint API listening on http://localhost:${config.port} (${config.nodeEnv})`);
});

// Due-date reminder sweep: run once on boot, then on an interval, so the header
// bell is populated even when nobody has the app open. In-app only for now;
// disabled when REMINDER_INTERVAL_MS <= 0 (the sweep can still be triggered via
// POST /api/notifications/run). Lives here, not in app.js, so tests that import
// the app don't spawn a timer.
function sweepReminders() {
  try {
    const created = runReminders();
    if (created > 0) console.log(`Reminders: created ${created} notification(s)`);
  } catch (err) {
    console.error('Reminder sweep failed:', err.message);
  }
}

sweepReminders();
if (config.reminderIntervalMs > 0) {
  const timer = setInterval(sweepReminders, config.reminderIntervalMs);
  timer.unref?.(); // don't keep the process alive just for the reminder timer
}
