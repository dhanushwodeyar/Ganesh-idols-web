// config.js
// WHAT IS THIS FILE?
//   Reads all the settings from your ".env" file in one place, so the
//   rest of the app never has to deal with "process.env" directly.
// WHY DO WE NEED IT?
//   So all your store-specific info (name, phone, API keys, timezone)
//   lives in ONE file (.env) instead of being scattered across the code.
// DO I NEED TO CHANGE ANYTHING HERE?
//   No. Change values in ".env" instead. This file just reads them.

require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  cronSecret: process.env.CRON_SECRET || 'change_this_to_a_random_secret',

  store: {
    name: process.env.STORE_NAME || 'Your Ganesha Store',
    phone: process.env.STORE_PHONE || '',
    address: process.env.STORE_ADDRESS || ''
  },

  timezone: process.env.TIMEZONE || 'Asia/Kolkata',

  messaging: {
    provider: (process.env.MESSAGE_PROVIDER || 'console').toLowerCase(),

    meta: {
      accessToken: process.env.META_ACCESS_TOKEN || '',
      phoneNumberId: process.env.META_PHONE_NUMBER_ID || '',
      wabaId: process.env.META_WABA_ID || '',
      templateThankYou: process.env.META_TEMPLATE_THANKYOU || 'order_confirmation',
      templateReminder: process.env.META_TEMPLATE_REMINDER || 'order_reminder',
      templateLang: process.env.META_TEMPLATE_LANG || 'en'
    },

    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_WHATSAPP_FROM || ''
    },

    thankYouTemplate:
      process.env.THANKYOU_MESSAGE ||
      'Thank you for your order! Order ID: {orderId}',
    reminderTemplate:
      process.env.REMINDER_MESSAGE ||
      'Reminder: your pickup is today at {pickupTime}. Order ID: {orderId}'
  }
};
