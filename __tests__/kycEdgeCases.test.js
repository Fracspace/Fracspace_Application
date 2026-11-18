// Edge cases for the e-KYC screens. The KYC API is replaced with jest fakes, so
// each test decides exactly what the server answers (failures, review, every
// error code, DigiLocker outcomes) without paid checks.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-vector-icons/Feather', () => 'Icon');
jest.mock('react-native-webview', () => ({WebView: 'WebView'}));
jest.mock('react-native-device-info', () => ({getVersion: () => '1.0.0'}));
jest.mock('react-native-image-picker', () => ({launchCamera: jest.fn(), launchImageLibrary: jest.fn()}));
jest.mock('react-native-safe-area-context', () => {
  const {View} = require('react-native');
  return {SafeAreaView: View, useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0})};
});
jest.mock('../Screen/Services/UserApi', () => ({ProfilePic: jest.fn()}));
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {useNavigation: () => global.__nav, useFocusEffect: cb => React.useEffect(cb, [cb])};
});
jest.mock('../Screen/Version2_O/Kyc/api', () => ({
  DIGILOCKER_RETURN: 'https://portal.fracspace.com/kyc/return',
  KYC_MOCK: {on: false},
  setMockDigilockerOutcome: jest.fn(),
  getKyc: jest.fn(),
  verifyPan: jest.fn(),
  startDigilocker: jest.fn(),
  syncDigilocker: jest.fn(),
  verifyBank: jest.fn(),
}));

import React from 'react';
import {Linking, Text, TextInput} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {AppContext} from '../Screen/Context/AppContext';
import {ApiError} from '../Screen/Version2_O/SpecialSection/api/client';
import * as api from '../Screen/Version2_O/Kyc/api';
import {checkError, setKyc} from '../Screen/Version2_O/Kyc/store';
import KycOverview from '../Screen/Version2_O/Kyc/KycOverview';
import KycPan from '../Screen/Version2_O/Kyc/KycPan';
import KycBank from '../Screen/Version2_O/Kyc/KycBank';
import KycAadhaar from '../Screen/Version2_O/Kyc/KycAadhaar';
import KycResult from '../Screen/Version2_O/Kyc/KycResult';

// ---------- helpers ----------
const RETURN = 'https://portal.fracspace.com/kyc/return?verification_id=v1';
const flush = () => act(async () => {});
const mounted = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach(t => t.unmount()));
  jest.clearAllMocks();
  jest.useRealTimers();
});

let userSeq = 0;
/** Each mount is a new account, so the shared KYC store starts empty. */
function mount(Screen, {email} = {}) {
  const nav = {navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn(), popToTop: jest.fn()};
  global.__nav = nav;
  const ctx = {
    globalState: {userEmail: email || `u${++userSeq}@test.in`, userName: 'Ananya', userDetails: {}},
    setGlobalState: jest.fn(),
  };
  let tree;
  act(() => {
    tree = renderer.create(
      <AppContext.Provider value={ctx}>
        <Screen navigation={nav} />
      </AppContext.Provider>,
    );
  });
  mounted.push(tree);
  return {tree, nav, ctx};
}
const texts = node =>
  (node.root || node)
    .findAllByType(Text)
    .map(t => [].concat(t.props.children).filter(c => typeof c === 'string' || typeof c === 'number').join(''))
    .join(' | ');
