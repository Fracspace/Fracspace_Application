// Overview: the Verification tab for customers on the new e-KYC. Built
// entirely from GET /kyc/me: one row per item in steps[] (NRIs get two), then
// the profile photo row, which isn't a KYC step.
import React, {useContext} from 'react';
import {ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {AppContext} from '../../Context/AppContext';
import {C, F} from './theme';
import {ROUTES, isDone, isStepLocked, useKyc} from './store';
import {Header, Note, PrimaryButton, ProgressBar, StatusBg, TextButton} from './ui';
import StepRow from './StepRow';
import PhotoRow from './PhotoRow';
import {ResultPanel, contactSupport} from './KycResult';

const CTA = {pan: 'Verify PAN', aadhaar: 'Continue with DigiLocker', bank: 'Verify bank account'};
const RETRY = {pan: 'Try PAN again', aadhaar: 'Try again with DigiLocker', bank: 'Try bank account again'};
const ctaLabel = step =>
  (['failed', 'expired', 'error'].includes(step.status) ? RETRY : CTA)[step.type] || 'Continue';
// BottomNavi floats over this screen: a 70pt bar plus the raised centre
// buttons, about 92pt in all above the safe-area inset.
const TAB_BAR = 92;
const CTA_BAR = 74;

// Names only the sources this customer's steps use (NRIs have no Aadhaar).
const SOURCES = {pan: 'Income Tax', aadhaar: 'DigiLocker', bank: 'your bank'};
function trustLine(steps) {
  const names = steps.map(x => SOURCES[x.type]).filter(Boolean);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] || 'official records';
  const aadhaar = steps.some(x => x.type === 'aadhaar') ? ' Fracspace never stores your full Aadhaar number.' : '';
  return `Your details are checked directly with ${list}.${aadhaar}`;
}

export default function KycOverview() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {globalState} = useContext(AppContext);
  const {kyc, loading, error, refresh} = useKyc();
  const tabTop = insets.bottom + TAB_BAR;

  // First load, or it failed before we ever had data.
  if (!kyc) {
    return (
      <View style={st.screen}>
        <Header centered title="Verify Your Profile" subtitle="Checked with government and bank records" />
        <View style={st.blank}>
          {error ? (
            <>
              <Icon name="wifi-off" size={28} color={C.faint} />
              <Text style={st.blankText}>{error.message || 'Couldn’t load your verification.'}</Text>
              <PrimaryButton title="Try again" onPress={refresh} loading={loading} style={st.blankBtn} />
            </>
          ) : (
            <ActivityIndicator color={C.navy} />
          )}
        </View>
      </View>
    );
  }

  const finished = ['verified', 'pending_review', 'rejected'].includes(kyc.status);
  const steps = (kyc.steps || []).filter(x => x.required !== false);
  const passed = steps.filter(x => isDone(x.status)).length;
  const open = step => !!step && kyc.canRunChecks !== false && !isDone(step.status) && !isStepLocked(step.type);
  // The server's nextStep, unless it's locked for today: then any other open step.
  const suggested = steps.find(x => x.type === kyc.nextStep);
  const next = open(suggested) ? suggested : steps.find(open);
  const paused = kyc.canRunChecks === false && !finished;
  const go = step => navigation.navigate(ROUTES[step.type]);

  const sticky = !finished && kyc.available !== false && open(next);

  return (
    <View style={st.screen}>
      <ScrollView
        contentContainerStyle={{paddingBottom: tabTop + (sticky ? CTA_BAR : 0) + 16}}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={C.navy} />}>
        <Header
          centered
          title="Verify Your Profile"
          subtitle={finished ? null : 'One quick step to unlock investing'}
        />

        {kyc.available === false ? (
          <View style={st.body}>
            <Note icon="alert-circle" tone="warn">
              Verification isn’t available right now. Please try again later.
            </Note>
          </View>
        ) : finished ? (
          <View style={st.body}>
            <ResultPanel kyc={kyc} userName={globalState?.userName} />
            {kyc.status === 'rejected' ? (
              <PrimaryButton title="Contact us" onPress={contactSupport} style={st.cta} />
            ) : (
              <View style={st.section}>
                <Text style={st.sectionHead}>Profile</Text>
                <PhotoRow />
              </View>
            )}
          </View>
        ) : (
          <View style={st.body}>
            <View style={st.progress}>
              <View style={st.progressTop}>
                <Text style={st.progressText}>
                  {passed} of {steps.length} done
                </Text>
                <Text style={st.progressHint}>
                  <Icon name="clock" size={12} color={C.muted} /> About {Math.max(1, steps.length - passed)} min
                </Text>
              </View>
              <ProgressBar value={steps.length ? passed / steps.length : 0} />
            </View>

            {steps.map(step => (
              <StepRow
                key={step.type}
                step={step}
                identity={kyc.identity}
                isNext={step === next}
                locked={isStepLocked(step.type)}
                tappable={open(step)}
                onPress={() => go(step)}
              />
            ))}

            {paused ? (
              <Note icon="clock" tone="warn" style={st.paused}>
                A check is in progress. This page updates in a moment.
              </Note>
            ) : null}

            <View style={st.section}>
              <Text style={st.sectionHead}>Profile</Text>
              <PhotoRow />
            </View>

            <Note icon="lock" style={st.trust}>
              {trustLine(steps)}
            </Note>

            {loading ? <ActivityIndicator color={C.navy} style={st.spin} /> : null}
          </View>
        )}
        {kyc.available === false ? <TextButton title="Try again" onPress={refresh} /> : null}
      </ScrollView>
      <StatusBg />
      {sticky ? (
        <View style={[st.ctaBar, {paddingBottom: tabTop + 12}]}>
          <PrimaryButton title={ctaLabel(next)} onPress={() => go(next)} />
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  screen: {flex: 1, backgroundColor: C.white},
  body: {paddingHorizontal: 20},
  blank: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 120},
  blankText: {fontFamily: F.body, fontSize: 14, color: C.muted, textAlign: 'center', marginTop: 12, lineHeight: 20},
  blankBtn: {alignSelf: 'stretch', marginTop: 20},
  progress: {
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.lineSoft,
    padding: 14,
    marginBottom: 16,
  },
  progressTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10},
  progressText: {fontFamily: F.bodySemi, fontSize: 14, color: C.ink},
  progressHint: {fontFamily: F.body, fontSize: 12, color: C.muted},
  section: {marginTop: 12},
  sectionHead: {fontFamily: F.bodySemi, fontSize: 12, color: C.muted, letterSpacing: 0.6, marginBottom: 10, textTransform: 'uppercase'},
  trust: {marginTop: 8},
  paused: {marginBottom: 4},
  cta: {marginTop: 20},
  ctaBar: {
    // Runs to the screen's bottom edge, behind the tab bar, so no content
    // shows through the gaps around the raised centre buttons.
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: C.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.lineSoft,
  },
  spin: {marginTop: 12},
});
