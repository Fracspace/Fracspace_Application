// Step: Aadhaar through DigiLocker. Our screen before, DigiLocker's own pages
// in a full-height WebView sheet, and our "Checking…" screen after.
import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';
import Icon from 'react-native-vector-icons/Feather';
import {DIGILOCKER_RETURN, USE_MOCK, setMockDigilockerOutcome, startDigilocker, syncDigilocker} from './api';
import {C, F} from './theme';
import {checkError, isStepLocked, nextRoute, refreshKyc, setKyc, stepNumber, useKyc} from './store';
import {Footer, Header, Note, PrimaryButton, StepDone, StatusBg} from './ui';
import {continueLabel} from './labels';

const SYNC_TRIES = 6;
const SYNC_GAP = 3000;

const STEPS = [
  ['Enter your Aadhaar number', 'Inside DigiLocker, the Government’s secure app'],
  ['Enter the OTP', 'Sent to the mobile number linked to your Aadhaar'],
  ['Tap Allow', 'To share your Aadhaar details with Fracspace'],
];

const hostOf = url => {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url || '');
  return m ? m[1] : 'digilocker.gov.in';
};

export default function KycAadhaar({navigation}) {
  const {kyc} = useKyc({refreshOnFocus: false});
  const step = kyc?.steps?.find(x => x.type === 'aadhaar');
  const {index, total} = stepNumber(kyc, 'aadhaar');

  const [phase, setPhase] = useState('intro'); // intro | sheet | checking | done | pending
  const [session, setSession] = useState(null);
  const [starting, setStarting] = useState(false);
  const [note, setNote] = useState(null);
  const [pageUrl, setPageUrl] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [locked, setLocked] = useState(isStepLocked('aadhaar'));
  const web = useRef(null);
  const canGoBack = useRef(false);
  const returned = useRef(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  // The step failed earlier (e.g. no Aadhaar on that DigiLocker account).
  const earlier = step?.status === 'failed' || step?.status === 'expired' || step?.status === 'error' ? step.message : null;

  const start = async () => {
    setStarting(true);
    setNote(null);
    try {
      const data = await startDigilocker();
      returned.current = false;
      setSession(data);
      setPageUrl(data.url || '');
      setPageLoading(true);
      setPhase('sheet');
    } catch (e) {
      const r = checkError(e, 'aadhaar');
      setNote(r.field || r.note);
      if (r.locked) {
        setLocked(true);
      }
      if (r.off) {
        navigation.goBack();
      }
    } finally {
      setStarting(false);
    }
  };

  const sync = async (verificationId, tries = 0) => {
    try {
      const data = await syncDigilocker(verificationId);
      if (!alive.current) {
        return;
      }
      if (data.pending && tries < SYNC_TRIES - 1) {
        setTimeout(() => alive.current && sync(verificationId, tries + 1), SYNC_GAP);
        return;
      }
      setKyc(data.kyc);
      const st = data.check?.status;
      if (data.pending) {
        setPhase('pending');
      } else if (st === 'passed' || st === 'needs_review') {
        setResult({status: st, kyc: data.kyc});
        setPhase('done');
      } else {
        setNote(data.check?.message || 'We couldn’t get your Aadhaar from DigiLocker. Please try again.');
        setPhase('intro');
      }
    } catch (e) {
      if (!alive.current) {
        return;
      }
      setNote(checkError(e, 'aadhaar').note);
      setPhase('intro');
    }
  };

  // DigiLocker finished (or the user cancelled there): close and check.
  const onReturn = url => {
    if (returned.current) {
      return;
    }
    returned.current = true;
    if (USE_MOCK) {
      const m = /[?&]mock=(\w+)/.exec(url);
      setMockDigilockerOutcome(m ? m[1] : null);
    }
    setPhase('checking');
    sync(session.verificationId);
  };

  const closeSheet = () => {
    setPhase('intro');
    refreshKyc(); // the row may now show "started"
  };

  const onAndroidBack = () => {
    if (canGoBack.current) {
      web.current?.goBack();
    } else {
      closeSheet();
    }
  };

  if (phase === 'done' && result) {
    const review = result.status === 'needs_review';
    return (
      <View style={st.screen}>
        <Header onBack={() => navigation.goBack()} step={total ? `Step ${index} of ${total}` : null} title="" />
        <StepDone
          review={review}
          title={review ? 'Aadhaar received' : 'Aadhaar verified'}
          value={result.kyc?.identity?.aadhaarLast4 ? `•••• ${result.kyc.identity.aadhaarLast4}` : null}
          detail={review ? 'Our team will check this one. You can carry on.' : 'Your name, date of birth and address came from DigiLocker.'}
          continueLabel={continueLabel(result.kyc)}
          onContinue={() => {
            const to = nextRoute(result.kyc);
            to ? navigation.replace(to) : navigation.goBack();
          }}
        />
      </View>
    );
  }

  if (phase === 'checking' || phase === 'pending') {
    const pending = phase === 'pending';
    return (
      <SafeAreaView style={[st.screen, st.centerAll]}>
        {pending ? (
          <View style={st.pendingBadge}>
            <Icon name="clock" size={30} color={C.navy} />
          </View>
        ) : (
          <ActivityIndicator size="large" color={C.navy} />
        )}
        <Text style={st.checkTitle}>{pending ? 'Still checking' : 'Checking your Aadhaar…'}</Text>
        <Text style={st.checkSub}>
          {pending
            ? 'DigiLocker is taking a little longer. We’ll update this shortly. You can carry on with the other steps.'
            : 'This takes a few seconds. Please keep the app open.'}
        </Text>
        {pending ? <PrimaryButton title="Back to overview" onPress={() => navigation.goBack()} style={st.checkBtn} /> : null}
      </SafeAreaView>
    );
  }

  return (
    <View style={st.screen}>
      <ScrollView contentContainerStyle={st.scroll}>
        <Header
          onBack={() => navigation.goBack()}
          step={total ? `Step ${index} of ${total}` : null}
          title="Aadhaar via DigiLocker"
          subtitle="The Government’s DigiLocker shares your Aadhaar with us securely. No photo or PDF upload."
        />
        <View style={st.body}>
          {locked ? (
            <Note icon="lock" tone="error" style={st.gap}>
              Too many attempts today. Please try again tomorrow.
            </Note>
          ) : note || earlier ? (
            <Note icon="alert-circle" tone="error" style={st.gap}>
              {note || earlier}
            </Note>
          ) : null}

          <View style={st.steps}>
            {STEPS.map(([title, sub], i) => (
              <View key={title} style={st.stepRow}>
                <View style={st.stepRail}>
                  <View style={st.stepDot}>
                    <Text style={st.stepNum}>{i + 1}</Text>
                  </View>
                  {i < STEPS.length - 1 ? <View style={st.stepLine} /> : null}
                </View>
                <View style={st.stepBody}>
                  <Text style={st.stepTitle}>{title}</Text>
                  <Text style={st.stepSub}>{sub}</Text>
                </View>
              </View>
            ))}
          </View>

          <Note icon="smartphone" tone="warn" style={st.gap}>
            The OTP goes to the mobile number linked to your Aadhaar, which may not be the number you use today. Keep that
            phone handy.
          </Note>
          <Note icon="lock">We keep only the last 4 digits of your Aadhaar, with your name, date of birth and address.</Note>
        </View>
      </ScrollView>
      <StatusBg />
      <Footer>
        <PrimaryButton
          title={note || earlier ? 'Try again with DigiLocker' : 'Continue with DigiLocker'}
          onPress={start}
          loading={starting}
          loadingText="Opening DigiLocker…"
          disabled={locked}
        />
      </Footer>

      <Modal visible={phase === 'sheet'} animationType="slide" onRequestClose={onAndroidBack} presentationStyle="fullScreen">
        <SafeAreaView style={st.sheet} edges={['top', 'bottom']}>
          <View style={st.sheetBar}>
            <Pressable onPress={closeSheet} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close DigiLocker">
              <Icon name="x" size={22} color={C.ink} />
            </Pressable>
            <View style={st.urlPill}>
              <Icon name="lock" size={12} color={C.success} />
              <Text style={st.urlText} numberOfLines={1}>
                {USE_MOCK ? 'digilocker.gov.in (mock)' : hostOf(pageUrl)}
              </Text>
            </View>
            <View style={st.sheetSpin}>{pageLoading ? <ActivityIndicator size="small" color={C.navy} /> : null}</View>
          </View>
          {session ? (
            <WebView
              ref={web}
              source={session.url ? {uri: session.url} : {html: session.mockHtml}}
              originWhitelist={['*']}
              onShouldStartLoadWithRequest={req => {
                if (req.url.startsWith(DIGILOCKER_RETURN)) {
                  onReturn(req.url);
                  return false; // don't load our web page inside the app
                }
                return true;
              }}
              onNavigationStateChange={nav => {
                canGoBack.current = nav.canGoBack;
                if (nav.url?.startsWith(DIGILOCKER_RETURN)) {
                  onReturn(nav.url); // backup for redirects some Android versions don't offer above
                } else if (nav.url && !nav.url.startsWith('about:')) {
                  setPageUrl(nav.url);
                }
              }}
              onLoadStart={() => setPageLoading(true)}
              onLoadEnd={() => setPageLoading(false)}
              startInLoadingState
              renderLoading={() => (
                <View style={st.webLoading}>
                  <ActivityIndicator color={C.navy} />
                </View>
              )}
              incognito
              javaScriptEnabled
              domStorageEnabled
              setSupportMultipleWindows={false}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  screen: {flex: 1, backgroundColor: C.white},
  scroll: {flexGrow: 1, paddingBottom: 16},
  body: {paddingHorizontal: 20},
  gap: {marginBottom: 12},
  steps: {borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 16, paddingTop: 16, marginBottom: 16},
  stepRow: {flexDirection: 'row'},
  stepRail: {alignItems: 'center', width: 28},
  stepDot: {width: 26, height: 26, borderRadius: 13, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center'},
  stepNum: {fontFamily: F.bodySemi, fontSize: 13, color: C.white},
  stepLine: {flex: 1, width: 1.5, backgroundColor: C.line, marginVertical: 4},
  stepBody: {flex: 1, marginLeft: 12, paddingBottom: 18},
  stepTitle: {fontFamily: F.bodySemi, fontSize: 15, color: C.ink, marginTop: 3},
  stepSub: {fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 3, lineHeight: 18},
  centerAll: {alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32},
  pendingBadge: {width: 72, height: 72, borderRadius: 36, backgroundColor: C.navyTint, alignItems: 'center', justifyContent: 'center'},
  checkTitle: {fontFamily: F.head, fontSize: 18, color: C.ink, marginTop: 20, textAlign: 'center'},
  checkSub: {fontFamily: F.body, fontSize: 14, color: C.muted, marginTop: 8, textAlign: 'center', lineHeight: 20},
  checkBtn: {alignSelf: 'stretch', marginTop: 28},
  sheet: {flex: 1, backgroundColor: C.white},
  sheetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  urlPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F7',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 14,
  },
  urlText: {fontFamily: F.bodyMed, fontSize: 12.5, color: C.body, marginLeft: 6, flexShrink: 1},
  sheetSpin: {width: 22, alignItems: 'flex-end'},
  webLoading: {...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white},
});
