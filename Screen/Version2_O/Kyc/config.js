/**
 * Shows the new e-KYC flow in the Verification tab instead of the old
 * document upload. Dev builds only for now: the backend isn't deployed and the
 * owner hasn't decided how unverified customers move over (App Controls switch).
 * Release builds keep ProfileVerification.js exactly as it is.
 */
export const KYC_FLOW_ENABLED = __DEV__;
