const https = require('https');
const http = require('http');
const url = require('url');

/**
 * Normalizes a Nigerian phone number to +234... format, dropping the leading 0
 * Examples:
 *   "08031234567" -> "+2348031234567"
 *   "0803 123 4567" -> "+2348031234567"
 *   "+234 803 123 4567" -> "+2348031234567"
 *   "2348031234567" -> "+2348031234567"
 *   "8031234567" -> "+2348031234567"
 */
function normalizeNigerianPhone(phone) {
  if (!phone) return '';
  let str = String(phone).trim();
  // Strip everything except digits and plus
  let cleaned = str.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+234')) {
    let rest = cleaned.slice(4);
    if (rest.startsWith('0')) rest = rest.slice(1);
    return '+234' + rest;
  }
  if (cleaned.startsWith('234')) {
    let rest = cleaned.slice(3);
    if (rest.startsWith('0')) rest = rest.slice(1);
    return '+234' + rest;
  }
  if (cleaned.startsWith('0')) {
    return '+234' + cleaned.slice(1);
  }
  if (/^\d{10}$/.test(cleaned)) {
    return '+234' + cleaned;
  }
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  return '+234' + cleaned;
}

/**
 * Formats a date string as YYYY-MM-DD
 */
function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return trimmed;
  return d.toISOString().split('T')[0];
}

/**
 * Post JSON payload to a webhook URL (with automatic redirect following for Google Apps Script Web Apps)
 */
function sendWebhook(targetUrl, payload, redirects = 5) {
  return new Promise((resolve) => {
    if (!targetUrl || !targetUrl.trim()) {
      return resolve({ skipped: true, reason: 'No webhook URL provided' });
    }

    try {
      const parsedUrl = new URL(targetUrl.trim());
      const postData = JSON.stringify(payload);
      const isHttps = parsedUrl.protocol === 'https:';
      const transport = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'JobBookingApp-Nigeria/1.0'
        },
        timeout: 12000
      };

      const req = transport.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          // Follow HTTP redirects (essential for Google Apps Script Web Apps which return 302 Found)
          if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
            if (targetUrl.includes('script.google.com')) {
              return resolve({ success: true, statusCode: 200, response: 'Google Script executed successfully' });
            }
            const redirectUrl = new URL(res.headers.location, targetUrl).toString();
            return sendWebhook(redirectUrl, payload, redirects - 1).then(resolve);
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, statusCode: res.statusCode, response: responseBody });
          } else {
            console.warn(`Webhook responded with status ${res.statusCode}:`, responseBody);
            resolve({ success: false, statusCode: res.statusCode, response: responseBody });
          }
        });
      });

      req.on('error', (err) => {
        console.error('Webhook error:', err.message);
        resolve({ success: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Webhook request timed out' });
      });

      req.write(postData);
      req.end();
    } catch (err) {
      console.error('Failed to parse or send webhook:', err.message);
      resolve({ success: false, error: err.message });
    }
  });
}

const GOOGLE_FORM_ACTION_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd-xFLwiwMW6WqaRZE7fgX_qeHfOYUtxIcbbY_KjtG4axM1SA/formResponse';

const GOOGLE_FORM_FIELD_MAP = {
  customerName: 'entry.873462855',
  customerPhone: 'entry.309071233',
  workerPhone: 'entry.1660459489',
  itemJob: 'entry.699553298',
  jobDetails: 'entry.922852429',
  collectionDate: 'entry.832432778',
  notifyEmail: 'entry.135128838',
  businessName: 'entry.1318290585'
};

/**
 * Submits the job directly to the Google Form linked to "job reminder (Responses)".
 * This instantly writes the row into the Google Sheet "Form responses 1" tab without any webhook!
 */
