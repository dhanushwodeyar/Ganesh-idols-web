// excelService.js
// WHAT IS THIS FILE?
//   This is the ONLY file that directly touches "orders.xlsx". Every
//   other part of the app asks this file to read or write orders,
//   instead of touching the Excel file themselves.
// WHY DO WE NEED IT?
//   Keeping all Excel logic in one place means we can safely control
//   how the file is read/written and avoid corrupting it when two
//   requests happen close together.
// WHAT DOES IT DO?
//   - Creates orders.xlsx (with the correct column headers) if it
//     does not exist yet.
//   - Reads all orders as a simple JavaScript array.
//   - Appends a new order as a new row.
//   - Updates an existing order (status, reminder sent, etc.)
// DO I NEED TO CHANGE ANYTHING?
//   No, unless you want to add a new column - see COLUMNS below.

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'orders.xlsx');
const SHEET_NAME = 'Orders';

// CHANGE THIS if you want to add/remove a column. Keep it in sync with
// anywhere in the code that creates an order object (see orderService.js).
const COLUMNS = [
  'Order ID',
  'Customer Name',
  'Phone',
  'WhatsApp Number',
  'Email',
  'Product',
  'Quantity',
  'Order Type',
  'Pickup Date',
  'Pickup Time',
  'Reminder DateTime',
  'Notes',
  'Status',
  'Thank You Sent',
  'Reminder Sent',
  'Created At'
];

// Very small "traffic light" so that only one read/write happens to the
// Excel file at a time. This is enough for a single small store - it
// prevents two near-simultaneous requests from corrupting the file.
let queue = Promise.resolve();
function runExclusive(fn) {
  const result = queue.then(() => fn());
  // Swallow errors here so one failed operation doesn't jam the queue
  // for everyone after it - the real error is still returned to the caller.
  queue = result.catch(() => {});
  return result;
}

function ensureFileExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(FILE_PATH)) {
    const worksheet = XLSX.utils.aoa_to_sheet([COLUMNS]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);
    XLSX.writeFile(workbook, FILE_PATH);
  }
}

function readAllRaw() {
  ensureFileExists();
  const workbook = XLSX.readFile(FILE_PATH);
  const sheet = workbook.Sheets[SHEET_NAME];
  // defval: '' makes sure missing cells come back as empty string, not undefined
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function writeAllRaw(rows) {
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: COLUMNS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);

  // Write to a temp file first, then rename. This avoids leaving a
  // half-written/corrupted orders.xlsx if something goes wrong mid-write.
  const tempPath = FILE_PATH + '.tmp';
  XLSX.writeFile(workbook, tempPath);
  fs.renameSync(tempPath, FILE_PATH);
}

/** Returns every order as an array of plain objects. */
function getAllOrders() {
  return runExclusive(() => readAllRaw());
}

/** Adds a brand new order row. Throws if the write fails. */
function appendOrder(orderRow) {
  return runExclusive(() => {
    const rows = readAllRaw();
    rows.push(orderRow);
    writeAllRaw(rows);
    return orderRow;
  });
}

/**
 * Updates fields on an existing order (matched by Order ID).
 * `updates` is a partial object, e.g. { Status: 'Ready' }.
 * Returns the updated order, or null if no order had that ID.
 */
function updateOrder(orderId, updates) {
  return runExclusive(() => {
    const rows = readAllRaw();
    const index = rows.findIndex((r) => r['Order ID'] === orderId);
    if (index === -1) return null;
    rows[index] = { ...rows[index], ...updates };
    writeAllRaw(rows);
    return rows[index];
  });
}

module.exports = {
  FILE_PATH,
  COLUMNS,
  getAllOrders,
  appendOrder,
  updateOrder
};
