const crypto = require('crypto');
const db = require('./db');
const integrations = require('./integrations');

/**
 * Register a real user account with full credentials
 */
function register({ firstName, lastName, email, phone, password, confirmPassword, agreedToTerms }) {
  if (!firstName || !firstName.trim()) {
    throw new Error('First name is required.');
  }
  if (!lastName || !lastName.trim()) {
    throw new Error('Last name is required.');
  }
  if (!email || !email.includes('@')) {
    throw new Error('A valid email address is required.');
  }
  if (!phone || !phone.trim()) {
    throw new Error('Phone number is required.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }
  if (password !== confirmPassword) {
    throw new Error('Password and confirm password do not match.');
  }
  if (!agreedToTerms) {
    throw new Error('You must agree to the Terms and Conditions to create an account.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const normalizedPhone = integrations.normalizeNigerianPhone(phone);

  if (!normalizedPhone) {
    throw new Error('Please enter a valid phone number (e.g. 0803 123 4567).');
  }

  // Check if account already exists
  const existing = db.findUserByEmail(cleanEmail);
  if (existing) {
    throw new Error('An account with this email already exists. Please sign in instead.');
  }

  // Hash password with random salt
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = db.hashPassword(password, salt);

  const newUser = db.createUser({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: cleanEmail,
    phone: normalizedPhone,
    passwordHash,
    salt
  });

  const token = db.createSession(newUser);

  return {
    token,
    user: {
      id: newUser.id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      isOwner: newUser.email.toLowerCase() === db.OWNER_EMAIL.toLowerCase()
    }
  };
}

/**
 * Sign in an existing user with email and password
 */
function login({ email, password }) {
  if (!email || !email.trim()) {
    throw new Error('Email is required.');
  }
  if (!password) {
    throw new Error('Password is required.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = db.findUserByEmail(cleanEmail);

  if (!user) {
    throw new Error('Invalid email or password. Please check your credentials.');
  }

  // Check password hash
  if (user.passwordHash && user.salt) {
    const computedHash = db.hashPassword(password, user.salt);
    if (computedHash !== user.passwordHash) {
      throw new Error('Invalid email or password. Please check your credentials.');
    }
  } else {
    // If legacy user without password hash, set their password on first sign-in
    const newSalt = crypto.randomBytes(16).toString('hex');
    user.salt = newSalt;
    user.passwordHash = db.hashPassword(password, newSalt);
    db.save();
  }

  db.updateUserLogin(user.id);
  const token = db.createSession(user);

  return {
    token,
    user: {
      id: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      name: user.name || user.email,
      email: user.email,
      phone: user.phone || '',
      isOwner: user.email.toLowerCase() === db.OWNER_EMAIL.toLowerCase()
    }
  };
}

/**
 * Express middleware to enforce authentication
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (authHeader) {
    token = authHeader.trim();
  }

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in to access Job Booking.'
    });
  }

  const session = db.getSession(token);
  if (!session) {
    return res.status(401).json({
      error: 'Session expired or invalid. Please sign in again.'
    });
  }

  req.user = {
    id: session.userId,
    email: session.email,
    name: session.name,
    phone: session.phone || '',
    isOwner: session.email.toLowerCase() === db.OWNER_EMAIL.toLowerCase()
  };
  req.token = token;
  next();
}

/**
 * Express middleware to enforce Owner privileges
 */
function requireOwner(req, res, next) {
  if (!req.user || !req.user.isOwner) {
    return res.status(403).json({
      error: 'Access denied. This page is reserved for the platform owner (osanyintuyimofeoluwa@gmail.com).'
    });
  }
  next();
}

module.exports = {
  register,
  login,
  requireAuth,
  requireOwner
};
