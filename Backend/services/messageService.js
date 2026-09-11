// messageService.js
// WHAT IS THIS FILE?
//   Handles sending the Thank-You and Reminder messages to customers.
// WHY DO WE NEED IT?
//   So the rest of the app never needs to know HOW a message is sent
//   (console log vs real WhatsApp) - it just calls sendThankYou() or
//   sendReminder() and this file figures out the rest.
// WHAT DOES IT DO?
//   Reads MESSAGE_PROVIDER from .env and sends the message using:
//     - "console" : just prints it (default, free, no setup needed)
//     - "meta"    : Meta's official WhatsApp Cloud API
//     - "twilio"  : Twilio's WhatsApp API
// DO I NEED TO CHANGE ANYTHING?
//   No code changes needed to switch providers - just edit .env.
//   See README.md for how to get real WhatsApp working.

const axios = require('axios');
const config = require('../config/config');

function fillTemplate(template, values) {
  let text = template;
  for (const [key, value] of Object.entries(values)) {
    text = text.split(`{${key}}`).join(String(value ?? ''));
  }
  // Support literal "\n" written in the .env file as real line breaks
  return text.replace(/\\n/g, '\n');
}

async function sendViaConsole(toNumber, text) {
  console.log('----------------------------------------------------');
  console.log('[MESSAGE - CONSOLE MODE, NOT ACTUALLY SENT]');
  console.log('To:', toNumber);
  console.log(text);
  console.log('----------------------------------------------------');
  return { ok: true, provider: 'console' };
}

// Sends a pre-approved WhatsApp template message via Meta's Cloud API.
// NOTE: Meta requires business-initiated messages to use an approved
// template (freeform text is only allowed as a REPLY within 24 hours
// of the customer messaging you first). See README for template setup.
async function sendViaMeta(toNumber, templateName, bodyParams) {
  const { accessToken, phoneNumberId, templateLang } = config.messaging.meta;
  if (!accessToken || !phoneNumberId) {
    throw new Error(
      'Meta WhatsApp is not configured. Fill META_ACCESS_TOKEN and META_PHONE_NUMBER_ID in .env'
    );
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: toNumber.replace(/[^\d]/g, ''), // digits only, with country code
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: 'body',
          parameters: bodyParams.map((text) => ({ type: 'text', text: String(text) }))
        }
      ]
    }
  };

  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  return { ok: true, provider: 'meta', response: response.data };
}

// Sends a freeform WhatsApp message via Twilio. Works out of the box
// with the Twilio Sandbox for testing. For production outside the
// sandbox, Twilio also requires approved WhatsApp templates.
async function sendViaTwilio(toNumber, text) {
  const { accountSid, authToken, fromNumber } = config.messaging.twilio;
  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      'Twilio is not configured. Fill TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env'
    );
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams();
  params.append('From', fromNumber);
  params.append('To', `whatsapp:${toNumber}`);
  params.append('Body', text);

  const response = await axios.post(url, params, {
    auth: { username: accountSid, password: authToken }
  });
  return { ok: true, provider: 'twilio', response: response.data };
}

async function sendThankYou(order) {
  const text = fillTemplate(config.messaging.thankYouTemplate, {
    name: order['Customer Name'],
    orderId: order['Order ID'],
    product: order['Product'],
    pickupDate: order['Pickup Date'],
    pickupTime: order['Pickup Time'],
    storeName: config.store.name
  });

  return sendMessage(order, text, config.messaging.meta.templateThankYou, [
    order['Customer Name'],
    order['Order ID'],
    order['Pickup Date'],
    order['Pickup Time']
  ]);
}

async function sendReminder(order) {
  const text = fillTemplate(config.messaging.reminderTemplate, {
    name: order['Customer Name'],
    orderId: order['Order ID'],
    product: order['Product'],
    pickupDate: order['Pickup Date'],
    pickupTime: order['Pickup Time'],
    storeName: config.store.name
  });

  return sendMessage(order, text, config.messaging.meta.templateReminder, [
    order['Customer Name'],
    order['Pickup Time'],
    order['Order ID']
  ]);
}

async function sendMessage(order, freeformText, metaTemplateName, metaTemplateParams) {
  const toNumber = order['WhatsApp Number'] || order['Phone'];
  const provider = config.messaging.provider;

  if (provider === 'meta') {
    return sendViaMeta(toNumber, metaTemplateName, metaTemplateParams);
  }
  if (provider === 'twilio') {
    return sendViaTwilio(toNumber, freeformText);
  }
  return sendViaConsole(toNumber, freeformText);
}

module.exports = { sendThankYou, sendReminder };
