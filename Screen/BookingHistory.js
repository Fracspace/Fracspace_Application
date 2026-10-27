import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import React, {useCallback, useContext, useEffect, useState} from 'react';
import IconCheck from 'react-native-vector-icons/Ionicons';
import Back from './Back';
import {GetBookingCancleedCoOwned, GetBookingDetails} from './Services/UserApi';
import {AppContext} from './Context/AppContext';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  BOOKING_STATUS,
  canCancelBooking,
  getBookingStageIndex,
  getRemainingCancellationDays,
  normalizeBookingStatus,
} from './constants/bookingEnums';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// Accepts ISO dates and the older "M/D/YYYY" format.
const formatBookingDate = value => {
  if (!value) {
    return '';
  }
  const legacy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(value).trim());
  const date = legacy
    ? new Date(Number(legacy[3]), Number(legacy[1]) - 1, Number(legacy[2]))
    : new Date(value);
  if (isNaN(date.getTime())) {
    return String(value);
  }
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

const formatAmount = amount => {
  const value = Number(amount);
  return Number.isFinite(value) ? value.toLocaleString('en-IN') : '0';
};

const STATUS_TEXT = {
  [BOOKING_STATUS.PENDING]: {text: 'Payment not completed', color: '#919398'},
  [BOOKING_STATUS.FAILED]: {text: 'Payment failed', color: '#B60505'},
  [BOOKING_STATUS.CANCELLATION_REQUESTED]: {
    text: 'Cancellation requested',
    color: '#B60505',
  },
  [BOOKING_STATUS.CANCELLED]: {text: 'Booking cancelled', color: '#B60505'},
};

const StepIcon = ({done, failed}) => {
  if (done) {
    return <IconCheck name="checkmark-circle" size={25} color="#0E9625" />;
  }
  if (failed) {
    return <IconCheck name="close-circle" size={25} color="#B60505" />;
  }
  return <IconCheck name="ellipse-outline" size={25} color="#919398" />;
};

