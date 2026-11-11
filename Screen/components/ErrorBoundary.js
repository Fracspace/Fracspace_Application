import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import crashlytics from '@react-native-firebase/crashlytics';

// Catches a render error anywhere below it, so one bad field from the API shows
// a "try again" screen instead of closing the app. The error goes to
// Crashlytics. "Try again" remounts the tree, which runs the start-up logic again.
export default class ErrorBoundary extends React.Component {
  state = { error: null, attempt: 0 };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    try {
      crashlytics().log(`Render error. Component stack: ${info?.componentStack || ''}`);
      crashlytics().recordError(error instanceof Error ? error : new Error(String(error)));
    } catch (e) {
      // Reporting must never throw from here.
    }
  }

  retry = () => {
    this.setState(s => ({ error: null, attempt: s.attempt + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>Sorry about that. Please try again.</Text>
          <Pressable
            onPress={this.retry}
            style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
            accessibilityRole="button">
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#021265',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-Medium',
    fontSize: 20,
    lineHeight: 28,
    textAlign: 'center',
  },
  body: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  btn: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  pressed: { opacity: 0.8 },
  btnText: {
    color: '#021265',
    fontFamily: 'Poppins-Medium',
    fontSize: 15,
  },
});
