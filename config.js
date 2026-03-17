// ─── AI Ticket App · Site Configuration ──────────────────────────────────────
//
// EMAIL ROUTING SETUP:
//   1. Visit https://web3forms.com
//   2. Enter your email address → click "Create Access Key" → verify via email
//   3. Paste the key into  Admin Dashboard → ⚙️ Settings
//      — or directly into web3forms_key below.
//
// Your email address is NEVER stored in this file or anywhere in the site code.
// The access key is a public identifier — safe to include in client-side JS
// (Web3Forms is designed for this; the key only routes mail to your verified address).
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {

  // ── Email routing ─────────────────────────────────────────────────────────
  // Paste your Web3Forms access key here, or set it via Admin → ⚙️ Settings.
  web3forms_key: '',

  // ── Confirmation email fields ──────────────────────────────────────────────
  // Controls what appears in the auto-reply sent to the ticket submitter.
  //   true  = included in the confirmation copy
  //   false = omitted
  // Add new entries here at any time — they will automatically appear in
  // Admin → ⚙️ Settings so you can toggle them without touching code.
  confirmation_fields: {
    ticket_id:     true,   // Assigned ticket number
    date_created:  true,   // Date & time the ticket was submitted
    urgency_level: true,   // Priority / urgency level
    subject:       true,   // Ticket subject line
    category:      false,  // Issue category (off by default)
    name:          true,   // Submitter name
  },

  // ── Submission gate ───────────────────────────────────────────────────────
  // Set submissions_disabled to true to manually block new ticket creation.
  // This flag is also set automatically when your Web3Forms monthly limit is hit.
  submissions_disabled: false,
  disabled_message:
    'Due to popular demand, this system is not accepting new tickets at this time. Please check back later.',
};

// Human-readable labels for confirmation_fields keys.
// Used in Admin → ⚙️ Settings to render the toggle list.
// Add a matching entry here whenever you add a new confirmation_fields key.
const FIELD_LABELS = {
  ticket_id:     'Assigned ticket number',
  date_created:  'Date & time submitted',
  urgency_level: 'Priority / urgency level',
  subject:       'Ticket subject line',
  category:      'Issue category',
  name:          'Submitter name',
};

// ─── Runtime helpers ──────────────────────────────────────────────────────────

/**
 * Returns the active config: localStorage overrides merged onto DEFAULT_CONFIG.
 * Call this on every page load — never cache the result.
 */
function getConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem('site_config') || '{}');
    return {
      ...DEFAULT_CONFIG,
      ...stored,
      confirmation_fields: {
        ...DEFAULT_CONFIG.confirmation_fields,
        ...(stored.confirmation_fields || {}),
      },
    };
  } catch (_) {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Persist config changes to localStorage (deep-merges with existing values).
 * Pass only the keys you want to change.
 */
function saveConfig(updates) {
  try {
    const current = JSON.parse(localStorage.getItem('site_config') || '{}');
    const next = { ...current, ...updates };
    if (updates.confirmation_fields) {
      next.confirmation_fields = {
        ...(current.confirmation_fields || {}),
        ...updates.confirmation_fields,
      };
    }
    localStorage.setItem('site_config', JSON.stringify(next));
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Strip HTML special characters from user input and hard-truncate to maxLength.
 * Call on every field before storing or transmitting.
 */
function sanitizeInput(str, maxLength = 2000) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, maxLength)
    .trim();
}

/**
 * Disable new ticket submissions site-wide.
 * Called automatically when Web3Forms returns a monthly-limit-exceeded error.
 * Can also be triggered manually from Admin → ⚙️ Settings.
 */
function disableSubmissions(customMessage) {
  saveConfig({
    submissions_disabled: true,
    ...(customMessage ? { disabled_message: customMessage } : {}),
  });
}

/**
 * Submit a ticket to Web3Forms for email routing.
 *
 * Returns one of:
 *   { success: true }
 *   { success: false, code: 'no_key' }          — no access key configured
 *   { success: false, code: 'limit_exceeded' }   — monthly quota hit (submissions auto-disabled)
 *   { success: false, code: 'network_error' }    — fetch failed
 *   { success: false, code: 'api_error', message } — Web3Forms returned an error
 */
async function sendTicketEmail(ticketData) {
  const config = getConfig();

  if (!config.web3forms_key) {
    return { success: false, code: 'no_key' };
  }

  const f = config.confirmation_fields;

  // ── Admin notification body ───────────────────────────────────────────────
  const adminBody = [
    `Ticket ID       : ${ticketData.id}`,
    `Date Submitted  : ${ticketData.date}`,
    `Priority        : ${ticketData.priority.toUpperCase()}`,
    `Category        : ${ticketData.category}`,
    ``,
    `Submitter       : ${ticketData.name}`,
    `Reply-To        : ${ticketData.email}`,
    ``,
    `Subject: ${ticketData.subject}`,
    ``,
    `─── Description ─────────────────────────────────────────────`,
    ticketData.description,
  ].join('\n');

  // ── Confirmation copy to submitter (only selected fields) ─────────────────
  const confirmLines = [
    'Your support ticket has been received. Here is your confirmation copy:\n',
  ];
  if (f.ticket_id)     confirmLines.push(`Ticket #       : ${ticketData.id}`);
  if (f.date_created)  confirmLines.push(`Date Submitted : ${ticketData.date}`);
  if (f.urgency_level) confirmLines.push(`Priority       : ${ticketData.priority.toUpperCase()}`);
  if (f.subject)       confirmLines.push(`Subject        : ${ticketData.subject}`);
  if (f.category)      confirmLines.push(`Category       : ${ticketData.category}`);
  if (f.name)          confirmLines.push(`Submitted by   : ${ticketData.name}`);
  confirmLines.push('\nWe will review your ticket and follow up shortly.\n— Support Team');

  const payload = {
    access_key:              config.web3forms_key,
    subject:                 `[Ticket ${ticketData.id}] ${ticketData.subject}`,
    from_name:               'Ticket System (no-reply)',
    name:                    ticketData.name,
    email:                   ticketData.email,
    message:                 adminBody,
    botcheck:                '',   // honeypot — must remain empty
    auto_response_subject:   `Support Ticket Received — ${ticketData.id}`,
    auto_response_message:   confirmLines.join('\n'),
  };

  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    // Auto-disable if monthly submission limit is hit
    if (!data.success && typeof data.message === 'string' &&
        /limit|exceeded|quota/i.test(data.message)) {
      disableSubmissions();
      return { success: false, code: 'limit_exceeded' };
    }

    if (!data.success) {
      return { success: false, code: 'api_error', message: data.message };
    }

    return { success: true };
  } catch (_) {
    return { success: false, code: 'network_error' };
  }
}
