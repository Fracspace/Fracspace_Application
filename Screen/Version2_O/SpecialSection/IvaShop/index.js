// Section 5 · IVA Shop (IvaShopV2.dc.html). One route with the design's
// internal `view` state: list → product → review → order placed. Each view
// slides in (`svin`, or `svback` going back); the bottom bars rise (`up`),
// "Add to cart" flies the product photo into the cart (`fly`, then `bump2`).
// Back from the list returns to the Hub, "Back to home" opens the Home tab.
// Ordering is mocked (1.2s → success) until the shop has an order API.
import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {BackHandler, Image, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import Animated, {Easing, useAnimatedStyle} from 'react-native-reanimated';
import {useIsFocused} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../theme';
import {LoopGate} from '../anim';
import {markTap, useFirstFrame, useJsFps, useRenderCount} from '../perf';
import List from './List';
import Product from './Product';
import Review from './Review';
import Done from './Done';
import {CartIcon, Cta, CtaNudge, IBar, Ph, PopIn, SlideIn, Spinner, Toast, styles as s, useOnce} from './bits';
import {address, byId, etaLabel, inr} from './data';

const FLY = Easing.bezierFn(0.55, 0, 0.35, 1);
const FLY_MS = 760;

/**
 * `.fly`: the product photo arcs from the Add to cart button to the cart
 * (offset-path `M300 790 Q 380 420 352 66` in the 390×844 frame), shrinking
 * to .35 and fading to .7 over .75s.
 */
function Fly({img, from, via, to}) {
  const p = useOnce(750, 0, FLY);
  const a = useAnimatedStyle(() => {
    const t = p.value;
    const u = 1 - t;
    const x = u * u * from.x + 2 * u * t * via.x + t * t * to.x;
    const y = u * u * from.y + 2 * u * t * via.y + t * t * to.y;
    return {
      opacity: 1 - 0.3 * t,
      transform: [{translateX: x - 24}, {translateY: y - 24}, {scale: 1 - 0.65 * t}],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.fly, a]}>
      {img ? <Image source={img} resizeMode="cover" style={styles.flyImg} /> : <Ph size={12} />}
    </Animated.View>
  );
}

export default function IvaShop({navigation}) {
  const {width, height} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  useRenderCount('IvaShop');
  useFirstFrame('IvaShop');
  useJsFps('IvaShop', isFocused);
  const eta = useMemo(etaLabel, []);

  const [v, setV] = useState('list'); // list | prod | review | done
  const [back, setBack] = useState(false);
  const [from, setFrom] = useState('list');
  const [pid, setPid] = useState('blessed');
  const [pq, setPq] = useState(1);
  const [cart, setCart] = useState({});
  const [bump, setBump] = useState(0);
  const [fly, setFly] = useState(false);
  const [addr, setAddr] = useState(address);
  const [draft, setDraft] = useState(address);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const timers = useRef([]);
  const later = useCallback((fn, ms) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const cur = byId[pid];
  const lines = Object.entries(cart).filter(([, q]) => q > 0);
  const count = lines.reduce((n, [, q]) => n + q, 0);
  const sub = lines.reduce((n, [k, q]) => n + q * byId[k].price, 0);
  const subLabel = inr(sub);

  const go = useCallback((next, isBack = false) => {
    markTap(`iva:${next}`);
    setBack(isBack);
    setV(next);
  }, []);
  const open = useCallback(
    id => {
      setPid(id);
      setPq(1);
      go('prod');
    },
    [go],
  );
  const goList = useCallback(() => go('list', true), [go]);
  const goCart = useCallback(() => {
    setFrom(v);
    go('review');
  }, [go, v]);
  const backFromReview = useCallback(() => go(from === 'prod' ? 'prod' : 'list', true), [go, from]);
  const toHub = useCallback(
    () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Hub')),
    [navigation],
  );
  const home = useCallback(() => {
    navigation.popToTop();
    navigation.navigate('HomeStack', {screen: 'HomePage'});
  }, [navigation]);

  const addToCart = useCallback(() => {
    const id = pid;
    const q = pq;
    setFly(true);
    later(() => {
      setCart(c => ({...c, [id]: (c[id] || 0) + q}));
      setFly(false);
      setBump(b => b + 1);
    }, FLY_MS);
  }, [pid, pq, later]);

  const setQ = useCallback((id, q) => setCart(c => ({...c, [id]: Math.max(0, q)})), []);
  const decLine = useCallback(id => setQ(id, (cart[id] || 0) - 1), [cart, setQ]);
  const incLine = useCallback(id => setQ(id, (cart[id] || 0) + 1), [cart, setQ]);

  const toggleAddr = useCallback(() => {
    setDraft(addr);
    setEditing(e => !e);
  }, [addr]);
  const saveAddr = useCallback(() => {
    setAddr(a => ({...a, ...draft}));
    setEditing(false);
    setToast('Address updated');
    later(() => setToast(''), 1600);
  }, [draft, later]);

  const placeOrder = useCallback(() => {
    if (busy) {
      return;
    }
    setBusy(true);
    later(() => {
      setBusy(false);
      go('done');
    }, 1200);
  }, [busy, go, later]);
  const shopMore = useCallback(() => {
    setCart({});
    go('list', true);
  }, [go]);

  // The internal views are one route: the iOS swipe would leave the shop.
  useLayoutEffect(() => {
    navigation.setOptions({gestureEnabled: v === 'list'});
  }, [navigation, v]);

  // Android back walks the views; it waits out the order and leaves success for Home.
  useEffect(() => {
    if (v === 'list') {
      return;
    }
    const sub_ = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy) {
        return true;
      }
      if (v === 'done') {
        home();
      } else if (v === 'review') {
        if (editing) {
          setEditing(false);
        } else {
          backFromReview();
        }
      } else {
        goList();
      }
      return true;
    });
    return () => sub_.remove();
  }, [v, busy, editing, home, backFromReview, goList]);

  const top = Math.max(20, insets.top + 8);
  const barBottom = Math.max(12, insets.bottom - 18);
  const inCart = !!cart[pid] || fly;

  let view = null;
  if (v === 'list') {
    view = <List top={top} bottom={insets.bottom} count={count} bump={bump} onBack={toHub} onCart={goCart} onOpen={open} />;
  } else if (v === 'prod') {
    view = (
      <Product
        p={cur}
        qty={pq}
        top={top}
        eta={eta}
        city={addr.city}
        count={count}
        bump={bump}
        onBack={goList}
        onCart={goCart}
        onDec={() => setPq(q => Math.max(q - 1, 1))}
        onInc={() => setPq(q => Math.min(q + 1, 9))}
      />
    );
  } else if (v === 'review') {
    view = (
      <Review
        top={top}
        lines={lines}
        count={count}
        subLabel={subLabel}
        addr={addr}
        editing={editing}
        draft={draft}
        setDraft={setDraft}
        eta={eta}
        onBack={backFromReview}
        onDec={decLine}
        onInc={incLine}
        onToggleAddr={toggleAddr}
        onSaveAddr={saveAddr}
        onBrowse={goList}
      />
    );
  }

  return (
    <View style={styles.page}>
      <LoopGate active={isFocused}>
        {view ? (
          <SlideIn key={v} back={back} style={styles.flex}>
            {view}
          </SlideIn>
        ) : null}

        {v === 'prod' && !cur.soldOut ? (
          <IBar key="bar-prod" bottom={barBottom}>
            <View style={styles.flex}>
              <Text style={s.tlabel}>
                {pq} × {inr(cur.price)}
              </Text>
              <Text style={[s.tval, styles.barVal]}>{inr(pq * cur.price)}</Text>
            </View>
            {inCart ? (
              <PopIn key="view">
                <Cta label="View cart" onPress={goCart} style={styles.barCta} after={<CtaNudge />} />
              </PopIn>
            ) : (
              <Cta key="add" label="Add to cart" onPress={addToCart} style={styles.barCta}>
                <CartIcon color={colors.ink} />
              </Cta>
            )}
          </IBar>
        ) : null}

        {fly ? (
          <Fly
            img={cur.img}
            from={{x: width - 90, y: height - barBottom - 42}}
            via={{x: width - 10, y: height / 2}}
            to={{x: width - 38, y: top + 22}}
          />
        ) : null}

        {v === 'review' && count > 0 ? (
          <IBar key="bar-review" bottom={barBottom}>
            <View style={styles.flex}>
              <Text style={s.tlabel}>Total payable</Text>
              <Text style={[s.tval, styles.barVal]}>{subLabel}</Text>
            </View>
            <Cta label={busy ? 'Placing…' : 'Place order'} onPress={placeOrder} style={styles.payCta}>
              {busy ? <Spinner /> : null}
            </Cta>
          </IBar>
        ) : null}

        {v === 'done' ? (
          <Done
            orderId={`IVA${10240 + count}`}
            totalLabel={subLabel}
            city={addr.city}
            eta={eta}
            insets={insets}
            onMore={shopMore}
            onHome={home}
          />
        ) : null}

        <Toast msg={toast} top={top + 52} />
      </LoopGate>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {flex: 1, backgroundColor: colors.ground},
  flex: {flex: 1},
  barVal: {fontSize: 18, letterSpacing: -0.18},
  barCta: {height: 50, minWidth: 170},
  payCta: {height: 50, minWidth: 150},
  fly: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.gold,
    zIndex: 70,
    elevation: 70,
  },
  flyImg: {width: '100%', height: '100%'},
});
