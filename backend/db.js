const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const OWNER_EMAIL = 'osanyintuyimofeoluwa@gmail.com';

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

class Database {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error('Error reading db.json, creating fallback:', err);
        this.data = this.getDefaultData();
        this.save();
      }
    } else {
      this.data = this.getDefaultData();
      this.save();
    }
  }

  getDefaultData() {
    const today = new Date();
    
    const dateDueTomorrow = new Date(today);
    dateDueTomorrow.setDate(today.getDate() + 1);
    
    const dateDueInTwoDays = new Date(today);
    dateDueInTwoDays.setDate(today.getDate() + 2);

    const dateDueNextWeek = new Date(today);
    dateDueNextWeek.setDate(today.getDate() + 7);

    const formatDate = (d) => d.toISOString().split('T')[0];

    const defaultSalt = 'd8f49b109e4f2a7c88b0123456789abc';
    const defaultHash = hashPassword('Admin@123', defaultSalt);

    return {
      app_settings: {
        id: 1,
        zapier_webhook_url: '',
        auth_webhook_url: '',
        google_sheet_id: '15oZab-gF3dFCInkIS49tRTF7jvErmvMcqC3-5T0eHX0',
        google_sheet_tab: 'Form responses 1',
        google_apps_script_url: '',
        updated_at: new Date().toISOString()
      },
      users: [
        {
          id: 'usr_owner_001',
          firstName: 'Mofeoluwa',
          lastName: 'Osanyintuyi',
          name: 'Mofeoluwa Osanyintuyi',
          email: OWNER_EMAIL,
          phone: '+2348140009988',
          passwordHash: defaultHash,
          salt: defaultSalt,
          agreedToTerms: true,
          created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
          last_login: new Date().toISOString()
        }
      ],
      jobs: [
        {
          id: 'job_001',
          'Customer Name': 'Folashade Adeleke',
          'Customer Phone': '+2348091112233',
          'Worker Phone': '+2348140009988',
          'Item / Job': 'Ankara gown with beaded embroidery',
          'Job Details': 'Full length flared gown, teal lace trims, chest 38, waist 32, ready for Saturday wedding.',
          'Collection Date': formatDate(dateDueTomorrow),
          'Notify Email': OWNER_EMAIL,
          'Business Name': 'StitchPerfect Tailoring',
          'Last Reminder': '',
          created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
          created_by_user_id: 'usr_owner_001'
        },
        {
          id: 'job_002',
          'Customer Name': 'Chinedu Okeke',
          'Customer Phone': '+2348035551234',
          'Worker Phone': '+2348029988776',
          'Item / Job': 'Toyota Camry - Brake pads & suspension servicing',
          'Job Details': 'Replace front brake discs, balance tires, shock absorber bushing inspection.',
          'Collection Date': formatDate(dateDueInTwoDays),
          'Notify Email': OWNER_EMAIL,
          'Business Name': 'TuyiTek Premier Mechanics',
          'Last Reminder': '',
          created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
          created_by_user_id: 'usr_owner_001'
        },
        {
          id: 'job_003',
          'Customer Name': 'Amina Bello',
          'Customer Phone': '+2348023334455',
          'Worker Phone': '+2348140009988',
          'Item / Job': '6-seater mahogany dining table',
          'Job Details': 'Polished dark walnut gloss, carved legs, matching 6 chairs with cream cushions.',
          'Collection Date': formatDate(dateDueNextWeek),
          'Notify Email': OWNER_EMAIL,
          'Business Name': 'Crown Artisans Woodcraft',
          'Last Reminder': '',
          created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
          created_by_user_id: 'usr_owner_001'
        }
      ],
      sessions: {}
    };
  }

  save() {
    try {
      const tempPath = path.join(DATA_DIR, `db.tmp.${Date.now()}`);
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error('Failed to write db.json:', err);
    }
  }

  // Settings
  getSettings() {
    return this.data.app_settings || {};
  }

  updateSettings(settings) {
    this.data.app_settings = {
      ...this.data.app_settings,
      ...settings,
      updated_at: new Date().toISOString()
    };
    this.save();
    return this.data.app_settings;
  }

  // Users
  getUsers() {
    return (this.data.users || []).map(u => ({
      id: u.id,
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
      email: u.email,
      phone: u.phone || '',
      created_at: u.created_at,
      last_login: u.last_login
    }));
  }

  findUserByEmail(email) {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    return (this.data.users || []).find(u => u.email.toLowerCase() === clean) || null;
  }

  createUser({ firstName, lastName, email, phone, passwordHash, salt }) {
    const cleanEmail = email.trim().toLowerCase();
    const now = new Date().toISOString();
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    const newUser = {
      id: 'usr_' + crypto.randomBytes(6).toString('hex'),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: fullName,
      email: cleanEmail,
      phone: phone.trim(),
      passwordHash,
      salt,
      agreedToTerms: true,
      created_at: now,
      last_login: now
    };

    if (!this.data.users) this.data.users = [];
    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  updateUserLogin(userId) {
    const user = (this.data.users || []).find(u => u.id === userId);
    if (user) {
      user.last_login = new Date().toISOString();
      this.save();
    }
  }

  // Sessions
  createSession(user) {
    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    if (!this.data.sessions) this.data.sessions = {};
    
    this.data.sessions[token] = {
      userId: user.id,
      email: user.email,
      name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      phone: user.phone || '',
      expiresAt
    };
    this.save();
    return token;
  }

  getSession(token) {
    if (!token || !this.data.sessions) return null;
    const session = this.data.sessions[token];
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      delete this.data.sessions[token];
      this.save();
      return null;
    }
    return session;
  }

  deleteSession(token) {
    if (token && this.data.sessions && this.data.sessions[token]) {
      delete this.data.sessions[token];
      this.save();
    }
  }

  // Jobs
  getJobs() {
    return [...(this.data.jobs || [])].sort((a, b) => {
      const dateA = new Date(a['Collection Date'] || '9999-12-31').getTime();
      const dateB = new Date(b['Collection Date'] || '9999-12-31').getTime();
      return dateA - dateB;
    });
  }

  addJob(jobData, userId) {
    const newJob = {
      id: 'job_' + crypto.randomBytes(6).toString('hex'),
      'Customer Name': String(jobData['Customer Name'] || '').trim(),
      'Customer Phone': String(jobData['Customer Phone'] || '').trim(),
      'Worker Phone': String(jobData['Worker Phone'] || '').trim(),
      'Item / Job': String(jobData['Item / Job'] || '').trim(),
      'Job Details': String(jobData['Job Details'] || '').trim(),
      'Collection Date': String(jobData['Collection Date'] || '').trim(),
      'Notify Email': String(jobData['Notify Email'] || '').trim(),
      'Business Name': String(jobData['Business Name'] || '').trim(),
      'Last Reminder': '', // Never write to or change Last Reminder; keep empty
      created_at: new Date().toISOString(),
      created_by_user_id: userId || 'anonymous'
    };

    if (!this.data.jobs) this.data.jobs = [];
    this.data.jobs.push(newJob);
    this.save();
    return newJob;
  }
}

module.exports = new Database();
module.exports.OWNER_EMAIL = OWNER_EMAIL;
module.exports.hashPassword = hashPassword;