export default function BookingHistory(props) {
  const {globalState} = useContext(AppContext);
  const [Bookingdata, setBookingdata] = useState(
    props?.route?.params?.booking || [],
  );
  const [cancellingId, setCancellingId] = useState(null);

  const fetchBookings = useCallback(async () => {
    try {
      let {data: res} = await GetBookingDetails(
        JSON.stringify({email: globalState?.userEmail}),
      );
      if (res?.success && Array.isArray(res?.data)) {
        setBookingdata(res.data);
      }
    } catch (error) {
      // Keep showing the list passed in from Profile.
    }
  }, [globalState?.userEmail]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleBookingCancel = async item => {
    setCancellingId(item?.id);
    let payload = JSON.stringify({
      email: globalState?.userEmail,
      bookingReference: item?.bookingReference,
      propertyId: item?.propertyId,
    });
    try {
      let {data: res} = await GetBookingCancleedCoOwned(payload);

      if (res?.success) {
        Alert.alert('Cancellation Request:', `${res?.message}`);
        await fetchBookings();
      }
    } catch (error) {
      if (error.response) {
        Alert.alert('Response error:', `${error?.response?.data?.message}`);
      } else if (error.request) {
        Alert.alert('Request error:', 'Please Check Your Internet Connection');
      } else {
        Alert.alert('Error:', `${error?.message}`);
      }
    } finally {
      setCancellingId(null);
    }
  };

  const confirmBookingCancel = item => {
    Alert.alert(
      'Cancel Booking',
      `Cancel your booking for ${item?.propertyName}? Platform fee is non-refundable.`,
      [
        {text: 'No', style: 'cancel'},
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => handleBookingCancel(item),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: '#021265'}}>
      <View style={{flex: 1}}>
        <Back title={'Booking History'} />
        <ScrollView style={{backgroundColor: '#FAFAFF', padding: 10}}>
          {Bookingdata.map((item, index) => {
            const status = normalizeBookingStatus(item);
            const stageIndex = getBookingStageIndex(item);
            const isPaid = status === BOOKING_STATUS.SUCCESS || stageIndex >= 0;
            const bookingFailed =
              status === BOOKING_STATUS.FAILED ||
              status === BOOKING_STATUS.CANCELLED;
            const fullPaymentDone = stageIndex >= 1;
            const allotted = stageIndex >= 2;
            const remainingDays = getRemainingCancellationDays(item);
            const showCancel = canCancelBooking(item);
            const isCancelling = cancellingId === item?.id;
            const statusText = STATUS_TEXT[status];

            return (
              <View style={{width: '100%', flex: 1}} key={item?.id || index}>
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 10,
                    padding: 10,
                    margin: 10,
                  }}>
                  <Text
                    style={{
                      color: '#000000',
                      fontFamily: 'WorkSans-SemiBold',
                      fontSize: 16,
                    }}>
                    {item?.propertyName}
                  </Text>
                  {!!item?.propertyLocation && (
                    <Text
                      style={{
                        color: '#919398',
                        fontFamily: 'WorkSans-Regular',
                        fontSize: 12,
                      }}>
                      {item.propertyLocation}
                    </Text>
                  )}
                  <View
                    style={{flexDirection: 'row', justifyContent: 'flex-start'}}>
                    <View style={{marginTop: 10}}>
                      <View style={{paddingBottom: 0, marginRight: 8}}>
                        <StepIcon done={isPaid} failed={bookingFailed} />
                      </View>
                      <Text
                        style={{
                          paddingLeft: 30,
                          borderStyle: 'dashed',
                          borderColor: '#000000',
                          borderBottomWidth: 2,
                          marginTop: 10,
                          transform: [{rotate: '90deg'}],
                        }}>
                        {'   '}
                      </Text>
                      <View style={{paddingTop: 5}}>
                        <StepIcon done={fullPaymentDone} />
                      </View>
                      <Text
                        style={{
                          borderStyle: 'dashed',
                          borderColor: '#000000',
                          borderBottomWidth: 2,
                          marginTop: 10,
                          transform: [{rotate: '90deg'}],
                        }}>
                        {''}
                      </Text>
                      <View style={{paddingTop: 5}}>
                        <StepIcon done={allotted} />
                      </View>
                    </View>
                    <View style={{marginLeft: -10, flex: 1}}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          borderBottomWidth: 1,
                          borderColor: '#F6F6F6',
                          paddingVertical: 10,
                          width: '100%',
                          flex: 1,
                        }}>
                        <View style={{flex: 1}}>
                          <Text
                            style={{
                              color: '#000000',
                              fontFamily: 'WorkSans-Medium',
                              fontSize: 14,
                            }}>
                            {isPaid ? 'Booking Amount Paid' : 'Booking Amount'}
                          </Text>
                          {status === BOOKING_STATUS.SUCCESS ||
                          !statusText ? (
                            <Text
                              style={{
                                color: '#000000',
                                fontFamily: 'WorkSans-Regular',
                                fontSize: 12,
                              }}>
                              {item?.bookingDate
                                ? `Paid on ${formatBookingDate(item.bookingDate)}`
                                : 'Status: Paid'}
                            </Text>
                          ) : (
                            <Text
                              style={{
                                color: statusText.color,
                                fontFamily: 'WorkSans-Regular',
                                fontSize: 12,
                              }}>
                              Status: {statusText.text}
                            </Text>
                          )}
                        </View>
                        <Text
                          style={{
                            color: '#000000',
                            fontFamily: 'WorkSans-Medium',
                            fontSize: 14,
                            textAlign: 'right',
                          }}>
                          ₹{formatAmount(item?.totalBookingAmount)}/-
                        </Text>
                      </View>
                      <View
                        style={{
                          borderBottomWidth: 1,
                          borderBottomColor: '#F6F6F6',
                          paddingVertical: 10,
                        }}>
                        <Text
                          style={{
                            color: '#000000',
                            fontFamily: 'WorkSans-Medium',
                            fontSize: 14,
                          }}>
                          Frac Full Payment
                        </Text>
                        <Text
                          style={{
                            color: '#000000',
                            fontFamily: 'WorkSans-Regular',
                            fontSize: 12,
                          }}>
                          Status: {fullPaymentDone ? 'Paid' : 'Yet to pay'}
                        </Text>
                      </View>
                      <View
                        style={{
                          borderBottomWidth: 1,
                          borderBottomColor: '#F6F6F6',
                          paddingVertical: 10,
                        }}>
                        <Text
                          style={{
                            color: '#000000',
                            fontFamily: 'WorkSans-Medium',
                            fontSize: 14,
                          }}>
                          Frac Allotment
                        </Text>
                        <Text
                          style={{
                            color: '#000000',
                            fontFamily: 'WorkSans-Regular',
                            fontSize: 12,
                          }}>
                          Status: {allotted ? 'Allotted' : 'Yet to allocate'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {showCancel && (
                    <>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          paddingVertical: 10,
                        }}>
                        <TouchableOpacity
                          disabled={isCancelling}
                          onPress={() => confirmBookingCancel(item)}
                          style={{
                            borderRadius: 10,
                            backgroundColor: '#B605051A',
                            paddingVertical: 10,
                            paddingHorizontal: 30,
                            borderColor: '#B60505',
                            borderWidth: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 150,
                          }}>
                          {isCancelling ? (
                            <ActivityIndicator size="small" color="#B60505" />
                          ) : (
                            <Text
                              style={{
                                color: '#B60505',
                                fontFamily: 'Poppins-Medium',
                                fontSize: 12,
                              }}>
                              Cancel Booking
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>

                      <Text
                        style={{
                          color: '#000000',
                          fontFamily: 'WorkSans-Regular',
                          fontSize: 12,
                        }}>
                        Note: Free cancellation ends in {remainingDays}{' '}
                        {remainingDays === 1 ? 'day' : 'days'}. Platform fee is
                        non-refundable.
                      </Text>
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
