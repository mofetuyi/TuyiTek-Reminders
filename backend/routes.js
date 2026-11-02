const express = require('express');
const router = express.Router();
const db = require('./db');
const auth = require('./auth');
const integrations = require('./integrations');

const TZ = 'Africa/Lagos';

/**
 * Helper to get current date in Nigeria (YYYY-MM-DD)
 */
function getTodayDateString() {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Calculate days between today and collection date
 */
function getDaysLeft(collectionDateStr) {
  if (!collectionDateStr) return null;
  const todayStr = getTodayDateString();
  const today = new Date(todayStr + 'T00:00:00Z');
  const target = new Date(collectionDateStr + 'T00:00:00Z');
  if (isNaN(target.getTime())) return null;
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

/* ==========================================================================
   PUBLIC AUTH ROUTES
   ========================================================================== */

/**
 * Request an email verification code (Magic 6-digit code)
 */
router.post('/auth/request-code', (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Please enter your email address' });
    }
    const result = auth.requestVerificationCode(email, name);
    res.json({
      success: true,
      message: 'Verification code generated! Please check your email.',
      previewCode: result.code, // Returned for instant demo testing
      email: result.email
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Verify 6-digit email code
 */
router.post('/auth/verify-code', (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }
    const result = auth.verifyCode(email, code);
    res.json({
      success: true,
      token: result.token,
      user: result.user
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Quick Google Sign-In
 */
router.post('/auth/google', (req, res) => {
  try {
    const { email, name, credential } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required for Google Sign-In' });
    }
    const result = auth.googleSignIn(email, name, credential);
    res.json({
      success: true,
      token: result.token,
      user: result.user
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get current authenticated user
 */
router.get('/auth/me', auth.requireAuth, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

/**
 * Sign out
 */
router.post('/auth/signout', auth.requireAuth, (req, res) => {
  db.deleteSession(req.token);
  res.json({ success: true, message: 'Signed out successfully' });
});


/* ==========================================================================
   JOB ROUTES (Protected by requireAuth)
   ========================================================================== */

/**
 * Page 2: "My Jobs"
 * Read-only list of all jobs from the sheet, sorted by Collection Date with nearest first.
 */
router.get('/jobs', auth.requireAuth, (req, res) => {
  try {
    const rawJobs = db.getJobs();
    const todayStr = getTodayDateString();

    const enrichedJobs = rawJobs.map(job => {
      const daysLeft = getDaysLeft(job['Collection Date']);
      const isDueSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
      const isOverdue = daysLeft !== null && daysLeft < 0;

      return {
        ...job,
        days_left: daysLeft,
        is_due_soon: isDueSoon,
        is_overdue: isOverdue
      };
    });

    res.json({
      success: true,
      jobs: enrichedJobs,
      today: todayStr
    });
  } catch (err) {
    console.error('Error fetching jobs:', err);
    res.status(500).json({ error: 'Failed to retrieve jobs' });
  }
});

/**
 * Page 1: "New Job" Form Submit
 * Adds a new row with exact columns, leaves Last Reminder empty,
 * dispatches to Zapier webhook if configured, and returns friendly confirmation.
 */
router.post('/jobs', auth.requireAuth, async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      workerPhone,
      itemJob,
      jobDetails,
      collectionDate,
      notifyEmail,
      businessName
    } = req.body;

    // Field validations
    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ error: 'Customer Name is required.' });
    }
    if (!customerPhone || !customerPhone.trim()) {
      return res.status(400).json({ error: 'Customer Phone is required.' });
    }
    if (!workerPhone || !workerPhone.trim()) {
      return res.status(400).json({ error: 'Worker Phone is required.' });
    }
    if (!itemJob || !itemJob.trim()) {
      return res.status(400).json({ error: 'Item / Job is required.' });
    }
    if (!collectionDate || !collectionDate.trim()) {
      return res.status(400).json({ error: 'Collection Date is required.' });
    }
    if (!notifyEmail || !notifyEmail.trim()) {
      return res.status(400).json({ error: 'Notify Email is required.' });
    }

    // Phone normalization (country code +234, dropping leading 0)
    const normalizedCustomerPhone = integrations.normalizeNigerianPhone(customerPhone);
    const normalizedWorkerPhone = integrations.normalizeNigerianPhone(workerPhone);

    if (!normalizedCustomerPhone) {
      return res.status(400).json({ error: 'Please enter a valid Customer Phone number.' });
    }
    if (!normalizedWorkerPhone) {
      return res.status(400).json({ error: 'Please enter a valid Worker Phone number.' });
    }

    // Date normalization & past date check
    const normalizedDate = integrations.normalizeDate(collectionDate);
    const todayStr = getTodayDateString();
    if (normalizedDate < todayStr) {
      return res.status(400).json({ error: 'Collection Date cannot be in the past.' });
    }

    // Construct job record with exact column headers matching Google Sheet
    const jobRecord = {
      'Customer Name': customerName.trim(),
      'Customer Phone': normalizedCustomerPhone,
      'Item / Job': itemJob.trim(),
      'Job Details': (jobDetails || '').trim(),
      'Collection Date': normalizedDate,
      'Notify Email': notifyEmail.trim().toLowerCase(),
      'Worker Phone': normalizedWorkerPhone,
      'Business Name': (businessName || '').trim(),
      'Last Reminder': '' // strictly left empty as instructed
    };

    // Save into database
    const savedJob = db.addJob(jobRecord, req.user.id);

    // Dispatch to Zapier Webhook & Google Sheets Webhook asynchronously
    const settings = db.getSettings();
    integrations.processJobIntegrations(savedJob, settings)
      .then(result => {
        console.log(`Integration dispatch for job ${savedJob.id}:`, result);
      })
      .catch(err => {
        console.error(`Integration dispatch error for job ${savedJob.id}:`, err);
      });

    // Exact response message required by specification:
    res.json({
      success: true,
      message: 'Job saved. Reminders will be sent automatically 5, 3 and 1 day before collection.',
      job: savedJob,
      retainedFields: {
        workerPhone: normalizedWorkerPhone,
        notifyEmail: notifyEmail.trim().toLowerCase(),
        businessName: (businessName || '').trim()
      }
    });

  } catch (err) {
    console.error('Error saving job:', err);
    res.status(500).json({ error: 'Failed to save job. Please try again.' });
  }
});


/* ==========================================================================
   PAGE 3: OWNER ROUTES (Protected by requireAuth and requireOwner)
   Strictly checked on the server too!
   ========================================================================== */

/**
 * Get Owner dashboard data:
 * - Totals: all jobs, due soon, overdue, number of sign-ups
 * - List of everyone who has signed up (name and email)
 * - Zapier webhook link and app settings
 */
router.get('/owner/data', auth.requireAuth, auth.requireOwner, (req, res) => {
  try {
    const jobs = db.getJobs();
    const users = db.getUsers();
    const settings = db.getSettings();
    const todayStr = getTodayDateString();

    let dueSoonCount = 0;
    let overdueCount = 0;

    jobs.forEach(job => {
      const daysLeft = getDaysLeft(job['Collection Date']);
      if (daysLeft !== null) {
        if (daysLeft < 0) {
          overdueCount++;
        } else if (daysLeft >= 0 && daysLeft <= 3) {
          dueSoonCount++;
        }
      }
    });

    const totals = {
      allJobs: jobs.length,
      dueSoon: dueSoonCount,
      overdue: overdueCount,
      signUps: users.length
    };

    res.json({
      success: true,
      totals,
      users,
      settings: {
        zapier_webhook_url: settings.zapier_webhook_url || '',
        google_sheet_id: settings.google_sheet_id || '',
        google_sheet_tab: settings.google_sheet_tab || '',
        google_apps_script_url: settings.google_apps_script_url || '',
        updated_at: settings.updated_at
      },
      ownerEmail: db.OWNER_EMAIL,
      today: todayStr
    });
  } catch (err) {
    console.error('Error loading owner data:', err);
    res.status(500).json({ error: 'Failed to load owner data' });
  }
});

/**
 * Save Zapier webhook link and App Settings in database table
 * An empty box turns it off.
 */
router.post('/owner/settings', auth.requireAuth, auth.requireOwner, (req, res) => {
  try {
    const { zapier_webhook_url, google_apps_script_url } = req.body;
    
    // Store in App Settings table; empty turns it off
    const updated = db.updateSettings({
      zapier_webhook_url: (zapier_webhook_url || '').trim(),
      google_apps_script_url: (google_apps_script_url || '').trim()
    });

    res.json({
      success: true,
      message: 'App settings saved successfully.',
      settings: updated
    });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * Test dispatch to Zapier webhook
 */
router.post('/owner/test-webhook', auth.requireAuth, auth.requireOwner, async (req, res) => {
  try {
    const { url: targetUrl } = req.body;
    if (!targetUrl || !targetUrl.trim()) {
      return res.status(400).json({ error: 'Please enter a webhook URL to test.' });
    }

    const testPayload = {
      test: true,
      event: 'job_booking_test',
      'Customer Name': 'Test Customer (Job Booking App)',
      'Customer Phone': '+2348012345678',
      'Item / Job': 'Ankara 3-Piece Agbada suit',
      'Job Details': 'Test ping from Job Booking app owner panel',
      'Collection Date': getTodayDateString(),
      'Notify Email': db.OWNER_EMAIL,
      'Worker Phone': '+2348140009988',
      'Business Name': 'TuyiTek Job Booking Demo',
      'Last Reminder': ''
    };

    const result = await integrations.sendWebhook(targetUrl.trim(), testPayload);
    res.json({
      success: result.success,
      result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
