// orderRoutes.js
// WHAT IS THIS FILE?
//   Defines the web addresses (API endpoints) the frontend calls.
// WHY DO WE NEED IT?
//   Keeps all "which URL does what" decisions in one readable file.
// DO I NEED TO CHANGE ANYTHING?
//   No, unless you want to add a brand-new feature/endpoint.

const express = require('express');
const router = express.Router();

const orderService = require('../services/orderService');
const reminderService = require('../services/reminderService');
const config = require('../config/config');

// POST /api/orders  -> place a new order
router.post('/orders', async (req, res) => {
  try {
    const { order, thankYouResult, reminderDateTime } = await orderService.createOrder(req.body);
    res.status(201).json({
      success: true,
      order,
      thankYouSent: thankYouResult.ok,
      thankYouError: thankYouResult.error,
      reminderScheduledFor: reminderDateTime.toFormat('dd-MM-yyyy hh:mm a')
    });
  } catch (err) {
    if (err.validationErrors) {
      return res.status(400).json({ success: false, errors: err.validationErrors });
    }
    console.error('[POST /orders] failed:', err);
    res.status(500).json({
      success: false,
      errors: ['Could not save the order. Nothing was recorded. Please try again.']
    });
  }
});

// GET /api/orders?search=xxx  -> list all orders, or search
router.get('/orders', async (req, res) => {
  try {
    const orders = req.query.search
      ? await orderService.searchOrders(req.query.search)
      : await orderService.getAllOrders();
    res.json({ success: true, orders });
  } catch (err) {
    console.error('[GET /orders] failed:', err);
    res.status(500).json({ success: false, errors: ['Could not read orders.'] });
  }
});

// GET /api/orders/:id  -> a single order
router.get('/orders/:id', async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ success: false, errors: ['Order not found.'] });
    res.json({ success: true, order });
  } catch (err) {
    console.error('[GET /orders/:id] failed:', err);
    res.status(500).json({ success: false, errors: ['Could not read order.'] });
  }
});

// PUT /api/orders/:id  -> update status (e.g. { "status": "Ready" })
router.put('/orders/:id', async (req, res) => {
  try {
    const updated = await orderService.updateOrderStatus(req.params.id, req.body.status);
    res.json({ success: true, order: updated });
  } catch (err) {
    if (err.notFound) return res.status(404).json({ success: false, errors: [err.message] });
    if (err.validationErrors) return res.status(400).json({ success: false, errors: err.validationErrors });
    console.error('[PUT /orders/:id] failed:', err);
    res.status(500).json({ success: false, errors: ['Could not update order.'] });
  }
});

// GET /api/cron/check-reminders?secret=...  -> triggers a reminder check
// This is the endpoint an external free "cron pinger" (see README)
// should call every few minutes. Protected by a shared secret so
// random visitors on the internet can't trigger it.
router.get('/cron/check-reminders', async (req, res) => {
  if (req.query.secret !== config.cronSecret) {
    return res.status(401).json({ success: false, errors: ['Invalid secret.'] });
  }
  try {
    const result = await reminderService.checkAndSendDueReminders();
    res.json({ success: true, result });
  } catch (err) {
    console.error('[GET /cron/check-reminders] failed:', err);
    res.status(500).json({ success: false, errors: ['Reminder check failed.'] });
  }
});

module.exports = router;
