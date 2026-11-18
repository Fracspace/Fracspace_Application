// Design tokens for the e-KYC screens. Taken from the current Profile
// Verification screen (navy button, light-blue header wash, WorkSans body,
// Montserrat headings) so the new flow looks like the same app.
export const C = {
  navy: '#021265',
  navyPressed: '#010B45',
  navyTint: '#EEF2FB', // navy at ~6%, for icon tiles and selected rows
  sky: '#C7E5FD', // header gradient top
  white: '#FFFFFF',
  ink: '#000000',
  body: '#000000CC',
  muted: '#00000099',
  faint: '#00000061',
  line: '#D9D9D9',
  lineSoft: '#ECECEC',
  field: '#FAFBFD',
  success: '#1E9E4A',
  successTint: '#E8F6EE',
  error: '#D93025',
  errorTint: '#FDEDEC',
  warn: '#B26A00',
  warnTint: '#FFF5E1',
};

export const F = {
  head: 'Montserrat-SemiBold',
  headMed: 'Montserrat-Medium',
  body: 'WorkSans-Regular',
  bodyMed: 'WorkSans-Medium',
  bodySemi: 'WorkSans-SemiBold',
};

// The same document artwork the old upload screen shows, so customers
// recognise each step.
export const LOGOS = {
  pan: 'https://duixj37yn5405.cloudfront.net/appImages/Pan.png',
  aadhaar: 'https://duixj37yn5405.cloudfront.net/appImages/Aadhaar.png',
  bank: 'https://duixj37yn5405.cloudfront.net/appImages/Cheque.png',
  photo: 'https://duixj37yn5405.cloudfront.net/appImages/pp1+1.png',
};

export const SUPPORT_EMAIL = 'support@fracspace.com';
