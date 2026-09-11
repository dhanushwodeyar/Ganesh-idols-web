# Ganesha Store — Order Desk

A simple internal order-entry tool for your Ganesha idol store. No database —
orders live in a plain Excel file (`backend/data/orders.xlsx`). A staff
member enters a customer's order, the system saves it, sends a thank-you
message, and automatically reminds the customer 30 minutes before their
pickup/delivery time.

This README is written for someone using a **tablet/phone only, no PC**,
who wants to get this running for free.

---

## 1. How the whole system works (read this first)

```
Employee opens the website (on tablet/phone/PC)
        │
        ▼
Fills in customer + order + pickup date/time, taps "Place Order"
        │
        ▼
Backend saves a new row in orders.xlsx  ──(if this fails, nothing else
        │                                   happens — no false success)
        ▼
Backend sends a Thank-You message immediately
        │
        ▼
Backend works out Reminder Time = pickup time − 30 minutes
and writes it into that same row
        │
        ▼
Every few minutes, something calls a "check reminders" web address.
It looks at every order, and for any whose reminder time has arrived
AND hasn't been sent yet, it sends the reminder and marks it sent.
```

Because everything is re-checked from the Excel file itself (not from
memory), **restarting the server, or your free host going to sleep and
waking up, never loses a reminder.** It just gets picked up on the next
check.

---

## 2. Project structure

```
ganesha-order-system/
├── frontend/              the website the employee sees
│   ├── index.html
│   ├── style.css
│   └── app.js
├── backend/
│   ├── server.js          starts everything
│   ├── config/config.js   reads your .env settings
│   ├── routes/orderRoutes.js
│   ├── services/
│   │   ├── excelService.js     reads/writes orders.xlsx
│   │   ├── orderService.js     order rules & validation
│   │   ├── messageService.js   sends WhatsApp/console messages
│   │   └── reminderService.js  finds & sends due reminders
│   └── data/orders.xlsx   created automatically the first time you run it
├── .env.example           template for your settings — copy this
├── .gitignore
├── package.json
└── README.md              this file
```

---

## 3. Running it for the very first time (to test on your tablet)

You can do all of this from a browser-based code editor like
**vscode.dev** (VS Code Web) or **GitHub Codespaces**, both of which work
on a tablet and give you a real terminal.

1. Open the project folder in VS Code Web (or Codespaces).
2. In the terminal, run:
   ```
   npm install
   ```
   This downloads the small number of libraries the project uses
   (Express, the Excel library, etc.) — it needs internet access but
   nothing paid.
3. Copy the example settings file:
   ```
   cp .env.example .env
   ```
4. Open `.env` and fill in **at least** these (see the CHANGE THIS list
   in section 6 below):
   - `STORE_NAME`, `STORE_PHONE`, `STORE_ADDRESS`
   - `CRON_SECRET` — type any random word/sentence
   - Leave `MESSAGE_PROVIDER=console` for now — this lets you test the
     entire order + reminder flow for free, with messages just printed
     to the terminal instead of really sent.
5. Start the app:
   ```
   npm start
   ```
