import React, { useContext } from 'react';
import WalletStack from './WalletStack';
import { AppContext } from '../Context/AppContext';
import ProfileVerification from '../Version2_O/ProfileVerification';
import KycOverview from '../Version2_O/Kyc/KycOverview';
import { KYC_FLOW_ENABLED } from '../Version2_O/Kyc/config';

export default function VerificationOrWallet({ navigation }) {
  const {globalState} = useContext(AppContext);
  const user = globalState?.userDetails;

  if (user?.verification) {
    return <WalletStack />;
  }

  // New e-KYC for anyone who hasn't sent documents the old way; customers
  // already waiting on a manual review keep seeing that screen.
  if (KYC_FLOW_ENABLED && !(user?.documents?.length > 0)) {
    return <KycOverview />;
  }

  return <ProfileVerification />;
}
