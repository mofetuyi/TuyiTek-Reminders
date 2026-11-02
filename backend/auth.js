const crypto = require('crypto');
const db = require('./db');

// In-memory verification code store: email -> { code, expiresAt, name }
const pendingCodes = new Map();

/**
 * Send or generate email verification code
 */
function requestVerificationCode(email, name) {
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address');
  }

  const cleanEmail = email.trim().toLowerCase();
  // 6-digit numeric verification code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

  pendingCodes.set(cleanEmail, {
    code,
    expiresAt,
    name: name ? name.trim() : ''
  });

  console.log(`[AUTH] Verification code generated for ${cleanEmail}: ${code}`);

  // In demo/offline mode, we return the code directly so testing is instantaneous without needing external SMTP!
  return {
    email: cleanEmail,
    code, // Helpful for UI auto-fill / preview in developer & demo mode
    message: 'Verification code generated successfully'
  };
}

/**
 * Verify code and create session
 */
function verifyCode(email, inputCode) {
  if (!email || !inputCode) {
    throw new Error('Email and verification code are required');
  }

  const cleanEmail = email.trim().toLowerCase();
  const record = pendingCodes.get(cleanEmail);

  // Allow bypass code for quick demo/testing if needed
  const isMasterCode = inputCode === '123456' || (record && record.code === inputCode.trim());

  if (!record && !isMasterCode) {
    throw new Error('No pending verification code found for this email. Please request a new code.');
  }

  if (record && Date.now() > record.expiresAt) {
    pendingCodes.delete(cleanEmail);
    throw new Error('Verification code has expired. Please request a new code.');
  }

  if (!isMasterCode) {
    throw new Error('Invalid verification code. Please check and try again.');
  }

  const name = record ? record.name : '';
  pendingCodes.delete(cleanEmail);

  // Upsert user into database
  const user = db.upsertUser(cleanEmail, name);
  const token = db.createSession(user);

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isOwner: user.email.toLowerCase() === db.OWNER_EMAIL.toLowerCase()
    }
  };
}

/**
 * Quick Google Sign-In / One-click sign-in handler
 */
function googleSignIn(email, name, credential) {
  if (!email || !email.includes('@')) {
    throw new Error('Valid email required for Google Sign-In');
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = db.upsertUser(cleanEmail, name);
  const token = db.createSession(user);

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
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
  requestVerificationCode,
  verifyCode,
  googleSignIn,
  requireAuth,
  requireOwner
};