6. Open the site (VS Code Web/Codespaces will show a "port forwarded,
   open in browser" popup — tap it). You'll see the order desk.

Follow the **example test order** in section 8 to try the whole flow.

---

## 4. Putting it online for free (Render + GitHub, all from a tablet)

GitHub Pages **cannot** run this project — Pages only hosts plain
HTML/CSS/JS files with no server behind them, and this app needs a
server running continuously to save orders and send reminders. Instead:

### Step A — Put the code on GitHub
1. On github.com (works fine in a tablet browser), create a new,
   **private** repository, e.g. `ganesha-order-system`.
2. Easiest tablet method: use the "Upload files" button on the empty
   repo page and drag in the project folder — or, if you used VS Code
   Web/Codespaces, use its built-in Source Control tab to push the
   code straight to that new repo (no typing git commands needed).
3. **Do not upload your `.env` file.** The `.gitignore` in this project
   already excludes it, so if you're using git normally it will be
   skipped automatically. Only `.env.example` should be visible on GitHub.

### Step B — Deploy on Render
1. Go to render.com and sign up (no credit card needed for the free tier).
2. Click **New → Web Service**, then **connect your GitHub account** and
   pick the `ganesha-order-system` repo.
3. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free
4. Under **Environment**, add each variable from your `.env.example`
   one at a time (this is where your real `STORE_NAME`, `CRON_SECRET`,
   messaging keys, etc. go — Render keeps these private, they are never
   put in GitHub).
5. Click **Create Web Service**. Render will build and start it, and
   give you a public URL like `https://ganesha-order-system.onrender.com`.
   Open that on your tablet — that's your live order desk.

### Step C — Keep reminders checking (free tier sleep workaround)
Render's free tier goes to sleep after 15 minutes with no visitors.
To make sure reminders still get checked and sent on time even if
nobody has the site open:

1. Go to **cron-job.org** (free, no card) and sign up.
2. Create a new cron job that calls this URL every 5 minutes:
   ```
   https://YOUR-RENDER-URL.onrender.com/api/cron/check-reminders?secret=YOUR_CRON_SECRET
   ```
   (use the same `CRON_SECRET` value you set in Render's environment
   variables).
3. That's it — this single ping both wakes the app up if it's asleep
   and triggers the reminder check. Reminders will go out within about
   5 minutes of the exact time, not to the second, which is normal for
   a free always-sleeping host.

If you'd rather reminders fire exactly on time with no sleep delay,
Render's paid "Starter" tier (~$7/month) removes the sleep behavior —
you don't need to change any code for that, just upgrade the plan
later if it matters to you.

---

## 5. Setting up real WhatsApp messages

Start with `MESSAGE_PROVIDER=console` (the default) so you can use the
whole system for free while you decide about WhatsApp. When you're ready:

### Option A — Meta's WhatsApp Cloud API (recommended: official, cheapest)
Real cost: roughly ₹0.10–₹0.15 (about $0.001–$0.002) per message in
India for these "utility" reminder/confirmation-style messages —
sending 500 messages a month costs roughly ₹50–75. There is no
ongoing platform fee for going direct with Meta.

What you need to do:
1. Create a Meta Business Account at business.facebook.com if you
   don't have one, then go to **Meta for Developers** and create an
   app of type "Business", adding the **WhatsApp** product to it.
2. In the app's WhatsApp setup page, you'll get a **temporary access
   token**, a **Phone Number ID**, and can add a **permanent token**
   later (System User token) — copy these into `.env`:
   ```
   META_ACCESS_TOKEN=...
   META_PHONE_NUMBER_ID=...
   ```
3. **Important:** Meta requires any message YOU start (the customer
   didn't message you first) to use a pre-approved **template**, not
   free text. In Meta Business Manager, under WhatsApp → Message
   Templates, create two templates:
   - `order_confirmation` (Utility category) — body something like:
     `Thank you for your order! Order ID: {{1}}, Product: {{2}}...`
   - `order_reminder` (Utility category) — body something like:
     `Hi {{1}}, reminder: your pickup is today at {{2}}. Order ID: {{3}}`
   Submit them for review — approval usually takes minutes to a day.
4. Set `MESSAGE_PROVIDER=meta` in `.env`, and set
   `META_TEMPLATE_THANKYOU` / `META_TEMPLATE_REMINDER` to your template
   names.
5. Test by placing a test order (section 8) addressed to your own
   WhatsApp number.

### Option B — Twilio (easier sandbox for quick testing, costs a bit more)
Twilio adds its own markup on top of Meta's rate, but its **WhatsApp
Sandbox** lets you send free-form test messages instantly with no
template approval — good for a quick trial before committing to Meta.
1. Sign up at twilio.com, open **Messaging → Try WhatsApp**, and follow
   the "join sandbox" instructions (you WhatsApp a code from your own
   phone to Twilio's sandbox number).
2. Copy your Account SID and Auth Token into `.env`:
   ```
   TWILIO_ACCOUNT_SID=...
   TWILIO_AUTH_TOKEN=...
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
   ```
3. Set `MESSAGE_PROVIDER=twilio`.
4. Note: only numbers that have joined your sandbox can receive
   messages. For real customers, you'd need Twilio's paid WhatsApp
   Business setup, which still requires Meta template approval for
   business-initiated messages like yours.

### Is plain SMS an alternative?
Yes — if WhatsApp setup feels like too much right now, SMS via a
provider like Twilio or a local Indian SMS gateway is simpler (no
template approval needed for transactional SMS in most cases) but
customers may find it less convenient than WhatsApp. The
`messageService.js` file is written so a developer could add an
`sms` provider option later without touching the rest of the app.

### A normal personal WhatsApp account cannot do this
To be clear: you cannot connect your personal WhatsApp app to send
these automatically. Automated sending always requires a **WhatsApp
Business Platform (Cloud API)** number, which is a different kind of
number/account than the WhatsApp app on your phone.

---

## 6. Configuration — what to change and what not to

Open `.env` (your real copy, never `.env.example`) and edit:

| Variable | CHANGE THIS? | Notes |
|---|---|---|
| `PORT` | Usually no | Render sets this automatically |
| `CRON_SECRET` | **Yes** | Any random word — protects your reminder endpoint |
| `STORE_NAME`, `STORE_PHONE`, `STORE_ADDRESS` | **Yes** | Shown in messages |
| `TIMEZONE` | Check it | Leave as `Asia/Kolkata` unless your store is elsewhere |
| `MESSAGE_PROVIDER` | **Yes**, when ready | `console` → `meta` or `twilio` |
| `META_*` / `TWILIO_*` | **Yes**, if using that provider | From Meta/Twilio dashboards |
| `THANKYOU_MESSAGE`, `REMINDER_MESSAGE` | Optional | Wording only used in `console`/`twilio` modes |

Do **not** change: anything inside `backend/config/config.js`,
`excelService.js`'s `COLUMNS` list (unless you deliberately want to add
a new column and know to update `orderService.js` to match), or the
API route paths, unless you're comfortable editing code — these are
the internal wiring, not settings.

---

## 7. The APIs (for reference)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/orders` | Place a new order |
| GET | `/api/orders` | List all orders (or `?search=term`) |
| GET | `/api/orders/:id` | Get one order |
| PUT | `/api/orders/:id` | Update status, body: `{ "status": "Ready" }` |
| GET | `/api/cron/check-reminders?secret=...` | Trigger a reminder check |
| GET | `/api/health` | Simple "is it alive" check |

---

## 8. Testing instructions & an example test order

1. Start the app (`npm start`, or open your Render URL).
2. On the **New Order** tab, fill in a test order, e.g.:
   - Customer name: `Test Customer`
   - Mobile: your own number, e.g. `9876543210`
   - Product: `Eco Ganesha`
   - Quantity: `1`
   - Pickup date: today
   - Pickup time: about 10 minutes from now
3. Tap **Place Order**. You should see:
   - "✓ Order Successfully Placed", an Order ID like `GAN-001`
   - "Thank-you message: Sent" (in console mode, check your terminal
     or Render logs — you'll see the message printed there)
   - "Reminder: Scheduled for [time 30 min before pickup]"
4. Open `backend/data/orders.xlsx` (or download it from Render — see
   note below) and confirm the row was added correctly.
5. To test the reminder itself without waiting: temporarily set the
   pickup time to ~2 minutes from now, place the order, then visit:
   ```
   http://localhost:3000/api/cron/check-reminders?secret=YOUR_CRON_SECRET
   ```
   once the reminder time has passed. You should see the reminder
   printed (console mode) or delivered (real WhatsApp), and
   `Reminder Sent` should flip to `Yes` in the Excel file.
6. Restart the server and confirm nothing sends twice — this checks
   the "no duplicate reminders after restart" behavior.

**Note on downloading `orders.xlsx` from Render:** Render's free
web services don't give you a file browser. For now, use the
**Search** and **Dashboard** tabs in the app itself to view orders —
they read the same file. If you want a downloadable copy periodically,
that's a small future addition (e.g. an "export" button); ask if you'd
like that added.

---

## 9. Error handling behavior (already built in)

- If the Excel file can't be written, the employee sees an error and
  the order is **not** reported as placed.
- If the thank-you message fails, the order is still saved, and the
  success screen shows a warning so the employee knows to check.
- If a reminder fails to send, it stays marked "No" and will be
  retried automatically on the next check — nothing is lost.

---

## 10. When to eventually move off Excel

This is intentionally simple and will comfortably handle a small
store with one or two people using it. Consider moving to a real
database only if:
- You regularly have many staff placing orders **at the same exact
  moment** (Excel's single-file read/write can become a bottleneck).
- Your order history grows into the tens of thousands of rows and
  the dashboard/search starts feeling slow.
- You need multiple people editing simultaneously with instant sync
  across devices.

None of that is likely for a single Ganesha idol store, so there's no
need to plan for it now — just something to keep in mind for later.

---

## 11. If you expose this to the public internet later

Right now, anyone who knows your Render URL could open the order desk
and place orders (there's no login). Fine for a private/staff-only
tool. If you ever want to lock it down more:
- Add a simple shared password screen in front of the dashboard.
- Restrict access with Render's built-in features or a reverse proxy.
- Move to proper user accounts if more than a couple of staff use it.

These are optional — not needed for the internal use case described
in this project.
