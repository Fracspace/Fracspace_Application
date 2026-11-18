// Login / Sign-up (dark) UI, from LoginV2.dc.html and SignupV2.dc.html in the
// "Fracspace Co-own Flow" design artifact (local copies in docs/login-v2/design).
// Only looks: LoginPanel and SignupPanel keep their own state, API calls and
// navigation and pass them in.
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Video from 'react-native-video';
import {useIsFocused} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Ic from 'react-native-vector-icons/AntDesign';
import Ion from 'react-native-vector-icons/Ionicons';
import {colors, fonts, ls} from '../SpecialSection/theme';
import {E, PressScale, enterUp, useLoop, useReducedMotion, useToggle} from '../SpecialSection/anim';
import {BackIcon, GlassButton, Grain} from '../SpecialSection/HubBits';
import {videoSource} from '../../utils/videoSource';
import {EDGE_TO_EDGE} from '../../utils/statusBar';

// CloudFront (edge cache near users) in front of the same S3 object.
const INTRO_VIDEO = 'https://duixj37yn5405.cloudfront.net/videos/FRACSPACE_Introo.mp4';
// The video's first frame (540×960), bundled: shows at once, before and
// instead of the video, so a slow or missing network never leaves the screen dark.
const INTRO_POSTER = require('../assets/loginIntroPoster.jpg');
const INTRO_SOURCE = videoSource(INTRO_VIDEO, {cacheSizeMB: 64});
const logo = require('../assets/Fslogoapp.png');
const AUDIO_OFF = {type: 'disabled'};
const AUDIO_ON = {type: 'system'};

// Android TextInput adds its own vertical/font padding; strip it so the text
// sits in the middle of the 56px field like on iOS.
const androidInputReset = Platform.OS === 'android' ? {includeFontPadding: false, paddingVertical: 0} : null;

// `.pane` / `.logo`: paneIn (fade + rise 18px, --out).
const paneIn = enterUp(0, {dy: 18, duration: 550});
const logoIn = enterUp(0, {dy: 18, duration: 800, delay: 100});

/**
 * The whole screen: intro video with its shade, logo, grain, and the bottom
 * panel (`.lpanel`) that holds the current pane and the legal line.
 */
/**
 * 0 → 1 as the keyboard comes up (and back), in step with it. Set straight
 * from the keyboard events on a shared value: no React re-render.
 */
function useKeyboardProgress() {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const to = target => e => {
      v.value = reduced ? target : withTiming(target, {duration: e?.duration || 250, easing: E.out});
    };
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', to(1));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', to(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [reduced, v]);
  return v;
}

