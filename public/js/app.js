/**
 * Job Booking Client Application
 * Tailored for small trade businesses in Nigeria
 */

(function () {
  'use strict';

  // Constants
  const OWNER_EMAIL = 'osanyintuyimofeoluwa@gmail.com';
  const STORAGE_KEYS = {
    TOKEN: 'job_booking_token',
    USER: 'job_booking_user',
    WORKER_PHONE: 'job_booking_worker_phone',
    NOTIFY_EMAIL: 'job_booking_notify_email',
    BUSINESS_NAME: 'job_booking_business_name'
  };

  // State
  let currentUser = null;
  let authToken = null;
  let cachedJobs = [];
  let pendingEmail = '';

  // DOM Elements
  const authModal = document.getElementById('authModal');
  const userMenuArea = document.getElementById('userMenuArea');
  const userNameDisplay = document.getElementById('userNameDisplay');
  const btnSignOut = document.getElementById('btnSignOut');

  // Navigation
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabOwner = document.getElementById('tabOwner');
  const pageViews = document.querySelectorAll('.page-view');

  // Form (Page 1)
  const newJobForm = document.getElementById('newJobForm');
  const customerNameInput = document.getElementById('customerName');
  const customerPhoneInput = document.getElementById('customerPhone');
  const workerPhoneInput = document.getElementById('workerPhone');
  const itemJobInput = document.getElementById('itemJob');
  const jobDetailsInput = document.getElementById('jobDetails');
  const collectionDateInput = document.getElementById('collectionDate');
  const notifyEmailInput = document.getElementById('notifyEmail');
  const businessNameInput = document.getElementById('businessName');
  const btnSaveJob = document.getElementById('btnSaveJob');
  const globalNotificationArea = document.getElementById('globalNotificationArea');

  // My Jobs (Page 2)
  const jobSearchInput = document.getElementById('jobSearchInput');
  const jobsListContainer = document.getElementById('jobsListContainer');

  // Owner (Page 3)
  const kpiAllJobs = document.getElementById('kpiAllJobs');
  const kpiDueSoon = document.getElementById('kpiDueSoon');
  const kpiOverdue = document.getElementById('kpiOverdue');
  const kpiSignups = document.getElementById('kpiSignups');
  const zapierWebhookUrl = document.getElementById('zapierWebhookUrl');
  const googleAppsScriptUrl = document.getElementById('googleAppsScriptUrl');
  const btnSaveZapierSettings = document.getElementById('btnSaveZapierSettings');
  const btnTestWebhook = document.getElementById('btnTestWebhook');
  const ownerUsersList = document.getElementById('ownerUsersList');
  const userCountSpan = document.getElementById('userCountSpan');

  // Auth Modal Elements
  const btnGoogleSignIn = document.getElementById('btnGoogleSignIn');
  const requestCodeForm = document.getElementById('requestCodeForm');
  const authEmailInput = document.getElementById('authEmail');
  const authNameInput = document.getElementById('authName');
  const verifyCodeForm = document.getElementById('verifyCodeForm');
  const authCodeInput = document.getElementById('authCode');
  const codeSentHelpText = document.getElementById('codeSentHelpText');
  const btnBackToEmail = document.getElementById('btnBackToEmail');
  const presetOwnerBtn = document.getElementById('presetOwnerBtn');
  const presetArtisanBtn = document.getElementById('presetArtisanBtn');

  const toastContainer = document.getElementById('toastContainer');

  /* ========================================================================
     HELPERS & TOAST NOTIFICATIONS
     ======================================================================== */

  function showToast(message, type = 'info', duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getTodayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /* ========================================================================
     AUTHENTICATION LOGIC
     ======================================================================== */

  function initAuth() {
    const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const savedUserJson = localStorage.getItem(STORAGE_KEYS.USER);

    if (savedToken && savedUserJson) {
      try {
        authToken = savedToken;
        currentUser = JSON.parse(savedUserJson);
        applyAuthenticatedState();
        return;
      } catch (e) {
        console.error('Failed to parse saved user:', e);
      }
    }

    // Otherwise show auth modal
    showAuthModal();
  }

  function showAuthModal() {
    authModal.style.display = 'flex';
    userMenuArea.style.display = 'none';
    tabOwner.style.display = 'none';
    requestCodeForm.style.display = 'block';
    verifyCodeForm.style.display = 'none';
    authEmailInput.value = '';
    authNameInput.value = '';
  }

  function applyAuthenticatedState() {
    authModal.style.display = 'none';
    userMenuArea.style.display = 'flex';
    userNameDisplay.textContent = currentUser.name || currentUser.email;

    // Check owner status (verified on server too)
    const isOwner = currentUser.email && currentUser.email.toLowerCase() === OWNER_EMAIL.toLowerCase();
    if (isOwner) {
      tabOwner.style.display = 'inline-flex';
    } else {
      tabOwner.style.display = 'none';
      // If currently on owner view, redirect to new job
      const currentView = document.querySelector('.page-view.active');
      if (currentView && currentView.id === 'viewOwner') {
        switchTab('viewNewJob');
      }
    }

    // Populate preserved worker fields in New Job form
    populatePreservedWorkerFields();

    // Set minimum date picker to today (no dates in the past)
    const today = getTodayString();
    collectionDateInput.min = today;

    // Pre-load jobs
    loadJobs();

    // If owner, pre-load owner data
    if (isOwner) {
      loadOwnerData();
    }
  }

  function handleSignOut() {
    if (authToken) {
      fetch('/api/auth/signout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      }).catch(err => console.warn(err));
    }

    authToken = null;
    currentUser = null;
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);

    showToast('Signed out successfully.', 'info');
    showAuthModal();
  }

  /* Request Email Code */
  requestCodeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmailInput.value.trim();
    const name = authNameInput.value.trim();

    if (!email) {
      showToast('Please enter your email.', 'error');
      return;
    }

    const submitBtn = document.getElementById('btnRequestCode');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending Code...';

    try {
      const res = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send verification code');

      pendingEmail = email;
      requestCodeForm.style.display = 'none';
      verifyCodeForm.style.display = 'block';
      codeSentHelpText.innerHTML = `Code sent to <strong>${escapeHtml(email)}</strong>.`;

      // Show preview code in toast for effortless local testing
      if (data.previewCode) {
        showToast(`Verification code is: ${data.previewCode}`, 'success', 10000);
        authCodeInput.value = data.previewCode;
      } else {
        showToast('Verification code generated. Please enter it below.', 'success');
      }

      authCodeInput.focus();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Sign-in Code';
    }
  });

  /* Verify Code */
  verifyCodeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = authCodeInput.value.trim();

    if (!code) {
      showToast('Please enter the 6-digit code.', 'error');
      return;
    }

    const submitBtn = document.getElementById('btnVerifyCode');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, code })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem(STORAGE_KEYS.TOKEN, authToken);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));

      showToast(`Welcome, ${currentUser.name}!`, 'success');
      applyAuthenticatedState();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Verify & Sign In';
    }
  });

  /* Switch back to email form */
  btnBackToEmail.addEventListener('click', () => {
    verifyCodeForm.style.display = 'none';
    requestCodeForm.style.display = 'block';
  });

  /* Quick Google Sign In */
  async function performGoogleSignIn(email, name) {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          name: name,
          credential: 'google_token_simulated'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google Sign-In failed');

      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem(STORAGE_KEYS.TOKEN, authToken);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));

      showToast(`Signed in as ${currentUser.name}!`, 'success');
      applyAuthenticatedState();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  btnGoogleSignIn.addEventListener('click', () => {
    performGoogleSignIn('worker.trades@gmail.com', 'Nigerian Trades Artisan');
  });

  presetOwnerBtn.addEventListener('click', () => {
    performGoogleSignIn(OWNER_EMAIL, 'Mofeoluwa Osanyintuyi (Owner)');
  });

  presetArtisanBtn.addEventListener('click', () => {
    performGoogleSignIn('kola.tailor@gmail.com', 'Kolawole Fabrics & Tailors');
  });

  btnSignOut.addEventListener('click', handleSignOut);


  /* ========================================================================
     NAVIGATION TABS
     ======================================================================== */

  function switchTab(targetViewId) {
    // Update active tab button
    navTabs.forEach(tab => {
      if (tab.dataset.target === targetViewId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update active view
    pageViews.forEach(view => {
      if (view.id === targetViewId) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // View specific actions
    if (targetViewId === 'viewMyJobs') {
      loadJobs();
    } else if (targetViewId === 'viewOwner') {
      loadOwnerData();
    }
  }

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target;
      switchTab(target);
    });
  });


  /* ========================================================================
     PAGE 1: NEW JOB FORM
     ======================================================================== */

  function populatePreservedWorkerFields() {
    const savedWorkerPhone = localStorage.getItem(STORAGE_KEYS.WORKER_PHONE);
    const savedNotifyEmail = localStorage.getItem(STORAGE_KEYS.NOTIFY_EMAIL);
    const savedBusinessName = localStorage.getItem(STORAGE_KEYS.BUSINESS_NAME);

    if (savedWorkerPhone) {
      workerPhoneInput.value = savedWorkerPhone;
    }
    if (savedNotifyEmail) {
      notifyEmailInput.value = savedNotifyEmail;
    } else if (currentUser && currentUser.email) {
      notifyEmailInput.value = currentUser.email;
    }
    if (savedBusinessName) {
      businessNameInput.value = savedBusinessName;
    }
  }

  newJobForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!authToken) {
      showToast('Please sign in first.', 'error');
      showAuthModal();
      return;
    }

    const payload = {
      customerName: customerNameInput.value.trim(),
      customerPhone: customerPhoneInput.value.trim(),
      workerPhone: workerPhoneInput.value.trim(),
      itemJob: itemJobInput.value.trim(),
      jobDetails: jobDetailsInput.value.trim(),
      collectionDate: collectionDateInput.value.trim(),
      notifyEmail: notifyEmailInput.value.trim(),
      businessName: businessNameInput.value.trim()
    };

    btnSaveJob.disabled = true;
    btnSaveJob.innerHTML = '<span>⏳</span> Saving Job...';

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save job');

      // Requirement: Show exact message:
      // "Job saved. Reminders will be sent automatically 5, 3 and 1 day before collection."
      showGlobalNotification(data.message || 'Job saved. Reminders will be sent automatically 5, 3 and 1 day before collection.');

      // Requirement: "After saving, keep the worker's phone, email and business name filled in for the next job."
      // Save retained fields to localStorage
      if (data.retainedFields) {
        localStorage.setItem(STORAGE_KEYS.WORKER_PHONE, data.retainedFields.workerPhone);
        localStorage.setItem(STORAGE_KEYS.NOTIFY_EMAIL, data.retainedFields.notifyEmail);
        localStorage.setItem(STORAGE_KEYS.BUSINESS_NAME, data.retainedFields.businessName);

        workerPhoneInput.value = data.retainedFields.workerPhone;
        notifyEmailInput.value = data.retainedFields.notifyEmail;
        businessNameInput.value = data.retainedFields.businessName;
      }

      // Reset only customer and item fields
      customerNameInput.value = '';
      customerPhoneInput.value = '';
      itemJobInput.value = '';
      jobDetailsInput.value = '';
      collectionDateInput.value = '';

      customerNameInput.focus();

      // Refresh cached jobs
      loadJobs();

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnSaveJob.disabled = false;
      btnSaveJob.innerHTML = '<span>💾</span> Save Job';
    }
  });

  function showGlobalNotification(msg) {
    globalNotificationArea.innerHTML = `
      <div class="success-banner">
        <div class="success-banner-icon" aria-hidden="true">🎉</div>
        <div class="success-banner-content">
          ${escapeHtml(msg)}
        </div>
      </div>
    `;

    // Auto dismiss after 10 seconds or when submitting next job
    setTimeout(() => {
      globalNotificationArea.innerHTML = '';
    }, 10000);
  }


  /* ========================================================================
     PAGE 2: MY JOBS
     - Read-only list of all jobs from the sheet
     - Sorted by Collection Date with the nearest first
     - Card shows:
         Customer Name, Item / Job, Collection Date,
         Customer Phone and directly under it Worker Phone
     - Search box for customer name
     - Highlight jobs due within the next 3 days with a warm orange or red badge "Due soon"
     ======================================================================== */

  async function loadJobs() {
    if (!authToken) return;

    try {
      const res = await fetch('/api/jobs', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (res.status === 401) {
        handleSignOut();
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load jobs');

      cachedJobs = data.jobs || [];
      renderJobsList(cachedJobs);
    } catch (err) {
      console.error('Jobs load error:', err);
    }
  }

  function renderJobsList(jobsToRender) {
    if (!jobsListContainer) return;

    if (!jobsToRender || jobsToRender.length === 0) {
      jobsListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h3>No jobs found</h3>
          <p>No customer bookings match your filter. Record a job using the New Job form above.</p>
        </div>
      `;
      return;
    }

    jobsListContainer.innerHTML = jobsToRender.map(job => {
      const customerName = escapeHtml(job['Customer Name']);
      const itemJob = escapeHtml(job['Item / Job']);
      const collectionDate = escapeHtml(job['Collection Date']);
      const customerPhone = escapeHtml(job['Customer Phone']);
      const workerPhone = escapeHtml(job['Worker Phone']);
      const jobDetails = escapeHtml(job['Job Details'] || '');
      const businessName = escapeHtml(job['Business Name'] || '');

      const isDueSoon = job.is_due_soon;
      const isOverdue = job.is_overdue;
      const daysLeft = job.days_left;

      let badgeHtml = '';
      let cardClass = 'job-card';

      if (isDueSoon) {
        cardClass += ' is-due-soon';
        badgeHtml = `<span class="badge-due-soon">⚡ Due soon (${daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : 'In ' + daysLeft + ' days'})</span>`;
      } else if (isOverdue) {
        cardClass += ' is-overdue';
        const daysPast = Math.abs(daysLeft);
        badgeHtml = `<span class="badge-overdue">⚠️ Overdue by ${daysPast}d</span>`;
      } else if (daysLeft !== null) {
        badgeHtml = `<span class="badge-scheduled">📅 In ${daysLeft} days</span>`;
      }

      // Format date nicely
      let formattedDate = collectionDate;
      try {
        const d = new Date(collectionDate + 'T00:00:00Z');
        formattedDate = d.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC'
        });
      } catch (e) {}

      // Clean phone for tel: and whatsapp: links
      const cleanCustomerPhone = (job['Customer Phone'] || '').replace(/[^\d+]/g, '');

      return `
        <article class="${cardClass}">
          <div class="job-header">
            <h3 class="job-customer-name">${customerName}</h3>
            ${badgeHtml}
          </div>

          <div class="job-item">
            <span>📦</span>
            <strong>${itemJob}</strong>
          </div>

          ${jobDetails ? `
            <div style="font-size: 0.88rem; color: #475569; margin-bottom: 10px; background: #f8fafc; padding: 8px 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
              ${jobDetails}
            </div>
          ` : ''}

          <!-- Collection Date -->
          <div class="job-meta-row">
            <span class="job-meta-label">📅 Collection Date:</span>
            <strong>${formattedDate}</strong>
          </div>

          <!-- Customer Phone -->
          <div class="job-meta-row">
            <span class="job-meta-label">📞 Customer Phone:</span>
            <a href="tel:${cleanCustomerPhone}" class="job-phone-link">${customerPhone}</a>
          </div>

          <!-- Worker Phone (directly under Customer Phone) -->
          <div class="job-meta-row worker-row">
            <span class="job-meta-label" style="color: #64748b;">👷 Worker Phone:</span>
            <span>${workerPhone}</span>
          </div>

          ${businessName ? `
            <div class="job-meta-row" style="margin-top: 4px; font-size: 0.82rem; color: #0f766e;">
              <span class="job-meta-label" style="color: #0f766e;">🏢 Business:</span>
              <span>${businessName}</span>
            </div>
          ` : ''}

          <!-- Direct action buttons for Nigerian mobile artisans -->
          <div class="job-actions-toolbar">
            <a href="tel:${cleanCustomerPhone}" class="btn-phone-action btn-call">
              📞 Call Customer
            </a>
            <a href="https://wa.me/${cleanCustomerPhone.replace('+', '')}?text=${encodeURIComponent('Hello ' + (job['Customer Name'] || '') + ', this is from ' + (job['Business Name'] || 'our workshop') + ' regarding your ' + (job['Item / Job'] || 'item') + '.')}" target="_blank" rel="noopener noreferrer" class="btn-phone-action btn-whatsapp">
              💬 WhatsApp
            </a>
          </div>
        </article>
      `;
    }).join('');
  }

  // Real-time search filter by customer name
  jobSearchInput.addEventListener('input', () => {
    const query = jobSearchInput.value.trim().toLowerCase();
    if (!query) {
      renderJobsList(cachedJobs);
      return;
    }

    const filtered = cachedJobs.filter(job => {
      const name = String(job['Customer Name'] || '').toLowerCase();
      return name.includes(query);
    });

    renderJobsList(filtered);
  });


  /* ========================================================================
     PAGE 3: OWNER DASHBOARD
     - Only accessible for osanyintuyimofeoluwa@gmail.com
     - Checked on the server too
     - Shows:
       Totals: all jobs, due soon, overdue, number of sign-ups
       List of everyone who has signed up (name and email)
       Box to save a Zapier webhook link
     ======================================================================== */

  async function loadOwnerData() {
    if (!authToken) return;

    try {
      const res = await fetch('/api/owner/data', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (res.status === 403) {
        showToast('Access denied: Owner privileges required.', 'error');
        tabOwner.style.display = 'none';
        switchTab('viewNewJob');
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load owner data');

      // Update KPI Totals
      kpiAllJobs.textContent = data.totals.allJobs || 0;
      kpiDueSoon.textContent = data.totals.dueSoon || 0;
      kpiOverdue.textContent = data.totals.overdue || 0;
      kpiSignups.textContent = data.totals.signUps || 0;

      // Update Zapier Webhook URL
      if (data.settings && data.settings.zapier_webhook_url !== undefined) {
        zapierWebhookUrl.value = data.settings.zapier_webhook_url;
      }
      if (data.settings && data.settings.google_apps_script_url !== undefined && googleAppsScriptUrl) {
        googleAppsScriptUrl.value = data.settings.google_apps_script_url;
      }

      // Render Signed-up Users list
      userCountSpan.textContent = data.users.length;
      if (data.users && data.users.length > 0) {
        ownerUsersList.innerHTML = data.users.map(u => {
          let dateStr = 'Recently';
          try {
            dateStr = new Date(u.created_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            });
          } catch (e) {}

          const isOwnerUser = u.email && u.email.toLowerCase() === OWNER_EMAIL.toLowerCase();

          return `
            <div class="user-item">
              <div class="user-item-info">
                <span class="user-item-name">
                  ${escapeHtml(u.name || 'Unnamed Artisan')}
                  ${isOwnerUser ? '<span style="color: #d97706; font-size: 0.76rem; background: #fef3c7; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">👑 Owner</span>' : ''}
                </span>
                <span class="user-item-email">${escapeHtml(u.email)}</span>
              </div>
              <div class="user-item-date">Joined ${dateStr}</div>
            </div>
          `;
        }).join('');
      } else {
        ownerUsersList.innerHTML = '<p style="color: #64748b; font-size: 0.88rem;">No users registered yet.</p>';
      }

    } catch (err) {
      console.error('Owner data error:', err);
      showToast(err.message, 'error');
    }
  }

  // Save Zapier Webhook Settings
  btnSaveZapierSettings.addEventListener('click', async () => {
    if (!authToken) return;

    const url = zapierWebhookUrl.value.trim();
    const scriptUrl = googleAppsScriptUrl ? googleAppsScriptUrl.value.trim() : '';
    btnSaveZapierSettings.disabled = true;
    btnSaveZapierSettings.innerHTML = '<span>⏳</span> Saving...';

    try {
      const res = await fetch('/api/owner/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          zapier_webhook_url: url,
          google_apps_script_url: scriptUrl
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      showToast(url ? 'Zapier webhook link saved in App Settings!' : 'Zapier webhook turned off (empty link).', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnSaveZapierSettings.disabled = false;
      btnSaveZapierSettings.innerHTML = '<span>💾</span> Save Webhook Link';
    }
  });

  // Test Webhook Ping
  btnTestWebhook.addEventListener('click', async () => {
    if (!authToken) return;

    const url = zapierWebhookUrl.value.trim();
    if (!url) {
      showToast('Please enter a Zapier webhook URL first.', 'error');
      return;
    }

    btnTestWebhook.disabled = true;
    btnTestWebhook.innerHTML = '<span>⏳</span> Sending ping...';

    try {
      const res = await fetch('/api/owner/test-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ url })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test webhook failed');

      if (data.success) {
        showToast('Webhook successfully pinged! Zapier received the payload.', 'success');
      } else {
        showToast('Webhook endpoint responded with an error. Check link.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnTestWebhook.disabled = false;
      btnTestWebhook.innerHTML = '<span>🚀</span> Test Webhook Ping';
    }
  });


  /* ========================================================================
     APPLICATION BOOTSTRAP
     ======================================================================== */
  window.addEventListener('DOMContentLoaded', () => {
    initAuth();
  });

})();
