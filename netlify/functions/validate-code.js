const { MongoClient } = require('mongodb');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "coursePortal"
const collectionName = process.env.MONGODB_COLLECTION || 'courseCodes';
const redirectField = process.env.COURSE_REDIRECT_FIELD || 'redirectTo';
const codeField = process.env.COURSE_CODE_FIELD || 'code';

if (!mongoUri) {
  console.warn('MONGODB_URI is not set. The validate-code function will fail until it is configured.');
}

if (!databaseName) {
  console.warn('MONGODB_DB is not set. The validate-code function will fail until it is configured.');
}

let cachedClient = null;

function normalizePath(value) {
  if (!value || typeof value !== 'string') {
    return '/';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '/';
  }

  try {
    const url = new URL(trimmed, 'https://placeholder.local');
    const pathname = url.pathname || '/';
    return pathname.split('#')[0].split('?')[0] || '/';
  } catch (error) {
    const sanitized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return sanitized.split('#')[0].split('?')[0] || '/';
  }
}

function deriveAccessRoot(pathValue) {
  const normalized = normalizePath(pathValue);
  if (normalized === '/') {
    return '/';
  }

  if (normalized.endsWith('/')) {
    return normalized;
  }

  const lastSegment = normalized.substring(normalized.lastIndexOf('/') + 1);
  const isFile = lastSegment.includes('.');

  if (isFile) {
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash <= 0) {
      return '/';
    }
    return normalized.slice(0, lastSlash + 1);
  }

  return `${normalized}/`;
}

async function getClient() {
  if (cachedClient) {
    return cachedClient;
  }
  cachedClient = new MongoClient(mongoUri, {
    maxPoolSize: 5,
  });
  await cachedClient.connect();
  return cachedClient;
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(payload),
  };
}

exports.handler = async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return jsonResponse(405, { message: 'Method Not Allowed' });
    }

    if (!mongoUri || !databaseName) {
      return jsonResponse(500, { message: 'Missing MongoDB configuration.' });
    }

    const payload = JSON.parse(event.body || '{}');
    const email = String(payload.email || '').trim();
    const courseCode = String(payload.courseCode || '').trim();

    if (!EMAIL_REGEX.test(email)) {
      return jsonResponse(400, { message: 'Invalid email format.' });
    }

    if (!courseCode) {
      return jsonResponse(400, { message: 'Course code is required.' });
    }

    const client = await getClient();
    const db = client.db(databaseName);
    const collection = db.collection(collectionName);

    const courseDoc = await collection.findOne({
      [codeField]: courseCode,
      active: { $ne: false },
    });

    if (!courseDoc) {
      return jsonResponse(401, { message: 'Invalid course code.' });
    }

    const nextPath = courseDoc[redirectField] || '/index.html';
    const accessRoot = deriveAccessRoot(nextPath);

    return jsonResponse(200, {
      message: 'Access granted.',
      nextPath,
      accessRoot,
    });
  } catch (error) {
    console.error('validate-code error', error);
    return jsonResponse(500, { message: 'Unexpected error validating course code.' });
  }
};