export function AuthScreen({children, overlay}) {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [videoFailed, setVideoFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  // The poster sits over the video and fades out once the video has drawn a
  // frame. (Fading the video itself doesn't work: Android draws it on a
  // SurfaceView, which ignores its parent's opacity.)
  const reduced = useReducedMotion();
  const poster = useSharedValue(1);
  const posterStyle = useAnimatedStyle(() => ({opacity: poster.value}));
  const onVideoReady = useCallback(() => {
    poster.value = reduced ? 0 : withTiming(0, {duration: 600, easing: E.out});
  }, [poster, reduced]);
  const onVideoError = useCallback(() => {
    poster.value = 1;
    setVideoFailed(true);
  }, [poster]);
  // With the keyboard up the panel rises over the bright part of the video:
  // dim the video and put a dark scrim behind the panel so the text reads.
  const kb = useKeyboardProgress();
  const dim = useAnimatedStyle(() => ({opacity: kb.value}));

  return (
    <View style={styles.app}>
      {/* `.bgv`: looping cover video, muted until the user unmutes it; its
          first frame (the poster, below) covers it until it can play.
          Muted, it leaves other audio alone. */}
      {!videoFailed && (
        <Video
          source={INTRO_SOURCE}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          muted={muted}
          repeat
          paused={!focused}
          playInBackground={false}
          // Muted: no audio track at all, so the audio decoder doesn't run.
          selectedAudioTrack={muted ? AUDIO_OFF : AUDIO_ON}
          disableFocus={muted}
          mixWithOthers={muted ? 'mix' : 'inherit'}
          ignoreSilentSwitch={muted ? 'obey' : 'ignore'}
          shutterColor="transparent"
          // Nothing reads progress: tick rarely instead of every 250 ms.
          progressUpdateInterval={5000}
          onReadyForDisplay={onVideoReady}
          onError={onVideoError}
        />
      )}
      <Animated.Image
        pointerEvents="none"
        source={INTRO_POSTER}
        style={[StyleSheet.absoluteFill, styles.poster, posterStyle]}
        resizeMode="cover"
        fadeDuration={0}
      />
      {/* `.vshade`: navy at the top, fading to the ground behind the panel. */}
      <LinearGradient
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        colors={['rgba(6,10,40,0.35)', 'rgba(6,10,40,0)', 'rgba(10,10,12,0)', 'rgba(10,10,12,0.82)', colors.ground]}
        locations={[0, 0.22, 0.4, 0.62, 0.8]}
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.kbDim, dim]} />
      <Animated.View entering={logoIn} style={[styles.logo, {top: insets.top + 8}]}>
        <Image source={logo} style={styles.logoImg} resizeMode="contain" />
      </Animated.View>

      {/* Android 15+ (targetSdk 35+) is edge-to-edge, where adjustResize no
          longer shrinks the window for the keyboard: pad it there like iOS. */}
      <KeyboardAvoidingView style={styles.flex} behavior={EDGE_TO_EDGE ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.panel, {paddingBottom: 30 + insets.bottom, paddingTop: insets.top + 60}]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <View>
            <Animated.View pointerEvents="none" style={[styles.scrim, {bottom: -(30 + insets.bottom)}, dim]}>
              <LinearGradient
                style={StyleSheet.absoluteFill}
                colors={[colors.groundA(0), colors.groundA(0.85), colors.groundA(0.95)]}
                locations={[0, 0.35, 1]}
              />
            </Animated.View>
            {children}
            <Text style={styles.legal}>By continuing you agree to our Terms & Privacy Policy</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {!videoFailed && (
        <GlassButton
          size={40}
          onPress={() => setMuted(m => !m)}
          label={muted ? 'Unmute video' : 'Mute video'}
          style={[styles.glass, styles.mute, {top: insets.top}]}>
          <Ion name={muted ? 'volume-mute' : 'volume-high'} size={18} color={colors.white} />
        </GlassButton>
      )}
      <Grain opacity={0.07} />
      {overlay}
    </View>
  );
}

/**
 * Holds one panel (Login or Sign-up). Both stay mounted so switching creates
 * no views; the one becoming active plays paneIn, the other hides at once.
 * Hidden = transparent, out of the layout and untouchable: `display: 'none'`
 * would drop its native views (New Architecture) and rebuild them on show.
 */
export function PanelSlot({active, children}) {
  const p = useToggle(active, {duration: 550, easing: E.out}, {duration: 0});
  const anim = useAnimatedStyle(() => ({opacity: p.value, transform: [{translateY: (1 - p.value) * 18}]}));
  return (
    <Animated.View
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      style={[anim, !active && styles.hidden]}>
      {children}
    </Animated.View>
  );
}

/** `.pane`: one step of the flow; remount it (new `key`) to replay paneIn. */
export function Pane({gap = 16, children}) {
  return (
    <Animated.View entering={paneIn} style={{gap}}>
      {children}
    </Animated.View>
  );
}

/** `.eyeb` + `.lt` (the boards set the title to 24px). */
export function Heading({eyebrow, title, sub, titleTop = 10}) {
  return (
    <View style={styles.flexShrink}>
      <Text style={styles.eyeb}>{eyebrow}</Text>
      <Text style={[styles.lt, {marginTop: titleTop}]}>{title}</Text>
      {!!sub && <Text style={styles.sub}>{sub}</Text>}
    </View>
  );
}