function submitToGoogleForm(job) {
  return new Promise((resolve) => {
    try {
      const querystring = require('querystring');
      const formData = {
        [GOOGLE_FORM_FIELD_MAP.customerName]: job['Customer Name'] || '',
        [GOOGLE_FORM_FIELD_MAP.customerPhone]: job['Customer Phone'] || '',
        [GOOGLE_FORM_FIELD_MAP.workerPhone]: job['Worker Phone'] || '',
        [GOOGLE_FORM_FIELD_MAP.itemJob]: job['Item / Job'] || '',
        [GOOGLE_FORM_FIELD_MAP.jobDetails]: job['Job Details'] || '',
        [GOOGLE_FORM_FIELD_MAP.collectionDate]: job['Collection Date'] || '',
        [GOOGLE_FORM_FIELD_MAP.notifyEmail]: job['Notify Email'] || '',
        [GOOGLE_FORM_FIELD_MAP.businessName]: job['Business Name'] || ''
      };

      const postData = querystring.stringify(formData);
      const parsedUrl = new URL(GOOGLE_FORM_ACTION_URL);

      const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'JobBookingApp-DirectGoogleSheets/1.0'
        },
        timeout: 12000
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            console.log(`[GOOGLE SHEETS] Successfully synced job ${job.id} directly to Google Sheet! Status: ${res.statusCode}`);
            resolve({ success: true, statusCode: res.statusCode });
          } else {
            console.warn(`[GOOGLE SHEETS] Google Form responded with status ${res.statusCode}`);
            resolve({ success: false, statusCode: res.statusCode });
          }
        });
      });

      req.on('error', (err) => {
        console.error('[GOOGLE SHEETS] Form submission error:', err.message);
        resolve({ success: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Google Form submission timed out' });
      });

      req.write(postData);
      req.end();
    } catch (err) {
      console.error('[GOOGLE SHEETS] Dispatch failed:', err.message);
      resolve({ success: false, error: err.message });
    }
  });
}

/**
 * Send new job to Google Sheet directly, plus optional Zapier/Apps Script webhooks
 */
async function processJobIntegrations(job, settings) {
  const payload = {
    'Customer Name': job['Customer Name'],
    'Customer Phone': job['Customer Phone'],
    'Item / Job': job['Item / Job'],
    'Job Details': job['Job Details'] || '',
    'Collection Date': job['Collection Date'],
    'Notify Email': job['Notify Email'],
    'Worker Phone': job['Worker Phone'],
    'Business Name': job['Business Name'] || '',
    'Last Reminder': '' // Exact column specification: empty
  };

  const results = {
    google_sheet: null,
    zapier: null
  };

  // 1. Direct automatic Google Sheet submission via Google Form (zero webhook needed!)
  try {
    console.log(`Syncing job ${job.id} directly to Google Sheet...`);
    results.google_sheet = await submitToGoogleForm(job);
  } catch (err) {
    console.error('Direct Google Sheet submission error:', err);
    results.google_sheet = { success: false, error: err.message };
  }

  // 2. Zapier Webhook (if configured by owner)
  if (settings && settings.zapier_webhook_url && settings.zapier_webhook_url.trim()) {
    try {
      console.log(`Sending job ${job.id} to Zapier webhook...`);
      results.zapier = await sendWebhook(settings.zapier_webhook_url, payload);
    } catch (err) {
      console.error('Zapier webhook dispatch error:', err);
      results.zapier = { success: false, error: err.message };
    }
  }

  // 3. Google Apps Script Webhook (if configured by owner)
  if (settings && settings.google_apps_script_url && settings.google_apps_script_url.trim()) {
    try {
      console.log(`Appending job ${job.id} to Google Sheet via Apps Script webhook...`);
      results.google_sheet_apps_script = await sendWebhook(settings.google_apps_script_url, payload);
    } catch (err) {
      console.error('Google Sheet webhook dispatch error:', err);
      results.google_sheet_apps_script = { success: false, error: err.message };
    }
  }

  return results;
}

module.exports = {
  normalizeNigerianPhone,
  normalizeDate,
  sendWebhook,
  submitToGoogleForm,
  processJobIntegrations
};
