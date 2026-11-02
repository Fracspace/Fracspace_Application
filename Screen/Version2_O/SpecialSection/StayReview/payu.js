// PayU CheckoutPro (payu-non-seam-less-react) for a stay payment. The server
// sends everything the SDK needs in `payment.sdk` and signs the hashes; this
// opens the checkout and resolves with what the SDK reported, for
// POST /payment-result. It never decides whether the payment went through.
import {NativeEventEmitter} from 'react-native';
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
    subs.push(
      emitter.addListener('generateHash', ({hashName, hashString, postSalt}) => {
        payuHash({attemptId: payment.attemptId, hashName, hashString, postSalt})
          .then(r => PayUBizSdk.hashGenerated({[hashName]: r.hash}))
          // An unsigned hash makes the SDK fail that step on its own.
          .catch(() => PayUBizSdk.hashGenerated({[hashName]: ''}));
      }),
    );
    ENDS.forEach(event => subs.push(emitter.addListener(event, e => finish({event, ...e}))));
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
