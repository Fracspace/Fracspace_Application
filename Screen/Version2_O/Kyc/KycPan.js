// Step: PAN. One field, one button. The name comes back from Income Tax.
// The PAN lives only in this screen's state; it's never stored or logged.
import React, {useRef, useState} from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View} from 'react-native';
import {verifyPan} from './api';
import {C} from './theme';
import {checkError, isStepLocked, nextRoute, setKyc, stepNumber, useKyc} from './store';
import {Field, Footer, Header, Note, PrimaryButton, StepDone, StatusBg} from './ui';
import {continueLabel} from './labels';

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// Points at the first character in the wrong place, as they type.
function panIssue(v) {
  for (let i = 0; i < v.length; i++) {
    const ch = v[i];
    const wantDigit = i >= 5 && i <= 8;
    if (wantDigit && !/[0-9]/.test(ch)) {
      return 'Characters 6 to 9 are numbers';
    }
    if (!wantDigit && !/[A-Z]/.test(ch)) {
      return i < 5 ? 'The first 5 characters are letters' : 'The last character is a letter';
    }
  }
  return null;
}

export default function KycPan({navigation}) {
  const {kyc} = useKyc({refreshOnFocus: false});
  const [pan, setPan] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false); // a double tap must not send two paid checks
  const [fieldError, setFieldError] = useState(null);
  const [note, setNote] = useState(null);
  const [result, setResult] = useState(null); // {status, kyc}
  const [locked, setLocked] = useState(isStepLocked('pan'));

  const {index, total} = stepNumber(kyc, 'pan');
  const issue = panIssue(pan);
  const valid = PAN_RE.test(pan);

  const onChange = t => {
    setPan(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10));
    setFieldError(null);
    setNote(null);
  };

  const submit = async () => {
    if (!valid || inFlight.current || locked) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setFieldError(null);
    setNote(null);
    try {
      const data = await verifyPan(pan);
      setKyc(data.kyc);
      const st = data.check?.status;
      if (st === 'passed' || st === 'needs_review') {
        setPan('');
        setResult({status: st, kyc: data.kyc});
      } else {
        setFieldError(data.check?.message || 'PAN could not be verified. Please check the number and try again.');
      }
    } catch (e) {
      const r = checkError(e, 'pan');
      r.field ? setFieldError(r.field) : setNote(r.note);
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

  const goNext = () => {
    const to = nextRoute(result?.kyc);
    to ? navigation.replace(to) : navigation.goBack();
  };

  if (result) {
    const review = result.status === 'needs_review';
    const name = result.kyc?.identity?.name;
    return (
      <View style={st.screen}>
        <Header onBack={() => navigation.goBack()} step={total ? `Step ${index} of ${total}` : null} title="" />
        <StepDone
          review={review}
          title={review ? 'PAN received' : 'PAN verified'}
          value={result.kyc?.identity?.panMasked}
          detail={review ? 'Our team will check this one. You can carry on.' : name ? `Name on PAN: ${name}` : null}
          continueLabel={continueLabel(result.kyc)}
          onContinue={goNext}
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
          title="Your PAN"
          subtitle="The 10-character number printed on your PAN card."
        />
        <View style={st.body}>
          <Field
            label="PAN"
            value={pan}
            onChangeText={onChange}
            placeholder="ABCDE1234F"
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            importantForAutofill="no"
            keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
            maxLength={10}
            returnKeyType="done"
            onSubmitEditing={submit}
            editable={!busy && !locked}
            autoFocus
            inputStyle={st.panInput}
            error={fieldError || (pan.length > 0 ? issue : null)}
            hint="5 letters, 4 numbers, 1 letter"
            valid={valid}
          />
          {locked ? (
            <Note icon="lock" tone="error">
              Too many attempts today. Please try again tomorrow.
            </Note>
          ) : note ? (
            <Note icon="alert-circle" tone="error">
              {note}
            </Note>
          ) : (
            <Note icon="info">
              We check this with Income Tax records. Your name comes from there, so you don’t need to type it.
            </Note>
          )}
          {fieldError ? <Note style={st.tries}>You can try 5 times a day.</Note> : null}
        </View>
      </ScrollView>
      <StatusBg />
      <Footer>
        <PrimaryButton
          title="Verify PAN"
          onPress={submit}
          disabled={!valid || locked}
          loading={busy}
          loadingText="Checking with Income Tax records…"
        />
      </Footer>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  screen: {flex: 1, backgroundColor: C.white},
  scroll: {flexGrow: 1},
  body: {paddingHorizontal: 20, paddingTop: 4},
  panInput: {fontSize: 18, letterSpacing: 2},
  tries: {marginTop: 10},
});
