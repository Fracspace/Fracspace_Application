import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Linking, Alert, Platform, PermissionsAndroid, View, StatusBar, AppState } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { Provider } from 'react-redux';
import messaging from '@react-native-firebase/messaging';
import Video from 'react-native-video';
import appsFlyer from 'react-native-appsflyer';
import NavigationStack from './Screen/Navigation/NavigationStack';
import store from './Screen/redux/store/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setDeepLinkNav } from './Screen/redux/reducer/homeReducer';
import Toast, { BaseToast } from 'react-native-toast-message';
import analytics from '@react-native-firebase/analytics';
import DeviceInfo from 'react-native-device-info';
import UpdatePopup from './components/UpdatePopup';
import { getAppVersionConfig } from './Screen/Services/versionService';
import { compareVersions } from './Screen/utils/versionUtils';
import { AppProvider } from './Screen/Context/AppContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import NetInfo from '@react-native-community/netinfo';
import NoInternet from './Screen/components/NoInternet';
import { applyStatusBarForRoute } from './Screen/utils/statusBar';
import { trackEvent, trackScreen } from './Screen/utils/analytics';
import { recoverOpenBookings, watchOpenBookings } from './Screen/Version2_O/SpecialSection/api/recover';
import './Screen/flags/flagStore'; // app flags: saved copy now, fresh copy in the background

// OTA updates: Stallion on both platforms.
import * as Stallion from 'react-native-stallion';

// Longest the splash may stay up (its video is ~4.6 s).
const SPLASH_MAX_MS = 6000;
const navigationRef = createNavigationContainerRef();

// Toast types: the library defaults plus 'push', the banner shown for a push
// notification that arrives while the app is open (two lines of text).
const toastConfig = {
  push: props => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#021265', borderLeftWidth: 6, width: '92%', height: undefined, minHeight: 64, paddingVertical: 8 }}
      contentContainerStyle={{ paddingHorizontal: 14 }}
      text1Style={{ fontFamily: 'WorkSans-SemiBold', fontSize: 14, color: '#0F1130' }}
      text2Style={{ fontFamily: 'WorkSans-Regular', fontSize: 13, color: '#4A4A4A' }}
      text1NumberOfLines={1}
      text2NumberOfLines={2}
    />
  ),
};

// Must render inside withStallion (useStallionUpdate needs its provider).
// A downloaded update is applied on the next cold start. Don't call
// Stallion.restart() here: restarting the moment the download finishes kills
// whatever the user is doing (a PayU payment, an OTP, a UPI app handoff).
const StallionUpdater = () => {
  useEffect(() => {
    if (!__DEV__) {
      Stallion.sync();
    }
  }, []);

  return null;
};


const linking = {
  prefixes: ['fracspace://', 'fsapp://', 'https://fracspace.com', 'https://fracspace.onelink.me'],
  config: {
    screens: {
      Property: 'property/:Id/:referralCode',
      NewLogin: 'login',
      NewSigin: 'signup',
      BottomNavigations: {
        screens: {
          HomePage: 'home',
        },
      },
    },
  },
};

// Screens of an in-progress payment. A deep link / push tap must not navigate
// away from them (the PayU page would be destroyed before the payment is
// verified and, for property bookings, recorded); it waits until the user
// leaves this flow.
const PAYMENT_FLOW_ROUTES = new Set([
  'Book',
  'PaymentPage',
  'PaymentSummary',
  'ConcertCheckout',
  'ConcertReviewBooking',
  'ConcertPaymentPage',
  'EscapePaymentPage',
  'StayReview',
]);

