# Job Booking - Web App for Nigerian Trades & Artisans 🇳🇬

A colourful, friendly, mobile-optimized web application built for small trade businesses in Nigeria—such as tailors, carpenters, mechanics, and handiworkers. Workers log each customer item dropped off, along with customer & worker contact details and the scheduled collection date.

---

## 🌟 Key Features

1. **Public with Mandatory Authentication**:
   - Anyone can sign up.
   - Every page and every action requires signing in.
   - Supported methods:
     - **Email verification code**: Instant 6-digit magic code.
     - **Google Sign-In**: 1-click authentication (with instant presets for local testing).
   - Server-side authorization protects all endpoints with HTTP 401/403.

2. **Page 1: "New Job" Form**:
   - Exact required field ordering & labels:
     1. `Customer Name` (short text, required)
     2. `Customer Phone` (phone number, required, default country Nigeria `+234`)
     3. `Worker Phone` (phone number, required, default country Nigeria `+234`, directly under Customer Phone with help text: *"Your own phone number. Reminders are texted here, and customers see it so they can call you"*)
     4. `Item / Job` (short text, required, placeholder: *"e.g. Toyota Camry, Ankara gown, dining table"*)
     5. `Job Details` (long text, optional)
     6. `Collection Date` (date picker, required, past dates blocked)
     7. `Notify Email` (email, required, help text: *"Where reminders are emailed (usually your own email)"*)
     8. `Business Name` (short text, optional, help text: *"Shown to the customer in the reminder text"*)
   - Large, rounded, vibrant orange **"Save Job"** button.
   - On submit:
     - Formats Nigerian phone numbers with `+234...` dropping leading `0`.
     - Leaves `Last Reminder` column empty (never overwritten, preserved for external automation).
     - Asynchronously posts to the saved **Zapier Webhook** (if enabled).
     - Asynchronously appends to Google Sheet (if configured).
     - Displays exact confirmation: *"Job saved. Reminders will be sent automatically 5, 3 and 1 day before collection."*
     - Keeps worker's phone, email, and business name filled in for subsequent jobs!

3. **Page 2: "My Jobs"**:
   - Live read-only list of jobs sorted by `Collection Date` with nearest first.
   - Real-time search filter for customer name.
   - Each card displays:
     - `Customer Name`
     - `Item / Job`
     - `Collection Date`
     - `Customer Phone`
     - Directly under it, `Worker Phone`
   - Warm orange/red badge: **"Due soon"** for jobs due within the next 3 days.
   - Tap-to-call and WhatsApp quick buttons for mobile trade workers.

4. **Page 3: "Owner" Control Center (Only for `osanyintuyimofeoluwa@gmail.com`)**:
   - Strictly hidden in the navigation and protected on the server with HTTP 403.
   - **Totals KPI Metrics**:
     - All jobs
     - Due soon (≤ 3 days)
     - Overdue
     - Number of sign-ups
   - **User Registry**: List of everyone who signed up (name, email, registration date).
   - **Zapier Webhook Box**:
     - Save/edit webhook URL.
     - Saves to `App Settings` database table.
     - Empty box turns it off.
     - Built-in "Test Webhook Ping" button.
   - **Connected Google Sheet** details:
     - Sheet: `job reminder (Responses)`
     - Tab: `Form responses 1`
     - ID: `15oZab-gF3dFCInkIS49tRTF7jvErmvMcqC3-5T0eHX0`
     - Columns: `Customer Name`, `Customer Phone`, `Item / Job`, `Job Details`, `Collection Date`, `Notify Email`, `Worker Phone`, `Business Name`, `Last Reminder`

5. **Design**:
   - Teal-to-blue gradient header (`#0d9488` to `#0284c7`) with white typography.
   - Soft light teal page background (`#e8f5f3`), never plain white.
   - White rounded cards with soft shadows and colored left accent borders:
     - Teal for Customer & Worker Contact
     - Purple for Item & Schedule
     - Orange for Reminders & Business
   - Rounded friendly font: **Nunito**.
   - Friendly icons for fields: person, phone, wrench/tools, calendar, email.

---

## 🚀 Running the App Locally

```bash
cd "C:\Users\BUY COMPUTERS\.gemini\antigravity\scratch\job-booking"
npm start
```
Then visit `http://localhost:3000` in any browser or phone connected to the network.
