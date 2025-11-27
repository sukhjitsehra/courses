const form = document.getElementById('access-form');
const emailInput = document.getElementById('email');
const codeInput = document.getElementById('course-code');
const statusMessage = document.getElementById('status-message');
const submitBtn = document.getElementById('submit-btn');
const spinner = document.getElementById('spinner');
const buttonText = document.getElementById('button-text');
const selectedCourseBanner = document.getElementById('selected-course');
const selectedCourseValue = document.getElementById('selected-course-value');
const params = new URLSearchParams(window.location.search);
const nextPath = params.get('next') || '/index.html';
const coursePrefill = params.get('course');
const ACCESS_KEY = 'courseAccess';
const ENDPOINT = '/.netlify/functions/validate-code';

const emailRegex = /^[a-z]{4}\d{4}@mylaurier\.ca$/i;
const SPINNER_ACTIVE_CLASS = 'is-loading';

function toggleLoading(isLoading) {
  if (isLoading) {
    submitBtn.setAttribute('disabled', 'disabled');
    spinner.classList.add(SPINNER_ACTIVE_CLASS);
    buttonText.textContent = 'Checking…';
  } else {
    submitBtn.removeAttribute('disabled');
    spinner.classList.remove(SPINNER_ACTIVE_CLASS);
    buttonText.textContent = 'Request access';
  }
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.className = isError ? 'error' : 'success';
}

function persistEmail(value) {
  try {
    localStorage.setItem('lastCourseEmail', value);
  } catch (error) {
    console.debug('Unable to persist email', error);
  }
}

function hydrateEmail() {
  try {
    const existing = localStorage.getItem('lastCourseEmail');
    if (existing) {
      emailInput.value = existing;
    }
  } catch (error) {
    console.debug('No stored email found', error);
  }
}

function hydrateCourseSelection() {
  if (!coursePrefill) {
    return;
  }

  const cleaned = coursePrefill.trim();
  if (!cleaned) {
    return;
  }

  if (selectedCourseBanner && selectedCourseValue) {
    selectedCourseValue.textContent = cleaned;
    selectedCourseBanner.hidden = false;
  }
}

function normalizePath(value) {
  if (!value || typeof value !== 'string') {
    return '/';
  }

  try {
    const url = new URL(value, window.location.origin);
    const pathname = url.pathname || '/';
    return pathname.split('#')[0].split('?')[0] || '/';
  } catch (error) {
    const sanitized = value.startsWith('/') ? value : `/${value}`;
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

function storeAccessSession({ email, accessRoot }) {
  const payload = {
    email,
    grantedAt: Date.now(),
    accessRoot: deriveAccessRoot(accessRoot),
  };

  try {
    sessionStorage.setItem(ACCESS_KEY, JSON.stringify(payload));
  } catch (error) {
    console.debug('Unable to persist access session', error);
  }
}

async function validateCredentials(email, courseCode) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, courseCode }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Unable to validate credentials.');
  }

  return response.json();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim();
  const courseCode = codeInput.value.trim();

  if (!emailRegex.test(email)) {
    setStatus('Use your Laurier email in the form abcd1234@mylaurier.ca.', true);
    emailInput.focus();
    return;
  }

  if (!courseCode) {
    setStatus('Your course code is required.', true);
    codeInput.focus();
    return;
  }

  toggleLoading(true);
  setStatus('');

  try {
    const result = await validateCredentials(email, courseCode);
    const destination = (result && result.nextPath) || nextPath;
    const accessRoot = (result && result.accessRoot) || deriveAccessRoot(destination);
    storeAccessSession({ email, accessRoot });
    persistEmail(email);
    setStatus('Access granted. Redirecting…');
    window.location.replace(destination);
  } catch (error) {
    console.error(error);
    setStatus('Access denied. Please double-check your details or contact your professor.', true);
  } finally {
    toggleLoading(false);
  }
});

hydrateEmail();
hydrateCourseSelection();