// Stays · My bookings (inside the Special Section tab).
const STAY_BOOKINGS = {
  screen: 'BottomNavigations',
  params: { screen: 'SpecialSectionStack', params: { screen: 'Stays', params: { view: 'bookings' } } },
};
const STAY_NEWS = {
  confirmed: name => ['Booking confirmed', `Your payment for ${name} went through.`],
  pending: name => ['Checking your payment', `We're checking your payment for ${name}. If it didn't go through, the room and any wallet amount are freed automatically.`],
  failed: (name, wallet) => [
    'Payment didn\'t go through',
    wallet
      ? `₹${wallet} is back in your wallet. Reserve ${name} again to book.`
      : `The room at ${name} was released. Reserve again to book.`,
  ],
};

const App = () => {
  const pendingLinkRef = useRef(null);
  const afterPaymentLinkRef = useRef(null);

  const openDeepLinkTarget = redirectData => {
    const current = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : null;
    if (current && PAYMENT_FLOW_ROUTES.has(current)) {
      afterPaymentLinkRef.current = redirectData;
      Toast.show({
        type: 'info',
        position: 'top',
        text1: 'We\'ll open this after your payment',
        visibilityTime: 3000,
        topOffset: 50,
      });
      return;
    }
    navigationRef.navigate(redirectData.screen, redirectData.params);
  };
  const [showSplash, setShowSplash] = useState(true);
  const [updateConfig, setUpdateConfig] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const routeNameRef = useRef();

  const navigateWithAuthCheck = async (redirectData) => {
    store.dispatch(setDeepLinkNav(true));
    const token = await AsyncStorage.getItem('mytoken');
    console.log('navigateWithAuthCheck: token:', token);
    if (token) {
      openDeepLinkTarget(redirectData);
    } else {
      // Keep the target so signup can pick it up too.
      await AsyncStorage.setItem(
        'pendingDeepLink',
        JSON.stringify(redirectData),
      ).catch(err => console.log('Save pending error:', err));
      navigationRef.navigate('NewLogin', {
        redirectAfterLogin: redirectData,
      });
    }
  };

  useEffect(() => {
    const sendEvent = async() => {
      try{
        await analytics().logEvent('app_open');
        console.log('Firebase event sent');
      }catch(e){
        console.log('Firebase error: ', e);
      }
    }
    sendEvent();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected !== false);
    });
    return () => unsubscribe();
  }, []);

  const checkConnection = () => {
    NetInfo.fetch().then(state => setIsConnected(state.isConnected !== false));
  };

  // A tapped push (or "View" on the in-app alert) opens the screen in its
  // `data` payload: same keys as AppsFlyer links, routed by tryNavigate below.
  // Keys: deep_link_value (+ deep_link_sub1 for an id), optional campaign.
  // See docs/DEVELOPER-GUIDE.md "Push notification deep links".
  const openFromNotification = (remoteMessage, appState) => {
    const raw = remoteMessage?.data;
    // Stay booking pushes carry {type: 'stay_booking', event, bookingId}.
    const data = raw?.type === 'stay_booking' ? { ...raw, deep_link_value: 'stay_bookings' } : raw;
    if (!data?.deep_link_value) return;
    // 'notification_open' is reserved by Firebase (logEvent rejects it).
    trackEvent('push_open', {
      target: String(data.deep_link_value).slice(0, 100),
      campaign: String(data.campaign || '').slice(0, 100),
      app_state: appState,
    });
    tryNavigate(data, 'notification');
  };

  // Foreground push: Android/iOS don't show it themselves while the app is open,
  // so slide in a banner at the top (react-native-toast-message) that hides
  // after a few seconds; tapping it opens the push's target. Data-only
  // messages are skipped.
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      const title = remoteMessage?.notification?.title;
      const body = remoteMessage?.notification?.body;
      if (title || body) {
        Toast.show({
          type: 'push',
          position: 'top',
          text1: title || body,
          text2: title ? body : undefined,
          visibilityTime: 5000,
          topOffset: 50,
          onPress: () => {
            Toast.hide();
            openFromNotification(remoteMessage, 'foreground');
          },
        });
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push tapped while the app was closed (launches it) or in the background.
  // When closed, navigation isn't ready yet (splash): tryNavigate keeps the
  // target and the 'ready' listener opens it.
  useEffect(() => {
    messaging()
      .getInitialNotification()
      .then(message => message && openFromNotification(message, 'closed'))
      .catch(() => {});
    const unsubscribe = messaging().onNotificationOpenedApp(message =>
      openFromNotification(message, 'background'),
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stays: holds and payments left open when the app was closed (killed in the
  // PayU checkout, a release that failed offline) are settled after the splash,
  // on every return to the foreground and when an open payment's hold runs
  // out; the outcome shows as a banner.
  useEffect(() => {
    if (showSplash) return;
    const show = news =>
      news.forEach(n => {
        const [text1, text2] = STAY_NEWS[n.kind](n.name, n.wallet);
        Toast.show({
          type: 'push',
          position: 'top',
          text1,
          text2,
          visibilityTime: 6000,
          topOffset: 50,
          onPress: () => {
            Toast.hide();
            openDeepLinkTarget(STAY_BOOKINGS);
          },
        });
      });
    const run = () => recoverOpenBookings().then(show).catch(() => {});
    run();
    const stopWatch = watchOpenBookings(show);
    const sub = AppState.addEventListener('change', state => state === 'active' && run());
    return () => {
      sub.remove();
      stopWatch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSplash]);

  useEffect(() => {
    const getDeviceToken = async() => {
      try{
        const data = await messaging().getToken();
        console.log("FCM Token: ", data);
      }catch(error){
        console.log("Fcm token error: ",error);
      }
    }
    
    getDeviceToken();
  }, []);

  // const getDeviceToken = async () => {
  //   try{
  //     const data = await messaging().getToken();
  //     console.log("FCM token: ", data);
  //   }catch(error){
  //     console.log("FCM token error: ", error);
  //   }
  // };

  const tryNavigate = (data, source = 'unknown') => {
    console.log(`[${source}] Deep link received:`, data);
    if (!data?.deep_link_value) return;
    let redirectData = null;
    if (data.deep_link_value === 'property' || data.deep_link_value === 'property_share') {
      redirectData = {
        screen: 'Property',
        params: {
          Id: data?.af_sub2 || data?.deep_link_sub1 || data?.af_sub1 || 'MISSING',
          referralCode: data.af_sub1 || 'MISSING',
        },
      };
    } else if (data.deep_link_value === 'wallet_section') {
      redirectData = { screen: 'WalletAmount', params: {} };
    } else if (data.deep_link_value === 'payment_link') {
      redirectData = {
        screen: 'Book',
        params: { Id: data?.deep_link_sub1 || data?.af_sub2 || data?.af_sub1 || 'MISSING' },
      };
    } else if (data.deep_link_value === 'escape_section'){
      redirectData = { screen: 'MembershipHome', params: {}};
    } else if (data.deep_link_value === 'concert_section') {
      redirectData = {
        screen: 'ConcertDetails',
        params: { concertId: data?.deep_link_sub1 || data?.af_sub2 || data?.af_sub1 || null },
      };
    // Tabs are opened inside BottomNavigations so the tab bar stays visible.
    } else if (data.deep_link_value === 'portfolio_section') {
      redirectData = {
        screen: 'BottomNavigations',
        params: { screen: 'DashboardStack', params: { screen: 'Owned' } },
      };
    } else if (data.deep_link_value === 'profile_section') {
      redirectData = {
        screen: 'BottomNavigations',
        params: { screen: 'ProfileStack', params: { screen: 'Profile' } },
      };
    } else if (data.deep_link_value === 'stay_bookings') {
      redirectData = STAY_BOOKINGS;
    } else if (data.deep_link_value === 'dreamscape_section') {
      redirectData = {
        screen: 'BottomNavigations',
        params: { screen: 'HomeStack', params: { screen: 'DreamscapeHome' } },
      };
    } else {
      return;
    }

    const isFirstLaunch = data?.is_first_launch === true || data?.is_first_launch === 'true';
    if (isFirstLaunch || source === 'onInstallConversionData') {
      AsyncStorage.setItem('pendingDeepLink', JSON.stringify(redirectData))
        .catch(err => console.log('Save pending error:', err));
    }
    AsyncStorage.getItem('mytoken').then((token) => {
      if (!token) {
        // Logged out: keep the target so it survives NewLogin -> NewSigin
        // and an app restart in the middle of logging in.
        AsyncStorage.setItem('pendingDeepLink', JSON.stringify(redirectData))
          .catch(err => console.log('Save pending error:', err));
      }
      if (navigationRef.isReady()) {
        if (token) {
          openDeepLinkTarget(redirectData);
        } else {
          navigationRef.navigate('NewLogin', { redirectAfterLogin: redirectData });
        }
      } else {
        pendingLinkRef.current = redirectData;
      }
    });
  };

  useEffect(() => {
    const deepLinkUnsub = appsFlyer.onDeepLink((res) => {
      if (res?.deepLinkStatus === 'FOUND') tryNavigate(res.data, 'onDeepLink');
    });

    // Conversion data is re-delivered on later launches; only act on the first launch.
    const installUnsub = appsFlyer.onInstallConversionData((res) => {
      const data = res?.data || {};
      const isFirstLaunch = data?.is_first_launch === true || data?.is_first_launch === 'true';
      if (isFirstLaunch) tryNavigate(data, 'onInstallConversionData');
    });

    const attributionUnsub = appsFlyer.onAppOpenAttribution((res) => {
      tryNavigate(res?.data || {}, 'onAppOpenAttribution');
    });

    appsFlyer.initSdk(
      {
        devKey: 'z9iokP3YwU3z6uxEkKgJfn',
        appId: '6498551006',
        isDebug: __DEV__,
        onInstallConversionDataListener: true,
        onDeepLinkListener: true,
      },
      () => console.log(' AppsFlyer init success'),
      (err) => console.log('AppsFlyer init failed:', err)
    );

    return () => {
      deepLinkUnsub?.();
      installUnsub?.();
      attributionUnsub?.();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = navigationRef.addListener('ready', () => {
      if (pendingLinkRef.current) {
        navigateWithAuthCheck(pendingLinkRef.current);
        pendingLinkRef.current = null;
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const requestPermission = async () => {
      try {
        if (Platform.OS === 'android') {
          if (Platform.Version >= 33) {
            await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            );
          }
          await messaging().getToken();
          return;
        }
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        if (enabled) await messaging().getToken();
      } catch (err) {
        console.log('Firebase permission error:', err);
      }
    };
    requestPermission();
    // The splash ends when its video does (onEnd); this is only a fallback
    // for a slow network or a video that never starts.
    const timer = setTimeout(() => setShowSplash(false), SPLASH_MAX_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const checkPendingAfterSplash = async () => {
      if (!showSplash) {
        const pending = await AsyncStorage.getItem('pendingDeepLink');
        if (pending && navigationRef.isReady()) {
          try {
            const data = JSON.parse(pending);
            navigateWithAuthCheck(data);
            await AsyncStorage.removeItem('pendingDeepLink');
          } catch (e) {}
        }
      }
    };
    checkPendingAfterSplash();
  }, [showSplash]);

  useEffect(() => {
    const parseAndNavigate = (url) => {
      if (url.includes('property/')) {
        const match = url.match(/property\/([^\/]+)\/([^\/\?]+)/);
        if (match) {
          const [, id, referralCode] = match;
          const redirectData = {
            screen: 'Property',
            params: { Id: id, referralCode: referralCode },
          };
          AsyncStorage.getItem('mytoken').then((token) => {
            if (navigationRef.isReady()) {
              if (token) {
                openDeepLinkTarget(redirectData);
              } else {
                navigationRef.navigate('NewLogin', { redirectAfterLogin: redirectData });
              }
            } else {
              pendingLinkRef.current = redirectData;
            }
          });
        }
      }
    };

    const handleInitialURL = async () => {
      const url = await Linking.getInitialURL();
      if (url) parseAndNavigate(url);
    };

    handleInitialURL();
    const subscription = Linking.addEventListener('url', ({ url }) => parseAndNavigate(url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!showSplash) {
      const checkVersion = async () => {
        try {
          const config = await getAppVersionConfig();
          if (!config) return;

          const installedVersion = DeviceInfo.getVersion();
          const targetVersion =
            Platform.OS === 'ios'
              ? config.iosCurrentVersion
              : config.androidCurrentVersion;

          if (
            config.showPopup &&
            targetVersion &&
            compareVersions(installedVersion, targetVersion) < 0
          ) {
            setUpdateConfig(config);
            setShowUpdateModal(true);
          }
        } catch (error) {
          console.log('Error checking app update:', error);
        }
      };

      checkVersion();
    }
  }, [showSplash]);

  const handleUpdatePress = async () => {
    if (!updateConfig) return;
    const url =
      Platform.OS === 'ios'
        ? updateConfig.appStoreUrl
        : updateConfig.playStoreUrl;

    if (url) {
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          await Linking.openURL(url);
        }
      } catch (err) {
        console.log('Error opening store URL:', err);
      }
    }
  };

  const handleLaterPress = () => {
    setShowUpdateModal(false);
  };

  return (
    <>
      <StallionUpdater />
      {showSplash ? (
        <View style={styles.splash}>
          <StatusBar hidden />
          {/* cover: fills the whole screen and crops the sides (no stretching);
              the logo is centred so nothing important is cut. */}
          <Video
            source={{uri: "https://duixj37yn5405.cloudfront.net/videos/fracspace_splash.mp4"}}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            hideShutterView
            muted
            onEnd={() => setShowSplash(false)}
            onError={(e) => {
              console.log('Video error:', e);
              setShowSplash(false);
            }}
          />
        </View>
      ) : (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Provider store={store}>
            <AppProvider>
              <NavigationContainer
                ref={navigationRef}
                linking={linking}
                onReady={() => {
                  routeNameRef.current = navigationRef.getCurrentRoute()?.name;
                  applyStatusBarForRoute(routeNameRef.current);
                  // The first screen (Home or Login) never triggers onStateChange.
                  trackScreen(routeNameRef.current);
                }}
                onStateChange={async () => {
                  const previousRouteName = routeNameRef.current;
                  const currentRouteName = navigationRef.getCurrentRoute()?.name;
                  // Status bar icons follow the screen's top colour (iOS, Android 15+).
                  applyStatusBarForRoute(currentRouteName);
                  if (currentRouteName && previousRouteName !== currentRouteName) {
                    trackScreen(currentRouteName);
                  }
                  routeNameRef.current = currentRouteName;
                  // A link tapped during a payment opens once the user has left it.
                  if (
                    afterPaymentLinkRef.current &&
                    currentRouteName &&
                    !PAYMENT_FLOW_ROUTES.has(currentRouteName)
                  ) {
                    const target = afterPaymentLinkRef.current;
                    afterPaymentLinkRef.current = null;
                    openDeepLinkTarget(target);
                  }
                }}
              >
                <NavigationStack />
              </NavigationContainer>
              {!isConnected && (
                <View style={styles.offlineOverlay}>
                  <NoInternet onRetry={checkConnection} />
                </View>
              )}
            </AppProvider>
          </Provider>
        </GestureHandlerRootView>
      )}
      <Toast config={toastConfig} />
      <UpdatePopup
        visible={showUpdateModal}
        title={updateConfig?.title}
        message={updateConfig?.message}
        forceUpdate={updateConfig?.forceUpdate}
        onLater={handleLaterPress}
        onUpdate={handleUpdatePress}
      />
    </>
  );
};

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    // Matches the video's dark background, so no white shows while it loads.
    backgroundColor: '#000',
  },
  offlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
});

export default Stallion.withStallion(App);