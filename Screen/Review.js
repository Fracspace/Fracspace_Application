import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';
import React, {useContext, useEffect, useRef, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import IconF from 'react-native-vector-icons/FontAwesome6';
import Icon from 'react-native-vector-icons/Ionicons';
import IconEdit from 'react-native-vector-icons/FontAwesome';
import IconH from 'react-native-vector-icons/MaterialCommunityIcons';
import {AppContext} from './Context/AppContext';
import Pdficon from 'react-native-vector-icons/FontAwesome5';
import {GetBookingAmountDate, PaymentPayU} from './Services/UserApi';
import { SafeAreaView } from 'react-native-safe-area-context';
import Back from './Back';
const {width, height} = Dimensions.get('window');

export default function Review(props) {
  const navigation = useNavigation();
  const [propertyImage, setPropertyImage] = useState(props?.route?.params?.PropertyImage);
  const [property, setProperty] = useState(props?.route?.params?.proprtyDetails?.data,);
  const [modalVisible, setModalVisible] = useState(false);
  const [SelectPic, setSelectPic] = useState(0);
  const {globalState, setGlobalState} = useContext(AppContext);
  const [Docs, setDocs] = useState(globalState?.userDetails?.documents);
  const [PanDoc, setPanDoc] = useState('');
  const [AadharDoc, setAadharDoc] = useState('');
  const [ChequeDoc, setChequeDoc] = useState('');


  const first = () => {
    for (let index = 0; index < Docs.length; index++) {
      if (Docs[index].includes('pan')) {
        setPanDoc(Docs[index]);
      } else if (Docs[index].includes('aadhar')) {
        setAadharDoc(Docs[index]);
      } else {
        setChequeDoc(Docs[index]);
      }
    }
  };

  const handlePayment1 = async () => {
    let id = `tnxnid-fracspace-app-${Date.now()}-${Math.floor(
      Math.random() * 10000,
    )}`;
    let payload = JSON.stringify({
      amount: property?.totalBookingAmount + 300*property?.numberOfFractions,
      productinfo: 'Co-ownership Product',
      firstname: globalState?.userName,
      email: globalState?.userDetails?.email,
      phone: globalState?.userDetails?.phoneNumber,
      txnid: id,
      surl: 'https://test.bunknbeyond.com/paymentsuccess',
      furl: 'https://test.bunknbeyond.com/paymentfailure',
    });

    try {
      let {data: res} = await PaymentPayU(payload);
      if (res?.success) {
        navigation.navigate('PaymentPage', {Link: res?.form, TxnID: id,property:property});
      }
    } catch (error) {
      if (error?.response) {
        Alert.alert('Response ErrorPPP', `${error?.response?.data?.message}`);
      } else if (error?.request) {
        // console.log('Request error:', ${JSON.stringify(error?.request)});
        Alert.alert('Request Error:', 'Please Check Your Internet Connection');
        // Alert.alert('Request error:', ${JSON.stringify(error?.request)});
      } else {
        //  console.log('error');
        Alert.alert('Error:', `${error}`);
      }
    }
  };

  // One payment request at a time: a second tap while the first is in flight
  // would make a second txnid and a second PayU form.
  const payingRef = useRef(false);
  const [paying, setPaying] = useState(false);

  const handlePayment = async () => {
  if (payingRef.current) {
    return;
  }
  payingRef.current = true;
  setPaying(true);
  try {
    const txnid = `fracspace${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const totalAmount =
      (Number(property?.totalBookingAmount) || 0) +
      300 * (Number(property?.numberOfFractions) || 0);

    if (!globalState?.userDetails?.email || !globalState?.userDetails?.phoneNumber) {
      Alert.alert('Error', 'Email or Phone number is missing');
      return;
    }

    const payload = JSON.stringify({
      amount: totalAmount.toFixed(2),
      productinfo: 'Co-ownership Product',
      firstname: globalState?.userName || 'User',
      email: globalState?.userDetails?.email,
      phone: globalState?.userDetails?.phoneNumber,
      txnid: txnid,
      surl: 'https://test.bunknbeyond.com/paymentsuccess',
      furl: 'https://test.bunknbeyond.com/paymentfailure',
    });

    let { data: res } = await PaymentPayU(payload);
//console.log(res,"=================res=======review===")
    if (res?.success && res?.form) {
      navigation.navigate('PaymentPage', {
        Link: res?.form,
        TxnID: txnid,
        property: property,
      });
    } else {
      Alert.alert('Payment Error', res?.message || 'Unable to initiate payment');
    }
  } catch (error) {
    if (error?.response) {
      Alert.alert('Response Error', error?.response?.data?.message || 'Server Error');
    } else if (error?.request) {
      Alert.alert('Network Error', 'Please check your internet connection');
    } else {
      Alert.alert('Error', error?.message || 'Something went wrong');
    }
  } finally {
    payingRef.current = false;
    setPaying(false);
  }
};

  useEffect(() => {
    first();
  }, []);

  return (
     <SafeAreaView style={{flex: 1,backgroundColor:"#021265"}}>
      <Back title={'Review'} />
      <ScrollView style={styles.reviewBeforePayment}>
        <Image
          style={{width: width * 0.89, height: height * 0.22, borderRadius: 10}}
          resizeMode="cover"
          source={{uri: propertyImage}}
        />
        <View
          style={{
            backgroundColor: '#FFFFFF',
            padding: 10,
            borderRadius: 10,

            marginVertical: 20,
          }}>
          <Text style={styles.title}>Property Details</Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingBottom: 8,
              width: '100%',
            }}>
            <Text style={[styles.text4Typo, {flex: 1}]}>Property Name</Text>
            <Text style={[styles.serenityHeights, {flex: 1}]}>
              {property?.propertyName}
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: 10,
              width: '100%',
            }}>
            <Text style={[styles.text4Typo, {flex: 1}]}>Frac Value</Text>
            <Text style={[styles.textTypo, {flex: 1}]}>
              {'\u20B9'}
              {property?.FC_Price}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: 10,
              width: '100%',
            }}>
            <Text style={[styles.text4Typo, {flex: 1}]}>Booking Amount</Text>
            <Text style={[styles.textTypo, {flex: 1}]}>
              {'\u20B9'}
              {property?.totalBookingAmount}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: 10,
              width: '100%',
            }}>
            <Text style={[styles.text4Typo, {flex: 1}]}>Platform Fee</Text>
            <Text style={[styles.textTypo, {flex: 1}]}>
              {'\u20B9 '}
              {300}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              width: '100%',
              alignItems: 'center',
              paddingBottom: 10,
            }}>
            <Text style={[styles.text4Typo, {flex: 1}]}>
              No of Fractions{'  '}
            </Text>
            <Text style={[styles.textTypo, {flex: 1}]}>
              {property?.numberOfFractions}
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              width: '100%',
              alignItems: 'center',
              paddingBottom: 10,
              // borderWidth:1
            }}>
            <Text
              style={[
                styles.text4Typo,
                {fontFamily: 'OpenSans-Bold', flex: 1},
              ]}>
              Total Amount{'  '}
            </Text>
            <Text
              style={[
                styles.textTypo,
                {fontFamily: 'OpenSans-Bold', flex: 1, opacity: 1},
              ]}>
              {'\u20B9 '}
              {property?.totalBookingAmount+property?.numberOfFractions*300}
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: 'white',
            padding: 10,
            borderRadius: 10,
            // marginHorizontal: 30,
            // marginTop: -40,
            marginBottom: 20,
          }}>
          <Text style={styles.title}>Personal Details</Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-start',
              alignItems: 'center',
              paddingBottom: 8,
            }}>
            <Icon name="person" size={20} color="#021265" />
            <Text
              style={{
                fontFamily: 'Montserrat-SemiBold',
                fontSize: 16,
                color: '#000000',
                paddingLeft: 10,
              }}>
              {globalState?.userDetails?.userName}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-start',
              alignItems: 'center',
              paddingBottom: 8,
            }}>
            <Icon name="mail" size={20} color="#021265" />
            <Text
              style={{
                fontFamily: 'Montserrat-SemiBold',
                fontSize: 14,
                color: '#000000',
                paddingLeft: 10,
              }}>
              {globalState?.userDetails?.email}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-start',
              alignItems: 'center',
              paddingBottom: 8,
            }}>
            <IconF name="phone-volume" size={20} color="#021265" />
            <Text
              style={{
                fontFamily: 'Montserrat-SemiBold',
                fontSize: 14,
                color: '#000000',
                paddingLeft: 10,
              }}>
              {globalState?.userDetails?.phoneNumber}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-start',
              alignItems: 'center',
              paddingBottom: 8,
              //flex:1
            }}>
            <IconF name="location-dot" size={20} color="#021265" />
            {/* One line, "…" at the end; flexShrink lets it fit inside the row. */}
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                fontFamily: 'Montserrat-SemiBold',
                fontSize: 14,
                color: '#000000',
                paddingLeft: 10,
                flexShrink: 1,
              }}>
              {/* Was "<address>Not Availble," every time. */}
              {globalState?.userDetails?.postalAddress
                ? [globalState?.userDetails?.postalAddress, globalState?.userDetails?.pincode]
                    .filter(Boolean)
                    .join(', ')
                : 'Not Available'}
              {/* Yorem ipsum dolor sit amet, consectetur adipiscing elit. */}
            </Text>
          </View>
        </View>

        {globalState?.userDetails?.verification &&<View
          style={{
            backgroundColor: 'white',
            padding: 10,
            borderRadius: 10,
            //marginHorizontal: 30,
            // marginTop: -40,
            marginBottom: 20,
          }}>
          <Text style={styles.title}>Pre-approval Documentation</Text>
          {globalState?.userDetails?.phoneNumber.startsWith('+91') &&
          globalState?.userDetails?.phoneNumber.length == 13 ? (
            <>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(!modalVisible);
                  setSelectPic(1);
                }}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                }}>
                    <View style={{ flexDirection: 'row',
                  justifyContent: 'flex-start',alignItems:'center'}}>
                  <Icon name="checkbox" size={30} color="#188C16" />
              
                <Text style={[styles.cardTypo]}>Pan Card</Text>
                </View>
                <Icon name="chevron-forward-outline" size={20} color="#000000" />

              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setModalVisible(!modalVisible);
                  setSelectPic(2);
                }}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',

                  marginBottom: 14,
                }}>
                   <View style={{ flexDirection: 'row',
                  justifyContent: 'flex-start',alignItems:'center'}}>
                 <Icon name="checkbox" size={30} color="#188C16" />
                <Text style={[styles.cardTypo]}>Cancelled Cheque</Text>
                </View>
                <Icon name="chevron-forward-outline" size={20} color="#000000" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  navigation.navigate('DisplayDoc', {
                    Link: AadharDoc,
                    screen: 'Rev',
                  });
                }}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                }}>
                 <View style={{ flexDirection: 'row',
                  justifyContent: 'flex-start',alignItems:'center'}}>
                <Icon name="checkbox" size={30} color="#188C16" />
                <Text style={[styles.cardTypo]}>
                  Aadhar Card
                </Text>
                </View> 
                <Icon name="chevron-forward-outline" size={20} color="#000000" />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={() => {
                // setModalVisible(!modalVisible);
                //setSelectPic(2);
                navigation.navigate('DisplayDoc', {
                  Link: AadharDoc,
                  screen: 'Rev',
                });
              }}
              style={{
                flexDirection: 'row',
                justifyContent:'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}>
             <View style={{ flexDirection: 'row',
                  justifyContent: 'flex-start',alignItems:'center'}}>
             <Icon name="checkbox" size={30} color="#188C16" />
              <Text style={[styles.cardTypo]}> Government Issued Photo ID</Text>
              </View>  
              <Icon name="chevron-forward-outline" size={30} color="#188C16" />
            </TouchableOpacity>
          )}
        </View>}
        <View></View>
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => {
            setModalVisible(!modalVisible);
          }}>
          <TouchableOpacity
            style={styles.centeredView}
            onPress={() => {
              setModalVisible(!modalVisible);
            }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-start',
                alignItems: 'center',
              }}>
              <TouchableOpacity
                onPress={() => {
                  if (SelectPic - 1 == 0) {
                    setSelectPic(2);
                  } else {
                    setSelectPic(SelectPic - 1);
                  }
                }}>
                <Image
                  style={{
                    width: 40,
                    height: 40,
                  }}
                  source={require('./assets/LeftArrow.png')}
                />
              </TouchableOpacity>
              {SelectPic == 1 && (
                <Image
                  style={{
                    width: '90%',
                    height: 200,
                    borderRadius: 10,
                    marginHorizontal: 5,
                  }}
                  source={
                    PanDoc != ''
                      ? {uri: PanDoc}
                      : require('./assets/Rectangle63692.png')
                  }
                />
              )}

              {SelectPic == 2 && (
                <Image
                  style={{
                    width: '90%',
                    height: 200,
                    borderRadius: 10,
                    marginHorizontal: 5,
                  }}
                  source={
                    ChequeDoc != ''
                      ? {uri: ChequeDoc}
                      : require('./assets/Rectangle63691.png')
                  }
                />
              )}
              <TouchableOpacity
                onPress={() => {
                  if (SelectPic + 1 > 2) {
                    setSelectPic(1);
                  } else {
                    setSelectPic(SelectPic + 1);
                  }
                  // navigation.navigate('LoginPage');
                }}>
                <Image
                  style={{
                    width: 30,
                    height: 30,
                  }}
                  source={require('./assets/RigthArrow.png')}
                />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
      <View
        style={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 10,
          paddingBottom: 30,
          paddingTop: 20,
          // opacity:0.4
        }}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            // padding: 15,
          }}>
          <Text
            style={{
              fontSize: 24,
              fontFamily: 'Montserrat-Medium',
              color: '#101010',
            }}>
            ₹ {property?.totalBookingAmount}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Montserrat-SemiBold',
              color: '#081F62',
            }}>
            + ₹{property?.numberOfFractions*300} taxes and fees
          </Text>
        </View>
        <TouchableOpacity
          style={{
            backgroundColor: '#081F62',
            flex: 1,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            width: '100%',
            // padding: 15,
          }}
          disabled={paying}
          onPress={() => {
            // handlePayment();
            //console.log(ItineraryKey);
            handlePayment();

            //  navigation.navigate('StayBookNow', { ItineraryKey: ItineraryKey })
          }}>
          <Text
            style={{
              fontSize: 15,
              fontFamily: 'Poppins-Medium',
              color: '#FFFFFF',
            }}>
            Book Now
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: 20,
    backgroundColor: '#000000',
    opacity: 0.99,
  },
  text3Typo: {
    left: 32,
    color: '#252b2d',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    textAlign: 'left',
    position: 'absolute',
  },

  text4Typo: {
    color: '#1A1A1A',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 14,
  },
  textTypo: {
    color: '#1A1A1A',
    fontFamily: 'Montserrat-Medium',
    fontSize: 12,
    opacity: 0.7,
  },
  parentFlexBox: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    left: 31,
    position: 'absolute',
  },

  cardTypo: {
    left: 10,
    color: '#000000',
    textAlign: 'left',
    fontSize: 16,
    fontFamily: 'WorkSans-SemiBold',
  },
 

 
  reviewChildLayout: {
    height: 50,
    width: 90,
    borderRadius: 5,
    // left: 32,
    //position: 'absolute',
  },
 
 
  text: {
    // fontFamily: "Inter-Medium",
    color: '#fff',
    fontFamily: 'OpenSans-Bold',
    fontSize: 16,
  },


  title: {
    color: '#000000',
    fontFamily: 'Montserrat-Bold',
    fontSize: 18,
    paddingBottom: 10,
  },
 

  
 

  serenityHeights: {
    //fontFamily: "Inter-Bold",

    color: '#000000',
    fontSize: 12,
    opacity: 0.7,
    fontFamily: 'Montserrat-SemiBold',
  },

 

  makePayment: {
    color: '#fff',
    fontFamily: 'Poppins-Medium',
  },
  loginButton: {
    // top: 757,
    borderRadius: 8,
    backgroundColor: '#043862',
    width: 343,
    height: 56,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingVertical: 10,
    left: 15,
  },
  reviewBeforePayment: {
    backgroundColor: '#FAFAFF',
    padding: 20,
    //flex: 1,
    width: '100%',
    // overflow: 'hidden',
  },
});
