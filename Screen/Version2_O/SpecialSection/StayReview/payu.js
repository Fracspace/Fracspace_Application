// PayU CheckoutPro (payu-non-seam-less-react) for a stay payment. The server
// sends everything the SDK needs in `payment.sdk` and signs the hashes; this
// opens the checkout and resolves with what the SDK reported, for
// POST /payment-result. It never decides whether the payment went through.
import {Alert, NativeEventEmitter} from 'react-native';
import PayUBizSdk from 'payu-non-seam-less-react';
import {payuHash} from '../api/stays';

const ENDS = ['onPaymentSuccess', 'onPaymentFailure', 'onPaymentCancel', 'onError'];

/** Resolves to `{event, ...sdkData}` once the checkout closes; never rejects. */
export function openPayU(payment) {
  return new Promise(resolve => {
    if (!PayUBizSdk) {
      // The installed app was built before the SDK was added.
      resolve({event: 'onError', errorMsg: 'PayU SDK is not in this build'});
      return;
    }
    const sdk = payment.sdk || {};
    const emitter = new NativeEventEmitter(PayUBizSdk);
    const subs = [];
    const finish = result => {
      subs.forEach(s => s.remove());
      resolve(result);
    };
    // An empty hash leaves the checkout on "processing", and the SDK can't be
    // closed from here, so a hash that can't be signed gets an alert (shown
    // over the checkout) asking the guest to close it; that ends as a cancel.
    let warned = false;
    subs.push(
      emitter.addListener('generateHash', e => {
        const {hashName, hashString, hashType, postSalt} = e;
        if (__DEV__) {
          console.log('[payu] generateHash', hashName, `hashType=${hashType}`, `fields=${Object.keys(e)}`);
        }
        payuHash({attemptId: payment.attemptId, hashName, hashString, hashType, postSalt})
          .then(r => {
            if (!r?.hash) {
              throw new Error('No hash in the response');
            }
            PayUBizSdk.hashGenerated({[hashName]: r.hash});
          })
          .catch(err => {
            if (__DEV__) {
              console.log('[payu] hash failed', hashName, err?.status, err?.message);
            }
            if (!warned) {
              warned = true;
              Alert.alert(
                'Payment could not start',
                'Please close the payment screen and try again.' +
                  (__DEV__ ? `\n\n[dev] ${hashName}: ${err?.message || 'no hash'}` : ''),
              );
            }
          });
      }),
    );
    ENDS.forEach(event =>
      subs.push(
        emitter.addListener(event, e => {
          if (__DEV__) {
            console.log('[payu] event', event, e?.errorMsg || '');
          }
          finish({event, ...e});
        }),
      ),
    );
    try {
      PayUBizSdk.openCheckoutScreen({
        payUPaymentParams: {
          key: sdk.key,
          transactionId: sdk.txnid,
          amount: String(sdk.amount),
          productInfo: sdk.productinfo,
          firstName: sdk.firstname,
          email: sdk.email,
          phone: sdk.phone,
          ios_surl: sdk.surl,
          ios_furl: sdk.furl,
          android_surl: sdk.surl,
          android_furl: sdk.furl,
          environment: sdk.environment,
          userCredential: sdk.userCredential,
          additionalParam: {payment: sdk.hashes?.payment},
        },
        payUCheckoutProConfig: {merchantName: 'Fracspace'},
      });
    } catch (e) {
      finish({event: 'onError', errorMsg: e?.message || 'Could not open PayU'});
    }
  });
}
