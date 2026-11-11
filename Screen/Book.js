import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Image,
  Modal,
  Alert,
  TouchableWithoutFeedback,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useContext, useEffect, useRef, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import MaterialDesignIcons from 'react-native-vector-icons/Feather';
import Entypo from 'react-native-vector-icons/Entypo';
import Icon from 'react-native-vector-icons/AntDesign';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Fontisto from 'react-native-vector-icons/Fontisto';
import {useDispatch, useSelector} from 'react-redux';
import {paymentReview, profileDetailsById} from './redux/reducer/propertyReducer';
import {AppContext} from './Context/AppContext';
import Back from './Back';
import { PaymentPayU } from './Services/UserApi';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from './components/GradientView';

const {height} = Dimensions.get('window');

export default function Book(props) {

  const navigation = useNavigation();
  const dispatch = useDispatch();
  const {globalState} = useContext(AppContext);

  const proId = props.route?.params?.Id;

  const Property = useSelector(state => state.property.PropertyDetailsById);
  // console.log("Property Details: ", Property);

  const [Number, setNumber] = useState(1);
  const [Terms, setTerms] = useState(false);
  const [priceModal, setPriceModal] = useState(false);

  const Available = Property?.AvailableFractions || 0;
const [summaryModal, setSummaryModal] = useState(false);

  // ===== CALCULATIONS =====
  const baseAmount = Number * (Property?.BookingAmount || 0);
  const platformFee = Number * (Property?.BookingAmount * 0.022);
  const subTotal = baseAmount + platformFee;
  const gst = platformFee * 0.18;
  const taxAmount = platformFee + gst
  const totalAmount = subTotal + gst;

  const platformFeeFromBackend = Property?.platformFeeAmount || 0;
  const gstFromBackend = Property?.gstAmount || 0;
  const totalAmountFromBackend = baseAmount + platformFeeFromBackend + gstFromBackend || 0;
    //  console.log(totalAmount,taxAmount,Number,baseAmount)
  // Display helpers for the price breakdown. "₹1,25,000"; fees may have paise.
  const inr = value =>
    `₹${(globalThis.Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  // Offer: fees the user doesn't pay (shown as savings).
  const offerSavings = Property?.offer
    ? Math.max(0, platformFee + gst - (platformFeeFromBackend + gstFromBackend))
    : 0;

  // PayU amount, rounded to 2 decimals (the fee/GST formulas above are unchanged)
  const payableAmount = globalThis.Number(
    (Property?.offer ? totalAmountFromBackend : totalAmount).toFixed(2),
  );
  // Redux can still hold a previously viewed property until this one loads.
  const propertyReady = !!Property && (!proId || Property?._id === proId);
  useEffect(() => {
    dispatch(profileDetailsById({id: proId}));
  }, []);

  const IncrementCount = () => {
    if (Number < Available && Number < 5) {
      setNumber(Number + 1);
    }else{
      Alert.alert("User Can Selected Max 5")
    }
  };

  const DecrementCount = () => {
    if (Number > 1) {
      setNumber(Number - 1);
    }
  };

  // ===== NAVIGATION AFTER CONTINUE =====
  const handleContinue = async () => {
    try {
      const data = await dispatch(
        paymentReview({
          email: globalState?.userDetails?.email,
          propertyName: Property?.name,
          propertyId: Property?._id,
          numberOfFractions: Number,
          totalBookingAmount: totalAmount,
          termsAndConditions: Terms,
        }),
      ).unwrap();
      setPriceModal(false)
    } catch (error) {
      Alert.alert('Booking Failed', error?.message);
    }
  };

    // One payment request at a time: a second tap would make a second txnid.
    const payingRef = useRef(false);
    const handlePayment = async () => {
    if (payingRef.current) {
      return;
    }
    payingRef.current = true;
    try {
      const txnid = `fracspace${Date.now()}${Math.floor(Math.random() * 1000)}`;
    //  const totalAmount = totalAmount
  
      if (!globalState?.userDetails?.email || !globalState?.userDetails?.phoneNumber) {
        Alert.alert('Error', 'Email or Phone number is missing');
        return;
      }
  
      const payload = JSON.stringify({
        // amount: 1,
        amount: payableAmount,
        productinfo: 'Co-ownership Product',
        firstname: globalState?.userName || 'User',
        email: globalState?.userDetails?.email,
        phone: globalState?.userDetails?.phoneNumber,
        txnid: txnid,
        surl: 'https://test.bunknbeyond.com/paymentsuccess',
        furl: 'https://test.bunknbeyond.com/paymentfailure',
      });
      console.log('Payload for PayU:', payload);
  
      let { data: res } = await PaymentPayU(payload);
      if (res?.success && res?.form) {
       //.log(Property,"===23======")
       console.log('PayU Response:', res);
  
        navigation.navigate('PaymentPage', {
          Link: res?.form,
          TxnID: txnid,
          property: Property,
          totalAmount:payableAmount,
          taxAmount:taxAmount,
          Number:Number,
          baseAmount:baseAmount,
          location:Property?.city
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
    }
  };

  return (
    <SafeAreaView style={{flex:1, backgroundColor: '#021265'}}>
    <View style={{flex: 1, backgroundColor: '#F5F7FB'}}>
      {/* HEADER */}
     <Back title={'Book Frac'}/>
      {/* IMAGE */}
      <View>
        <Image
          source={{uri: Property?.image?.Image1}}
          style={styles.image}
        />

        <GradientView colors={['#00000000', '#00000066', '#000000A6']} style={{position:'absolute',bottom:0,left:0,right:0,height:100}}>
          <View style={styles.imageOverlay}>
            <Text style={styles.propertyTitle}>{Property?.name}</Text>

            <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Ionicons
                              name="location-outline"
                              size={15}
                              color="#fff"
                            />
              <Text style={styles.locationText}>
                {Property?.city || '-'}
              </Text>
            </View>
          </View>
        </GradientView>
      </View>

      {/* CONTENT */}
      <View
        style={{marginTop: -20}}
        contentContainerStyle={{paddingBottom: 180}}
        showsVerticalScrollIndicator={false}>

        <View style={styles.card}>

          <View style={{flexDirection:"row",justifyContent:"space-between"}}>
            <View style={styles.priceBox}>
              <Text style={styles.smallLabel}>Available Fracs</Text>
              <Text style={styles.boldText}>
                {Available} Fracs
              </Text>
              </View>
     
          {/* <Text style={styles.sectionTitle}>Price Details</Text> */}

          {/* <View style={styles.priceRow}> */}

            <View style={styles.priceBox}>
              <Text style={styles.smallLabel}>Frac Booking Price</Text>
              <View style={{flexDirection:"row",alignItems:"center"}}>
<Text style={styles.boldText}>
  ₹ {Property?.BookingAmount?.toLocaleString('en-IN')}
</Text>
               <Text style={[styles.smallLabel,{fontSize:13,marginTop:3}]}> /Frac</Text>
              </View>
            
            </View>
{/* 
            <View style={styles.priceBox}>
              <Text style={styles.smallLabel}>Platform Fee</Text>
              <Text style={styles.boldText}>₹ 300</Text>
            </View> */}

          {/* </View> */}
          </View>



          {/* FRACTIONS */}
          <Text style={styles.sectionTitle}>No of Fracs</Text>

          <View style={styles.counterContainer}>
            <TouchableOpacity onPress={DecrementCount} style={{backgroundColor:"rgba(2, 18, 101, 0.1)",padding:5}}>
              <Icon name="minus" size={18} color="#021265" />
            </TouchableOpacity>

            <View style={{alignItems: 'center'}}>
              <Text style={styles.counterText}>
                {Number.toString().padStart(2, '0')}
              </Text>
              <Text style={{fontSize: 11, color: '#6B7280'}}>
                Selected
              </Text>
            </View>

            <TouchableOpacity onPress={IncrementCount} style={{backgroundColor:"#021265",padding:5}}>
              <Icon name="plus" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* TERMS BELOW CARD */}
        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => setTerms(!Terms)}>

          <View style={[styles.checkbox, Terms && styles.checkedBox]}>
            {Terms && <Icon name="check" size={14} color="#fff" />}
          </View>

  <Text style={styles.termsText}>
  I agree to the{' '}
  <Text style={styles.linkText} onPress={() => navigation.navigate('TermsAndCondition')}>
    Terms & Conditions
  </Text>{' '}
  and{' '}
  <Text style={styles.linkText} onPress={() => navigation.navigate('Privacy')}>
    Privacy Policy
  </Text>
</Text>
        </TouchableOpacity>

      </View>

      {/* BOTTOM BAR */}
      <View style={styles.bottomBar}>

        <TouchableOpacity onPress={() => setPriceModal(true)}>
         
<View style={{flexDirection:"row", justifyContent:"space-between"}}>
   {/* <Text style={styles.totalAmount}>
            ₹ {Math.round(totalAmount).toLocaleString('en-IN')}
          </Text> */}

          {!Property?.offer ? 
        <Text style={styles.totalAmount}>
            ₹ {Math.round(totalAmount).toLocaleString('en-IN')}
          </Text>
        :
        <View style={{flexDirection:'row',alignItems:'baseline'}}>
          <Text style={[styles.totalAmount, {marginRight: 8}]}>{inr(Math.round(totalAmountFromBackend))}</Text>
          <Text style={styles.strikeAmount}>{inr(Math.round(totalAmount))}</Text>
        </View>
        }

          <Entypo
            name="chevron-up"
            size={20}
            style={{alignSelf: 'center', marginTop: 4}}
          />
</View>
          <Text style={styles.totalLabel}>
            Total Booking Amount
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!Terms || !propertyReady}
          onPress={() => {
            setSummaryModal(true);
            //setPriceModal(true)
          }
          }
          style={[
            styles.reviewBtn,
            {backgroundColor: Terms && propertyReady ? '#021265' : '#C4C4C4'},
          ]}>
          <Text style={{color: '#fff'}}>Review</Text>
        </TouchableOpacity>
      </View>

{/* BOTTOM MODAL */}
<Modal visible={priceModal} transparent animationType="slide">
  <View style={styles.modalOverlay}>

    <TouchableOpacity
      style={{flex: 1}}
      activeOpacity={1}
      onPress={() => setPriceModal(false)}
    />

    <View style={styles.bottomModalBox}>
      <View style={styles.sheetHandle} />
      <View style={styles.breakdownHeader}>
        <Text style={styles.breakdownTitle}>Price Breakdown</Text>
        <TouchableOpacity onPress={() => setPriceModal(false)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Entypo name="cross" size={22} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Booking */}
      <View style={styles.breakdownRow}>
        <View style={{flexShrink: 1}}>
          <Text style={styles.breakdownLabel}>Booking amount</Text>
          <Text style={styles.breakdownSub}>
            {Number} × {inr(Property?.BookingAmount)}
          </Text>
        </View>
        <Text style={styles.breakdownValue}>{inr(baseAmount)}</Text>
      </View>

      {/* Fees: with an offer, the original amount is struck through and the
          new one (or FREE) shown beside it, using real strikethrough text. */}
      {[
        {label: 'Platform fee', note: '2.2%', normal: platformFee, offer: platformFeeFromBackend},
        {label: 'GST', note: '18% on platform fee', normal: gst, offer: gstFromBackend},
      ].map(row => (
        <View key={row.label} style={styles.breakdownRow}>
          <View style={{flexShrink: 1}}>
            <Text style={styles.breakdownLabel}>{row.label}</Text>
            <Text style={styles.breakdownSub}>{row.note}</Text>
          </View>
          {!Property?.offer ? (
            <Text style={styles.breakdownValue}>{inr(row.normal)}</Text>
          ) : (
            <View style={styles.amountPair}>
              <Text style={styles.strikeAmount}>{inr(row.normal)}</Text>
              {row.offer > 0 ? (
                <Text style={styles.breakdownValue}>{inr(row.offer)}</Text>
              ) : (
                <Text style={styles.freeText}>FREE</Text>
              )}
            </View>
          )}
        </View>
      ))}

      <View style={styles.breakdownDivider} />

      {/* Total */}
      <View style={[styles.breakdownRow, {marginBottom: 0}]}>
        <Text style={styles.breakdownTotalLabel}>Total payable</Text>
        {!Property?.offer ? (
          <Text style={styles.breakdownTotalValue}>{inr(Math.round(totalAmount))}</Text>
        ) : (
          <View style={styles.amountPair}>
            <Text style={styles.strikeAmount}>{inr(Math.round(totalAmount))}</Text>
            <Text style={styles.breakdownTotalValue}>{inr(Math.round(totalAmountFromBackend))}</Text>
          </View>
        )}
      </View>

      {offerSavings > 0 && (
        <View style={styles.savingsBox}>
          <Entypo name="price-tag" size={14} color="#0F7B3F" />
          <Text style={styles.savingsText}>
            Offer applied: you save {inr(Math.round(offerSavings))} on fees
          </Text>
        </View>
      )}

      {/* <TouchableOpacity
        style={styles.continueBtn}
        onPress={handleContinue}>
        <Text style={{color: '#fff'}}>Continue</Text>
      </TouchableOpacity> */}

      {/* <TouchableOpacity
        onPress={() => setPriceModal(false)}
        style={{marginTop: 10}}>
        <Text style={{textAlign: 'center'}}>Cancel</Text>
      </TouchableOpacity> */}
      
    </View>
  </View>
</Modal>
    
    </View>
    
  <Modal
  visible={summaryModal}
  animationType="slide"
  transparent
  onRequestClose={() => setSummaryModal(false)}>
    <TouchableWithoutFeedback onPress={() => setSummaryModal(false)}>
  <View style={styles.bottomSheetWrapper}>
    <View style={styles.bottomSheet}>

      {/* Title */}
      <Text style={styles.sheetTitle}>Property Details</Text>

      {/* Property Card */}
      <View style={{borderWidth:StyleSheet.hairlineWidth,borderColor:"grey",borderRadius:10,padding:10}}>
      <View style={styles.propertyCard}>

        <Image
          source={{ uri: Property?.image?.Image1 }}
          style={styles.sheetImage}
        />

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.propertyName}>
            {Property?.name}
          </Text>

          <View style={styles.rowAlign}>
    <Ionicons
                            name="location-outline"
                            size={15}
                            color="#262D3D"
                          />
            <Text style={styles.locationTextModal}>
            {Property?.city||'-'}
            </Text>
          </View>

          <Text style={styles.fracText}>
            No of Fracs: {Number.toString().padStart(2, '0')}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.dividerLine} />

      {/* 3 Column Price Row */}
      <View style={styles.priceColumns}>
{Property?.name !== "ALTAIRA – VILLA" &&
        <View style={styles.priceColumn}>
          <Text style={styles.smallLabel}>Frac Value</Text>
          <Text style={styles.boldValue}>
            ₹ {Property?.FC_Price || '-'}
          </Text>
        </View>
}
{Property?.name !== "ALTAIRA – VILLA" &&
  <View style={styles.verticalDivider} />
}

        <View style={styles.priceColumn}>
          <Text style={styles.smallLabel}>Booking Amount</Text>
       <Text style={styles.boldValue}>
  ₹ {(Property?.BookingAmount * Number)?.toLocaleString('en-IN')}
</Text>
        </View>

  {/* <View style={styles.verticalDivider} /> */}

        {/* <View style={styles.priceColumn}>
          <Text style={styles.smallLabel}>Platform Fee</Text>
          <Text style={styles.boldValue}>
            ₹ {platformFee}
          </Text>
        </View> */}

      </View>
</View>
      {/* Total Box */}
      <View style={styles.totalBox}>
        <Text style={styles.totalLabelSheet}>Total Amount</Text>
        {/* <Text style={styles.totalAmountSheet}>
          ₹ {totalAmount?.toLocaleString('en-IN')}
        </Text> */}
        {!Property?.offer ? 
        <Text style={styles.totalAmountSheet}>
          ₹ {totalAmount?.toLocaleString('en-IN')}
        </Text>
        :
        <View style={{flexDirection:'row',alignItems:'center'}}>
          <View style={{position:'absolute',alignSelf:'center',justifyContent:'center',borderWidth:0.5,borderColor:'#0000009c',left:-2,right:55,top:9}}/>
          <Text style={{fontFamily:'WorkSans-Regular',fontSize:14,color:'#0000009c'}}>₹ {Math.round(totalAmount).toLocaleString('en-IN')}</Text>
          <Text style={{fontFamily:'WorkSans-SemiBold',fontSize:14,color:'#000000',marginLeft:10}}>{Math.round(totalAmountFromBackend).toLocaleString('en-IN')}</Text>
        </View>
        }
      </View>

      {/* Personal Details */}
      <Text style={[styles.sheetTitle, { marginTop: 20 }]}>
        Personal Details
      </Text>

      <View style={styles.personalRow}>

        <View style={{justifyContent:"center",alignItems:"center",padding:10}}>
        <Image
          source={{
            uri:
              globalState?.userDetails?.profilePicture ||
              'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRok_BUdv1oJkVi09IkXw3IpMA1F2SN2FUCvA&s'
          }}
          style={styles.profileImage}
        />
       <Text style={styles.profileName}>
            {globalState?.userDetails?.userName}
          </Text>
        </View>
        
  <View style={styles.verticalDivider} />
        {/* flex: 1 limits this column to the card's remaining width, so long
            text (the address) is cut with "…" instead of overflowing. */}
        <View style={{ marginLeft: 12, flex: 1 }}>
          <View style={styles.iconRow}>
            <Fontisto name="email" size={14} color="#021265" />
            <Text style={styles.profileText}>
              {globalState?.userDetails?.email}
            </Text>
          </View>

          <View style={styles.iconRow}>
            <MaterialDesignIcons name="phone" size={14} color="#021265" />
            <Text style={styles.profileText}>
              {globalState?.userDetails?.phoneNumber}
            </Text>
          </View>

            <View style={styles.iconRow}>
            {/* <Octicons name="location" size={14} color="#021265" /> */}
                 <Ionicons
                            name="location-outline"
                            size={15}
                            color="#021265"
                          />
            {/* One line, "…" at the end; flexShrink lets it fit inside the row. */}
            <Text style={[styles.profileText, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">
              {/* The profile field is postalAddress (there is no `address`). */}
              {globalState?.userDetails?.postalAddress || 'Not Available'}
            </Text>
          </View>

        </View>
      </View>

      {/* Continue Button */}
      <TouchableOpacity
        style={styles.continueBtn}
        onPress={() => {
          setSummaryModal(false);
          handlePayment();
        }}
      >
        <Text style={styles.continueText}>Continue</Text>
      </TouchableOpacity>

    </View>
  </View>
</TouchableWithoutFeedback>
</Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  header:{
    backgroundColor:'#021265',
    flexDirection:'row',
    justifyContent:'space-between',
    alignItems:'center',
    padding:16
  },

  headerTitle:{
    color:'#fff',
    fontSize:16,
    fontWeight:'600'
  },

  image:{
    width:'100%',
    height:240
  },

  imageOverlay:{
    position:'absolute',
    bottom:30,
    left:20
  },

  propertyTitle:{
    color:'#fff',
    fontSize:16,
    fontWeight:'600'
  },

  locationText:{
    color:'#ddd',
    fontSize:12,
    marginLeft:4
  },

  card:{
    backgroundColor:'#fff',
    marginHorizontal:20,
    borderRadius:12,
    padding:20,
    shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 8,
  },
  shadowOpacity: 0.15,
  shadowRadius: 12,

  // Android shadow
  elevation: 12,

  },

  smallLabel:{fontSize:12,color:'#6B7280'},
  boldText:{fontSize:15,fontWeight:'600',marginTop:4},

  sectionTitle:{
    marginTop:20,
    fontWeight:'600'
  },

  priceRow:{
    flexDirection:'row',
    justifyContent:'space-between',
    marginTop:10
  },

  priceBox:{
    backgroundColor:'#F3F4F6',
    width:'48%',
    borderRadius:12,
    padding:12
  },

  counterContainer:{
    marginTop:10,
    backgroundColor:'#EEF2F7',
    borderRadius:12,
    padding:12,
    flexDirection:'row',
    justifyContent:'space-between',
    alignItems:'center'
  },

  counterText:{
    fontSize:18,
    fontWeight:'600'
  },

  termsRow:{
    flexDirection:'row',
    alignItems:'center',
    marginHorizontal:20,
    marginTop:20
  },

  checkbox:{
    width:18,
    height:18,
    borderWidth:1,
    borderColor:'#021265',
    marginRight:10,
    justifyContent:'center',
    alignItems:'center',
    borderRadius:2
  },

  checkedBox:{
    backgroundColor:'#021265'
  },

  termsText:{
    fontSize:12,
    color:'#444'
  },

  bottomBar:{
    position:'absolute',
    bottom:0,
    width:'100%',
    backgroundColor:'#fff',
    padding:20,
    flexDirection:'row',
    justifyContent:'space-between',
    alignItems:'center',
    borderTopWidth:1,
    borderColor:'#eee'
  },

  totalLabel:{fontSize:12,color:'#6B7280', marginTop:5},
  totalAmount:{fontSize:18,fontWeight:'700'},

  reviewBtn:{
    paddingHorizontal:30,
    paddingVertical:12,
    borderRadius:10
  },



  modalBox:{
    width:'85%',
    backgroundColor:'#fff',
    borderRadius:20,
    padding:20
  },

  modalTitle:{
    fontSize:16,
    fontWeight:'600',
    marginBottom:10
  },

  modalRow:{
    flexDirection:'row',
    justifyContent:'space-between',
    marginVertical:6
  },

  divider:{
    height:1,
    backgroundColor:'#ddd',
    marginVertical:10
  },

  continueBtn:{
    backgroundColor:'#021265',
    padding:14,
    borderRadius:10,
    alignItems:'center',
    marginTop:15
  },
  bottomSheetWrapper: {
  flex: 1,
  justifyContent: 'flex-end',
  backgroundColor: 'rgba(0,0,0,0.4)',
},

bottomSheet: {
  backgroundColor: '#fff',
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  padding: 20,
},

sheetTitle: {
  fontSize: 16,
  fontFamily: 'Montserrat-SemiBold',
  marginBottom: 10,
},

propertyCard: {
  flexDirection: 'row',
 // backgroundColor: '#F9FAFB',
  padding: 10,
  borderRadius: 12,
  justifyContent:"center",
  alignItems:"center"
 // borderWidth:1
},

sheetImage: {
  width: 120,
  height: 80,
  borderRadius: 10,
},

rowAlign: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 4,
},

locationTextModal: {
  fontSize: 12,
  color: '#080a0c',
  marginLeft: 4,
},

fracText: {
  fontSize: 12,
  marginTop: 4,
},

dividerLine: {
  height: 1,
  backgroundColor: '#E5E7EB',
  marginVertical: 15,
},
verticalDivider: {
  width: 1,
  height: '90%',   // adjust height as needed
  backgroundColor: '#E5E7EB',
},
verticalDivider2: {
  width: 1,
  height: '10%',   // adjust height as needed
  backgroundColor: '#E5E7EB',
},

priceColumns: {
  flexDirection: 'row',
  justifyContent: 'space-around',
  paddingVertical:10,
  paddingHorizontal:30
},

priceColumn: {
  alignItems: 'center',
},

smallLabel: {
  fontSize: 11,
  color: '#6B7280',
},

boldValue: {
  fontSize: 14,
  fontFamily: 'Montserrat-SemiBold',
  marginTop: 4,
},

totalBox: {
 // backgroundColor: '#F3F4F6',
  padding: 12,
  borderRadius: 10,
  marginTop: 15,
  flexDirection: 'row',
  justifyContent: 'space-between',
  borderWidth:StyleSheet.hairlineWidth,
  borderColor:"grey",
  paddingVertical:15
},

totalLabelSheet: {
  fontFamily: 'Montserrat-SemiBold',
},

totalAmountSheet: {
  fontFamily: 'Montserrat-Bold',
},

personalRow: {
  flexDirection: 'row',
  alignItems: 'center',
  borderWidth:StyleSheet.hairlineWidth,
  borderColor:"grey",
  paddingVertical:15,
 borderRadius:10,
 padding:10,
 alignItems:"center"
},

profileImage: {
  width: 60,
  height: 60,
  borderRadius: 60,
  resizeMode:"cover"
},

profileName: {
  fontSize: 14,
  fontFamily: 'Montserrat-SemiBold',
  marginTop:3
},

iconRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 4,
  paddingVertical:4
},

profileText: {
  fontSize: 12,
  marginLeft: 6,
},

continueBtn: {
  backgroundColor: '#021265',
  padding: 14,
  borderRadius: 10,
  marginTop: 20,
  alignItems: 'center',
},

continueText: {
  color: '#fff',
  fontFamily: 'Montserrat-SemiBold',
},
propertyName:{
  color:"#021265",
  fontFamily:"WorkSans-SemiBold",
  fontSize:14
},
modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.4)',
  justifyContent: 'flex-end',
},

bottomModalBox: {
  backgroundColor: '#fff',
  paddingHorizontal: 20,
  paddingTop: 10,
  paddingBottom: 40,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
},

// Price breakdown sheet
sheetHandle: {
  alignSelf: 'center',
  width: 40,
  height: 4,
  borderRadius: 2,
  backgroundColor: '#D1D5DB',
  marginBottom: 14,
},
breakdownHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 18,
},
breakdownTitle: {
  fontFamily: 'Montserrat-SemiBold',
  fontSize: 18,
  color: '#0F1130',
},
breakdownRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16,
},
breakdownLabel: {
  fontFamily: 'WorkSans-Medium',
  fontSize: 14,
  color: '#1A1A1A',
},
breakdownSub: {
  fontFamily: 'WorkSans-Regular',
  fontSize: 12,
  color: '#6B7280',
  marginTop: 2,
},
breakdownValue: {
  fontFamily: 'WorkSans-SemiBold',
  fontSize: 14,
  color: '#1A1A1A',
},
amountPair: {
  flexDirection: 'row',
  alignItems: 'center',
},
strikeAmount: {
  fontFamily: 'WorkSans-Regular',
  fontSize: 13,
  color: '#9CA3AF',
  textDecorationLine: 'line-through',
  marginRight: 8,
},
freeText: {
  fontFamily: 'WorkSans-SemiBold',
  fontSize: 14,
  color: '#0F7B3F',
},
breakdownDivider: {
  height: 1,
  backgroundColor: '#E5E7EB',
  marginBottom: 16,
},
breakdownTotalLabel: {
  fontFamily: 'WorkSans-SemiBold',
  fontSize: 16,
  color: '#0F1130',
},
breakdownTotalValue: {
  fontFamily: 'WorkSans-Bold',
  fontSize: 18,
  color: '#021265',
},
savingsBox: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#E8F5EE',
  borderRadius: 8,
  paddingVertical: 10,
  paddingHorizontal: 12,
  marginTop: 16,
},
savingsText: {
  fontFamily: 'WorkSans-Medium',
  fontSize: 13,
  color: '#0F7B3F',
  marginLeft: 8,
},

modalTitle: {
  fontSize: 18,
  fontWeight: 'bold',
  marginBottom: 15,
},

modalRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginVertical: 6,
},

divider: {
  height: 1,
  backgroundColor: '#ddd',
  marginVertical: 10,
},
  termsText: {
    fontSize: 12,
    color: '#000000',
    fontFamily: 'Poppins-Regular',
  },
  linkText: {
    color: '#000000', // blue color
    fontWeight: 'bold',
  },


});