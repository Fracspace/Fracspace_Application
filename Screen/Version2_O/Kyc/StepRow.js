// One row of the overview, styled from steps[i].status.
import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {C, F, LOGOS} from './theme';
import {DocTile} from './ui';

const HINTS = {
  pan: 'Just your 10-character PAN number',
  aadhaar: 'Sign in to DigiLocker and allow Fracspace to read your Aadhaar',
  bank: 'We send ₹1 to confirm the account is yours',
};
const TITLES = {pan: 'PAN', aadhaar: 'Aadhaar', bank: 'Bank account'};

/** The masked value a passed row shows, from identity. */
function maskedValue(type, identity) {
  if (type === 'pan') {
    return identity?.panMasked;
  }
  if (type === 'aadhaar') {
    return identity?.aadhaarLast4 ? `•••• ${identity.aadhaarLast4}` : null;
  }
  if (type === 'bank') {
    const b = identity?.bank;
    return b ? [b.accountMasked, b.bankName].filter(Boolean).join(' · ') : null;
  }
  return null;
}

export default function StepRow({step, identity, isNext, locked, tappable, onPress}) {
  const {type, status, message} = step;
  let sub = HINTS[type] || step.label;
  let tone = C.muted;
  let right = <Icon name="chevron-right" size={20} color={C.faint} />;

  switch (status) {
    case 'passed':
      sub = maskedValue(type, identity) || 'Verified';
      tone = C.body;
      right = <Icon name="check-circle" size={22} color={C.success} />;
      break;
    case 'needs_review':
      sub = 'Received · our team will check this';
      tone = C.warn;
      right = <Icon name="clock" size={20} color={C.warn} />;
      break;
    case 'started':
      sub = type === 'aadhaar' ? 'Waiting for DigiLocker · tap to open again' : 'In progress';
      right = <ActivityIndicator size="small" color={C.navy} />;
      break;
    case 'failed':
      sub = message || 'Didn’t match. Please try again.';
      tone = C.error;
      right = <Text style={r.retry}>Retry</Text>;
      break;
    case 'expired':
    case 'error':
      sub = message || 'Something went wrong. Please try again.';
      tone = C.error;
      right = <Text style={r.retry}>Retry</Text>;
      break;
  }
  if (locked) {
    sub = 'Too many attempts today. Please try again tomorrow.';
    tone = C.error;
    right = <Icon name="lock" size={18} color={C.faint} />;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={!tappable}
      accessibilityRole="button"
      accessibilityState={{disabled: !tappable}}
      accessibilityLabel={`${TITLES[type] || step.label}. ${sub}`}
      style={({pressed}) => [r.card, isNext && r.next, pressed && tappable && r.pressed]}>
      <DocTile logo={LOGOS[type]} icon="file" />
      <View style={r.body}>
        <View style={r.titleRow}>
          <Text style={r.title}>{TITLES[type] || step.label}</Text>
          {isNext && !locked ? (
            <View style={r.chip}>
              <Text style={r.chipText}>Next</Text>
            </View>
          ) : null}
        </View>
        <Text style={[r.sub, {color: tone}]} numberOfLines={2}>
          {sub}
        </Text>
      </View>
      {right}
    </Pressable>
  );
}

export const rowStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  next: {borderColor: C.navy, borderWidth: 1.5},
  pressed: {backgroundColor: C.navyTint},
  body: {flex: 1, marginHorizontal: 14},
  titleRow: {flexDirection: 'row', alignItems: 'center'},
  title: {fontFamily: F.bodySemi, fontSize: 15, color: C.ink},
  sub: {fontFamily: F.body, fontSize: 12.5, color: C.muted, marginTop: 4, lineHeight: 17},
  chip: {marginLeft: 8, backgroundColor: C.navy, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2},
  chipText: {fontFamily: F.bodyMed, fontSize: 10.5, color: C.white},
  retry: {fontFamily: F.bodySemi, fontSize: 14, color: C.navy},
});
const r = rowStyles;