const buttons = (tree, label) =>
  tree.root.findAll(n => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function' && texts(n).includes(label));
const button = (tree, label) => {
  const b = buttons(tree, label);
  if (!b.length) {
    throw new Error(`No button "${label}" in: ${texts(tree)}`);
  }
  return b[0];
};
const press = (tree, label) => act(async () => button(tree, label).props.onPress());
const inputs = tree => tree.root.findAllByType(TextInput);
const type = (tree, i, v) => act(() => inputs(tree)[i].props.onChangeText(v));

const step = (kind, status = 'not_started', message = null) => ({type: kind, label: kind, required: true, status, message});
const kycOf = over => ({
  status: 'not_started',
  customerType: 'resident_individual',
  canRunChecks: true,
  available: true,
  nextStep: 'pan',
  steps: [step('pan'), step('aadhaar'), step('bank')],
  identity: {name: 'ANANYA RAO', panMasked: null, aadhaarLast4: null, bank: null},
  verifiedAt: null,
  rejectionReason: null,
  ...over,
});
const err = (status, message) => new ApiError(status, message);

// ---------- error-code mapping ----------
describe('checkError', () => {
  it('maps each status the API documents', () => {
    jest.useFakeTimers();
    api.getKyc.mockResolvedValue(kycOf());
    expect(checkError(err(400, 'PAN format is wrong'), 'pan')).toEqual({field: 'PAN format is wrong'});
    expect(checkError(err(409), 'pan').note).toBe('A check is already running - wait a moment');
    expect(checkError(err(429), 'bank')).toMatchObject({locked: true});
    expect(checkError(err(503), 'pan')).toMatchObject({off: true});
    expect(checkError(err(0, 'No internet connection. Check your network and try again.'), 'pan').note).toMatch(/No internet/);
    expect(checkError(err(500), 'pan').note).toBe('Something went wrong. Please try again.');
  });
});

// ---------- overview ----------
describe('Overview', () => {
  it('shows the error and retries when /me fails', async () => {
    api.getKyc.mockRejectedValueOnce(err(0, 'No internet connection. Check your network and try again.'));
    const {tree} = mount(KycOverview);
    await flush();
    expect(texts(tree)).toContain('No internet connection');
    api.getKyc.mockResolvedValueOnce(kycOf());
    await press(tree, 'Try again');
    await flush();
    expect(texts(tree)).toContain('0 of 3 done');
  });

  it('KYC switched off: says so and offers no step', async () => {
    api.getKyc.mockResolvedValue(kycOf({available: false}));
    const {tree} = mount(KycOverview);
    await flush();
    expect(texts(tree)).toContain('Verification isn’t available right now');
    expect(buttons(tree, 'Verify PAN')).toHaveLength(0);
  });

  it('NRI: only the two steps the API sends', async () => {
    api.getKyc.mockResolvedValue(kycOf({customerType: 'nri', steps: [step('pan'), step('bank')]}));
    const {tree} = mount(KycOverview);
    await flush();
    const t = texts(tree);
    expect(t).toContain('0 of 2 done');
    expect(t).not.toContain('Aadhaar');
    expect(t).toContain('checked directly with Income Tax and your bank.');
  });

  it('a needs_review step is not tappable; a failed one shows its message and Retry', async () => {
    api.getKyc.mockResolvedValue(
      kycOf({status: 'in_progress', nextStep: 'aadhaar', steps: [step('pan', 'needs_review'), step('aadhaar', 'failed', 'No Aadhaar is linked to this DigiLocker account'), step('bank')]}),
    );
    const {tree, nav} = mount(KycOverview);
    await flush();
    expect(button(tree, 'PAN').props.disabled).toBe(true);
    expect(texts(tree)).toContain('No Aadhaar is linked to this DigiLocker account');
    expect(buttons(tree, 'Try again with DigiLocker')).toHaveLength(1); // bottom button matches the row
    await press(tree, 'Retry');
    expect(nav.navigate).toHaveBeenCalledWith('KycAadhaar');
  });

  it('checks paused by the server: explains, no button, rows locked', async () => {
    api.getKyc.mockResolvedValue(kycOf({status: 'in_progress', canRunChecks: false}));
    const {tree} = mount(KycOverview);
    await flush();
    expect(texts(tree)).toContain('A check is in progress');
    expect(buttons(tree, 'Verify PAN')).toHaveLength(0);
    expect(button(tree, 'Bank account').props.disabled).toBe(true);
  });

  it.each([
    ['pending_review', 'Thanks! We’re reviewing'],
    ['verified', 'Your profile is verified'],
  ])('%s shows the result panel instead of the steps', async (status, title) => {
    api.getKyc.mockResolvedValue(kycOf({status, canRunChecks: false, nextStep: null}));
    const {tree} = mount(KycOverview);
    await flush();
    expect(texts(tree)).toContain(title);
    expect(texts(tree)).not.toContain('of 3 done');
  });

  it('rejected shows the staff reason and Contact us', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    api.getKyc.mockResolvedValue(kycOf({status: 'rejected', canRunChecks: false, rejectionReason: 'Bank account is not in your name.'}));
    const {tree} = mount(KycOverview);
    await flush();
    expect(texts(tree)).toContain('Bank account is not in your name.');
    await press(tree, 'Contact us');
    expect(open.mock.calls[0][0]).toMatch(/^mailto:support@fracspace\.com/);
  });

  it('never shows the previous account’s data after switching user', async () => {
    api.getKyc.mockResolvedValueOnce(kycOf({status: 'verified', canRunChecks: false}));
    const a = mount(KycOverview, {email: 'a@test.in'});
    await flush();
    expect(texts(a.tree)).toContain('Your profile is verified');
    act(() => a.tree.unmount());
    let resolveB;
    api.getKyc.mockReturnValueOnce(new Promise(r => (resolveB = r)));
    const b = mount(KycOverview, {email: 'b@test.in'});
    await flush();
    expect(texts(b.tree)).not.toContain('Your profile is verified'); // spinner, not A's result
    expect(api.getKyc).toHaveBeenCalledTimes(2);
    await act(async () => resolveB(kycOf()));
    expect(texts(b.tree)).toContain('0 of 3 done');
  });

  it('a failed first load for the next account shows Try again, not an endless spinner', async () => {
    api.getKyc.mockResolvedValueOnce(kycOf({status: 'verified', canRunChecks: false}));
    const a = mount(KycOverview, {email: 'c@test.in'});
    await flush();
    act(() => a.tree.unmount());
    api.getKyc.mockRejectedValueOnce(err(0, 'No internet connection. Check your network and try again.'));
    const b = mount(KycOverview, {email: 'd@test.in'});
    await flush();
    expect(texts(b.tree)).toContain('No internet connection');
    expect(texts(b.tree)).not.toContain('Your profile is verified');
    expect(buttons(b.tree, 'Try again')).toHaveLength(1);
  });
});

