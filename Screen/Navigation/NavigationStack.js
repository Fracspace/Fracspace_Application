import React, { useState, useEffect, useContext, useLayoutEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Home from '../Home';
import Property from '../Property';
import Enquire from '../Enquire';
import Profile from '../Profile';
import Like from '../Like';
import Owned from '../Owned';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileDetails } from '../Services/UserApi';
import { AppContext } from '../Context/AppContext';
import Privacy from '../Privacy';
import Aboutus from '../Aboutus';
import Dashboard from '../Dashboard';
import Chat from '../Chat';
import BookNow from '../BookNow';
import Enquirenew from '../Enquirenew';
import Book from '../Book';
import Review from '../Review';
import MyProfile from '../MyProfile';
import TermsAndCondition from '../TermsAndCondition';
import SiteHistory from '../SiteHistory';
import BookingHistory from '../BookingHistory';
import DisplayDoc from '../DisplayDoc';
import BookingStatus from '../BookingStatus';
import Payment from '../Payment';
import VideoDisplay from '../VideoDisplay';
import PaymentPage from '../PaymentPage';
import { LaunchBackdrop, LaunchLogo } from '../components/LaunchSplash';
import NewLogin from '../Version2_O/NewLogin';
import NewSigin from '../Version2_O/NewSigin';
import HomePage from '../Version2_O/HomePage';
import InteriorForm from '../Version2_O/InteriorForm';
import InteriorFormSec from '../Version2_O/InteriorFormSec';
import InteriorFSec from '../Version2_O/InteriorFSec';
import InteriorFormThird from '../Version2_O/InteriorFormThird';
import PropertyListing from '../Version2_O/PropertyListing';
import Filter from '../Version2_O/Filter';
import PropertyDetailsNew from '../Version2_O/PropertyDetailsNew';
import Locationview from '../Version2_O/Locationview';
import SelectRoom from '../Version2_O/SelectRoom';
import DreamscapeHome from '../Version2_O/DreamscapeHome';
import RoomListing from '../Version2_O/RoomListing';
import VideoTour from '../Version2_O/VideoTour';
import RoomDescription from '../Version2_O/RoomDescription';
import Ourstay from '../Version2_O/Ourstay';
import FeedbackForm from '../Version2_O/FeedbackForm';
import MonthlyInsight from '../Version2_O/MonthlyInsight';
import Transfer from '../Version2_O/Transfer';
import NotificationsScreen from '../Version2_O/NotificationsScreen';
import Blogs from '../Version2_O/Blogs';
import Label from '../Version2_O/Label';
import Wallet from '../Version2_O/Wallet';
import LableProperty from '../Version2_O/LableProperty';
import LablePropertyDis from '../Version2_O/LablePropertyDis'
import WalletAmount from '../Version2_O/WalletAmount';
import PaidSuccessfully from '../Version2_O/PaidSuccessfully';
import Packages from '../Version2_O/Packages';
import PdfViewerScreen from '../Version2_O/PdfScreen';
import AltairaExperience from '../Version2_O/altaira/AltairaExperience';
import EdgeFab from '../Version2_O/altaira/FloatingButton';
import BottomNavigations from './BottomNavigation';
import LiveStream from '../Version2_O/altaira/LiveStream';
import EnquirtyFS from '../Version2_O/EnquirtyFS';
import VerificationOrWallet from './VerificationOrWallet';
import PaymentSummaryScreen from '../Version2_O/PaymentSummaryScreen';
import MembershipProfile from '../Version2_O/escapeMembership/MembershipProfile';
import MembershipProprtyDesc from '../Version2_O/escapeMembership/MembershipProprtyDesc';
import PaymentSuccessEscape from '../Version2_O/escapeMembership/PaymentSuccessEscape';
import PaymentFailedEscape from '../Version2_O/escapeMembership/PaymentFailedEscape';
import EscapePaymentPage from '../Version2_O/escapeMembership/EscapePaymentPage';
import TranHisForEscape from '../Version2_O/escapeMembership/TranHisForEscape';
import MembershipHome from '../Version2_O/escapeMembership/MembershipHome';
import PackageDescription from '../Version2_O/PackageDescription';
import AddressSearchScreen from '../Version2_O/AddressSearchScreen';
import CompleteProfileScreen from '../Version2_O/CompleteProfileScreen';
import ConcertDetails from '../Version2_O/Concert/ConcertDetails';
import ConcertBookings from '../Version2_O/Concert/ConcertBookings';
import ConcertBookingDetail from '../Version2_O/Concert/ConcertBookingDetail';
import ConcertCheckout from '../Version2_O/Concert/ConcertCheckout';
import ConcertReviewBooking from '../Version2_O/Concert/ConcertReviewBooking';
import ConcertPaymentPage from '../Version2_O/Concert/ConcertPaymentPage';
import ConcertBookingSuccess from '../Version2_O/Concert/ConcertBookingSuccess';
import ConcertBookingFailed from '../Version2_O/Concert/ConcertBookingFailed';


