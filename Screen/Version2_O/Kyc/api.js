// e-KYC API (/api/v1/kyc). Every call returns `data` from {success, message,
// data} or throws an ApiError with .status and the customer-facing .message.
//
// Never log or store the PAN, account number or IFSC: they only live in the
// screen's state and go straight into the request body.
import {request, ApiError} from '../SpecialSection/api/client';

/**
 * true = the screens run against the in-memory mock below and never call the
 * server. The KYC backend isn't deployed yet; flip this off once it is.
 */
export const USE_MOCK = true;

export const DIGILOCKER_RETURN = 'https://portal.fracspace.com/kyc/return';

export const getKyc = () => (USE_MOCK ? mock.me() : request('GET', '/kyc/me'));

export const verifyPan = pan =>
  USE_MOCK ? mock.pan(pan) : request('POST', '/kyc/pan', {body: {pan}, timeout: 30000});

export const startDigilocker = () =>
  USE_MOCK ? mock.startDigilocker() : request('POST', '/kyc/aadhaar/digilocker', {body: {}});

export const syncDigilocker = verificationId =>
  USE_MOCK
    ? mock.syncDigilocker(verificationId)
    : request('POST', '/kyc/aadhaar/digilocker/sync', {body: {verificationId}, timeout: 30000});

export const verifyBank = (accountNumber, ifsc) =>
  USE_MOCK
    ? mock.bank(accountNumber, ifsc)
    : request('POST', '/kyc/bank', {body: {accountNumber, ifsc}, timeout: 30000});

// ---------------------------------------------------------------------------
// Mock backend, shaped like docs/kyc-api.md. Inputs that drive each outcome:
//   PAN    ending in Z → failed · ending in R → needs_review · else passed
//   Bank   account ending 0000 → failed · ending 9999 → needs_review · else passed
//   Aadhaar: the fake DigiLocker page has buttons for Allow / no Aadhaar / cancel
// Set MOCK_CUSTOMER to 'nri' to see the two-step flow.
// ---------------------------------------------------------------------------
const MOCK_CUSTOMER = 'resident_individual';
const wait = ms => new Promise(r => setTimeout(r, ms));

const mock = (() => {
  const types = MOCK_CUSTOMER === 'nri' ? ['pan', 'bank'] : ['pan', 'aadhaar', 'bank'];
  const labels = {pan: 'PAN', aadhaar: 'Aadhaar (DigiLocker)', bank: 'Bank account'};
  const s = {
    steps: types.map(type => ({type, label: labels[type], required: true, status: 'not_started', message: null})),
    identity: {name: null, panMasked: null, aadhaarLast4: null, bank: null},
    attempts: {},
    session: null,
  };

  const snapshot = () => {
    const done = s.steps.every(x => x.status === 'passed' || x.status === 'needs_review');
    const anyReview = s.steps.some(x => x.status === 'needs_review');
    const anyTried = s.steps.some(x => x.status !== 'not_started');
    const status = done ? (anyReview ? 'pending_review' : 'verified') : anyTried ? 'in_progress' : 'not_started';
    const next = s.steps.find(x => !['passed', 'needs_review'].includes(x.status));
    return JSON.parse(
      JSON.stringify({
        status,
        statusLabel: status,
        customerType: MOCK_CUSTOMER,
        canRunChecks: !done,
        available: true,
        nextStep: next ? next.type : null,
        steps: s.steps,
        identity: s.identity,
        verifiedAt: status === 'verified' ? new Date().toISOString() : null,
        rejectionReason: null,
      }),
    );
  };

  const step = type => s.steps.find(x => x.type === type);
  const tries = type => {
    s.attempts[type] = (s.attempts[type] || 0) + 1;
    if (s.attempts[type] > 5) {
      throw new ApiError(429, 'Too many attempts today - please try again tomorrow');
    }
  };
  const set = (type, status, message) => Object.assign(step(type), {status, message});

  return {
    async me() {
      await wait(500);
      return snapshot();
    },
    async pan(pan) {
      await wait(1800);
      tries('pan');
      if (pan.endsWith('Z')) {
        set('pan', 'failed', 'PAN could not be verified. Please check the number and try again.');
      } else {
        set('pan', pan.endsWith('R') ? 'needs_review' : 'passed', 'PAN verified');
        s.identity.name = s.identity.name || 'ANANYA RAO';
        s.identity.panMasked = 'XXXXXX' + pan.slice(6);
      }
      const p = step('pan');
      return {check: {type: 'pan', status: p.status, message: p.message}, kyc: snapshot()};
    },
    async startDigilocker() {
      await wait(700);
      tries('aadhaar');
      set('aadhaar', 'started', null);
      s.session = {verificationId: 'mock-' + Date.now(), outcome: null};
      return {url: null, mockHtml: MOCK_DIGILOCKER_HTML, verificationId: s.session.verificationId, expiresAt: null};
    },
    setMockOutcome(outcome) {
      if (s.session) {
        s.session.outcome = outcome;
      }
    },
    async syncDigilocker() {
      await wait(1500);
      const outcome = s.session?.outcome;
      if (outcome === 'allow') {
        set('aadhaar', 'passed', 'Aadhaar verified');
        s.identity.aadhaarLast4 = '7302';
      } else if (outcome === 'none') {
        set('aadhaar', 'failed', 'No Aadhaar is linked to this DigiLocker account');
      }
      const a = step('aadhaar');
      return {pending: false, check: {type: 'aadhaar', status: a.status, message: a.message}, kyc: snapshot()};
    },
    async bank(accountNumber) {
      await wait(2200);
      tries('bank');
      if (accountNumber.endsWith('0000')) {
        set('bank', 'failed', 'Account number is not valid for this IFSC');
      } else {
        const review = accountNumber.endsWith('9999');
        set('bank', review ? 'needs_review' : 'passed', review ? 'Our team will check this one' : 'Bank account verified');
        s.identity.bank = {accountMasked: 'XXXXXX' + accountNumber.slice(-4), bankName: 'YES BANK'};
      }
      const b = step('bank');
      return {check: {type: 'bank', status: b.status, message: b.message}, kyc: snapshot()};
    },
  };
})();

export const setMockDigilockerOutcome = o => mock.setMockOutcome(o);

// Stand-in for DigiLocker's own pages. Each link goes to the return URL, which
// the sheet catches exactly as it will for the real DigiLocker.
const MOCK_DIGILOCKER_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:-apple-system,Roboto,sans-serif;padding:24px;color:#222}h2{margin:8px 0 4px}p{color:#666}
a{display:block;margin:12px 0;padding:14px;border-radius:8px;text-align:center;text-decoration:none;font-weight:600}
.y{background:#1B3F8B;color:#fff}.n{border:1px solid #ccc;color:#333}</style></head><body>
<p>MOCK · DigiLocker</p><h2>Share your Aadhaar with Fracspace?</h2><p>In the real flow the customer enters their Aadhaar number, the OTP and taps Allow here.</p>
<a class="y" href="${DIGILOCKER_RETURN}?verification_id=mock&mock=allow">Allow</a>
<a class="n" href="${DIGILOCKER_RETURN}?verification_id=mock&mock=none">Simulate: no Aadhaar linked</a>
<a class="n" href="${DIGILOCKER_RETURN}?verification_id=mock&mock=deny">Deny</a></body></html>`;