// ---------- PAN ----------
describe('PAN', () => {
  const passed = kycOf({status: 'in_progress', nextStep: 'aadhaar', steps: [step('pan', 'passed'), step('aadhaar'), step('bank')], identity: {name: 'ANANYA RAO', panMasked: 'XXXXXX234D'}});

  it('bad formats never reach the server', async () => {
    const {tree} = mount(KycPan);
    for (const v of ['ABCDE1234', '12345ABCDE', 'ABCD12345F', 'ABCDE12345']) {
      await type(tree, 0, v);
      await press(tree, 'Verify PAN');
    }
    expect(api.verifyPan).not.toHaveBeenCalled();
    expect(button(tree, 'Verify PAN').props.disabled).toBe(true);
  });

  it('a double tap sends one check', async () => {
    let resolve;
    api.verifyPan.mockReturnValue(new Promise(r => (resolve = r)));
    const {tree} = mount(KycPan);
    await type(tree, 0, 'abcde1234d');
    const b = button(tree, 'Verify PAN');
    await act(async () => {
      b.props.onPress();
      b.props.onPress();
    });
    expect(api.verifyPan).toHaveBeenCalledTimes(1);
    expect(api.verifyPan).toHaveBeenCalledWith('ABCDE1234D');
    await act(async () => resolve({check: {status: 'passed'}, kyc: passed}));
    expect(texts(tree)).toContain('PAN verified');
  });

  it('server says failed: message under the field, value kept, try limit shown', async () => {
    api.verifyPan.mockResolvedValue({check: {status: 'failed', message: 'PAN could not be verified. Please check the number and try again.'}, kyc: kycOf()});
    const {tree} = mount(KycPan);
    await type(tree, 0, 'DEFPV0126D');
    await press(tree, 'Verify PAN');
    expect(texts(tree)).toContain('PAN could not be verified');
    expect(texts(tree)).toContain('You can try 5 times a day.');
    expect(inputs(tree)[0].props.value).toBe('DEFPV0126D');
    await type(tree, 0, 'DEFPV0126');
    expect(texts(tree)).not.toContain('PAN could not be verified'); // clears as they fix it
  });

  it('needs_review: received, carry on', async () => {
    api.verifyPan.mockResolvedValue({check: {status: 'needs_review'}, kyc: {...passed, steps: [step('pan', 'needs_review'), step('aadhaar'), step('bank')]}});
    const {tree, nav} = mount(KycPan);
    await type(tree, 0, 'ABCPV1234D');
    await press(tree, 'Verify PAN');
    expect(texts(tree)).toContain('PAN received');
    await press(tree, 'Continue to Aadhaar');
    expect(nav.replace).toHaveBeenCalledWith('KycAadhaar');
  });

  it('400: the API’s text goes under the field', async () => {
    api.verifyPan.mockRejectedValue(err(400, 'Enter a valid PAN'));
    const {tree} = mount(KycPan);
    await type(tree, 0, 'ABCPV1234D');
    await press(tree, 'Verify PAN');
    expect(texts(tree)).toContain('Enter a valid PAN');
  });

  it('429: locks the step for today; no more calls', async () => {
    api.verifyPan.mockRejectedValue(err(429, 'Too many attempts today - please try again tomorrow'));
    const {tree} = mount(KycPan);
    await type(tree, 0, 'ABCPV1234D');
    await press(tree, 'Verify PAN');
    expect(texts(tree)).toContain('Too many attempts today');
    expect(inputs(tree)[0].props.editable).toBe(false);
    expect(button(tree, 'Verify PAN').props.disabled).toBe(true);
    await press(tree, 'Verify PAN');
    expect(api.verifyPan).toHaveBeenCalledTimes(1);
  });

  it('409: says a check is running and refreshes status after 5 s', async () => {
    jest.useFakeTimers();
    api.verifyPan.mockRejectedValue(err(409, 'A check is already running - wait a moment'));
    api.getKyc.mockResolvedValue(kycOf());
    const {tree} = mount(KycPan);
    await type(tree, 0, 'ABCPV1234D');
    await press(tree, 'Verify PAN');
    expect(texts(tree)).toContain('A check is already running');
    expect(api.getKyc).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(5000));
    expect(api.getKyc).toHaveBeenCalled();
  });

  it('503: KYC switched off, leaves the screen', async () => {
    api.verifyPan.mockRejectedValue(err(503, 'KYC is switched off'));
    api.getKyc.mockResolvedValue(kycOf({available: false}));
    const {tree, nav} = mount(KycPan);
    await type(tree, 0, 'ABCPV1234D');
    await press(tree, 'Verify PAN');
    expect(nav.goBack).toHaveBeenCalled();
  });

  it('no answer (offline / timeout): says so and re-checks status instead of pushing a paid retry', async () => {
    jest.useFakeTimers();
    api.verifyPan.mockRejectedValue(err(0, 'No internet connection. Check your network and try again.'));
    api.getKyc.mockResolvedValue(kycOf());
    const {tree} = mount(KycPan);
    await type(tree, 0, 'ABCPV1234D');
    await press(tree, 'Verify PAN');
    expect(texts(tree)).toContain('No internet connection');
    await act(async () => jest.advanceTimersByTime(3000));
    expect(api.getKyc).toHaveBeenCalled();
  });
});