/** `.lf`: input row; gold border and tint while focused (.25s). */
export function Field({leading, style, onFocus, onBlur, ...input}) {
  const [focused, setFocused] = useState(false);
  const f = useToggle(focused, {duration: 250});
  const anim = useAnimatedStyle(() => ({
    borderColor: interpolateColor(f.value, [0, 1], ['rgba(255,255,255,0.12)', colors.gold]),
    backgroundColor: interpolateColor(f.value, [0, 1], ['rgba(255,255,255,0.06)', 'rgba(241,221,186,0.06)']),
  }));
  return (
    <Animated.View style={[styles.lf, anim, style]}>
      {leading}
      <TextInput
        placeholderTextColor="#7E7870"
        selectionColor={colors.gold}
        cursorColor={colors.gold}
        keyboardAppearance="dark"
        {...input}
        onFocus={e => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={e => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.lfInput, androidInputReset]}
      />
    </Animated.View>
  );
}

/** `.cc`: country code at the start of the phone field; opens the picker. */
export function CountryCode({flag, code, onPress}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.cc} accessibilityRole="button" accessibilityLabel="Country code">
      {!!flag && <Text style={styles.ccText}>{flag}</Text>}
      <Text style={styles.ccText}>{code}</Text>
      <Ic name="caretdown" size={9} color={colors.muted} />
    </Pressable>
  );
}

/** `.spin`: ink ring with a dark top, 0.7s linear. */
function Spinner() {
  const p = useLoop(700);
  const anim = useAnimatedStyle(() => ({transform: [{rotate: `${p.value * 360}deg`}]}));
  return <Animated.View style={[styles.spin, anim]} />;
}

/** `.lbtn`: gold full-width button; `.off` dims it, `busy` shows the spinner. */
export function GoldButton({label, off, busy, onPress, disabled, style}) {
  return (
    <PressScale
      to={0.97}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{disabled: !!disabled, busy: !!busy}}
      style={[styles.lbtn, off && styles.lbtnOff, style]}>
      {busy && <Spinner />}
      <Text style={styles.lbtnText}>{label}</Text>
    </PressScale>
  );
}

/** `.swap`: "Don't have an account? Sign up". */
export function Swap({text, action, onPress, disabled}) {
  return (
    <Text style={styles.swap}>
      {text}{' '}
      <Text
        style={[styles.swapBtn, disabled && styles.swapBtnOff]}
        onPress={disabled ? undefined : onPress}
        accessibilityRole="button"
        accessibilityState={{disabled: !!disabled}}
        suppressHighlighting>
        {action}
      </Text>
    </Text>
  );
}

/** Message for <Toast>: `show(text)` shows it for `ms`. Returns [message, show]. */
export function useToast(ms = 1600) {
  const [message, setMessage] = useState('');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = useCallback(
    text => {
      clearTimeout(timer.current);
      setMessage(text);
      timer.current = setTimeout(() => setMessage(''), ms);
    },
    [ms],
  );
  return [message, show];
}

/** `.toast`: gold pill that drops in from the top (spring .5s, fade .25s). */
export function Toast({message}) {
  const insets = useSafeAreaInsets();
  const last = useRef(message);
  if (message) {
    last.current = message;
  }
  const slide = useToggle(!!message, {duration: 500, easing: E.spring});
  const fade = useToggle(!!message, {duration: 250});
  const anim = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{translateY: (1 - slide.value) * -20}],
  }));
  return (
    <View pointerEvents="none" style={[styles.toastWrap, {top: insets.top + 52}]}>
      <Animated.View style={[styles.toast, anim]} accessibilityLiveRegion="polite">
        <Text style={styles.toastText}>{last.current}</Text>
      </Animated.View>
    </View>
  );
}

/** Round glass back button (`.gbtn.glass`, 40px). */
export function BackButton({onPress, label = 'Back'}) {
  return (
    <GlassButton size={40} onPress={onPress} label={label} style={styles.glass}>
      <BackIcon />
    </GlassButton>
  );
}

/** `.ob`: one OTP box; pops (.88 → 1, spring .3s) when a digit lands. */
function OtpBox({value, focused, children}) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (value && !reduced) {
      s.value = withSequence(withTiming(0.88, {duration: 0}), withTiming(1, {duration: 300, easing: E.spring}));
    }
  }, [value, reduced, s]);
  const anim = useAnimatedStyle(() => ({transform: [{scale: s.value}]}));
  return (
    <Animated.View style={[styles.ob, focused && styles.obCur, !!value && styles.obFilled, anim]}>
      {children}
    </Animated.View>
  );
}

