import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Hub from '../Version2_O/SpecialSection/Hub';
import Stays from '../Version2_O/SpecialSection/Stays';
import StayDetail from '../Version2_O/SpecialSection/StayDetail';
import StayReview from '../Version2_O/SpecialSection/StayReview';
import IvaShop from '../Version2_O/SpecialSection/IvaShop';
import ConcertDetails from '../Version2_O/Concert/ConcertDetails';
import ConcertBookings from '../Version2_O/Concert/ConcertBookings';
import ConcertBookingDetail from '../Version2_O/Concert/ConcertBookingDetail';
import ConcertCheckout from '../Version2_O/Concert/ConcertCheckout';
import ConcertReviewBooking from '../Version2_O/Concert/ConcertReviewBooking';
import ConcertPaymentPage from '../Version2_O/Concert/ConcertPaymentPage';
import ConcertBookingSuccess from '../Version2_O/Concert/ConcertBookingSuccess';
import ConcertBookingFailed from '../Version2_O/Concert/ConcertBookingFailed';
import ConcertTicketQR from '../Version2_O/Concert/ConcertTicketQR';

const Stack = createNativeStackNavigator();

// Centre tab: Special Section (dark). Stays/StayDetail/StayReview/IvaShop are
// filled in by their own folders; Concerts reuse the existing screens so their
// flow (and back) stays inside this tab.
export default function SpecialSectionStack() {
  return (
    <Stack.Navigator
      initialRouteName="Hub"
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#050506' } }}
    >
      <Stack.Screen name="Hub" component={Hub} />
      <Stack.Screen name="Stays" component={Stays} />
      <Stack.Screen name="StayDetail" component={StayDetail} />
      <Stack.Screen name="StayReview" component={StayReview} />
      <Stack.Screen name="IvaShop" component={IvaShop} />

      {/* ------ Concerts (existing screens) ------ */}
      <Stack.Screen name="ConcertDetails" component={ConcertDetails} />
      <Stack.Screen name="ConcertBookings" component={ConcertBookings} />
      <Stack.Screen name="ConcertBookingDetail" component={ConcertBookingDetail} />
      <Stack.Screen name="ConcertCheckout" component={ConcertCheckout} />
      <Stack.Screen name="ConcertReviewBooking" component={ConcertReviewBooking} />
      <Stack.Screen name="ConcertPaymentPage" component={ConcertPaymentPage} />
      <Stack.Screen name="ConcertBookingSuccess" component={ConcertBookingSuccess} />
      <Stack.Screen name="ConcertBookingFailed" component={ConcertBookingFailed} />
      <Stack.Screen name="ConcertTicketQR" component={ConcertTicketQR} options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
    </Stack.Navigator>
  );
}
