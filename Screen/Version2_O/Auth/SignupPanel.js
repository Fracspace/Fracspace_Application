import React, { useContext, useState } from 'react';
import {
  View,
  Alert,
  Keyboard,
  BackHandler,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { CountryPicker } from 'react-native-country-codes-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute } from '@react-navigation/native';
import {
  GetLogin,
  GetOtpForLoginWithNumber,
  GetRegistration,
  OtpLoginWithEmail,
  verifyOtpLogin,
} from '../../Services/UserApi';
import { AppContext } from '../../Context/AppContext';
import { trackSignUp } from '../../utils/analytics';
import useOtpAutofill, { OTP_LENGTH } from '../../utils/useOtpAutofill';
import { BackButton, CountryCode, Field, GoldButton, Heading, OtpBoxes, Pane, Swap } from './AuthUI';
import { alertRequestError, alertSessionNotSaved, formatSeconds, isValidEmail, isValidName, isValidPhone, onlyDigits, phoneMaxLength, saveSession, useCooldown, useSingleFlight } from './authFlow';

/**
 * Sign-up steps (details → OTP), shown inside LoginSignup's screen next to
 * LoginPanel. `onSwitch('login')` swaps back; `showToast` shows LoginSignup's toast.
 * Both panels stay mounted; only the `active` one listens for the SMS and back.
 */
export default function SignupPanel({ active, onSwitch, showToast }) {
  const navigation = useNavigation();
  const { setGlobalState } = useContext(AppContext);
  const [visible1, setVisible1] = useState(true);
  const [visible2, setVisible2] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [selectedCode, setSelectedCode] = useState({ code: '+91', name: 'India', flag: '🇮🇳' });
  const route = useRoute();
  const [sending, run] = useSingleFlight();
  const [cooldown, startCooldown] = useCooldown();
  // Fills the code from the SMS (Android) / keyboard suggestion (iOS) and
  // submits as soon as all 6 digits are in.
  const { otpDigits, inputRefs, handleChange, handleKeyPress, resetOtp, submitOtp, submitting } = useOtpAutofill({
    listenForSms: active && visible2 && selectedCode.code === '+91',
    onComplete: () => handleOTPLogin(),
  });

  const isIndia = selectedCode.code === '+91';
  const nameOk = isValidName(name);
  const phoneOk = isValidPhone(selectedCode.code, phone);
  const emailOk = isValidEmail(email);

  const handleRegister = async () => {
    if (!nameOk) {
      Alert.alert('Check your name', 'Enter your full name.');
      return;
    }
    if (!phoneOk) {
      Alert.alert('Check your number', isIndia ? 'Enter your 10-digit mobile number.' : 'Enter a valid phone number.');
      return;
    }
    if (!emailOk) {
      Alert.alert('Check your email', 'Enter a valid email address.');
      return;
    }
    await run(async () => {
      try {
        const payload = {
          userName: name.trim(),
          phoneNumber: selectedCode.code + phone,
          email: email.trim(),
          countryCode: selectedCode.code,
        };
        const { data: res } = await GetRegistration(payload);
        if (res?.success) {
          await requestOtp();
        } else {
          Alert.alert('Couldn’t create your account', res?.message || 'Please try again.');
        }
      } catch (error) {
        alertRequestError(error, 'Couldn’t create your account');
      }
    });
  };

  // Sends the OTP (SMS for +91, email otherwise). Resolves to true when sent.
  const requestOtp = async () => {
    try {
      const { data: res } = isIndia
        ? await GetLogin({ phoneNumber: phone, smsCountry: true })
        : await OtpLoginWithEmail({ email: email.trim() });
      if (res?.success) {
        setVisible1(false);
        setVisible2(true);
        startCooldown();
        return true;
      }
      Alert.alert('Couldn’t send the code', res?.message || 'Please try again.');
    } catch (error) {
      alertRequestError(error, 'Couldn’t send the code');
    }
    return false;
  };

  const resend = () => {
    if (cooldown > 0) return;
    run(async () => {
      if (await requestOtp()) {
        resetOtp();
        showToast('A new code is on its way');
      }
    });
  };

  const backToForm = React.useCallback(() => {
    resetOtp();
    setVisible2(false);
    setVisible1(true);
  }, [resetOtp]);

  // Android back: OTP step → form → Login panel.
  useFocusEffect(
    React.useCallback(() => {
      if (!active) return undefined;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (visible2) {
          backToForm();
        } else {
          onSwitch('login');
        }
        return true;
      });
      return () => subscription.remove();
    }, [active, visible2, backToForm, onSwitch])
  );