// ---------- Bank ----------
describe('Bank', () => {
  const fill = async (tree, a, b, ifsc) => {
    await type(tree, 0, a);
    await type(tree, 1, b);
    await type(tree, 2, ifsc);
  };

  it.each([
    ['mismatched numbers', '026291800001191', '026291800001190', 'YESB0000262', 'Account numbers don’t match'],
    ['5th IFSC character not zero', '026291800001191', '026291800001191', 'YESB1000262', 'The 5th character is always 0 (zero)'],
    ['IFSC starts with digits', '026291800001191', '026291800001191', '1ESB0000262', 'The first 4 characters are letters'],
    ['IFSC too short', '026291800001191', '026291800001191', 'YESB00002', null],
    ['account too short', '12345', '12345', 'YESB0000262', null],
  ])('%s: blocked before any call', async (_, a, b, ifsc, msg) => {
    const {tree} = mount(KycBank);
    await fill(tree, a, b, ifsc);
    if (msg) {
      expect(texts(tree)).toContain(msg);
    }
    expect(button(tree, 'Verify bank account').props.disabled).toBe(true);
    await press(tree, 'Verify bank account');
    expect(api.verifyBank).not.toHaveBeenCalled();
  });

  it('keeps leading zeros and sends one check on a double tap', async () => {
    let resolve;
    api.verifyBank.mockReturnValue(new Promise(r => (resolve = r)));
    const {tree} = mount(KycBank);
    await fill(tree, '026291800001191', '026291800001191', 'yesb0000262');
    const b = button(tree, 'Verify bank account');
    await act(async () => {
      b.props.onPress();
      b.props.onPress();
    });
    expect(api.verifyBank).toHaveBeenCalledTimes(1);
    expect(api.verifyBank).toHaveBeenCalledWith('026291800001191', 'YESB0000262');
    await act(async () =>
      resolve({check: {status: 'passed'}, kyc: kycOf({status: 'in_progress', nextStep: 'aadhaar', identity: {bank: {accountMasked: 'XXXXXX1191', bankName: 'YES BANK'}}})}),
    );
    expect(texts(tree)).toContain('XXXXXX1191 · YES BANK');
  });

  it('server says failed: shows its message and keeps the values', async () => {
    api.verifyBank.mockResolvedValue({check: {status: 'failed', message: 'Account number is not valid for this IFSC'}, kyc: kycOf()});
    const {tree} = mount(KycBank);
    await fill(tree, '026291800001190', '026291800001190', 'YESB0000262');
    await press(tree, 'Verify bank account');
    expect(texts(tree)).toContain('Account number is not valid for this IFSC');
    expect(inputs(tree)[0].props.value).toBe('026291800001190');
    expect(inputs(tree)[2].props.value).toBe('YESB0000262');
  });

  it('needs_review (e.g. NRE account or name mismatch): received', async () => {
    api.verifyBank.mockResolvedValue({check: {status: 'needs_review'}, kyc: kycOf({status: 'pending_review', canRunChecks: false})});
    const {tree, nav} = mount(KycBank);
    await fill(tree, '026291800001191', '026291800001191', 'YESB0000262');
    await press(tree, 'Verify bank account');
    expect(texts(tree)).toContain('Bank account received');
    await press(tree, 'Finish');
    expect(nav.replace).toHaveBeenCalledWith('KycResult');
  });

  it('the re-enter field can’t be pasted into', () => {
    const {tree} = mount(KycBank);
    expect(inputs(tree)[1].props.contextMenuHidden).toBe(true);
  });
});

