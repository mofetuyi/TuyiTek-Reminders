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
  const authWebhookUrl = document.getElementById('authWebhookUrl');
  const googleAppsScriptUrl = document.getElementById('googleAppsScriptUrl');
  const btnSaveZapierSettings = document.getElementById('btnSaveZapierSettings');
  const btnTestWebhook = document.getElementById('btnTestWebhook');
  const btnTestAuthWebhook = document.getElementById('btnTestAuthWebhook');
  const ownerUsersList = document.getElementById('ownerUsersList');
  const userCountSpan = document.getElementById('userCountSpan');

  // Auth Modal Elements (Production Sign Up & Sign In)
  const authModalTitle = document.getElementById('authModalTitle');
  const authModalSubtitle = document.getElementById('authModalSubtitle');
  const btnTabSignUp = document.getElementById('btnTabSignUp');
  const btnTabSignIn = document.getElementById('btnTabSignIn');
  const signUpForm = document.getElementById('signUpForm');
  const signInForm = document.getElementById('signInForm');
  const linkSwitchToSignIn = document.getElementById('linkSwitchToSignIn');
  const linkSwitchToSignUp = document.getElementById('linkSwitchToSignUp');

  // Sign Up Inputs
  const regFirstName = document.getElementById('regFirstName');
  const regLastName = document.getElementById('regLastName');
  const regEmail = document.getElementById('regEmail');
  const regPhone = document.getElementById('regPhone');
  const regPassword = document.getElementById('regPassword');
  const regConfirmPassword = document.getElementById('regConfirmPassword');
  const regAgreeTerms = document.getElementById('regAgreeTerms');
  const btnSubmitSignUp = document.getElementById('btnSubmitSignUp');

  // Sign In Inputs
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const btnSubmitSignIn = document.getElementById('btnSubmitSignIn');

  // Terms Modal
  const termsModal = document.getElementById('termsModal');
  const linkOpenTerms = document.getElementById('linkOpenTerms');
  const btnCloseTerms = document.getElementById('btnCloseTerms');
  const btnAcceptTermsClose = document.getElementById('btnAcceptTermsClose');

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

        // Verify session status with server
        fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }).then(res => {
          if (res.status === 401) {
            handleSignOut('Your session has expired. Please sign in again.');
          } else if (res.ok) {
            return res.json().then(data => {
              if (data && data.user) {
                currentUser = data.user;
                localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
                applyAuthenticatedState();
              }
            });
          }
        }).catch(err => {
          console.warn('Session verification error:', err.message);
        });

        return;
      } catch (e) {
        console.error('Failed to parse saved user:', e);
      }
    }

    // Otherwise show auth modal in sign in mode
    showAuthModal('signin');
  }

  function setAuthMode(mode) {
    if (mode === 'signup') {
      btnTabSignUp.style.background = '#ffffff';
      btnTabSignUp.style.color = '#0f766e';
      btnTabSignUp.style.boxShadow = '0 2px 4px rgba(0,0,0,0.06)';
      btnTabSignIn.style.background = 'transparent';
      btnTabSignIn.style.color = '#64748b';
      btnTabSignIn.style.boxShadow = 'none';

      signUpForm.style.display = 'block';
      signInForm.style.display = 'none';
      authModalTitle.textContent = 'Create Your Account';
      authModalSubtitle.textContent = 'Sign up to manage customer jobs and reminders for your workshop.';
    } else {
      btnTabSignIn.style.background = '#ffffff';
      btnTabSignIn.style.color = '#0f766e';
      btnTabSignIn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.06)';
      btnTabSignUp.style.background = 'transparent';
      btnTabSignUp.style.color = '#64748b';
      btnTabSignUp.style.boxShadow = 'none';

      signInForm.style.display = 'block';
      signUpForm.style.display = 'none';
      authModalTitle.textContent = 'Sign in to Job Booking';
      authModalSubtitle.textContent = 'Welcome back! Enter your email and password to access your jobs.';
    }
  }

  function showAuthModal(initialMode = 'signin') {
    authModal.style.display = 'flex';
    userMenuArea.style.display = 'none';
    tabOwner.style.display = 'none';
    setAuthMode(initialMode);
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

  function handleSignOut(customMessage = null) {
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

    showToast(customMessage || 'Signed out successfully.', 'info');
    showAuthModal('signin');
  }

  // Switch tabs in Auth Modal
  btnTabSignUp.addEventListener('click', () => setAuthMode('signup'));
  btnTabSignIn.addEventListener('click', () => setAuthMode('signin'));
  linkSwitchToSignIn.addEventListener('click', () => setAuthMode('signin'));
  linkSwitchToSignUp.addEventListener('click', () => setAuthMode('signup'));

  // Terms Modal Handlers
  linkOpenTerms.addEventListener('click', () => {
    termsModal.style.display = 'flex';
  });
  btnCloseTerms.addEventListener('click', () => {
    termsModal.style.display = 'none';
  });
  btnAcceptTermsClose.addEventListener('click', () => {
    regAgreeTerms.checked = true;
    termsModal.style.display = 'none';
  });

  // SIGN UP (Create Account) Form Submit
  signUpForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const firstName = regFirstName.value.trim();
    const lastName = regLastName.value.trim();
    const email = regEmail.value.trim();
    const phone = regPhone.value.trim();
    const password = regPassword.value;
    const confirmPassword = regConfirmPassword.value;
    const agreedToTerms = regAgreeTerms.checked;

    if (password !== confirmPassword) {
      showToast('Passwords do not match. Please verify and re-type.', 'error');
      regConfirmPassword.focus();
      return;
    }

    if (!agreedToTerms) {
      showToast('Please agree to the Terms & Conditions to create an account.', 'error');
      return;
    }

    btnSubmitSignUp.disabled = true;
    btnSubmitSignUp.innerHTML = '<span>⏳</span> Creating Account...';

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          password,
          confirmPassword,
          agreedToTerms
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create account');

      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem(STORAGE_KEYS.TOKEN, authToken);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));

      if (currentUser.phone) {
        localStorage.setItem(STORAGE_KEYS.WORKER_PHONE, currentUser.phone);
      }
      if (currentUser.email) {
        localStorage.setItem(STORAGE_KEYS.NOTIFY_EMAIL, currentUser.email);
      }

      showToast(`Welcome, ${currentUser.name}! Your account is active.`, 'success');
      applyAuthenticatedState();

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnSubmitSignUp.disabled = false;
      btnSubmitSignUp.innerHTML = '<span>📝</span> Create Account';
    }
  });

  // SIGN IN Form Submit
  signInForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {
      showToast('Please enter both your email and password.', 'error');
      return;
    }

    btnSubmitSignIn.disabled = true;
    btnSubmitSignIn.innerHTML = '<span>⏳</span> Signing In...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid email or password');

      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem(STORAGE_KEYS.TOKEN, authToken);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));

      if (currentUser.phone) {
        localStorage.setItem(STORAGE_KEYS.WORKER_PHONE, currentUser.phone);
      }
      if (currentUser.email) {
        localStorage.setItem(STORAGE_KEYS.NOTIFY_EMAIL, currentUser.email);
      }

      showToast(`Welcome back, ${currentUser.name}!`, 'success');
      applyAuthenticatedState();

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnSubmitSignIn.disabled = false;
      btnSubmitSignIn.innerHTML = '<span>🔐</span> Sign In';
    }
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

  // 1-Click Export to Google Sheets (CSV)
  const btnExportCsv = document.getElementById('btnExportCsv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      if (!cachedJobs || cachedJobs.length === 0) {
        showToast('No jobs available to export yet.', 'info');
        return;
      }

      const headers = [
        'Customer Name',
        'Customer Phone',
        'Item / Job',
        'Job Details',
        'Collection Date',
        'Notify Email',
        'Worker Phone',
        'Business Name',
        'Last Reminder'
      ];

      const escapeCsv = (val) => {
        const str = String(val === undefined || val === null ? '' : val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = cachedJobs.map(job => [
        escapeCsv(job['Customer Name']),
        escapeCsv(job['Customer Phone']),
        escapeCsv(job['Item / Job']),
        escapeCsv(job['Job Details']),
        escapeCsv(job['Collection Date']),
        escapeCsv(job['Notify Email']),
        escapeCsv(job['Worker Phone']),
        escapeCsv(job['Business Name']),
        '' // Last Reminder strictly empty
      ].join(','));

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `TuyiTek_Job_Bookings_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Exported jobs to CSV for Google Sheets!', 'success');
    });
  }


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
      if (data.settings && data.settings.auth_webhook_url !== undefined && authWebhookUrl) {
        authWebhookUrl.value = data.settings.auth_webhook_url;
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
    const authUrl = authWebhookUrl ? authWebhookUrl.value.trim() : '';
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
          auth_webhook_url: authUrl,
          google_apps_script_url: scriptUrl
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      showToast('Settings saved successfully in App Settings!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnSaveZapierSettings.disabled = false;
      btnSaveZapierSettings.innerHTML = '<span>💾</span> Save Webhook Settings';
    }
  });

  // Test Auth Webhook Ping
  if (btnTestAuthWebhook) {
    btnTestAuthWebhook.addEventListener('click', async () => {
      if (!authToken) return;

      const url = (authWebhookUrl ? authWebhookUrl.value.trim() : '') || zapierWebhookUrl.value.trim();
      if (!url) {
        showToast('Please enter an Auth Webhook URL first.', 'error');
        return;
      }

      btnTestAuthWebhook.disabled = true;
      btnTestAuthWebhook.innerHTML = '<span>⏳</span> Sending ping...';

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
          showToast('Test auth code webhook successfully pinged!', 'success');
        } else {
          showToast('Webhook endpoint responded with error. Check URL.', 'error');
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btnTestAuthWebhook.disabled = false;
        btnTestAuthWebhook.innerHTML = '<span>✉️</span> Test Auth Code Ping';
      }
    });
  }

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
     TRADE AI ASSISTANT & SMART SCOPING
     Powered by Google Gemini AI
     ======================================================================== */

  // AI Elements
  const btnAiSuggestDetails = document.getElementById('btnAiSuggestDetails');
  const aiSuggestionBox = document.getElementById('aiSuggestionBox');
  const aiSuggestionContent = document.getElementById('aiSuggestionContent');
  const btnCloseAiSuggestion = document.getElementById('btnCloseAiSuggestion');
  const btnApplyAiSuggestion = document.getElementById('btnApplyAiSuggestion');

  const tradeChipsBar = document.getElementById('tradeChipsBar');
  const aiChatStream = document.getElementById('aiChatStream');
  const aiAskForm = document.getElementById('aiAskForm');
  const aiQuestionInput = document.getElementById('aiQuestionInput');
  const btnAiSend = document.getElementById('btnAiSend');
  const btnClearChat = document.getElementById('btnClearChat');
  const quickPromptButtons = document.querySelectorAll('.btn-prompt-pill');

  let currentTradeFilter = 'General Trade';
  let lastAiSuggestionRaw = '';
  let chatHistory = []; // Multi-turn chat memory for full back-and-forth conversation

  // Simple Markdown Formatter
  function formatMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);

    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Headings ### or ##
    html = html.replace(/^### (.*$)/gim, '<h4 style="margin: 8px 0 4px 0; color: #0f766e; font-size: 0.95rem;">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 style="margin: 10px 0 6px 0; color: #0f172a; font-size: 1.05rem;">$1</h3>');

    // Numbered lists 1. 2.
    html = html.replace(/^\d+\.\s+(.*$)/gim, '<li style="margin-bottom: 4px;">$1</li>');

    // Bullet lists - or *
    html = html.replace(/^[\*\-]\s+(.*$)/gim, '<li style="margin-bottom: 4px;">$1</li>');

    // Wrap list items
    html = html.replace(/(<li.*<\/li>)/gms, '<ul style="padding-left: 20px; margin: 6px 0;">$1</ul>');

    // Paragraph breaks
    html = html.replace(/\n\n+/g, '</p><p style="margin-top: 6px;">');
    html = `<p>${html}</p>`;

    return html;
  }

  // Inline AI: Suggest Job Details & Timeline on New Job Form
  if (btnAiSuggestDetails) {
    btnAiSuggestDetails.addEventListener('click', async () => {
      const itemJob = itemJobInput.value.trim();
      if (!itemJob) {
        showToast('Please type an Item / Job title first (e.g. Toyota Camry AC repair, or Ankara gown).', 'info');
        itemJobInput.focus();
        return;
      }

      btnAiSuggestDetails.disabled = true;
      btnAiSuggestDetails.innerHTML = '<span>⏳</span> Thinking...';

      try {
        const res = await fetch('/api/ai/suggest-details', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ itemJob })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get suggestion');

        lastAiSuggestionRaw = data.suggestion;
        aiSuggestionContent.innerHTML = formatMarkdown(data.suggestion);
        aiSuggestionBox.style.display = 'block';

      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btnAiSuggestDetails.disabled = false;
        btnAiSuggestDetails.innerHTML = '<span>✨</span> Ask Gemini AI: Suggest Job Details & Timeline';
      }
    });
  }

  if (btnCloseAiSuggestion) {
    btnCloseAiSuggestion.addEventListener('click', () => {
      aiSuggestionBox.style.display = 'none';
    });
  }

  if (btnApplyAiSuggestion) {
    btnApplyAiSuggestion.addEventListener('click', () => {
      if (!lastAiSuggestionRaw) return;
      const currentVal = jobDetailsInput.value.trim();
      if (currentVal) {
        jobDetailsInput.value = `${currentVal}\n\n[AI Recommendations]:\n${lastAiSuggestionRaw}`;
      } else {
        jobDetailsInput.value = lastAiSuggestionRaw;
      }
      aiSuggestionBox.style.display = 'none';
      showToast('Copied into Job Details!', 'success');
      jobDetailsInput.focus();
    });
  }

  // Trade selection chips
  if (tradeChipsBar) {
    tradeChipsBar.addEventListener('click', (e) => {
      const chip = e.target.closest('.trade-chip');
      if (!chip) return;

      document.querySelectorAll('.trade-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentTradeFilter = chip.dataset.trade || 'General Trade';
    });
  }

  // Quick Prompt Pills
  quickPromptButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt;
      if (prompt) {
        aiQuestionInput.value = prompt;
        submitTradeQuestion(prompt);
      }
    });
  });

  // Ask AI Form Submit
  if (aiAskForm) {
    aiAskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = aiQuestionInput.value.trim();
      if (!query) return;
      submitTradeQuestion(query);
    });
  }

  // Clear Chat Handler
  if (btnClearChat) {
    btnClearChat.addEventListener('click', () => {
      chatHistory = [];
      aiChatStream.innerHTML = `
        <div class="ai-msg ai-msg-bot">
          <div class="ai-msg-avatar">🤖</div>
          <div class="ai-msg-bubble">
            <p><strong>Hello! Chat cleared.</strong></p>
            <p style="margin-top: 4px;">Ask me anything you'd like to know, learn how to do something, or let's chat!</p>
          </div>
        </div>
      `;
      showToast('Chat cleared. What would you like to talk about?', 'info');
      aiQuestionInput.focus();
    });
  }

  async function submitTradeQuestion(questionText) {
    if (!authToken) {
      showToast('Please sign in first.', 'error');
      showAuthModal();
      return;
    }

    // Add user message to conversation memory & append to UI
    chatHistory.push({ role: 'user', content: questionText });
    appendChatMessage('user', questionText);
    aiQuestionInput.value = '';

    // Append temporary typing indicator
    const typingId = 'typing_' + Date.now();
    appendChatMessage('bot', '<em>Thinking...</em>', typingId);

    btnAiSend.disabled = true;

    try {
      const res = await fetch('/api/ai/advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          messages: chatHistory
        })
      });

      if (res.status === 401) {
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();
        chatHistory.pop();
        handleSignOut('Your session expired or was reset. Please sign in again.');
        return;
      }

      const data = await res.json();
      const typingEl = document.getElementById(typingId);
      if (typingEl) typingEl.remove();

      if (!res.ok) throw new Error(data.error || 'Failed to get response');

      // Add AI response to conversation memory & append to UI
      chatHistory.push({ role: 'model', content: data.answer });
      appendChatMessage('bot', data.answer);

    } catch (err) {
      const typingEl = document.getElementById(typingId);
      if (typingEl) typingEl.remove();
      // Remove last user question from memory if failed
      chatHistory.pop();
      appendChatMessage('bot', `⚠️ Could not reach AI: ${escapeHtml(err.message)}`);
    } finally {
      btnAiSend.disabled = false;
      aiQuestionInput.focus();
    }
  }

  function appendChatMessage(sender, text, elementId = null) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-msg ${sender === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}`;
    if (elementId) msgDiv.id = elementId;

    const avatar = sender === 'user' ? '👤' : '🤖';
    const formattedContent = sender === 'user' ? `<p>${escapeHtml(text)}</p>` : formatMarkdown(text);

    msgDiv.innerHTML = `
      <div class="ai-msg-avatar" aria-hidden="true">${avatar}</div>
      <div class="ai-msg-bubble">${formattedContent}</div>
    `;

    aiChatStream.appendChild(msgDiv);
    aiChatStream.scrollTop = aiChatStream.scrollHeight;
  }


  /* ========================================================================
     APPLICATION BOOTSTRAP
     ======================================================================== */
  window.addEventListener('DOMContentLoaded', () => {
    initAuth();
  });

})();
