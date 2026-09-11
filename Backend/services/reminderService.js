// reminderService.js
// WHAT IS THIS FILE?
//   Looks through orders.xlsx for reminders that are due and sends
//   them. This is what makes the "send reminder 30 min before pickup"
//   feature work.
// WHY DO WE NEED IT?
//   Because there's no database to "listen" for events, we simply
//   re-check the Excel file on a schedule and act on whatever is due.
//   This also means restarting the server is completely safe: on the
//   next check, any still-pending reminder is picked up again exactly
//   the same way. Nothing is lost.
// WHAT DOES IT DO?
//   checkAndSendDueReminders():
//     1. Reads every order from Excel.
//     2. Finds ones where Status is not Cancelled/Completed,
//        Reminder Sent is "No", and the Reminder DateTime has arrived.
//     3. Sends the reminder message and marks "Reminder Sent" = Yes.
//     4. Never sends the same reminder twice (checks the flag first).
// DO I NEED TO CHANGE ANYTHING?
//   No. If you're running this on your own PC, it also runs an
//   internal timer automatically (see startInternalScheduler). If you
//   deploy to a free host like Render, use an external cron pinger
//   instead (see README) since the free tier can go to sleep.

const { DateTime } = require('luxon');
const excelService = require('./excelService');
const messageService = require('./messageService');
const config = require('../config/config');

const DONE_STATUSES = ['Completed', 'Cancelled'];

/** Parses "dd-MM-yyyy HH:mm" in the store's timezone. */
function parseReminderDateTime(order) {
  const raw = order['Reminder DateTime'];
  if (!raw) return null;
  const dt = DateTime.fromFormat(String(raw), 'dd-MM-yyyy HH:mm', {
    zone: config.timezone
  });
  return dt.isValid ? dt : null;
}

/**
 * Runs one pass over all orders and sends any reminders that are due.
 * Safe to call as often as you like - already-sent reminders are
 * skipped, so calling it every few minutes (or right after a restart)
 * never causes duplicate messages.
 */
async function checkAndSendDueReminders() {
  const now = DateTime.now().setZone(config.timezone);
  const orders = await excelService.getAllOrders();

  const results = { checked: orders.length, sent: [], failed: [] };

  for (const order of orders) {
    if (order['Reminder Sent'] === 'Yes') continue;
    if (DONE_STATUSES.includes(order['Status'])) continue;

    const reminderTime = parseReminderDateTime(order);
    if (!reminderTime) continue;
    if (reminderTime > now) continue; // not due yet

    try {
      await messageService.sendReminder(order);
      await excelService.updateOrder(order['Order ID'], { 'Reminder Sent': 'Yes' });
      results.sent.push(order['Order ID']);
    } catch (err) {
      // Leave "Reminder Sent" as "No" so it will be retried on the
      // next check instead of being silently lost.
      results.failed.push({ orderId: order['Order ID'], error: err.message });
    }
  }

  return results;
}

/**
 * For local/PC hosting: runs checkAndSendDueReminders automatically
 * every `intervalMinutes` minutes, for as long as the process is
 * running. Not useful on a free host that goes to sleep - use the
 * external cron pinger described in README.md for that case instead.
 */
function startInternalScheduler(intervalMinutes = 5) {
  const ms = intervalMinutes * 60 * 1000;
  setInterval(() => {
    checkAndSendDueReminders().catch((err) =>
      console.error('[reminderService] scheduled check failed:', err.message)
    );
  }, ms);
  console.log(`[reminderService] internal scheduler running every ${intervalMinutes} minute(s).`);
}

module.exports = { checkAndSendDueReminders, startInternalScheduler };