/**
 * `.otp`: the code boxes. Keeps one TextInput per box so useOtpAutofill's
 * refs, focus moves and autofill work as before.
 */
export function OtpBoxes({digits, inputRefs, maxLength, onChange, onKeyPress}) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  return (
    <View style={styles.otp}>
      {digits.map((d, i) => (
        <OtpBox key={i} value={d} focused={focusedIndex === i}>
          <TextInput
            ref={ref => (inputRefs.current[i] = ref)}
            style={[styles.obInput, androidInputReset, Platform.OS === 'android' && styles.obInputAndroid]}
            keyboardType="number-pad"
            keyboardAppearance="dark"
            maxLength={maxLength}
            value={d}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            importantForAutofill="yes"
            selectionColor={colors.gold}
            cursorColor={colors.gold}
            onFocus={() => setFocusedIndex(i)}
            onBlur={() => setFocusedIndex(cur => (cur === i ? -1 : cur))}
            onChangeText={text => onChange(text, i)}
            onKeyPress={e => onKeyPress(e, i)}
          />
        </OtpBox>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  app: {flex: 1, backgroundColor: '#061040'},
  flex: {flex: 1},
  // absoluteFill's width/height are undefined; an Image needs them to cover.
  poster: {width: '100%', height: '100%'},
  hidden: {position: 'absolute', left: 0, right: 0, bottom: 0},
  flexShrink: {flexShrink: 1},
  logo: {position: 'absolute', left: 24, zIndex: 5},
  logoImg: {height: 24, width: 96, tintColor: colors.white},
  mute: {position: 'absolute', right: 20, zIndex: 5},
  kbDim: {backgroundColor: 'rgba(10,10,12,0.5)'},
  // Behind the panel, from 140px above its first line down past the legal text.
  scrim: {position: 'absolute', top: -140, left: -24, right: -24},
  panel: {flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 24},
  legal: {
    marginTop: 16,
    fontFamily: fonts.regular,
    fontSize: 10.5,
    lineHeight: 16,
    color: '#7E7870',
    textAlign: 'center',
  },
  eyeb: {fontFamily: fonts.extrabold, fontSize: 10.5, letterSpacing: ls(0.2, 10.5), color: colors.gold},
  lt: {fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 27, letterSpacing: ls(-0.02, 24), color: colors.white},
  sub: {fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 4},
  lf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  lfInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontFamily: fonts.semibold,
    fontSize: 15,
    letterSpacing: ls(0.02, 15),
    color: colors.white,
  },
  cc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.14)',
  },
  ccText: {fontFamily: fonts.bold, fontSize: 15, color: colors.white},
  lbtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.gold,
  },
  lbtnOff: {opacity: 0.45},
  lbtnText: {fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink},
  spin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: 'rgba(26,22,17,0.25)',
    borderTopColor: colors.ink,
  },
  swap: {fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 8},
  swapBtn: {fontFamily: fonts.bold, color: colors.gold},
  swapBtnOff: {color: colors.muted},
  toastWrap: {position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 55},
  toast: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  toastText: {fontFamily: fonts.bold, fontSize: 13, color: colors.ink},
  glass: {backgroundColor: 'rgba(10,10,12,0.42)', borderColor: 'rgba(255,255,255,0.2)'},
  otp: {flexDirection: 'row', gap: 8},
  ob: {
    flex: 1,
    height: 60,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
  },
  obCur: {borderColor: 'rgba(241,221,186,0.6)'},
  obFilled: {borderColor: colors.gold, backgroundColor: 'rgba(241,221,186,0.08)'},
  obInput: {
    fontFamily: fonts.extrabold,
    fontSize: 24,
    color: colors.white,
    textAlign: 'center',
    padding: 0,
    height: '100%',
  },
  obInputAndroid: {textAlignVertical: 'center'},
});
