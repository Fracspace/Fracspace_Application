import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomePage from '../Version2_O/HomePage';
import Blogs from '../Version2_O/Blogs';
import Home from '../Home';
import Packages from '../Version2_O/Packages';
import InteriorForm from '../Version2_O/InteriorForm';
import DreamscapeHome from '../Version2_O/DreamscapeHome';
import Property from '../Property';
import RoomListing from '../Version2_O/RoomListing';
import Book from '../Book';
import Enquirenew from '../Enquirenew';
import Review from '../Review';
import LableProperty from '../Version2_O/LableProperty';
import LablePropertyDis from '../Version2_O/LablePropertyDis';
import EnquirtyFS from '../Version2_O/EnquirtyFS';
import InteriorFormSec from '../Version2_O/InteriorFormSec';
import InteriorFSec from '../Version2_O/InteriorFSec';
import InteriorFormThird from '../Version2_O/InteriorFormThird';
import Locationview from '../Version2_O/Locationview';
import Like from '../Like';
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

export default function HomeStack() {
  return (
    <Stack.Navigator initialRouteName='HomePage' screenOptions={{ headerShown: false }}>
        <Stack.Screen name="HomePage" component={HomePage} />
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Property" component={Property} />
        <Stack.Screen name="Book" component={Book} />
        <Stack.Screen name="Enquirenew" component={Enquirenew} />
        <Stack.Screen name="Review" component={Review} />
        <Stack.Screen name="Like" component={Like} />

        {/* ------ Altaira ----- */}
        <Stack.Screen name="LableProperty" component={LableProperty}/>
        <Stack.Screen name="LablePropertyDis" component={LablePropertyDis}/>
        {/* Aliases for route names used by the Android app */}
        <Stack.Screen name="IntroAnim" component={LableProperty}/>
        <Stack.Screen name="LabelsDescription" component={LablePropertyDis}/>
        <Stack.Screen name="Packages" component={Packages}/>

        {/* ------ Interior ------- */}
        <Stack.Screen name="InteriorForm" component={InteriorForm}/>
        <Stack.Screen name="InteriorFormSec" component={InteriorFormSec}/>
        <Stack.Screen name="InteriorFSec" component={InteriorFSec}/>
        <Stack.Screen name="InteriorFormThird" component={InteriorFormThird}/>
        <Stack.Screen name="Locationview" component={Locationview}/>
        <Stack.Screen name="ConcertDetails" component={ConcertDetails}/>
        <Stack.Screen name="ConcertBookings" component={ConcertBookings}/>
        <Stack.Screen name="ConcertBookingDetail" component={ConcertBookingDetail}/>
        <Stack.Screen name="ConcertCheckout" component={ConcertCheckout}/>
        <Stack.Screen name="ConcertReviewBooking" component={ConcertReviewBooking}/>
        <Stack.Screen name="ConcertPaymentPage" component={ConcertPaymentPage}/>
        <Stack.Screen name="ConcertBookingSuccess" component={ConcertBookingSuccess}/>
        <Stack.Screen name="ConcertBookingFailed" component={ConcertBookingFailed}/>
        <Stack.Screen name="ConcertTicketQR" component={ConcertTicketQR} options={{ presentation: 'fullScreenModal', animation: 'fade' }}/>

        {/* ------ Dreamscape ------ */}
        <Stack.Screen name="DreamscapeHome" component={DreamscapeHome}/>
        {/* <Stack.Screen name="RoomListing" component={RoomListing}/> */}
        <Stack.Screen name="EnquirtyFS" component={EnquirtyFS}/>


        <Stack.Screen name="Blogs" component={Blogs}/>
        {/* <Stack.Screen name="CoOwnHomePage" component={CoOwnHomePage}/> */}
        {/* <Stack.Screen name="PropertyListing" component={PropertyListing} />
        <Stack.Screen name="CoOwnPropDetail" component={CoOwnPropDetail} />
        <Stack.Screen name='EnquireNow' component={EnquireNow} />
        <Stack.Screen name="BookingScreen" component={BookingScreen} />
        <Stack.Screen name="PaymentStatus" component={PaymentStatus} /> */}
    </Stack.Navigator>
  );
}