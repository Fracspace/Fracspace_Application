// Walks the e-KYC screens through the mock backend (KYC_MOCK in Kyc/api.js):
// overview → PAN → bank → Aadhaar (DigiLocker sheet) → result.
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
  return {
    useNavigation: () => global.__nav,
    useFocusEffect: cb => React.useEffect(cb, [cb]),
  };
});

import React from 'react';
import {Text, TextInput} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {AppContext} from '../Screen/Context/AppContext';
import KycOverview from '../Screen/Version2_O/Kyc/KycOverview';
import KycPan from '../Screen/Version2_O/Kyc/KycPan';
import KycBank from '../Screen/Version2_O/Kyc/KycBank';
import KycAadhaar from '../Screen/Version2_O/Kyc/KycAadhaar';
import KycResult from '../Screen/Version2_O/Kyc/KycResult';
import {KYC_MOCK} from '../Screen/Version2_O/Kyc/api';

KYC_MOCK.on = true;

jest.setTimeout(30000);
const sleep = ms => act(() => new Promise(r => setTimeout(r, ms)));
const mounted = [];
afterEach(() => act(() => mounted.splice(0).forEach(t => t.unmount())));
const makeNav = () => ({navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn(), popToTop: jest.fn()});

function mount(Screen) {
  const nav = makeNav();
  global.__nav = nav;
  const ctx = {globalState: {userName: 'Ananya', userDetails: {email: 'a@b.c'}}, setGlobalState: jest.fn()};
  let tree;
  act(() => {
    tree = renderer.create(
      <AppContext.Provider value={ctx}>
        <Screen navigation={nav} />
      </AppContext.Provider>,
    );
  });
  mounted.push(tree);
  return {tree, nav};
}
const texts = tree =>
  tree.root
    .findAllByType(Text)
    .map(t => [].concat(t.props.children).filter(c => typeof c === 'string' || typeof c === 'number').join(''))
    .join(' | ');
const press = (tree, label) => {
  const btn = tree.root.find(n => n.props.onPress && n.props.accessibilityRole === 'button' && texts({root: n}).includes(label));
  return act(async () => btn.props.onPress());
};
const type = (tree, i, value) => act(() => tree.root.findAllByType(TextInput)[i].props.onChangeText(value));

it('overview starts at 0 of 3 with PAN next', async () => {
  const {tree} = mount(KycOverview);
  await sleep(700);
  const t = texts(tree);
  expect(t).toContain('Verify Your Profile');
  expect(t).toContain('0 of 3 done');
  expect(t).toContain('Next');
  expect(t).toContain('Verify PAN');
  expect(t).toContain('Profile photo');
});

it('PAN: flags a wrong character, then verifies', async () => {
  const {tree, nav} = mount(KycPan);
  await type(tree, 0, 'abc12');
  expect(texts(tree)).toContain('The first 5 characters are letters');
  await type(tree, 0, 'abcde 1234 f');
  expect(tree.root.findByType(TextInput).props.value).toBe('ABCDE1234F');
  await press(tree, 'Verify PAN');
  await sleep(2000);
  const t = texts(tree);
  expect(t).toContain('PAN verified');
  expect(t).toContain('XXXXXX234F');
  await press(tree, 'Continue to Aadhaar');
  expect(nav.replace).toHaveBeenCalledWith('KycAadhaar');
});

it('Bank: catches a mismatch and a bad IFSC, then verifies', async () => {
  const {tree, nav} = mount(KycBank);
  await type(tree, 0, '50100001191');
  await type(tree, 1, '50100001192');
  expect(texts(tree)).toContain('Account numbers don’t match');
  await type(tree, 1, '50100001191');
  await type(tree, 2, 'yesb1000123');
  expect(texts(tree)).toContain('The 5th character is always 0 (zero)');
  await type(tree, 2, 'yesb0000123');
  await press(tree, 'Verify bank account');
  await sleep(2400);
  expect(texts(tree)).toContain('Bank account verified');
  expect(texts(tree)).toContain('XXXXXX1191 · YES BANK');
  await press(tree, 'Continue to Aadhaar');
  expect(nav.replace).toHaveBeenCalledWith('KycAadhaar');
});

it('Aadhaar: DigiLocker return closes the sheet, checks, then finishes', async () => {
  const {tree, nav} = mount(KycAadhaar);
  expect(texts(tree)).toContain('Aadhaar via DigiLocker');
  await press(tree, 'Continue with DigiLocker');
  await sleep(800);
  const web = tree.root.findByType('WebView');
  let allowed;
  act(() => {
    allowed = web.props.onShouldStartLoadWithRequest({url: 'https://portal.fracspace.com/kyc/return?verification_id=x&mock=allow'});
  });
  expect(allowed).toBe(false);
  expect(texts(tree)).toContain('Checking your Aadhaar…');
  await sleep(1700);
  expect(texts(tree)).toContain('Aadhaar verified');
  expect(texts(tree)).toContain('•••• 7302');
  await press(tree, 'Finish');
  expect(nav.replace).toHaveBeenCalledWith('KycResult');
});

it('Result shows verified with the masked summary', async () => {
  const {tree} = mount(KycResult);
  const t = texts(tree);
  expect(t).toContain('Your profile is verified');
  expect(t).toContain('Thank you, Ananya.');
  expect(t).toContain('XXXXXX234F');
  expect(t).toContain('One last thing');
});