const handleOTPLogin = async () => {
  const otp = otpDigits.join('');

  if (otp.length !== 6) {
    Alert.alert('Invalid OTP', 'Enter 6 digit OTP');
    return;
  }

  try {
    let response;

    if (selectedCode.code === '+91') {
      response = await GetOtpForLoginWithNumber({
        phoneNumber: phone,
        otp,
        smsCountry: true,
      });
    } else {
      response = await verifyOtpLogin({
        email: email.trim(),
        otp,
      });
    }

    if (response?.data?.success) {
      const token = response.data.data;
      console.log('[OTP Login Success] Token received:', token);

      // Token and email are saved together or not at all (see saveSession), so
      // a failed write can't leave a token on disk behind a "wrong code" alert.
      const userEmail = response.data.email || email.trim();
      try {
        await saveSession({ token, email: userEmail });
      } catch (e) {
        console.error('[Signup] Session not saved:', e);
        alertSessionNotSaved();
        return;
      }

      // Standard Firebase "sign_up" event (never the email: GA terms). The
      // helper can't throw, so analytics can't fail a signup.
      trackSignUp(selectedCode.code === '+91' ? 'phone_otp' : 'email_otp');

      setGlobalState(prev => ({
        ...prev,
        token,
        userEmail,
        userName: response.data.userName,
      }));

      console.log('[OTP Login Success] Auth data saved', token);

      // ==================== DEEP LINK REDIRECT LOGIC ====================
      let targetRoute = { name: 'BottomNavigations' };

      // Priority 1: route params, forwarded from NewLogin when the user
      // arrived on a deep link and chose to sign up instead.
      const redirectFromParams = route?.params?.redirectAfterLogin;

      // Priority 2: stored pendingDeepLink (deferred links / first launch)
      const pendingJson = await AsyncStorage.getItem('pendingDeepLink');

      if (redirectFromParams?.screen) {
        targetRoute = {
          name: redirectFromParams.screen,
          params: redirectFromParams.params || {},
        };
        console.log('[Signup Success] Using redirect from params:', redirectFromParams.screen);
        await AsyncStorage.removeItem('pendingDeepLink'); // Clean up
      } else if (pendingJson) {
        try {
          const pending = JSON.parse(pendingJson);
          if (pending?.screen) {
            targetRoute = {
              name: pending.screen,
              params: pending.params || {},
            };
            console.log('[Signup Success] Redirecting to pending deep link:', pending.screen);
          }
          await AsyncStorage.removeItem('pendingDeepLink'); // Clean up
        } catch (e) {
          console.warn('Invalid pending deep link JSON', e);
        }
      }

      // Final Navigation Reset (don't stack a second BottomNavigations when there is no deep link)
      const routes =
        targetRoute.name === 'BottomNavigations'
          ? [targetRoute]
          : [{ name: 'BottomNavigations' }, targetRoute];
      navigation.reset({
        index: routes.length - 1,
        routes,
      });
    } else {
      Alert.alert('Wrong code', response?.data?.message || 'Please check the code and try again.');
    }
  } catch (error) {
    alertRequestError(error, 'Couldn’t verify the code');
  }
};


  return (
    <>
      {visible1 && (
        <Pane key="signup" gap={12}>
          <Heading eyebrow="CREATE ACCOUNT" title={'Start your\nco-ownership journey.'} />
          <Field
            style={styles.firstField}
            placeholder="Full name"
            accessibilityLabel="Full name"
            autoComplete="name"
            textContentType="name"
            value={name}
            onChangeText={setName}
          />
          <Field
            leading={
              <CountryCode
                flag={selectedCode.flag}
                code={selectedCode.code}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowPicker(true);
                }}
              />
            }
            placeholder="Phone number"
            accessibilityLabel="Phone number"
            keyboardType="number-pad"
            maxLength={phoneMaxLength(selectedCode.code)}
            value={phone}
            onChangeText={t => setPhone(onlyDigits(t))}
            textContentType="telephoneNumber"
            autoComplete="tel"
          />
          <Field
            placeholder="Email address"
            accessibilityLabel="Email address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
          />
          <GoldButton
            label={sending ? 'Creating account…' : 'Register'}
            busy={sending}
            off={!nameOk || !phoneOk || !emailOk}
            disabled={sending}
            onPress={handleRegister}
            style={styles.register}
          />
          <Swap text="Already have an account?" action="Log in" onPress={() => onSwitch('login')} />
        </Pane>
      )}

      {visible2 && (
        <Pane key="otp">
          <View style={styles.otpHead}>
            <BackButton label="Change details" onPress={backToForm} />
            <Heading
              eyebrow="VERIFY"
              title="Enter the code"
              titleTop={6}
              sub={`Sent to ${isIndia ? `${selectedCode.code} ${phone}` : email.trim()}`}
            />
          </View>
          <OtpBoxes
            digits={otpDigits}
            inputRefs={inputRefs}
            maxLength={OTP_LENGTH}
            onChange={handleChange}
            onKeyPress={handleKeyPress}
          />
          <GoldButton
            label={submitting ? 'Verifying…' : 'Verify & continue'}
            busy={submitting}
            off={otpDigits.join('').length < OTP_LENGTH}
            disabled={submitting}
            onPress={submitOtp}
          />
          <Swap
            text="Didn’t get it?"
            action={sending ? 'Sending…' : cooldown > 0 ? `Resend in ${formatSeconds(cooldown)}` : 'Resend code'}
            disabled={sending || cooldown > 0}
            onPress={resend}
          />
        </Pane>
      )}

      {/* Mounted only while open: hidden, it still listens to the keyboard
          and re-renders on every keyboard show/hide and panel switch. */}
      {showPicker && (
        <CountryPicker
          enableModalAvoiding={false}
          disableBackdrop={false}
          style={{
            modal: {
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: 10,
              maxHeight: '70%',
            },
            itemsList: { maxHeight: 400 },
          }}
          show={showPicker}
          pickerButtonOnPress={(item) => {
            setSelectedCode({
              code: item.dial_code,
              name: item.name,
              flag: item.flag,
            });
            setPhone(p => p.slice(0, phoneMaxLength(item.dial_code)));
            setShowPicker(false);
          }}
          onBackdropPress={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  firstField: { marginTop: 6 },
  register: { marginTop: 4 },
  otpHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
});
