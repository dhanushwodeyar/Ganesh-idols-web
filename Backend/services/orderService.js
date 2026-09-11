// orderService.js
// WHAT IS THIS FILE?
//   The "brain" of order handling: validates input, generates Order
//   IDs, works out the reminder time, and talks to excelService to
//   actually save things.
// WHY DO WE NEED IT?
//   Keeps routes/orderRoutes.js thin (just HTTP plumbing) and keeps
//   all the order rules in one place.
// DO I NEED TO CHANGE ANYTHING?
//   Only if you want to change validation rules or the ID format
//   (see generateOrderId below).

const { DateTime } = require('luxon');
const excelService = require('./excelService');
const messageService = require('./messageService');
const config = require('../config/config');

const VALID_STATUSES = ['Pending', 'Confirmed', 'Ready', 'Completed', 'Cancelled'];
const REMINDER_MINUTES_BEFORE = 30;

/** Looks at existing orders and works out the next GAN-00X id. */
async function generateOrderId() {
  const orders = await excelService.getAllOrders();
  let maxNumber = 0;
  for (const order of orders) {
    const match = String(order['Order ID'] || '').match(/^GAN-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  }
  const nextNumber = maxNumber + 1;
  return `GAN-${String(nextNumber).padStart(3, '0')}`;
}

/**
 * Combines a "DD-MM-YYYY" date and "HH:mm" (24hr) time into a Luxon
 * DateTime in the store's configured timezone.
 */
function toStoreDateTime(dateStr, timeStr) {
  return DateTime.fromFormat(`${dateStr} ${timeStr}`, 'dd-MM-yyyy HH:mm', {
    zone: config.timezone
  });
}

function formatTime12h(dateStr, timeStr) {
  const dt = toStoreDateTime(dateStr, timeStr);
  return dt.isValid ? dt.toFormat('hh:mm a') : timeStr;
}

function validateOrderInput(input) {
  const errors = [];

  if (!input.customerName || !input.customerName.trim()) {
    errors.push('Customer name is required.');
  }
  if (!input.phone || !/^\+?\d{7,15}$/.test(input.phone.trim())) {
    errors.push('A valid phone number is required.');
  }
  if (!input.product || !input.product.trim()) {
    errors.push('Product / Ganesha idol is required.');
  }
  const quantity = Number(input.quantity);
  if (!quantity || quantity < 1) {
    errors.push('Quantity must be at least 1.');
  }
  if (!input.pickupDate || !/^\d{2}-\d{2}-\d{4}$/.test(input.pickupDate)) {
    errors.push('Pickup date is required in DD-MM-YYYY format.');
  }
  if (!input.pickupTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.pickupTime)) {
    errors.push('Pickup time is required in 24-hour HH:mm format.');
  }
  if (input.orderType && !['Pickup', 'Delivery'].includes(input.orderType)) {
    errors.push('Order type must be Pickup or Delivery.');
  }

  if (errors.length === 0) {
    const pickupDateTime = toStoreDateTime(input.pickupDate, input.pickupTime);
    if (!pickupDateTime.isValid) {
      errors.push('Pickup date/time could not be understood. Please re-check them.');
    }
  }

  return errors;
}

/**
 * Creates a new order: validates, saves to Excel, sends thank-you,
 * and works out (but does not yet send) the reminder time.
 * The caller (routes) is responsible for telling reminderService to
 * schedule the reminder afterwards.
 */
async function createOrder(input) {
  const errors = validateOrderInput(input);
  if (errors.length > 0) {
    const err = new Error('Validation failed');
    err.validationErrors = errors;
    throw err;
  }

  const orderId = await generateOrderId();
  const pickupDateTime = toStoreDateTime(input.pickupDate, input.pickupTime);
  const reminderDateTime = pickupDateTime.minus({ minutes: REMINDER_MINUTES_BEFORE });

  const orderRow = {
    'Order ID': orderId,
    'Customer Name': input.customerName.trim(),
    'Phone': input.phone.trim(),
    'WhatsApp Number': (input.whatsappNumber || input.phone).trim(),
    'Email': (input.email || '').trim(),
    'Product': input.product.trim(),
    'Quantity': Number(input.quantity),
    'Order Type': input.orderType || 'Pickup',
    'Pickup Date': input.pickupDate,
    'Pickup Time': formatTime12h(input.pickupDate, input.pickupTime),
    'Reminder DateTime': reminderDateTime.toFormat('dd-MM-yyyy HH:mm'),
    'Notes': (input.notes || '').trim(),
    'Status': 'Pending',
    'Thank You Sent': 'No',
    'Reminder Sent': 'No',
    'Created At': DateTime.now().setZone(config.timezone).toFormat('dd-MM-yyyy HH:mm:ss')
  };

  // IMPORTANT (see spec section 18): the order is only reported as
  // successfully placed if this Excel write succeeds. If it throws,
  // the route layer will NOT tell the customer/employee it worked.
  await excelService.appendOrder(orderRow);

  // Thank-you message is sent right after saving. If it fails, the
  // order still exists - we just report the failure back to the caller.
  let thankYouResult = { ok: false, error: null };
  try {
    await messageService.sendThankYou(orderRow);
    await excelService.updateOrder(orderId, { 'Thank You Sent': 'Yes' });
    thankYouResult.ok = true;
  } catch (err) {
    thankYouResult.error = err.message;
  }

  return { order: orderRow, thankYouResult, reminderDateTime };
}

async function getAllOrders() {
  return excelService.getAllOrders();
}

async function getOrderById(orderId) {
  const orders = await excelService.getAllOrders();
  return orders.find((o) => o['Order ID'] === orderId) || null;
}

async function searchOrders(query) {
  const orders = await excelService.getAllOrders();
  if (!query) return orders;
  const q = query.trim().toLowerCase();
  return orders.filter(
    (o) =>
      String(o['Order ID']).toLowerCase().includes(q) ||
      String(o['Customer Name']).toLowerCase().includes(q) ||
      String(o['Phone']).includes(q)
  );
}

async function updateOrderStatus(orderId, status) {
  if (!VALID_STATUSES.includes(status)) {
    const err = new Error(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
    err.validationErrors = [err.message];
    throw err;
  }
  const updated = await excelService.updateOrder(orderId, { Status: status });
  if (!updated) {
    const err = new Error('Order not found');
    err.notFound = true;
    throw err;
  }
  return updated;
}

module.exports = {
  VALID_STATUSES,
  createOrder,
  getAllOrders,
  getOrderById,
  searchOrders,
  updateOrderStatus,
  toStoreDateTime
};
