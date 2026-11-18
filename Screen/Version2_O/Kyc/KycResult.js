// Result: verified · under review · not approved. Driven by kyc.status.
// ResultPanel is also what the overview shows once the checks are finished.
import React, {useContext, useEffect, useRef} from 'react';
import {Animated, Linking, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {AppContext} from '../../Context/AppContext';
import {C, F, SUPPORT_EMAIL} from './theme';
import {useKyc} from './store';
import {Footer, PrimaryButton, TextButton} from './ui';
import PhotoRow, {ownPhoto} from './PhotoRow';

const firstName = n => {
  const w = (n || '').trim().split(/\s+/)[0];
  return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '';
};

const VIEW = {
  verified: {icon: 'check', fg: C.success, bg: C.successTint, title: 'Your profile is verified'},
  pending_review: {icon: 'clock', fg: C.navy, bg: C.navyTint, title: 'Thanks! We’re reviewing'},
  rejected: {icon: 'alert-circle', fg: C.error, bg: C.errorTint, title: 'Not approved'},
};

export function ResultPanel({kyc, userName}) {
  const v = VIEW[kyc?.status];
  const scale = useRef(new Animated.Value(kyc?.status === 'verified' ? 0.6 : 1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (kyc?.status === 'verified') {
      Animated.parallel([
        Animated.spring(scale, {toValue: 1, friction: 5, tension: 80, useNativeDriver: true}),
        Animated.sequence([
          Animated.timing(glow, {toValue: 1, duration: 450, useNativeDriver: true}),
          Animated.timing(glow, {toValue: 0, duration: 900, useNativeDriver: true}),
        ]),
      ]).start();
    }
  }, [kyc?.status, scale, glow]);

  if (!v) {
    return null;
  }
  const name = firstName(kyc?.identity?.name) || firstName(userName);
  const id = kyc?.identity || {};
  const rows = [
    id.panMasked && ['PAN', id.panMasked],
    id.aadhaarLast4 && ['Aadhaar', `•••• ${id.aadhaarLast4}`],
    id.bank && ['Bank', [id.bank.accountMasked, id.bank.bankName].filter(Boolean).join(' · ')],
  ].filter(Boolean);

  return (
    <View style={st.panel}>
      <View style={st.badgeWrap}>
        <Animated.View
          style={[st.glow, {backgroundColor: v.bg, opacity: glow, transform: [{scale: Animated.add(1, Animated.multiply(glow, 0.5))}]}]}
        />
        <Animated.View style={[st.badge, {backgroundColor: v.bg, transform: [{scale}]}]}>
          <Icon name={v.icon} size={38} color={v.fg} />
        </Animated.View>
      </View>
      <Text style={st.title}>{v.title}</Text>

      {kyc.status === 'verified' ? (
        <Text style={st.sub}>{name ? `Thank you, ${name}. ` : ''}You’re all set to invest with Fracspace.</Text>
      ) : kyc.status === 'pending_review' ? (
        <Text style={st.sub}>Our team is checking your details. We’ll let you know as soon as it’s done.</Text>
      ) : (
        <>
          {kyc.rejectionReason ? (
            <View style={st.reason}>
              <Text style={st.reasonText}>{kyc.rejectionReason}</Text>
            </View>
          ) : null}
          <Text style={st.sub}>Please contact your Fracspace relationship manager, or write to us and we’ll help.</Text>
        </>
      )}

      {kyc.status !== 'rejected' && rows.length ? (
        <View style={st.summary}>
          {rows.map(([k, val], i) => (
            <View key={k} style={[st.sumRow, i > 0 && st.sumDivider]}>
              <Text style={st.sumKey}>{k}</Text>
              <Text style={st.sumVal}>{val}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export const contactSupport = () => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Profile verification')}`).catch(() => {});

export default function KycResult({navigation}) {
  const {kyc} = useKyc();
  const {globalState} = useContext(AppContext);
  const hasPhoto = !!ownPhoto(globalState);
  const done = () => navigation.popToTop();

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <ScrollView contentContainerStyle={st.scroll}>
        <ResultPanel kyc={kyc} userName={globalState?.userName} />
        {kyc?.status !== 'rejected' && !hasPhoto ? (
          <View style={st.photo}>
            <Text style={st.photoHead}>One last thing</Text>
            <PhotoRow />
          </View>
        ) : null}
      </ScrollView>
      <Footer>
        {kyc?.status === 'rejected' ? (
          <>
            <PrimaryButton title="Contact us" onPress={contactSupport} />
            <TextButton title="Back to home" onPress={done} />
          </>
        ) : (
          <PrimaryButton title={kyc?.status === 'verified' ? 'Done' : 'Back to home'} onPress={done} />
        )}
      </Footer>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  screen: {flex: 1, backgroundColor: C.white},
  scroll: {paddingHorizontal: 20, paddingTop: 48, paddingBottom: 24},
  panel: {alignItems: 'center'},
  badgeWrap: {width: 120, height: 120, alignItems: 'center', justifyContent: 'center'},
  glow: {position: 'absolute', width: 96, height: 96, borderRadius: 48},
  badge: {width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center'},
  title: {fontFamily: F.head, fontSize: 20, color: C.ink, marginTop: 12, textAlign: 'center'},
  sub: {fontFamily: F.body, fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 21, marginTop: 10, marginHorizontal: 8},
  reason: {alignSelf: 'stretch', backgroundColor: C.errorTint, borderRadius: 10, padding: 14, marginTop: 18},
  reasonText: {fontFamily: F.bodyMed, fontSize: 14, color: '#7A1A13', lineHeight: 20, textAlign: 'center'},
  summary: {alignSelf: 'stretch', borderWidth: 1, borderColor: C.line, borderRadius: 12, marginTop: 28, paddingHorizontal: 16},
  sumRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14},
  sumDivider: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line},
  sumKey: {fontFamily: F.body, fontSize: 14, color: C.muted},
  sumVal: {fontFamily: F.bodySemi, fontSize: 14, color: C.ink, letterSpacing: 0.5},
  photo: {marginTop: 32},
  photoHead: {fontFamily: F.bodySemi, fontSize: 13, color: C.muted, marginBottom: 10},
});
