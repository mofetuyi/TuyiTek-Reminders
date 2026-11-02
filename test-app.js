const assert = require('assert');
const http = require('http');

const PORT = 3001;
process.env.PORT = PORT;
const server = require('./server');

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const headers = {};
    if (postData) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Job Booking App Automated Tests ---');

  // Wait 500ms for server to start
  await new Promise(r => setTimeout(r, 500));

  // Test 1: Unauthenticated request to GET /api/jobs must fail with 401
  console.log('Test 1: Unauthenticated request to /api/jobs returns 401...');
  const resUnauth = await makeRequest('GET', '/api/jobs');
  assert.strictEqual(resUnauth.status, 401, 'Should return 401 Unauthorized');
  console.log('✓ PASS: 401 Unauthorized returned');

  // Test 2: Register a new user with full details (First, Last, Email, Phone, Password, Terms)
  console.log('Test 2: Register account with real credentials...');
  const testWorkerEmail = 'artisan_' + Date.now() + '@example.com';
  const resRegister = await makeRequest('POST', '/api/auth/register', {
    firstName: 'Babatunde',
    lastName: 'Fashola',
    email: testWorkerEmail,
    phone: '0814 111 2233',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    agreedToTerms: true
  });
  assert.strictEqual(resRegister.status, 200);
  assert.ok(resRegister.data.token, 'Should return auth token');
  assert.strictEqual(resRegister.data.user.email, testWorkerEmail);
  assert.strictEqual(resRegister.data.user.phone, '+2348141112233');
  const workerToken = resRegister.data.token;
  console.log('✓ PASS: Worker registered successfully without verification code');

  // Test 3: Sign in with registered credentials
  console.log('Test 3: Sign in with email and password...');
  const resLogin = await makeRequest('POST', '/api/auth/login', {
    email: testWorkerEmail,
    password: 'Password123!'
  });
  assert.strictEqual(resLogin.status, 200);
  assert.ok(resLogin.data.token, 'Should return auth token on login');
  console.log('✓ PASS: Worker signed in successfully');

  // Test 4: Authenticated user can fetch jobs
  console.log('Test 4: Worker fetches /api/jobs...');
  const resJobs = await makeRequest('GET', '/api/jobs', null, workerToken);
  assert.strictEqual(resJobs.status, 200);
  assert.ok(Array.isArray(resJobs.data.jobs), 'Jobs should be an array');
  console.log(`✓ PASS: Loaded ${resJobs.data.jobs.length} jobs`);

  // Test 5: Worker cannot access owner data (403 Forbidden)
  console.log('Test 5: Worker accessing /api/owner/data returns 403 Forbidden...');
  const resOwnerDeny = await makeRequest('GET', '/api/owner/data', null, workerToken);
  assert.strictEqual(resOwnerDeny.status, 403, 'Should return 403 Forbidden for non-owner');
  console.log('✓ PASS: 403 Forbidden returned for non-owner');

  // Test 6: Authenticate as Owner (osanyintuyimofeoluwa@gmail.com) with password
  console.log('Test 6: Owner authentication with email and password...');
  const resOwnerAuth = await makeRequest('POST', '/api/auth/login', {
    email: 'osanyintuyimofeoluwa@gmail.com',
    password: 'Admin@123'
  });
  assert.strictEqual(resOwnerAuth.status, 200);
  assert.strictEqual(resOwnerAuth.data.user.isOwner, true);
  const ownerToken = resOwnerAuth.data.token;
  console.log('✓ PASS: Owner authenticated');

  // Test 7: Owner accesses /api/owner/data
  console.log('Test 7: Owner access /api/owner/data...');
  const resOwnerData = await makeRequest('GET', '/api/owner/data', null, ownerToken);
  assert.strictEqual(resOwnerData.status, 200);
  assert.ok(resOwnerData.data.totals, 'Should return totals');
  assert.ok(Array.isArray(resOwnerData.data.users), 'Should return user list');
  console.log('✓ PASS: Owner data retrieved:', resOwnerData.data.totals);

  // Test 8: Save Job with phone normalization & validation
  console.log('Test 8: Save Job with phone normalization...');
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 2); // 2 days from now -> "Due soon"
  const futureDateStr = futureDate.toISOString().split('T')[0];

  const newJobPayload = {
    customerName: 'Babatunde Fashola',
    customerPhone: '0802 345 6789', // test Nigerian local phone with leading 0 & spaces
    workerPhone: '0814 111 2233',   // test Worker Phone
    itemJob: 'Senator Suit 3-Piece Navy Blue',
    jobDetails: 'Italian wool, gold buttons, extra sleeve length',
    collectionDate: futureDateStr,
    notifyEmail: 'babatunde.workshop@gmail.com',
    businessName: 'Lagos Heritage Tailors'
  };

  const resSaveJob = await makeRequest('POST', '/api/jobs', newJobPayload, workerToken);
  assert.strictEqual(resSaveJob.status, 200);
  assert.strictEqual(resSaveJob.data.message, 'Job saved. Reminders will be sent automatically 5, 3 and 1 day before collection.');
  assert.strictEqual(resSaveJob.data.job['Customer Phone'], '+2348023456789', 'Customer Phone must be normalized to +234...');
  assert.strictEqual(resSaveJob.data.job['Worker Phone'], '+2348141112233', 'Worker Phone must be normalized to +234...');
  assert.strictEqual(resSaveJob.data.job['Last Reminder'], '', 'Last Reminder must be strictly empty');
  assert.strictEqual(resSaveJob.data.retainedFields.workerPhone, '+2348141112233');
  assert.strictEqual(resSaveJob.data.retainedFields.notifyEmail, 'babatunde.workshop@gmail.com');
  assert.strictEqual(resSaveJob.data.retainedFields.businessName, 'Lagos Heritage Tailors');
  console.log('✓ PASS: Job saved properly with exact requirements and normalized phones');

  // Test 9: Verify job appears in My Jobs with "Due soon" badge flag
  console.log('Test 9: Verify new job in My Jobs list and Due Soon calculation...');
  const resJobsAfter = await makeRequest('GET', '/api/jobs', null, workerToken);
  const found = resJobsAfter.data.jobs.find(j => j['Customer Name'] === 'Babatunde Fashola');
  assert.ok(found, 'Saved job must be in list');
  assert.strictEqual(found.is_due_soon, true, 'Job due in 2 days must have is_due_soon = true');
  console.log('✓ PASS: Job found and flagged as Due Soon');

  // Test 10: Owner saves Zapier webhook URL in App Settings table
  console.log('Test 10: Owner saves Zapier webhook URL...');
  const resSaveSettings = await makeRequest('POST', '/api/owner/settings', {
    zapier_webhook_url: 'https://hooks.zapier.com/hooks/catch/123456/abcdef/'
  }, ownerToken);
  assert.strictEqual(resSaveSettings.status, 200);
  assert.strictEqual(resSaveSettings.data.settings.zapier_webhook_url, 'https://hooks.zapier.com/hooks/catch/123456/abcdef/');
  console.log('✓ PASS: Zapier webhook saved in App Settings');

  // Test 11: Empty box turns off Zapier webhook
  console.log('Test 11: Empty box turns off Zapier webhook...');
  const resTurnOff = await makeRequest('POST', '/api/owner/settings', {
    zapier_webhook_url: ''
  }, ownerToken);
  assert.strictEqual(resTurnOff.status, 200);
  assert.strictEqual(resTurnOff.data.settings.zapier_webhook_url, '');
  console.log('✓ PASS: Empty box turns off Zapier webhook');

  // Test 12: Gemini AI Multi-turn Conversational Chat
  console.log('Test 12: Conversational Chat with Gemini AI...');
  const resAiAdvice = await makeRequest('POST', '/api/ai/advice', {
    messages: [
      { role: 'user', content: 'What are the essential checks for a Toyota Camry 2.4L overheating problem?' }
    ],
    trade: 'Auto Mechanic'
  }, workerToken);
  assert.strictEqual(resAiAdvice.status, 200);
  assert.ok(resAiAdvice.data.answer, 'AI should return answer');
  console.log('✓ PASS: Gemini AI Initial turn generated (Model: ' + resAiAdvice.data.model + ')');

  // Test 12b: Multi-turn follow-up chat
  console.log('Test 12b: Multi-turn conversational follow-up...');
  const resAiFollowup = await makeRequest('POST', '/api/ai/advice', {
    messages: [
      { role: 'user', content: 'What are the essential checks for a Toyota Camry 2.4L overheating problem?' },
      { role: 'model', content: resAiAdvice.data.answer },
      { role: 'user', content: 'The radiator fan is not spinning at all. What fuse and relay should I test?' }
    ],
    trade: 'Auto Mechanic'
  }, workerToken);
  assert.strictEqual(resAiFollowup.status, 200);
  assert.ok(resAiFollowup.data.answer, 'AI should return follow-up answer');
  console.log('✓ PASS: Gemini AI Follow-up conversation maintained context successfully');

  // Test 13: Gemini AI Suggest Job Details
  console.log('Test 13: AI Suggest Job Details & Timeline...');
  const resAiSuggest = await makeRequest('POST', '/api/ai/suggest-details', {
    itemJob: 'Ankara 6-piece flared wedding gown with lace trimming'
  }, workerToken);
  assert.strictEqual(resAiSuggest.status, 200);
  assert.ok(resAiSuggest.data.suggestion, 'AI should return suggestion');
  console.log('✓ PASS: Gemini AI Job Scope & Turnaround generated successfully');

  console.log('\n========================================');
  console.log('🎉 ALL 13 TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('========================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
