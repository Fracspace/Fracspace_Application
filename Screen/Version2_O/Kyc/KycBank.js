// Step: bank account. Account number twice plus IFSC, then a ₹1 check. No
// name field: the bank returns the holder's name and the server compares it.
// These values live only in this screen's state; never stored or logged.
import React, {useRef, useState} from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View} from 'react-native';
import {verifyBank} from './api';
import {C} from './theme';
import {checkError, isStepLocked, nextRoute, setKyc, stepNumber, useKyc} from './store';
import {Field, Footer, Header, Note, PrimaryButton, StepDone, StatusBg} from './ui';
import {continueLabel} from './labels';

const ACC_RE = /^[A-Z0-9]{6,40}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const clean = t => t.toUpperCase().replace(/[^A-Z0-9]/g, '');

function ifscIssue(v) {
  if (/[^A-Z]/.test(v.slice(0, 4))) {
    return 'The first 4 characters are letters (the bank code)';
  }
  if (v.length >= 5 && v[4] !== '0') {
    return 'The 5th character is always 0 (zero)';
  }
  if (v.length === 11 && !IFSC_RE.test(v)) {
    return 'IFSC is not valid';
  }
  return null;
}

export default function KycBank({navigation}) {
  const {kyc} = useKyc({refreshOnFocus: false});
  const {index, total} = stepNumber(kyc, 'bank');
  const [acc, setAcc] = useState('');
  const [acc2, setAcc2] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accFocused, setAccFocused] = useState(false);
  const [acc2Touched, setAcc2Touched] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false); // a double tap must not send two paid checks
  const [note, setNote] = useState(null);
  const [result, setResult] = useState(null);
  const [locked, setLocked] = useState(isStepLocked('bank'));
  const acc2Ref = useRef(null);
  const ifscRef = useRef(null);

  const accValid = ACC_RE.test(acc);
  const accShort = acc.length > 0 && acc.length < 6 && !accFocused;
  const mismatch = acc2.length > 0 && (acc2Touched || acc2.length >= acc.length) && acc2 !== acc;
  const matches = accValid && acc2 === acc;
  const ifscValid = IFSC_RE.test(ifsc);
  const ready = matches && ifscValid && !locked;

  const reset = () => {
    setNote(null);
  };

  const submit = async () => {
    if (!ready || inFlight.current) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    reset();
    try {
      const data = await verifyBank(acc, ifsc);
      setKyc(data.kyc);
      const st = data.check?.status;
      if (st === 'passed' || st === 'needs_review') {
        setAcc('');
        setAcc2('');
        setIfsc('');
        setResult({status: st, kyc: data.kyc});
      } else {
        setNote(data.check?.message || 'We couldn’t verify this account. Please check the details and try again.');
      }
    } catch (e) {
      const r = checkError(e, 'bank');
      setNote(r.field || r.note);
      if (r.locked) {
        setLocked(true);
      }
      if (r.off) {
        navigation.goBack();
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (result) {
    const review = result.status === 'needs_review';
    const b = result.kyc?.identity?.bank;
    return (
      <View style={st.screen}>
        <Header onBack={() => navigation.goBack()} step={total ? `Step ${index} of ${total}` : null} title="" />
        <StepDone
          review={review}
          title={review ? 'Bank account received' : 'Bank account verified'}
          value={b ? [b.accountMasked, b.bankName].filter(Boolean).join(' · ') : null}
          detail={review ? 'Our team will check this one.' : 'Your payouts will go to this account.'}
          continueLabel={continueLabel(result.kyc)}
          onContinue={() => {
            const to = nextRoute(result.kyc);
            to ? navigation.replace(to) : navigation.goBack();
          }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={st.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={st.scroll}>
        <Header
          onBack={() => navigation.goBack()}
          step={total ? `Step ${index} of ${total}` : null}
          title="Your bank account"
          subtitle="Payouts go here. The account must be in your own name."
        />
        <View style={st.body}>
          {locked ? (
            <Note icon="lock" tone="error" style={st.gap}>
              Too many attempts today. Please try again tomorrow.
            </Note>
          ) : note ? (
            <Note icon="alert-circle" tone="error" style={st.gap}>
              {note}
            </Note>
          ) : null}

          <Field
            label="Account number"
            value={acc}
            onChangeText={t => {
              setAcc(clean(t).slice(0, 40));
              reset();
            }}
            onFocus={() => setAccFocused(true)}
            onBlur={() => setAccFocused(false)}
            secureTextEntry={!accFocused && acc.length > 0}
            placeholder="Enter account number"
            keyboardType="number-pad"
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
            textContentType="none"
            returnKeyType="next"
            onSubmitEditing={() => acc2Ref.current?.focus()}
            editable={!busy && !locked}
            maxLength={40}
            error={accShort ? 'Account number looks too short' : null}
            hint="Usually 9 to 18 digits"
          />
          <Field
            ref={acc2Ref}
            label="Re-enter account number"
            value={acc2}
            onChangeText={t => {
              setAcc2(clean(t).slice(0, 40));
              reset();
            }}
            onBlur={() => setAcc2Touched(true)}
            placeholder="Enter it again"
            keyboardType="number-pad"
            contextMenuHidden // type it again rather than paste
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
            textContentType="none"
            returnKeyType="next"
            onSubmitEditing={() => ifscRef.current?.focus()}
            editable={!busy && !locked}
            maxLength={40}
            error={mismatch ? 'Account numbers don’t match' : null}
            valid={matches}
          />
          <Field
            ref={ifscRef}
            label="IFSC"
            value={ifsc}
            onChangeText={t => {
              setIfsc(clean(t).slice(0, 11));
              reset();
            }}
            placeholder="e.g. HDFC0001234"
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            importantForAutofill="no"
            keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
            maxLength={11}
            returnKeyType="done"
            onSubmitEditing={submit}
            editable={!busy && !locked}
            inputStyle={st.ifsc}
            error={ifsc.length ? ifscIssue(ifsc) : null}
            hint="11 characters, printed on your cheque book or passbook"
            valid={ifscValid}
          />
          <Note icon="send">We send ₹1 to this account to confirm it’s yours.</Note>
        </View>
      </ScrollView>
      <StatusBg />
      <Footer>
        <PrimaryButton
          title="Verify bank account"
          onPress={submit}
          disabled={!ready}
          loading={busy}
          loadingText="Sending ₹1 to your account…"
        />
      </Footer>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  screen: {flex: 1, backgroundColor: C.white},
  scroll: {flexGrow: 1, paddingBottom: 16},
  body: {paddingHorizontal: 20, paddingTop: 4},
  gap: {marginBottom: 16},
  ifsc: {letterSpacing: 1.5},
});