// Android passed {url} to "PdfViewerScreen"; the iOS PdfScreen reads {pdf}.
const PdfViewerScreenAlias = props => {
  const params = props?.route?.params || {};
  return (
    <PdfViewerScreen
      {...props}
      route={{ ...props.route, params: { ...params, pdf: params.pdf ?? params.url } }}
    />
  );
};

const Stack = createNativeStackNavigator();

export default function NavigationStack() {
  const { globalState, setGlobalState } = useContext(AppContext);
  const [Email, setEmail] = useState('');
  const [LoadingS, setLoadingS] = useState(true);
  const [token, setToken] = useState('');

// Updated handleProfile - More robust for deep linking
const handleProfile = async (emailId, tokenid) => {
  if (!emailId || !tokenid) {
    console.warn('Missing email or token for profile fetch');
    setToken('');
    setLoadingS(false);
    return;
  }

  // console.log('Fetching profile →', { email: emailId, token: tokenid });

  const payload = JSON.stringify({ email: emailId });

  try {
    const { data: res } = await ProfileDetails(payload, tokenid);

    if (res?.success) {
      setGlobalState(prev => ({
        ...prev,
        userName: res?.data?.userName,
        userEmail: emailId,
        token: tokenid,
        userPhone: res?.data?.phoneNumber,
        userDetails: res?.data,
        userProfile: res?.data?.profilePicture,
      }));

      setToken(tokenid);
      // console.log('Profile fetched successfully');
    } else {
      throw new Error(res?.message || 'Profile fetch failed');
    }
  } catch (error) {
    console.error('Profile fetch error:', error);

    const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';

    if (errorMessage.toLowerCase().includes('invalid token') || 
        error?.response?.status === 401) {
      
      console.log('Invalid/expired token detected → logging out');
      setToken('');
      await AsyncStorage.multiRemove(['mytoken', 'Email', 'concert_tickets_v1']);
      
      // Do NOT clear pendingDeepLink here - we want to keep it for after re-login
    } else {
      // Non-critical error - show alert but keep token and pending deep link
      Alert.alert(
        'Profile Error',
        errorMessage || 'Failed to load profile. Some features may be limited.',
      );
      // Keep the token so deep link flow can still work after login
      setToken(tokenid);
    }
  } finally {
    setLoadingS(false);
  }
};

// Improved handleAuth
const handleAuth = async () => {
  try {
    const [[, storedToken], [, storedEmail]] = await AsyncStorage.multiGet(['mytoken', 'Email']);

    if (storedToken && storedEmail) {
      // console.log('Stored token found, fetching profile...');
      await handleProfile(storedEmail, storedToken);
    } else {
      console.log('No stored token found');
      setToken('');
      setLoadingS(false);
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    setToken('');
    setLoadingS(false);
  }
};

// Keep your useLayoutEffect as is
useLayoutEffect(() => {
  handleAuth();
}, []);

// Logging in (NewLogin / NewSigin) only stores the token, name and email; the
// full profile was fetched at app start only, so screens that read
// globalState.userDetails stayed empty until the Profile tab refetched it.
// Load it whenever we are logged in without a profile. AppContext starts
// userDetails as [] (truthy), so check for a real profile, not just a value:
// otherwise a fresh install never loaded it after the first login.
// Once per login (token): if a profile ever comes back without an _id, or a
// screen stores one without it, this must not refetch in a loop.
const profileRequestedFor = useRef(null);
useEffect(() => {
  const token = globalState?.token;
  if (!LoadingS && token && globalState?.userEmail && !globalState?.userDetails?._id
      && profileRequestedFor.current !== token) {
    profileRequestedFor.current = token;
    handleProfile(globalState.userEmail, token);
  }
}, [LoadingS, globalState?.token, globalState?.userEmail, globalState?.userDetails]);


  if (LoadingS) {
    // Startup (reading the saved login). LaunchSplash covers this; it matches
    // it, so if the splash's time cap is reached first nothing changes.
    return (
      <LaunchBackdrop>
        <LaunchLogo />
      </LaunchBackdrop>
    );
  } else {
    return (
      <Stack.Navigator initialRouteName={token != '' ? 'BottomNavigations' : 'NewLogin'}>
        <Stack.Screen
          name="HomePage"
          component={HomePage}
          options={{ headerShown: false }}
        />
        {/* <Stack.Screen
          name="LoginPage"
          component={LoginPage}
          options={{ headerShown: false }}
        /> */}
        <Stack.Screen
          name="BottomNavigations"
          component={BottomNavigations}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="MembershipHome" component={MembershipHome} options={{headerShown:false}}/>
        <Stack.Screen name="MembershipProfile" component={MembershipProfile} options={{headerShown:false}}/>
        <Stack.Screen name="MembershipProprtyDesc" component={MembershipProprtyDesc} options={{headerShown:false}}/>
        <Stack.Screen name="PaymentSuccessEscape" component={PaymentSuccessEscape} options={{headerShown:false}}/>
        <Stack.Screen name="PaymentFailedEscape" component={PaymentFailedEscape} options={{headerShown:false}}/>
        <Stack.Screen name="EscapePaymentPage" component={EscapePaymentPage} options={{headerShown:false}}/>
        <Stack.Screen name="TranHisForEscape" component={TranHisForEscape} options={{headerShown:false}}/>
        <Stack.Screen name="PackageDescription" component={PackageDescription} options={{headerShown:false}}/>
        <Stack.Screen name="ConcertDetails" component={ConcertDetails} options={{headerShown:false}}/>
        <Stack.Screen name="ConcertBookings" component={ConcertBookings} options={{headerShown:false}}/>
        <Stack.Screen name="ConcertBookingDetail" component={ConcertBookingDetail} options={{headerShown:false}}/>
        <Stack.Screen name="ConcertCheckout" component={ConcertCheckout} options={{headerShown:false}}/>
        <Stack.Screen name="ConcertReviewBooking" component={ConcertReviewBooking} options={{headerShown:false}}/>
        <Stack.Screen name="ConcertPaymentPage" component={ConcertPaymentPage} options={{headerShown:false}}/>
        <Stack.Screen name="ConcertBookingSuccess" component={ConcertBookingSuccess} options={{headerShown:false}}/>
        <Stack.Screen name="ConcertBookingFailed" component={ConcertBookingFailed} options={{headerShown:false}}/>
        <Stack.Screen
          name="trails"
          component={EdgeFab}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="LiveStream"
          component={LiveStream}
          options={{ headerShown: false }}
        />
          <Stack.Screen
          name="AltairaExperience"
          component={AltairaExperience}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PdfViewer"
          component={PdfViewerScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Home"
          component={Home}
          options={{ headerShown: false }}
        />
     
        <Stack.Screen
          name="Property"
          component={Property}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Enquire"
          component={Enquire}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Profile"
          component={Profile}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Like"
          component={Like}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Owned"
          component={Owned}
          options={{ headerShown: false }}
        />
        {/* 2nd Phase */}
        <Stack.Screen
          name="Privacy"
          component={Privacy}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Aboutus"
          component={Aboutus}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Dashboard"
          component={Dashboard}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Chat"
          component={Chat}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BookNow"
          component={BookNow}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Book"
          component={Book}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Enquirenew"
          component={Enquirenew}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Review"
          component={Review}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MyProfile"
          component={MyProfile}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TermsAndCondition"
          component={TermsAndCondition}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SiteHistory"
          component={SiteHistory}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BookingHistory"
          component={BookingHistory}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DisplayDoc"
          component={DisplayDoc}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BookingStatus"
          component={BookingStatus}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Payment"
          component={Payment}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="VideoDisplay"
          component={VideoDisplay}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PaymentPage"
          component={PaymentPage}
          options={{ headerShown: false }}
        />

        {/* version2.0 */}
        <Stack.Screen
          name="NewLogin"
          component={NewLogin}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="NewSigin"
          component={NewSigin}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AddressSearchScreen"
          component={AddressSearchScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CompleteProfileScreen"
          component={CompleteProfileScreen}
          options={{ headerShown: false }}
        />
     

        <Stack.Screen
          name="InteriorForm"
          component={InteriorForm}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="InteriorFormSec"
          component={InteriorFormSec}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="InteriorFSec"
          component={InteriorFSec}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="InteriorFormThird"
          component={InteriorFormThird}
          options={{ headerShown: false }}
        />
       
        <Stack.Screen
          name="PropertyListing"
          component={PropertyListing}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Filter"
          component={Filter}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PropertyDetailsNew"
          component={PropertyDetailsNew}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Locationview"
          component={Locationview}
          options={{ headerShown: false }}
        />    
        <Stack.Screen
          name="EnquirtyFS"
          component={EnquirtyFS}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DreamscapeHome"
          component={DreamscapeHome}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RoomListing"
          component={RoomListing}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="VideoTour"
          component={VideoTour}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RoomDescription"
          component={RoomDescription}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SelectRoom"
          component={SelectRoom}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Ourstay"
          component={Ourstay}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FeedbackForm"
          component={FeedbackForm}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MonthlyInsight"
          component={MonthlyInsight}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Transfer"
          component={Transfer}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="NotificationsScreen"
          component={NotificationsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Blogs"
          component={Blogs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Wallet"
          component={Wallet}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="WalletAmount"
          component={WalletAmount}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PaidSuccessfully"
          component={PaidSuccessfully}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="Label"
          component={Label}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="LableProperty"
          component={LableProperty}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="LablePropertyDis"
          component={LablePropertyDis}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Packages"
          component={Packages}
          options={{ headerShown: false }}
        />

          <Stack.Screen
          name="PaymentSummary"
          component={PaymentSummaryScreen}
          options={{ headerShown: false }}
        />
        

        {/* ------ Aliases: route names used by the Android app / backend ------ */}
        <Stack.Screen name="SelectRoomFS" component={SelectRoom} options={{ headerShown: false }} />
        <Stack.Screen name="LabelsDescription" component={LablePropertyDis} options={{ headerShown: false }} />
        <Stack.Screen name="IntroAnim" component={LableProperty} options={{ headerShown: false }} />
        <Stack.Screen name="PdfViewerScreen" component={PdfViewerScreenAlias} options={{ headerShown: false }} />
        <Stack.Screen name="PropertyImages" component={Label} options={{ headerShown: false }} />
        <Stack.Screen name="EdgeFab" component={EdgeFab} options={{ headerShown: false }} />
      </Stack.Navigator>
    );
  }
}
