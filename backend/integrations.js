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
 * Post JSON payload to a webhook URL
 */
function sendWebhook(targetUrl, payload) {
  return new Promise((resolve, reject) => {
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
        timeout: 10000
      };

      const req = transport.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
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

/**
 * Send new job to Zapier webhook and optional Google Sheets webhook
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
    zapier: null,
    google_sheet: null
  };

  // 1. Zapier Webhook
  if (settings && settings.zapier_webhook_url && settings.zapier_webhook_url.trim()) {
    try {
      console.log(`Sending job ${job.id} to Zapier webhook...`);
      results.zapier = await sendWebhook(settings.zapier_webhook_url, payload);
    } catch (err) {
      console.error('Zapier webhook dispatch error:', err);
      results.zapier = { success: false, error: err.message };
    }
  }

  // 2. Google Apps Script / Sheet Webhook (if configured)
  if (settings && settings.google_apps_script_url && settings.google_apps_script_url.trim()) {
    try {
      console.log(`Appending job ${job.id} to Google Sheet via Apps Script webhook...`);
      results.google_sheet = await sendWebhook(settings.google_apps_script_url, payload);
    } catch (err) {
      console.error('Google Sheet webhook dispatch error:', err);
      results.google_sheet = { success: false, error: err.message };
    }
  }

  return results;
}

module.exports = {
  normalizeNigerianPhone,
  normalizeDate,
  sendWebhook,
  processJobIntegrations
};
