import {nextRoute} from './store';

/** Button text after a step: names where it goes next. */
export function continueLabel(kyc) {
  switch (nextRoute(kyc)) {
    case 'KycPan':
      return 'Continue to PAN';
    case 'KycAadhaar':
      return 'Continue to Aadhaar';
    case 'KycBank':
      return 'Continue to bank account';
    case 'KycResult':
      return 'Finish';
    default:
      return 'Back to overview';
  }
}