// ---------- Aadhaar / DigiLocker ----------
describe('Aadhaar', () => {
  const session = {url: 'https://digilocker.gov.in/x', verificationId: 'v1', expiresAt: null};
  const openSheet = async tree => {
    await press(tree, 'Continue with DigiLocker');
    return tree.root.findByType('WebView');
  };

  it('DigiLocker failed to start (502): shows why and offers Try again', async () => {
    api.startDigilocker.mockRejectedValue(err(502, 'DigiLocker could not be started. Please try again.'));
    const {tree} = mount(KycAadhaar);
    await press(tree, 'Continue with DigiLocker');
    expect(texts(tree)).toContain('DigiLocker could not be started');
    expect(buttons(tree, 'Try again with DigiLocker')).toHaveLength(1);
  });

  it('only web links load in the sheet; app links (intent://) are ignored', async () => {
    api.startDigilocker.mockResolvedValue(session);
    const {tree} = mount(KycAadhaar);
    const web = await openSheet(tree);
    const go = url => web.props.onShouldStartLoadWithRequest({url});
    expect(go('https://digilocker.meripehchaan.gov.in/signin')).toBe(true);
    expect(go('intent://digilocker#Intent;scheme=dl;end')).toBe(false);
    expect(go('market://details?id=com.digilocker.android')).toBe(false);
  });

  it('the return URL closes the sheet and syncs once, even if both callbacks fire', async () => {
    api.startDigilocker.mockResolvedValue(session);
    api.syncDigilocker.mockResolvedValue({pending: false, check: {status: 'passed'}, kyc: kycOf({status: 'in_progress', nextStep: 'bank', identity: {aadhaarLast4: '7302'}})});
    const {tree, nav} = mount(KycAadhaar);
    const web = await openSheet(tree);
    await act(async () => {
      expect(web.props.onShouldStartLoadWithRequest({url: RETURN})).toBe(false);
      web.props.onNavigationStateChange({url: RETURN, canGoBack: true});
    });
    expect(api.syncDigilocker).toHaveBeenCalledTimes(1);
    expect(api.syncDigilocker).toHaveBeenCalledWith('v1');
    expect(texts(tree)).toContain('•••• 7302');
    await press(tree, 'Continue to bank account');
    expect(nav.replace).toHaveBeenCalledWith('KycBank');
  });

  it('no Aadhaar on that DigiLocker account: back to the intro with the reason', async () => {
    api.startDigilocker.mockResolvedValue(session);
    api.syncDigilocker.mockResolvedValue({pending: false, check: {status: 'failed', message: 'No Aadhaar is linked to this DigiLocker account'}, kyc: kycOf()});
    const {tree} = mount(KycAadhaar);
    const web = await openSheet(tree);
    await act(async () => web.props.onShouldStartLoadWithRequest({url: RETURN}));
    expect(texts(tree)).toContain('No Aadhaar is linked to this DigiLocker account');
    expect(buttons(tree, 'Try again with DigiLocker')).toHaveLength(1);
  });

  it('still pending after 6 tries (~15 s): "Still checking", back to overview', async () => {
    jest.useFakeTimers();
    api.startDigilocker.mockResolvedValue(session);
    api.syncDigilocker.mockResolvedValue({pending: true, check: {status: 'started'}, kyc: kycOf({status: 'in_progress', steps: [step('pan'), step('aadhaar', 'started'), step('bank')]})});
    const {tree, nav} = mount(KycAadhaar);
    const web = await openSheet(tree);
    await act(async () => web.props.onShouldStartLoadWithRequest({url: RETURN}));
    expect(texts(tree)).toContain('Checking your Aadhaar…');
    for (let i = 0; i < 6; i++) {
      await act(async () => jest.advanceTimersByTime(3000));
    }
    expect(api.syncDigilocker).toHaveBeenCalledTimes(6);
    expect(texts(tree)).toContain('Still checking');
    await press(tree, 'Back to overview');
    expect(nav.goBack).toHaveBeenCalled();
  });

  it('closing the sheet (✕ or Android back on the first page) returns to the intro and refreshes', async () => {
    api.startDigilocker.mockResolvedValue(session);
    api.getKyc.mockResolvedValue(kycOf());
    const {tree} = mount(KycAadhaar);
    await openSheet(tree);
    const modal = tree.root.find(n => n.props.onRequestClose);
    expect(modal.props.visible).toBe(true);
    await act(async () => modal.props.onRequestClose());
    expect(tree.root.find(n => n.props.onRequestClose).props.visible).toBe(false);
    expect(api.getKyc).toHaveBeenCalled();
    expect(api.syncDigilocker).not.toHaveBeenCalled();
  });

  it('a step that failed earlier shows its reason before they start', async () => {
    const {tree} = mount(KycAadhaar);
    act(() => setKyc(kycOf({status: 'in_progress', steps: [step('pan'), step('aadhaar', 'expired', 'Session expired. Please try again.'), step('bank')]})));
    expect(texts(tree)).toContain('Session expired. Please try again.');
    expect(buttons(tree, 'Try again with DigiLocker')).toHaveLength(1);
  });

  it('429 on start locks the step', async () => {
    api.startDigilocker.mockRejectedValue(err(429, 'Too many attempts today - please try again tomorrow'));
    const {tree} = mount(KycAadhaar);
    await press(tree, 'Continue with DigiLocker');
    expect(texts(tree)).toContain('Too many attempts today');
    expect(button(tree, 'DigiLocker').props.disabled).toBe(true);
  });
});

// ---------- Result ----------
describe('Result', () => {
  it('rejected: reason, Contact us, and no summary of numbers', async () => {
    api.getKyc.mockReturnValue(new Promise(() => {})); // focus refresh stays pending
    const {tree} = mount(KycResult);
    act(() => setKyc(kycOf({status: 'rejected', rejectionReason: 'PAN name differs from Aadhaar.', identity: {panMasked: 'XXXXXX234D'}})));
    const t = texts(tree);
    expect(t).toContain('PAN name differs from Aadhaar.');
    expect(t).not.toContain('XXXXXX234D');
    expect(buttons(tree, 'Contact us')).toHaveLength(1);
  });
});
