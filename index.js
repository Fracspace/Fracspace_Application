/**
 * @format
 */

// 1. Gesture handler must be the very first import
import 'react-native-gesture-handler';

// 2. Reanimated
import 'react-native-reanimated';

// 3. Firebase modules
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import crashlytics from '@react-native-firebase/crashlytics';

import App from './App';
import { name as appName } from './app.json';

// Background message handler
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('Message handled in the background!', remoteMessage);
});

// Crashlytics: calling it here installs its JS error handler at launch, so
// errors before login (or before the profile loads) are reported too.
// Collection is on in release builds only.
crashlytics().setCrashlyticsCollectionEnabled(!__DEV__).catch(() => {});

// Register the app
AppRegistry.registerComponent(appName, () => App)