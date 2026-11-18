// Building blocks for the e-KYC screens, in the look of the current
// Profile Verification screen.
import React, {useState} from 'react';
import {ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {C, F} from './theme';

/** Light-blue wash header. `step` shows "Step 1 of 3" next to the back button. */
export function Header({title, subtitle, step, onBack, centered}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, {paddingTop: insets.top + 8}]}>
      {/* Solid sky under the status bar (same as StatusBg), gradient below it. */}
      <View style={[s.statusBg, {height: insets.top}]} />
      <LinearGradient colors={[C.sky, C.white]} style={[StyleSheet.absoluteFill, {top: insets.top}]} />
      <View style={s.headerBar}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
            <Icon name="chevron-left" size={24} color={C.ink} />
          </Pressable>
        ) : (
          <View style={s.back} />
        )}
        {step ? <Text style={s.stepText}>{step}</Text> : null}
        <View style={s.back} />
      </View>
      <View style={centered ? s.titleCentered : s.titleLeft}>
        <Text style={[s.title, centered && s.center]}>{title}</Text>
        {subtitle ? <Text style={[s.subtitle, centered && s.center]}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

/**
 * Light-blue strip behind the translucent status bar, so scrolled content
 * doesn't run under the clock. Matches the header gradient's top colour.
 */
export function StatusBg() {
  const insets = useSafeAreaInsets();
  return <View pointerEvents="none" style={[s.statusBg, {height: insets.top}]} />;
}

/** Square tile holding the document artwork (or an icon). */
export function DocTile({logo, icon, size = 48}) {
  return (
    <View style={[s.tile, {width: size, height: size}]}>
      {logo ? (
        <Image source={{uri: logo}} style={{width: size - 14, height: size - 22}} resizeMode="contain" />
      ) : (
        <Icon name={icon} size={20} color={C.navy} />
      )}
    </View>
  );
}

export function PrimaryButton({title, onPress, disabled, loading, loadingText, style}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{disabled: off, busy: !!loading}}
      style={({pressed}) => [s.btn, off && !loading && s.btnOff, pressed && s.btnPressed, style]}>
      {loading ? (
        <View style={s.row}>
          <ActivityIndicator color={C.white} size="small" />
          <Text style={[s.btnText, s.btnTextBusy]}>{loadingText || title}</Text>
        </View>
      ) : (
        <Text style={[s.btnText, off && s.btnTextOff]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function TextButton({title, onPress, color = C.navy}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={s.textBtn} accessibilityRole="button">
      <Text style={[s.textBtnText, {color}]}>{title}</Text>
    </Pressable>
  );
}

/**
 * Labelled input. `error` turns the border red and shows the text below;
 * otherwise `hint` shows. `valid` adds a small green tick.
 */
export const Field = React.forwardRef(function Field(
  {label, hint, error, valid, style, inputStyle, onFocus, onBlur, ...input},
  ref,
) {
  const [focused, setFocused] = useState(false);
  const border = error ? C.error : focused ? C.navy : C.line;
  return (
    <View style={[s.fieldWrap, style]}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.field, {borderColor: border}, focused && s.fieldFocused]}>
        <TextInput
          ref={ref}
          placeholderTextColor={C.faint}
          style={[s.input, inputStyle]}
          onFocus={e => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...input}
        />
        {valid && !error ? <Icon name="check-circle" size={18} color={C.success} /> : null}
      </View>
      {error ? (
        <View style={s.msgRow}>
          <Icon name="alert-circle" size={14} color={C.error} style={s.msgIcon} />
          <Text style={[s.msg, s.msgErr]}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={s.msg}>{hint}</Text>
      ) : null}
    </View>
  );
});

/** Soft info box. tone: info | warn | success | error */
export function Note({icon = 'info', tone = 'info', children, style}) {
  const t = TONES[tone];
  return (
    <View style={[s.note, {backgroundColor: t.bg}, style]}>
      <Icon name={icon} size={16} color={t.fg} style={s.noteIcon} />
      <Text style={[s.noteText, tone !== 'info' && {color: t.text}]}>{children}</Text>
    </View>
  );
}

const TONES = {
  info: {bg: C.navyTint, fg: C.navy, text: C.body},
  warn: {bg: C.warnTint, fg: C.warn, text: '#5C3A00'},
  success: {bg: C.successTint, fg: C.success, text: '#0F5129'},
  error: {bg: C.errorTint, fg: C.error, text: '#7A1A13'},
};

/** Bottom action area that sits above the keyboard / home indicator. */
export function Footer({children}) {
  const insets = useSafeAreaInsets();
  return <View style={[s.footer, {paddingBottom: Math.max(insets.bottom, 12) + 4}]}>{children}</View>;
}

export function ProgressBar({value}) {
  return (
    <View style={s.track}>
      <View style={[s.fill, {width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`}]} />
    </View>
  );
}

/**
 * A step's "done" state: a check (or clock for review), the verified value and
 * a Continue button. Shown in place of the form.
 */
export function StepDone({review, title, value, detail, onContinue, continueLabel}) {
  const fg = review ? C.warn : C.success;
  const bg = review ? C.warnTint : C.successTint;
  return (
    <View style={s.done}>
      <View style={[s.doneBadge, {backgroundColor: bg}]}>
        <Icon name={review ? 'clock' : 'check'} size={34} color={fg} />
      </View>
      <Text style={[s.title, s.center, s.doneTitle]}>{title}</Text>
      {value ? <Text style={s.doneValue}>{value}</Text> : null}
      {detail ? <Text style={[s.subtitle, s.center, s.doneDetail]}>{detail}</Text> : null}
      <PrimaryButton title={continueLabel} onPress={onContinue} style={s.doneBtn} />
    </View>
  );
}

export const s = StyleSheet.create({
  done: {alignItems: 'center', paddingHorizontal: 24, paddingTop: 40},
  doneBadge: {width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center'},
  doneValue: {fontFamily: F.bodySemi, fontSize: 16, color: C.ink, marginTop: 10, letterSpacing: 1},
  doneBtn: {alignSelf: 'stretch', marginTop: 32},
  msgErr: {color: C.error, marginTop: 0},
  statusBg: {position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: C.sky},
  btnTextBusy: {marginLeft: 10},
  doneTitle: {marginTop: 20},
  doneDetail: {marginHorizontal: 12},
  row: {flexDirection: 'row', alignItems: 'center'},
  center: {textAlign: 'center'},
  header: {paddingHorizontal: 20, paddingBottom: 20},
  headerBar: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 36},
  back: {width: 32, height: 32, justifyContent: 'center'},
  stepText: {fontFamily: F.bodyMed, fontSize: 13, color: C.muted},
  titleLeft: {marginTop: 14},
  titleCentered: {alignItems: 'center', marginTop: 6},
  title: {fontFamily: F.head, fontSize: 20, color: C.ink},
  subtitle: {fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 19},
  tile: {borderRadius: 10, backgroundColor: C.navyTint, alignItems: 'center', justifyContent: 'center'},
  btn: {
    backgroundColor: C.navy,
    borderRadius: 8,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnOff: {backgroundColor: '#B8BED6'},
  btnPressed: {backgroundColor: C.navyPressed},
  btnText: {fontFamily: F.bodyMed, fontSize: 16, color: C.white},
  btnTextOff: {color: '#FFFFFFE6'},
  textBtn: {alignSelf: 'center', paddingVertical: 12},
  textBtnText: {fontFamily: F.bodyMed, fontSize: 14},
  fieldWrap: {marginBottom: 18},
  label: {fontFamily: F.bodyMed, fontSize: 13, color: C.body, marginBottom: 8},
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: C.field,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  fieldFocused: {backgroundColor: C.white},
  input: {flex: 1, fontFamily: F.bodyMed, fontSize: 16, color: C.ink, paddingVertical: 12},
  msgRow: {flexDirection: 'row', alignItems: 'flex-start', marginTop: 8},
  msgIcon: {marginTop: 1, marginRight: 6},
  msg: {fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 17, flexShrink: 1},
  note: {flexDirection: 'row', borderRadius: 8, padding: 12, alignItems: 'flex-start'},
  noteIcon: {marginTop: 1, marginRight: 10},
  noteText: {flex: 1, fontFamily: F.body, fontSize: 13, color: C.body, lineHeight: 19},
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: C.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
  },
  track: {height: 6, borderRadius: 3, backgroundColor: '#E3E8F3', overflow: 'hidden'},
  fill: {height: 6, borderRadius: 3, backgroundColor: C.navy},
});
