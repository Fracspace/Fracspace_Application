// Loading / error states in the dark design: a card-coloured block with the
// gold sheen sweeping over it (no spinners), and a quiet retry card.
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, fonts} from '../theme';
import {PressScale, Sheen} from '../anim';

export function Skeleton({style}) {
  return (
    <View style={[styles.sk, style]}>
      <Sheen duration={1600} alpha={0.07} />
    </View>
  );
}

/** Shown when a load failed and there is nothing cached to show instead. */
export function ErrorCard({title = "Couldn't load this", message, onRetry, style}) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{message || 'Something went wrong. Please try again.'}</Text>
      {onRetry ? (
        <PressScale to={0.95} duration={400} onPress={onRetry} accessibilityLabel="Try again" style={styles.btn}>
          <Text style={styles.btnText}>Try again</Text>
        </PressScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sk: {backgroundColor: colors.card, overflow: 'hidden', borderRadius: 22},
  card: {
    marginHorizontal: 20,
    padding: 20,
    gap: 6,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.whiteA(0.08),
    alignItems: 'flex-start',
  },
  title: {fontFamily: fonts.bold, fontSize: 15, color: colors.cream},
  sub: {fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted},
  btn: {
    marginTop: 8,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  btnText: {fontFamily: fonts.bold, fontSize: 13, color: colors.ink},
});
