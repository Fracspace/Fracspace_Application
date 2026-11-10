let hasShownHomePopup = false;
import {View,Text,ScrollView,Image,StyleSheet,TouchableOpacity,Linking,Dimensions,Animated,Alert,ImageBackground,Modal,StatusBar,Easing,PanResponder,Pressable,ActivityIndicator,FlatList,Platform,BackHandler} from 'react-native';
import React, {useCallback,useContext,useEffect,useMemo,useRef,useState,} from 'react';
import Icon from 'react-native-vector-icons/Ionicons';
import IconF from 'react-native-vector-icons/FontAwesome6';
import IconI from 'react-native-vector-icons/AntDesign';
import Iconn from 'react-native-vector-icons/Feather';
import {findFocusedRoute,useFocusEffect,useIsFocused,useNavigation,} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../components/GradientView';
import Video, { VideoRef } from 'react-native-video';
import { videoSource } from '../utils/videoSource';
import { EDGE_TO_EDGE } from '../utils/statusBar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useDispatch, useSelector } from 'react-redux';
import {CallRecord,DisLike,DreamscapeHotels,GetAllNotification,GetCarousel,GetConcertSection,Like,LikeData,PaymentUPI,PopularDestination,PropertyDetails,updateFCMToken,} from '../Services/UserApi';
import { AppContext } from '../Context/AppContext';
const { width, height } = Dimensions.get('window');
import Swiper from 'react-native-swiper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAllNotifications, fetchProperties, hidePopup, showPopup } from '../redux/reducer/homeReducer';
import HomeSkeleton from '../components/HomeSkeleton';
import FastImage from 'react-native-fast-image';
import EdgeFab from './altaira/FloatingButton';
import CustomSwiper from '../components/CustomSwiper';
import ConcertVideoCard from './Concert/components/ConcertVideoCard';
import HomeTicketShortcut from './Concert/components/HomeTicketShortcut';
import { isConcertHomeOn, normalizeSection } from './Concert/utils/concertAdapter';
import { profileDetails } from '../redux/reducer/profileReducer';
import useAccountActions from '../utils/useAccountActions';
import DeleteAccountModal from '../components/DeleteAccountModal';
import Toast from 'react-native-toast-message';
import messaging from '@react-native-firebase/messaging';
import CompleteProfilePopup from '../../components/CompleteProfilePopup';

export default function HomePage() {
  const { globalState, setGlobalState } = useContext(AppContext);
  const navigation = useNavigation();
  const [selectCountry, setSelectCountry] = useState('India');
  const [Popular, setPopular] = useState([]);
  const [modalVisibleRS, setModalVisibleRS] = useState(false);
  const [notification, setNotification] = useState([]);
  const dispatch = useDispatch();
  const Offer = useSelector(state => state.home.offer);
  const Properties = useSelector(state => state.home.Properties);
  const AllProperties   = useSelector(state => state.home.AllProperties  );
  const loading = useSelector(state => state.home.loading);
  const phoneNumber = useSelector(state => state.profile?.user?.phoneNumber);
  const fcmToken = useSelector(state => state.profile?.user?.fcmToken);
  // console.log("Phone Number: ", phoneNumber, "FCM Token: ", fcmToken);
  const isFetched = useRef(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [concertSection, setConcertSection] = useState(null);
  const [carousel, setCarousel] = useState([])
  const popUp = useSelector(state => state.home.isPopupVisible);
  // const userProfileData = useSelector(state => state.profile?.user);
  const { user: userProfileData, loading: profileLoading } = useSelector(
  state => state.profile
);
  const [showProfilePopup, setShowProfilePopup] = useState(true);

  // console.log('User Profile Data:', userProfileData);
  // const needsProfileCompletion = useMemo(() => {
  //   if (!userProfileData) return false;
  //   return userProfileData?.postalAddress == "" || userProfileData?.pincode == "";
  // }, [userProfileData]);
  const needsProfileCompletion = useMemo(() => {
    if (!userProfileData) return false;

    return (
      userProfileData?.verification === true &&
      (userProfileData?.postalAddress == "" || userProfileData?.pincode == "")
    );
  }, [userProfileData]);

  const isDeepLink = useSelector(state => state.home.isDepplinkNav);
  const UpComingDetails = useSelector(state => state.property.upComingProjects);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    dispatch(fetchProperties());
    // userDetails isn't loaded yet right after login; fall back to the login email
    dispatch(profileDetails({ email: globalState?.userDetails?.email || globalState?.userEmail }))
    handleListedHotels()
    getDeviceToken();
  }, []);

  

  useEffect(() => {
    const unsubscribe = messaging().onTokenRefresh(async token => {
      const email = await AsyncStorage.getItem('Email');
      console.log("FCM Token Refreshed:", token);

      let payload = JSON.stringify({
        email: email,
        fcmToken: token,
      });
      console.log("update token: ", payload);

      await updateFCMToken(payload);
      await AsyncStorage.setItem('fcmToken', token);
    });

    return unsubscribe;
  }, []);

  const getDeviceToken = async () => {
    try {
      await messaging().requestPermission();

      const newToken = await messaging().getToken();
      const savedToken = await AsyncStorage.getItem('fcmToken');
      const email = await AsyncStorage.getItem('Email');

      // console.log("Current FCM Token:", newToken);
      // console.log("Saved FCM Token:", savedToken);

      if (savedToken !== newToken) {
        let payload = JSON.stringify({
          email: email,
          fcmToken: newToken,
        });
        console.log("Payload update fcm token: ", payload);

        const res = await updateFCMToken(payload);
        console.log('FCM update response:', res?.data);

        if (res?.data?.success) {
          await AsyncStorage.setItem('fcmToken', newToken);
        }
      }
    } catch (error) {
      console.log('FCM token error:', error?.response?.message || error?.response?.data);
    }
  };

  const handleListedHotels = async () => {
    try {
      const { data: res } = await DreamscapeHotels();
      const cities = [...new Set(res?.hotels?.map(hotel => hotel?.location?.city))];
      const availableHotels = res?.hotels?.filter(
        hotel => hotel?.availabilityStatus
      );
      const locationList = [];
      const citySet = new Set();

      setGlobalState(prevState => ({
        ...prevState,
        HotelDetails: res?.hotels,
        ourStays: res?.citySummary
      }))

      availableHotels?.forEach(hotel => {
        const city = hotel?.location?.city;

        if (!citySet.has(city)) {
          citySet.add(city);

          locationList.push({
            label: city,          
            value: city,            
            image: hotel?.locationImage 
          });
        }
      });
      // console.log('Unique hotel locations:', res?.citySummary);

      // setLocations(locationList);
      setLocations(res?.citySummary);

    } catch (error) {
      console.log('Error in Listed Hotels:', error);
    }
  };
  // First visible popup (as Android), falling back to the first entry.
  const popupData =
    carousel?.popup?.find?.(p => p?.visibility === true) || carousel?.popup?.[0];
  // The backend sends a separate screen name per platform.
  const popupLink = Platform.OS === 'ios'
    ? popupData?.iosNavigationLink
    : (popupData?.navigationLink || popupData?.iosNavigationLink);
  const openPopupLink = () => {
    dispatch(hidePopup());
    if (popupLink) {
      navigation.navigate(popupLink);
    }
  };
  const isFocused = useIsFocused();

  useEffect(() => {
    dispatch(showPopup());
  }, []);


  const isValidUri = (uri) =>
    typeof uri === 'string' && uri.trim().length > 0;

  const fetchCarousel = async () => {
    try {
      let { data: res } = await GetCarousel();
      setCarousel(res?.data);
      setGlobalState(prevState => ({
        ...prevState,
        liveVersion: Platform.OS === 'ios'
          ? res?.data?.appVersion?.iosCurrentVersion
          : res?.data?.appVersion?.androidCurrentVersion,
        walletNote: res?.data?.noteForWallet?.isVisible,
        noteMessage: res?.data?.noteForWallet?.message,
      }))
    } catch (error) {
      console.error("Error in fetching carousel: ", error?.response?.data || error?.response?.message);
    } finally {
    }
  }
const Categories = carousel?.category

  const cardsFromApi = carousel?.cards || [];
  const offerCards = cardsFromApi.filter(card => {
    if (!card.enabled) return false;
    if (card.type === 'COUNTDOWN') {
      const endTimeMs =
        card?.endTime && !isNaN(new Date(card.endTime).getTime())
          ? new Date(card.endTime).getTime()
          : null;
      const isExpired = endTimeMs ? Date.now() >= endTimeMs : true;
      if (!isExpired) {
        return isValidUri(card.image);
      }
      return isValidUri(card.watchLiveStreamImage);
    }
    return isValidUri(card.image);
  });

  const handleCallRecord = async () => {
    let payload = JSON.stringify({
      email: globalState?.userEmail,
      ContactNumberOfFs: '+919880626111',
      enquiryAbout: 'Home Page call',
    });
    try {
      let { data: res } = await CallRecord(payload);
      if (res?.success) {
        handleCallNow();
      }
    } catch (error) {
      if (error?.response) {
        Alert.alert('Response Error', `${error?.response?.data?.message}`);

      } else if (error?.request) {
        //Alert.alert('Request error:', ${JSON.stringify(error?.request)});
        // Alert.alert('Request Error:', 'Please Check Your Internet Connection');
        // Alert.alert('Request error:', ${JSON.stringify(error?.request)});
      } else {
        Alert.alert('Error:', `${error}`);
      }
    }
  };

  const handleCallNow = () => {
    const phoneNumber = '+919880626111';
    const phoneUrl = `tel:${phoneNumber}`;
    Linking.openURL(phoneUrl)
      .then(supported => {
        if (!supported) {
          Toast.show({
            type: 'error',
            text1: 'Call Failed',
            text2: 'Phone number not supported',
            position: 'top',
          });
        }
      })
      .catch(error => console.log('Error making phone call:', error));
  };

  const handleRating = () => {
    const appStoreUrl = 'https://apps.apple.com/in/app/fracspace/id6498551006';
    Linking.openURL(appStoreUrl).catch(error =>
      console.error('Error opening Play Store', error),
    );
  };

  const openApp = async link => {
    const url = link;
    try {
      // canOpenURL is unreliable for https on Android 11+; open and fall back.
      await Linking.openURL(url);
    } catch (error) {
      handlewhatsapplink(link);
    }
  };

  const handlewhatsapplink = async link => {
    let payload = JSON.stringify({
      message: `Enguire  Via whatsapp ${link}`,
      phoneNumber: globalState?.userDetails?.phoneNumber,
    });
    try {
      let { data: res } = await PaymentUPI(payload);
      if (res?.success) {
        Alert.alert(
          'Congratulations!',
          'The whatsapp link has been successfully sent to your message section.Kindly Enquire',
        );
      }
    } catch (error) {
      if (error?.response) {
        Alert.alert('Response Error', `${error?.response?.data?.message}`);
      } else if (error?.request) {
      } else {
        Alert.alert('Error:', `${error}`);
      }
    }
  };

  const FetchAllNotification = async () => {
    let payload = JSON.stringify({
      email: globalState?.userEmail,
    });
    try {
      let { data: res } = await GetAllNotification(payload);
      setNotification(res?.data);
    } catch (error) {
    }
  };

  // Same 45-day window as NotificationsScreen, so the bell dot never points at
  // notifications that screen hides.
  const NOTIFICATION_WINDOW_MS = 45 * 24 * 60 * 60 * 1000;
  const unreadNotifications = (notification || []).some(
    item =>
      Date.now() - new Date(item?.date || item?.createdAt).getTime() <= NOTIFICATION_WINDOW_MS &&
      !item?.buttonClicks?.some(click => click.email === globalState?.userEmail),
  );

  useEffect(() => {
    FetchAllNotification();
    fetchCarousel();
  }, []);

  const { width } = Dimensions.get('window');
  const [menuAnimation] = useState(new Animated.Value(-width * 0.8)); // Initially hidden off-screen
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const openMenu = () => {
    setIsMenuOpen(true);
    Animated.timing(menuAnimation, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(menuAnimation, {
      toValue: -MENU_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setIsMenuOpen(false);
    });
  };

  const MENU_WIDTH = width * 0.8;
  const insets = useSafeAreaInsets();

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      isMenuOpen && Math.abs(gesture.dx) > Math.abs(gesture.dy),

    onPanResponderMove: (_, gesture) => {
      const translateX = Math.min(
        0,
        Math.max(gesture.dx, -MENU_WIDTH)
      );
      menuAnimation.setValue(translateX);
    },
    onPanResponderRelease: (_, gesture) => {
      const shouldClose =
        gesture.dx < -MENU_WIDTH / 3 || gesture.vx < -0.5;
      if (shouldClose) {
        closeMenu();
      } else {
        openMenu();
      }
    },
  });

  // Android: hardware back on Home closes the side menu first, otherwise exits
  // the app instead of going back into the login/splash stack.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isMenuOpen) {
          closeMenu();
          return true;
        }
        BackHandler.exitApp();
        return true;
      });
      return () => subscription.remove();
    }, [isMenuOpen]),
  );

  // Logout / Delete Account are shared with the Profile tab.
  const { logOut: handleLogOut, deleteAccount, deleting } = useAccountActions();
  const handleDeleteAccount = async () => {
    if (await deleteAccount()) setModalVisibleRS(false);
  };

  const scaleAnimation = useRef({}).current;
  const triggerScaleAnimation = itemName => {
    if (!scaleAnimation[itemName]) {
      scaleAnimation[itemName] = new Animated.Value(1);
    }
    Animated.sequence([
      Animated.timing(scaleAnimation[itemName], {
        toValue: 1.5,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation[itemName], {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const testimonials = [
    {
      name: 'Abdul Basith',
      video:
        'https://d1nj26fz89n9xw.cloudfront.net/fracspace_properties_images/testimonials/testimonial2.mp4',
      image:
        'https://duixj37yn5405.cloudfront.net/appImages/testimonial1.png',
      transcript: [
        {
          start: 0.0,
          end: 11.0,
          text: "Hi, this is Abdul Basith and that's my wife  Bushra Khan. Yeah, so I've invested in a Fracspace in the Goa property.",
        },
        {
          start: 12.0,
          end: 23.0,
          text: 'This idea like actually came across in a reality expo and since then You know, it has been quite exciting and interesting to know about this opportunity.',
        },
        {
          start: 26.0,
          end: 34.0,
          text: 'Talking about investment point of view, I see a good value proposition and at the same time what makes a difference is that the company culture,',
        },
        {
          start: 35.0,
          end: 43.0,
          text: 'The people in this whole startup and I feel the staff has been really supportive and have been very patient in giving good information.',
        },
      ],
    },
    {
      name: 'Srinivas',
      video:
        'https://d1nj26fz89n9xw.cloudfront.net/fracspace_properties_images/testimonials/testimonial3.mp4',
      image:
        'https://duixj37yn5405.cloudfront.net/appImages/testimonial2.png',
      transcript: [
        {
          start: 0.0,
          end: 7.0,
          text: 'Hi, my name is Srinivas I am from Indusind Bank. I got to know about this Fracspace through an expo.',
        },
        {
          start: 8.0,
          end: 15.0,
          text: 'I interested in  becoming a  part of this. Looks very interesting, the team is very good.',
        },
        {
          start: 15.0,
          end: 22.0,
          text: 'And  like the concept When you get an opportunity to invest a small amount and get ownership',
        },
        {
          start: 22.0,
          end: 27.0,
          text: 'with a good return I showed this thing, nothing like it so I went for it.',
        },
        {
          start: 27.0,
          end: 29.0,
          text: "I request all of you to consider it. It's a good option.",
        },
        {
          start: 30.0,
          end: 37.0,
          text: 'I find it interesting and getting to know a lot of people coming into this community. I am enjoying it a lot. Thanks.',
        },
      ],
    },
    {
      name: 'Prashanth & Nikita',
      video:
        'https://d1nj26fz89n9xw.cloudfront.net/fracspace_properties_images/testimonials/testimonial1.mp4',
      image:
        'https://duixj37yn5405.cloudfront.net/appImages/testimonial3.png',
      transcript: [
        {
          start: 0.0,
          end: 5.0,
          text: "Hi, I'm Prashant and this is Nikita.We're both software engineers.",
        },
        // { start: 3.0, end: 4.0, text: '' },
        {
          start: 6.0,
          end: 13.0,
          text: 'We like the idea of fractional ownership.We thought this was a good entry point.',
        },
        {
          start: 14.0,
          end: 21.0,
          text: 'We found fracspace and then we found that the business model interesting and then the transparency.',
        },
        {
          start: 21.0,
          end: 24.0,
          text: 'We asked them a lot of questions and they answered it very well. ',
        },
        {
          start: 25.0,
          end: 29.0,
          text: 'We just started with one property investment.',
        },
        {
          start: 30.0,
          end: 35.0,
          text: "Yeah, we're enjoying it so far and then we\re looking to do more business with them.",
        },
      ],
    },
  ];

  const [like, setLike] = useState([]);
  const [likedProperty, setLikedProperty] = useState([]);
  const [playStates, setPlayStates] = useState(testimonials.map(() => false));
  const [currentTimes, setCurrentTimes] = useState(testimonials.map(() => 0));
  const [durations, setDurations] = useState(testimonials.map(() => 0));
  const transcriptScrollRefs = useRef([]);
  const videoRefs = useRef([]);
  // Only the testimonial being watched gets a player; the others show their
  // thumbnail. Three always-mounted players each held a decoder + buffers.
  const [activeVideoIndex, setActiveVideoIndex] = useState(null);
  // Index whose player has drawn its first frame. Until then the thumbnail
  // stays up (with a spinner) instead of a black box.
  const [readyVideoIndex, setReadyVideoIndex] = useState(null);
  const [videoEnded, setVideoEnded] = useState(testimonials.map(() => false));
  const [showControls, setShowControls] = useState(
    testimonials.map(() => true)
  );
  const [showThumbnails, setShowThumbnails] = useState(
    testimonials.map(() => true),
  );

  const togglePlay = index => {
    const isNowPlaying = !playStates[index];
    const updatedPlayStates = playStates.map((_, i) =>
      i === index ? isNowPlaying : false
    );

    setPlayStates(updatedPlayStates);
    if (isNowPlaying && activeVideoIndex !== index) {
      // A new player mounts for this testimonial (the previous one unmounts,
      // keeping its position in currentTimes to resume from later).
      setReadyVideoIndex(null);
      setActiveVideoIndex(index);
    }

    const updatedControls = showControls.map((_, i) =>
      i === index ? true : true
    );

    setShowControls(updatedControls);

    if (isNowPlaying) {
      setTimeout(() => {
        setShowControls(prev => {
          const newControls = [...prev];
          newControls[index] = false;
          return newControls;
        });
      }, 5000);
    }

    if (showThumbnails[index]) {
      const updatedThumbnails = [...showThumbnails];
      updatedThumbnails[index] = false;
      setShowThumbnails(updatedThumbnails);
    }

    if (videoEnded[index]) {
      videoRefs.current[index]?.seek(0);
      const updatedEnded = [...videoEnded];
      updatedEnded[index] = false;
      setVideoEnded(updatedEnded);
      // Replay from the start, not from the end position kept in currentTimes.
      setCurrentTimes(prev => prev.map((t, i) => (i === index ? 0 : t)));
    }
  };

  const swiperRef = useRef(null);
  const cardWidth = 250;
  const wireHeight = 100;

  useFocusEffect(
    useCallback(() => {
      fetchLikedProperty();
      return () => {
        setPlayStates(prev => prev.map(() => false));
        // Leaving Home: release the testimonial player entirely.
        setActiveVideoIndex(null);
        setReadyVideoIndex(null);
        videoRefs.current.forEach(ref => {
          if (ref) {
            ref.pause && ref.pause();
          }
        });
      };
    }, []),
  );

  const videoLayouts = useRef([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('mytoken');
        const { data } = await GetConcertSection({ token });
        if (alive) setConcertSection(normalizeSection(data));
      } catch (e) {
        // The concert surface is optional - a failure here must never take
        // the home screen down, so it just stays hidden.
        console.log('Concert section fetch failed:', e?.message);
        if (alive) setConcertSection({ enabled: false, concert: null });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleVerticalScroll = event => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const windowHeight = event.nativeEvent.layoutMeasurement.height;

    videoLayouts.current.forEach((layout, index) => {
      if (!layout) return;
      const isVisible = layout.y + layout.height > scrollY && layout.y < scrollY + windowHeight;
      if (!isVisible && playStates[index]) {
        const updatedPlayStates = [...playStates];
        updatedPlayStates[index] = false;
        setPlayStates(updatedPlayStates);
      }
    });
  };


  const fetchLikedProperty = async () => {
    let payload = JSON.stringify({
      email: globalState?.userEmail,
    });
    try {
      let { data: res } = await LikeData(payload);
      if (res?.success) {
        const likeProp = res?.properties.map(item => item._id);
        // console.log("Likes: ", likeProp);
        setLikedProperty(likeProp);
      } else {
        console.log('Error in fetching liked property: ', res.message || res);
      }
    } catch (error) {
      console.error(
        'Error in Fetching Liked Hotels: ',
        error.response?.data || error.message,
      );
    }
  };

  const handleLike = async propId => {
    let payload = JSON.stringify({
      email: globalState?.userEmail,
      propertyId: propId,
    });
    try {
      let { data: res } = await Like(payload);
      if (res?.success) {
        console.log('Response: ', res);
      } else {
        console.log('Failed to handle like: ', res.message || res);
      }
    } catch (error) {
      console.error(
        'Error in Liking Property: ',
        error.response?.data || error.message,
      );
    }
  };

  const handleRemoveLike = async propId => {
    let payload = JSON.stringify({
      email: globalState?.userEmail,
      propertyId: propId,
    });
    try {
      let { data: res } = await DisLike(payload);
      if (res?.success) {
        // console.log('Response: ', res);
      } else {
        console.log('Failed to remove like: ', res.message || res);
      }
    } catch (error) {
      console.error(
        'Error in Removing Liked Prop: ',
        error.response?.data || error.message,
      );
    }
  };

  const Wire = ({ cardCount, segmentWidth = 400, height = 70 }) => {
    const wavePath = generateWavePath(cardCount, segmentWidth);
    return (
      <Svg
        width={cardCount * segmentWidth}
        height={height}
        style={{ position: 'absolute', top: 20, left: 0 }}>
        <Path d={wavePath} stroke="#999" strokeWidth={1} fill="none" />
      </Svg>
    );
  };

  const generateWavePath = (
    cardCount,
    segmentWidth,
    amplitude = 30,
    midline = 30,
  ) => {
    let path = `M0,${midline}`;
    for (let i = 0; i < cardCount; i++) {
      const startX = i * segmentWidth;
      const cp1X = startX + segmentWidth * 0.25;
      const cp2X = startX + segmentWidth * 0.75;
      const endX = startX + segmentWidth;
      path += ` C${cp1X},${midline - amplitude} ${cp2X},${midline + amplitude
        } ${endX},${midline}`;
    }
    return path;
  };

  const toggleLike = item => {
    setLike(prevSelected =>
      prevSelected.includes(item)
        ? prevSelected.filter(selected => selected !== item)
        : [...prevSelected, item],
    );
  };

  const renderItem = ({ item, index }) => {
    const route =
      Platform.OS === 'ios'
        ? item?.iosNavigation
        : (item?.androidNavigation || item?.iosNavigation);

    return (
      <TouchableOpacity
        onPress={() => {
          // The route comes from the backend; a tile without one does nothing
          // (navigate(undefined) throws and closes the app).
          if (!route) return;
          if (item?.heading === 'Co-Own') {
            navigation.navigate(route, { details: Properties });
          } else if(item?.heading === 'Stays') {
            navigation.navigate(route, { from: 'HomePage' });
          } else{
            navigation.navigate(route);
          }
        }}
        style={{
          backgroundColor: '#FFF',
          padding: 12,
          borderRadius: 6,
          width: 135,
          marginRight: 20,
          elevation: 5,
          marginVertical: 10,
        }}
      >
        <Text
          style={{
            fontFamily: 'Montserrat-SemiBold',
            fontSize: 15,
            color: '#021265',
          }}
        >
          {item?.heading}
        </Text>

        <View style={{ width: 60, marginTop: 5 }}>
          <Text
            style={{
              fontFamily: 'WorkSans-Regular',
              fontSize: 11,
              color: '#000',
            }}
          >
            {item?.subHeading}
          </Text>
        </View>

        <View style={{ position: 'absolute', bottom: 0, right: 5 }}>
          <Image resizeMethod="resize"
            resizeMode="cover"
            source={{ uri: item?.image }}
            style={{ width: 55, height: 55 }}
          />
        </View>
      </TouchableOpacity>
    );
  };

 
  if (loading) {
    return <HomeSkeleton />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#021265' }}>
      <View style={styles.container}>
        {/* Android 14 and older: the navy status bar for the whole app. iOS and
            Android 15+ have no bar background; App.js sets icon colours per screen. */}
        {!EDGE_TO_EDGE && (
          <StatusBar barStyle="light-content" backgroundColor="#021265" translucent={false} />
        )}
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}>

          <ScrollView
            onScroll={handleVerticalScroll}
            scrollEventThrottle={16}
            style={{ backgroundColor: '#FFFFFF', flex: 1, width: '100%' }}>
            <View
              style={{
                backgroundColor: '#021265',
                width: '100%',
                paddingHorizontal: 15,
                paddingBottom: 10,
                marginBottom: 20,
              }}>
              <View
                style={{
                  width: '100%',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                  }}>
                  <TouchableOpacity
                    style={{ paddingTop: 8 }}
                    onPress={() => {
                      openMenu();
                    }}>
                    <IconF name="bars-staggered" size={18} color={'#FFFFFF'} />
                  </TouchableOpacity>
                  <Image
                    style={{ width: 100, height: 60, marginLeft: 15 }}
                    resizeMode="contain"
                    source={require('./assets/Fslogoapp.png')}
                  />
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    width: '30%',
                    justifyContent: 'flex-end',
                    alignItems: 'flex-end',
                  }}>
                  <TouchableOpacity
                    onPress={() => {
                        navigation.navigate('NotificationsScreen');
                    }}>
                    <Image resizeMethod="resize" source={{ uri: "https://duixj37yn5405.cloudfront.net/appImages/notification-01.png" }} style={{ height: 23, width: 23 }} />
                    {unreadNotifications && (
                      <View
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 9,
                          backgroundColor: '#FF0000',
                          position: 'absolute',
                          top: 0,
                          right: 0,
                        }}></View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      navigation.navigate('Like');
                    }}
                    style={{ alignItems: 'flex-end', width: '100%', flex: 1 }}>
                    <Image resizeMethod="resize" source={{ uri: "https://duixj37yn5405.cloudfront.net/appImages/favourite.png" }} style={{ height: 23, width: 23 }} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      navigation.navigate('WalletAmount');
                    }}
                    style={{ alignItems: 'flex-end', width: '100%', flex: 1 }}>
                    <Icon name={'wallet-outline'} size={22} color={'#FFFFFF'} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <HomeTicketShortcut />

            <CustomSwiper
              data={offerCards}
              height={210}
              autoplay={carousel?.autoPlay}
            />

            <View style={{ backgroundColor: '#EBE9F6', paddingVertical: 12, marginTop: 20 }}>
                <Text style={styles.mostCommonFaqsTypo}>Categories</Text>

                <FlatList
                  data={Categories}
                  keyExtractor={(_, index) => index.toString()}
                  renderItem={renderItem}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: 20,
                  }}
                />
              {/* <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 10, paddingHorizontal: 20 }}>
                {ui.map((item, index) => (
                  <TouchableOpacity onPress={() => {
                    if (item?.head === 'Co-Own') {
                      navigation.navigate(item?.navi, { details: Properties });
                    } else {
                      navigation.navigate(item?.navi)
                    }
                  }} key={index} style={{ backgroundColor: '#FFF', padding: 12, borderRadius: 6, width: 135, marginRight: 20, elevation: 5, marginVertical: 10 }}>
                    <Text style={{ fontFamily: 'Montserrat-SemiBold', fontSize: 15, color: '#021265' }}>{item?.head}</Text>
                    <View style={{ width: 60, marginTop: 5 }}>
                      <Text style={{ fontFamily: 'WorkSans-Regular', fontSize: 11, color: '#000' }}>{item?.data}</Text>
                    </View>
                    <View style={{ position: 'absolute', bottom: 0, right: 5 }}>
                      <Image resizeMethod="resize" resizeMode='cover' source={{ uri: item?.img }} style={{ width: 60, height: 60 }} />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView> */}

            </View>
            {/* Same switch as the floating video card: while the dashboard has
                the concert's home card on, this banner opens the concert; when
                it is turned off it goes back to the Altaira banner. Nothing
                renders until the concert section has loaded, so neither banner
                flashes. */}
            {isConcertHomeOn(concertSection) === null ? (
              <View style={{ paddingTop: 20, height: 130 }} />
            ) : isConcertHomeOn(concertSection) ? (
              <TouchableOpacity onPress={() => {
                navigation.navigate('ConcertDetails');
              }} style={{ paddingTop: 20, paddingHorizontal: 20 }}>
                <Image resizeMethod="resize" resizeMode='contain' source={{ uri: "https://fracspace-updates.s3.ap-south-1.amazonaws.com/appImages/bgc+(1).png" }} style={{ width: '100%', height: 110, borderRadius: 10}} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => {
                navigation.navigate('LableProperty');
              }} style={{ paddingTop: 20, paddingHorizontal: 20 }}>
                <Image resizeMethod="resize" resizeMode='contain' source={{ uri: "https://fracspace-updates.s3.ap-south-1.amazonaws.com/appImages/Altaira_Banner.png" }} style={{ width: '100%', height: 110, borderRadius: 10}} />
              </TouchableOpacity>
            )}

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 20,
              }}>
              <Text style={[styles.mostCommonFaqsTypo, { paddingVertical: 15 }]}>
                Available Properties
              </Text>
              <TouchableOpacity
                onPress={() => {
                  navigation.navigate('Home', { details: Properties });
                }}>
                <Text
                  style={[
                    styles.viewTypo11,
                    { paddingVertical: 0, marginTop: 5, paddingRight: 20 },
                  ]}>
                  View More
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal={true}
              style={{ paddingHorizontal: 15, paddingVertical: 5 }}
              showsHorizontalScrollIndicator={false}>
              {Properties.filter(item => item.AvailableFractions > 0).map(
                (item, index) => {
                  const itemName = item?.name;
                  const propId = item?._id;
                  const isLiked = likedProperty.includes(propId);
                  if (!scaleAnimation[itemName]) {
                    scaleAnimation[itemName] = new Animated.Value(1);
                  }
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        navigation.navigate('Property', {
                          details: item,
                          Id: item._id,
                          nav: 'HomePage',
                        });
                        // navigation.navigate('CoOwnPropDetail', { data: item })
                      }}
                      key={index}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#00000014',
                        borderWidth: 1,
                        padding: 10,
                        borderRadius: 10,
                        elevation: 5,
                        width: width * 0.65,
                        marginRight: 20,
                      }}>
                      <Image resizeMethod="resize"
                        resizeMode="cover"
                        source={{ uri: item?.image?.Image1 }}
                        style={{ width: '100%', height: 150 }}
                      />
                      <View style={{ position: 'absolute', top: 15, left: 15 }}>
                        <View>
                          <Text
                            style={{
                              fontFamily: 'Poppins-SemiBold',
                              fontSize: 20,
                              color: '#FFFFFF',
                            }}>
                            {item?.city}
                          </Text>
                        </View>
                      </View>
                      <View style={{ marginTop: 10 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            flex: 1,
                          }}>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontFamily: 'Montserrat-SemiBold',
                                fontSize: 13,
                                color: '#000000',
                              }}>
                              {item?.name}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => {
                              triggerScaleAnimation(itemName);
                              toggleLike(itemName);
                              if (isLiked) {
                                handleRemoveLike(propId);
                                setLikedProperty(prev =>
                                  prev.filter(id => id !== propId),
                                );
                              } else {
                                handleLike(propId);
                                setLikedProperty(prev => [...prev, propId]);
                              }
                            }}
                            style={{}}>
                            <GradientView
                              colors={
                                isLiked
                                  ? ['#FFFFFF', '#FFFFFF']
                                  : ['#FFFFFF', '#FFFFFF']
                              }
                              style={{
                                width: 35,
                                height: 35,
                                borderRadius: 20,
                                alignItems: 'center',
                                justifyContent: 'center',
                                elevation: 5,
                                backgroundColor: '#FFFFFF',
                              }}>
                              <Animated.View
                                style={{
                                  transform: [{ scale: scaleAnimation[itemName] }],
                                }}>
                                {isLiked ? (
                                  <Icon name={'heart'} size={20} color="#ED1C24" />
                                ) : (
                                  <Icon
                                    name={'heart-outline'}
                                    size={20}
                                    color="#ED1C24"
                                  />
                                )}
                              </Animated.View>
                            </GradientView>
                          </TouchableOpacity>
                        </View>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginTop: 10,
                          }}>
                          <Text
                            style={{
                              fontFamily: 'Montserrat-Medium',
                              fontSize: 11,
                              color: '#00000099',
                            }}>
                            Total Frac Value:{' '}
                          </Text>
                          <Text
                            style={{
                              fontFamily: 'Montserrat-SemiBold',
                              fontSize: 11,
                              color: '#000000',
                              marginLeft: 5,
                            }}>
                            ₹ {item?.Price}
                          </Text>
                        </View>
                        {item?.name !== 'ALTAIRA – VILLA' &&
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginVertical: 8,
                          }}>
                          <Text
                            style={{
                              fontFamily: 'Montserrat-Medium',
                              fontSize: 11,
                              color: '#00000099',
                            }}>
                            Frac Value:{' '}
                          </Text>
                          <Text
                            style={{
                              fontFamily: 'Montserrat-SemiBold',
                              fontSize: 11,
                              color: '#000000',
                              marginLeft: 5,
                            }}>
                            ₹ {item?.FC_Price}
                          </Text>
                        </View>
                        }
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text
                            style={{
                              fontFamily: 'Montserrat-Medium',
                              fontSize: 11,
                              color: '#00000099',
                            }}>
                            Available Frac:{' '}
                          </Text>
                          <Text
                            style={{
                              fontFamily: 'Montserrat-SemiBold',
                              fontSize: 11,
                              color: '#000000',
                              marginLeft: 5,
                            }}>
                            {item?.AvailableFractions}
                          </Text>
                        </View>
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginTop: 10,
                          }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              flex: 1,
                            }}>
                            <Image resizeMethod="resize"
                              source={{
                                uri: 'https://duixj37yn5405.cloudfront.net/appImages/square.png',
                              }}
                              style={{ width: 15, height: 15 }}
                            />
                            <Text
                              style={{
                                fontFamily: 'Montserrat-Medium',
                                fontSize: 9,
                                color: '#181D27',
                                marginLeft: 10,
                              }}>
                              {item?.area}
                            </Text>
                          </View>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              flex: 1,
                            }}>
                            <Image resizeMethod="resize"
                              source={{
                                uri: 'https://duixj37yn5405.cloudfront.net/appImages/building.png',
                              }}
                              style={{ width: 15, height: 15 }}
                            />
                            <Text
                              style={{
                                fontFamily: 'Montserrat-Medium',
                                fontSize: 9,
                                color: '#181D27',
                                marginLeft: 7,
                              }}>
                              {item?.P_Type}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                },
              )}
            </ScrollView>

            <View style={{ paddingTop: 20, paddingBottom: 15 }}>
              <Text
                style={{
                  fontFamily: 'WorkSans-SemiBold',
                  fontSize: 20,
                  color: '#000000',
                  paddingHorizontal: 15,
                }}>
                Postcards
              </Text>
            </View>

            <View style={{ paddingLeft: 20 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('Blogs', { Blogfor: 'SouthIndia' });
                  }}
                  style={{ marginRight: 20 }}>
                  <Image resizeMethod="resize"
                    resizeMode="stretch"
                    source={{
                      uri: 'https://duixj37yn5405.cloudfront.net/Postcard+Images/PostCard3.png',
                    }}
                    style={{
                      width: width * 0.91,
                      height: height * 0.4,
                      borderRadius: 15,
                    }}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('Blogs', { Blogfor: 'VaranasiBlog' });
                  }}
                  style={{ marginRight: 20 }}>
                  <Image resizeMethod="resize"
                    resizeMode="stretch"
                    source={{
                      uri: 'https://duixj37yn5405.cloudfront.net/appImages/varanashiPosterImage.jpeg',
                    }}
                    style={{
                      width: width * 0.91,
                      height: height * 0.4,
                      borderRadius: 15,
                    }}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('Blogs', { Blogfor: 'SrilankaBlog' });
                  }}
                  style={{ marginRight: 20 }}>
                  <Image resizeMethod="resize"
                    resizeMode='stretch'
                    source={{
                      uri: 'https://duixj37yn5405.cloudfront.net/appImages/srilankaPosterImage.jpeg',
                    }}
                    style={{
                      width: width * 0.91,
                      height: height * 0.4,
                      borderRadius: 15,
                    }}
                  />
                </TouchableOpacity>
              </ScrollView>
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 20,
                marginTop: 5,
                alignItems: 'center',
              }}>
              <Text style={styles.mostCommonFaqsTypo}>
                Wherever you go, we've a stay
              </Text>
              <View
                style={{
                  marginRight: 15,
                  alignItems: 'center',
                  borderBottomWidth: 0.5,
                  borderBottomColor: '#081F62',
                }}>
              </View>
            </View>

            <FlatList
              data={(locations || []).filter(item => item?.isVisible)}
              horizontal
              keyExtractor={(item, index) => index.toString()}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('Ourstay', { location: item?.city });
                  }}
                  style={{ alignItems: 'center', paddingLeft: 15 }}>
                  <Image resizeMethod="resize"
                    resizeMode='stretch'
                    source={{
                      uri: item?.locationImage
                    }}
                    style={{ width: 91, height: 91 }}
                  />
                  <Text
                    style={{
                      fontFamily: 'Montserrat-Medium',
                      fontSize: 11,
                      color: '#000000',
                      marginTop: 9,
                    }}>
                    {item?.city}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <View style={{
              paddingTop: 30,
            }}>
              <Text style={styles.mostCommonFaqsTypo}>Testimonials</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{
                  flexDirection: 'column', paddingBottom: 50,
                }}>
                
                  <Wire
                    cardCount={3}
                    width={testimonials.length * (cardWidth + 200)}
                    height={wireHeight}
                  />

                  <View
                    style={{
                      flexDirection: 'row',
                      marginTop: 70,
                      paddingHorizontal: 20,
                      //borderWidth:1
                    }}>
                    {testimonials.map((item, index) => (
                      <View
                        key={index}
                        style={{
                          width: 230,
                          marginRight: 100,
                          alignItems: 'center',
                        }}
                        onLayout={event => {
                          const { y, height } = event.nativeEvent.layout;
                          videoLayouts.current[index] = { y, height };
                        }}>
                  
                        <Image resizeMethod="resize"
                          source={{
                            uri: 'https://duixj37yn5405.cloudfront.net/appImages/clip.png',
                          }}
                          style={{
                            width: 40,
                            height: 40,
                            position: 'absolute',
                            top: -40,
                            zIndex: 2,
                            right: index % 2 === 0 ? 15 : undefined,
                            left: index % 2 !== 0 ? 5 : undefined,
                          }}
                        />
                        {showControls[index] && (
                          <View
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: 150,
                              justifyContent: 'center',
                              alignItems: 'center',
                              zIndex: 3,
                            }}
                          >
                            <TouchableOpacity
                              onPress={() => togglePlay(index)}
                              style={{
                                backgroundColor: 'rgba(0,0,0,0.5)',
                                width: 55,
                                height: 55,
                                borderRadius: 30,
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              <Icon
                                name={
                                  playStates[index]
                                    ? 'pause-circle-outline'
                                    : 'play-circle-outline'
                                }
                                size={35}
                                color="#fff"
                              />
                            </TouchableOpacity>
                          </View>
                        )}


                        <View
                          style={{
                            borderWidth: 1,
                            borderColor: '#0000001A',
                            backgroundColor: '#E6E6E670',
                            width: '100%',
                            padding: 10,
                            height: 300,
                            transform: [
                              { rotate: index % 2 === 0 ? '-10deg' : '10deg' },
                            ],
                          }}>
                          <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => togglePlay(index)}>
                            {/* pointerEvents none: on the New Architecture the native video view swallows taps, so the parent Touchable's onPress never fired */}
                            {activeVideoIndex === index ? (
                            <View pointerEvents="none">
                            <Video
                              ref={ref => (videoRefs.current[index] = ref)}
                              source={videoSource(item?.video)}
                              style={{ width: '100%', height: 150, marginBottom: 8 }}
                              resizeMode="cover"
                              paused={!playStates[index]}
                              onEnd={() => {
                                const updatedPlayStates = [...playStates];
                                updatedPlayStates[index] = false;
                                setPlayStates(updatedPlayStates);

                                const updatedEnded = [...videoEnded];
                                updatedEnded[index] = true;
                                setVideoEnded(updatedEnded);
                                setActiveVideoIndex(null);
                                setReadyVideoIndex(null);
                                setShowThumbnails(prev => prev.map((v, i) => (i === index ? true : v)));
                              }}
                              onReadyForDisplay={() => setReadyVideoIndex(index)}
                              onProgress={({ currentTime }) => {
                                const updatedTimes = [...currentTimes];
                                updatedTimes[index] = currentTime;
                                setCurrentTimes(updatedTimes);

                                const activeLineIndex = item.transcript.findIndex(
                                  line =>
                                    currentTime >= line.start &&
                                    currentTime <= line.end,
                                );
                                if (
                                  activeLineIndex !== -1 &&
                                  transcriptScrollRefs.current[index]
                                ) {
                                  transcriptScrollRefs.current[index].scrollTo({
                                    y: activeLineIndex * 32,
                                    animated: true,
                                  });
                                }
                              }}
                              onLoad={({ duration }) => {
                                const updatedDurations = [...durations];
                                updatedDurations[index] = duration;
                                setDurations(updatedDurations);
                                // Came back to a testimonial watched part-way: resume it.
                                if (currentTimes[index] > 0 && !videoEnded[index]) {
                                  videoRefs.current[index]?.seek(currentTimes[index]);
                                }
                              }}
                            />
                            </View>
                            ) : (
                              <View style={{ width: '100%', height: 150, marginBottom: 8 }} />
                            )}

                            {(showThumbnails[index] || activeVideoIndex !== index || readyVideoIndex !== index) && (
                              <Image resizeMethod="resize"
                                source={{ uri: item.image }}
                                style={{
                                  position: 'absolute',
                                  width: '100%',
                                  height: '100%',
                                  top: 0,
                                  left: 0,
                                  resizeMode: 'cover',
                                  zIndex: 1,
                                }}
                              />
                            )}
                            {activeVideoIndex === index && readyVideoIndex !== index && playStates[index] && (
                              <View
                                pointerEvents="none"
                                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 150, zIndex: 2, alignItems: 'center', justifyContent: 'center' }}>
                                <ActivityIndicator size="large" color="#FFFFFF" />
                              </View>
                            )}
                          </TouchableOpacity>

                          <Text
                            style={{
                              fontFamily: 'WorkSans-SemiBold',
                              fontSize: 15,
                              color: '#000000',
                              marginBottom: 8,
                            }}>
                            {item.name}
                          </Text>

                          <ScrollView
                            ref={ref => (transcriptScrollRefs.current[index] = ref)}
                            style={{ maxHeight: 150 }}
                            showsVerticalScrollIndicator={false}>
                            {item.transcript.map((line, idx) => {
                              const isActive =
                                currentTimes[index] >= line.start &&
                                currentTimes[index] <= line.end;
                              return (
                                <Text
                                  key={idx}
                                  style={{
                                    fontFamily: 'Montserrat-Medium',
                                    fontSize: 12,
                                    color: isActive ? '#1A73E8' : '#0000007A',
                                    fontWeight: isActive ? 'bold' : 'normal',
                                    lineHeight: 18,
                                  }}>
                                  {line.text}
                                </Text>
                              );
                            })}
                          </ScrollView>
                        </View>

                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>

            <Text style={[styles.mostCommonFaqsTypo, { paddingTop: 10 }]}>
              In the Media
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 10, paddingLeft: 20, paddingBottom: 65 }}>
                <Image resizeMethod="resize"
                  style={{ width: 120, height: 100 }}
                  resizeMode="contain"
                  source={{
                    uri: 'https://duixj37yn5405.cloudfront.net/appImages/news2.jpeg',
                  }}
         
                />
                <Image resizeMethod="resize"
                  style={{ width: 120, height: 80 }}
                  resizeMode="contain"
                  source={{
                    uri: 'https://duixj37yn5405.cloudfront.net/appImages/news1.jpeg',
                  }}
      
                />
                <Image resizeMethod="resize"
                  style={{ width: 120, height: 80 }}
                  resizeMode="contain"
                  source={{
                    uri: 'https://duixj37yn5405.cloudfront.net/appImages/news3.jpeg',
                  }}
          
                />
                <Image resizeMethod="resize"
                  style={{ width: 120, height: 80 }}
                  resizeMode="contain"
                  source={{
                    uri: 'https://duixj37yn5405.cloudfront.net/appImages/news4.jpeg',
                  }}
                />
              </View>
            </ScrollView>
            
            <Modal
              // visible={popupData?.visibility === true && popUp && !needsProfileCompletion}
              visible={
                isFocused &&
                !profileLoading &&
                popupData?.visibility === true &&
                popUp &&
                !needsProfileCompletion
              }
              transparent
              animationType="fade"
              onRequestClose={() => dispatch(hidePopup())}>
              <View style={styles.overlay}>

                {/* Close when touching outside */}
                <TouchableOpacity
                  style={styles.outsideArea}
                  activeOpacity={1}
                  onPress={() => dispatch(hidePopup())}
                />

                {/* Modal Content */}
                <View style={styles.modalContainer}>
                  {/* Cross Button */}
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => dispatch(hidePopup())}
                  >
                    <Text style={styles.closeText}>✕</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      openPopupLink();
                    }}>

                    <FastImage
                      source={{
                        uri: popupData?.image,
                        priority: FastImage.priority.high,
                      }}
                      style={styles.image}
                      resizeMode={FastImage.resizeMode.cover}
                    />
                    {popupData?.buttonVisibility ? (<>
                      <TouchableOpacity
                        onPress={() => {
                          openPopupLink();
                        }}
                        style={{ position: 'absolute', bottom: 40, alignSelf: 'center' }}>
                        <GradientView
                          colors={popupData?.buttonColor || ['#FAD059', '#FFE7A2']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{
                            borderRadius: 10,
                            padding: 13,
                            paddingHorizontal: 50,
                          }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text
                              style={{
                                fontFamily: 'Montserrat-SemiBold',
                                fontSize: 14,
                                color: popupData?.buttonTextColor,
                              }}>
                              {popupData?.buttonText}
                            </Text>

                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginLeft: 10,
                              }}>

                            </View>
                          </View>
                        </GradientView>
                      </TouchableOpacity></>) : null}

                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            <CompleteProfilePopup
              visible={isFocused && needsProfileCompletion && showProfilePopup && !profileLoading}
              // visible={!profileLoading && needsProfileCompletion}
              onComplete={() => {
                setShowProfilePopup(false);
                navigation.navigate('CompleteProfileScreen');
              }}
              onLater={() => {
                setShowProfilePopup(false);
              }}
            />


          </ScrollView>
        </Animated.ScrollView>
        {carousel?.edgeTab &&
          <EdgeFab scrollY={scrollY} />
        }
        {isConcertHomeOn(concertSection) && (
            <ConcertVideoCard
              scrollY={scrollY}
              concert={concertSection.concert}
            />
          )}

        {isMenuOpen && (
          <Pressable
            onPress={closeMenu}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(0,0,0,0.3)',
              zIndex: 999,
            }}
          />
        )}

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            {
              transform: [{ translateX: menuAnimation }],
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: MENU_WIDTH,
              backgroundColor: '#fff',
              paddingBottom: insets.bottom,
              zIndex: 1000,
              elevation: 10,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
            },
          ]}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 90 + insets.bottom }]}
            showsVerticalScrollIndicator={false}>

            <View style={styles.containerPadding}>
              <View style={styles.profileContainer}>
                <View style={styles.profileRow}>
                  <View>
                    <Image resizeMethod="resize"
                      resizeMode='cover'
                      source={globalState?.userProfile ? { uri: globalState?.userProfile } : require('../assets/NewProfileimage.jpg')}
                      style={styles.profileImage}
                    />
                  </View>

                  <View style={styles.profileTextContainer}>
                    <Text style={styles.helloText}>
                      Hello {globalState?.userName}!
                    </Text>
                    <Text style={styles.emailText}>
                      {globalState?.userEmail}
                    </Text>
                  </View>
                </View>

                <View style={styles.profileRight}>
                  {/* <IconI name={'right'} color={'#FFFFFF'} size={15} /> */}
                </View>
              </View>

              {/* <View style={styles.quickActionsBox}>
      <TouchableOpacity onPress={() => { handleCallRecord(); }} style={styles.quickActionItem}>
        <Image resizeMethod="resize" source={{ uri: 'https://duixj37yn5405.cloudfront.net/appImages/Ico3.png' }} style={styles.quickIcon} />
        <Text style={styles.quickText}>Support</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => { handleRating(); }} style={styles.quickActionItem}>
        <Image resizeMethod="resize" source={{ uri: 'https://duixj37yn5405.cloudfront.net/appImages/Ico2.png' }} style={styles.quickIcon} />
        <Text style={styles.quickText}>Rate App</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => { navigation.navigate('FeedbackForm'); }} style={styles.quickActionItem}>
        <Image resizeMethod="resize" source={{ uri: 'https://duixj37yn5405.cloudfront.net/appImages/Ico1.png' }} style={styles.quickIcon} />
        <Text style={styles.quickText}>Feedback</Text>
      </TouchableOpacity>
    </View> */}

              <View style={styles.sectionWrapper}>
                <View style={styles.sectionTitleMargin}>
                  <Text style={styles.sectionTitle}>Explore</Text>
                </View>

                <TouchableOpacity
                  onPress={() => { navigation.navigate('Home', { details: Properties }); }}
                  style={styles.listItem}
                >
                  <View style={styles.listRow}>
                    <Image resizeMethod="resize" source={{ uri: 'https://duixj37yn5405.cloudfront.net/appImages/image4.jpeg' }} style={styles.smallIcon} />
                    <Text style={styles.listText}>Co-own</Text>
                  </View>
                  <IconI name={'right'} size={15} color={'#081F62'} />
                </TouchableOpacity>

                {/* <TouchableOpacity
                  onPress={() => {
                    setGlobalState(prevState => ({ ...prevState, userEvent: 'Interiors' }));
                    navigation.navigate('InteriorForm');
                  }}
                  style={styles.listItem}
                >
                  <View style={styles.listRow}>
                    <Image resizeMethod="resize" source={{ uri: 'https://duixj37yn5405.cloudfront.net/appImages/image8.jpeg' }} style={styles.smallIcon} />
                    <Text style={styles.listText}>Interiors</Text>
                  </View>
                  <IconI name={'right'} size={15} color={'#081F62'} />
                </TouchableOpacity> */}

                <TouchableOpacity
                  onPress={() => { navigation.navigate('DreamscapeHome', {from: 'HomePage'}); }}
                  style={styles.listItemNoBorder}
                >
                  <View style={styles.listRow}>
                    <Image resizeMethod="resize" source={{ uri: 'https://duixj37yn5405.cloudfront.net/appImages/image10.jpeg' }} style={styles.smallIcon} />
                    <Text style={styles.listText}>Stays</Text>
                  </View>
                  <IconI name={'right'} size={15} color={'#081F62'} />
                </TouchableOpacity>
              </View>

              <View style={styles.sectionWrapper}>
                <View style={styles.supportTitleMargin}>
                  <Text style={styles.sectionTitle}>Support</Text>
                </View>

                <TouchableOpacity style={styles.listItem} onPress={() => {
                  navigation.navigate('MyProfile', { screen: 'home' })
                }}>
                  <View style={styles.listRow} >
                    <Iconn name={'headphones'} size={20} color={'#222222'} />
                    <Text style={styles.listText}>Helpline</Text>
                  </View>
                  <IconI name={'right'} size={15} color={'#081F62'} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.listItem} onPress={() => {
                  navigation.navigate('TermsAndCondition')
                }}>
                  <View style={styles.listRow}>
                    <Iconn name={'info'} size={20} color={'#222222'} />
                    <Text style={styles.listText}>Terms & Policies</Text>
                  </View>
                  <IconI name={'right'} size={15} color={'#081F62'} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.listItem} onPress={() => {
                  navigation.navigate('Privacy')
                }}>
                  <View style={styles.listRow}>
                    <Icon name={'shield-checkmark-outline'} size={20} color={'#222222'} />
                    <Text style={styles.listText}>Privacy Policy</Text>
                  </View>
                  <IconI name={'right'} size={15} color={'#081F62'} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.listItem} onPress={() => {
                  navigation.navigate('Aboutus')
                }}>
                  <View style={styles.listRow}>
                    <Iconn name={'info'} size={20} color={'#222222'} />
                    <Text style={styles.listText}>About</Text>
                  </View>
                  <IconI name={'right'} size={15} color={'#081F62'} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { handleLogOut(); }} style={styles.logoutRow}>
                  <View style={styles.listRow}>
                    <Icon name={'log-out-outline'} size={20} color={'#F01212'} style={styles.logoutIconRotate} />
                    <Text style={styles.listText}>Logout</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => { setModalVisibleRS(true); }}
              style={styles.deleteContainer}>
              <View style={styles.deleteRow}>
                <View style={styles.deleteIconWrapper}>
                  <IconI name={'delete'} size={15} color={'#D40D0D'} />
                </View>
                <Text style={styles.deleteText}>Delete Account</Text>
              </View>
            </TouchableOpacity>

          </ScrollView>
        </Animated.View>
        <DeleteAccountModal
          visible={modalVisibleRS}
          deleting={deleting}
          onCancel={() => setModalVisibleRS(false)}
          onConfirm={handleDeleteAccount}
        />

      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  input: {
    borderColor: '#1A1A1A',
    borderWidth: 1,
    borderRadius: 8,
    fontFamily: 'Barlow-Medium',
    fontSize: 16,
  },

  mostCommonFaqsTypo: {
    fontFamily: 'WorkSans-SemiBold',
    color: '#000',
    textAlign: 'left',
    letterSpacing: 0,
    fontSize: 18,
    marginHorizontal: 15,
    // borderWidth:1
  },
  viewTypo1: {
    color: '#000000',
    fontFamily: 'Montserrat-Medium',
    textAlign: 'center',
    letterSpacing: 0,
    fontSize: 14,
    paddingVertical: 15,
  },
  viewTypo11: {
    color: '#386BF6',
    fontFamily: 'WorkSans-Medium',
    textAlign: 'center',

    fontSize: 12,
  },
  maskGroupIconLayout: {
    flex: 1,
    width: width * 0.3,
    height: height * 0.16,
    overflow: 'visible',
  },

  groupChild22: {
    borderRadius: 12,
    borderColor: '#e7e7e7',
    borderWidth: 1,
    borderStyle: 'solid',
    backgroundColor: '#ffffff',
    // padding:20,
    paddingVertical: 10,
    width: '100%',
    // flex: 1
  },
  groupChild23: {
    //  top: 175,
    left: 121,
    // alignItems:'center',
    width: 142,
    height: 18,
    //position: "absolute",
    overflow: 'hidden',
  },
  airportTypo: {
    color: '#2b2b2b',
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    //alignItems: 'center',
    textAlign: 'center',
    // fontWeight: "500",
    //paddingVertical: 10
  },
  image: {
    width: '90%',
    //height: height * 0.22,
    //height:160,
    borderRadius: 15,
    alignSelf: "center"
    //flex: 1,
  },
  wrapper: {},
  container: {
    flex: 1,
  },
  videoContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: width * 0.4, // Adjust the width of the video as needed
    height: 255, // Adjust the height of the video as needed
    overflow: 'hidden',
    borderRadius: 10, // Optional: For rounded corners on the video
  },
  backgroundVideo: {
    width: '100%',
    height: '100%',
  },
  backgroundVideo2: {
    width: '10%',
    height: '10%',
  },
  image1: {
    width: 100,
    height: 60,
  },
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer1: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#000',
    marginTop: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#000000',
    marginTop: 10,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 20,
  },
  okayButton: {
    marginTop: 20,
    backgroundColor: '#0E2038',
    paddingVertical: 12,
    // paddingHorizontal: 0,
    borderRadius: 15,
    width: '40%',
    alignItems: 'center',
    marginHorizontal: 3,
  },
  okayButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  //drawer styles********
  scrollView: {
    backgroundColor: '#FFFFFF',
    top: 20,
  },
  scrollContent: {},

  containerPadding: {
    paddingHorizontal: 15,
  },

  profileContainer: {
    marginHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#021265E5',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  profileRow: {
    flexDirection: 'row',
    flex: 2,
  },
  profileImage: {
    width: 45,
    height: 45,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  profileTextContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    marginLeft: 10,
  },
  profileRight: {
    justifyContent: 'center',
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 20,
  },

  helloText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  emailText: {
    fontFamily: 'Montserrat-Medium',
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 5,
  },

  quickActionsBox: {
    marginHorizontal: 15,
    borderWidth: 1,
    borderColor: '#DCDCDC',
    borderRadius: 10,
    marginVertical: 20,
    padding: 15,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
    elevation: 5,
  },
  quickActionItem: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  quickIcon: {
    width: 50,
    height: 50,
  },
  quickText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10,
    color: '#1A1A1A',
    marginTop: 5,
  },

  sectionWrapper: {
    marginHorizontal: 20,
  },
  sectionTitleMargin: {
    marginVertical: 10,
  },
  supportTitleMargin: {
    marginVertical: 20,
  },
  sectionTitle: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 16,
    color: '#1A1A1A',
  },

  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomColor: '#F6F6F6',
    borderBottomWidth: 1,
  },
  listItemNoBorder: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  listRow: {
    flexDirection: 'row',
  },
  listText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
    color: '#1A1A1A',
    marginLeft: 20,
  },
  smallIcon: {
    width: 20,
    height: 20,
  },

  logoutRow: {
    flexDirection: 'row',
    marginVertical: 20,
  },
  logoutIconRotate: {
    transform: [{ rotate: '180deg' }],
  },

  deleteContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 31,
    paddingVertical: 20,
    borderBottomColor: '#F6F6F6',
    borderBottomWidth: 1,
    backgroundColor: '#FBE4D0',
    marginBottom: 40,
    borderRadius: 0,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteIconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
    color: '#1A1A1A',
    marginLeft: 10,
  },
  //below modal//

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },

  outsideArea: {
    flex: 1,
  },

  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },

  image: {
    width: '100%',
    height: 480,
  },

  closeButton: {
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)', // semi transparent
    width: 35,
    height: 35,
    alignSelf: 'center',

  },

  closeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  upgradeButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: '#D4AF37',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 30,
  },

  upgradeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

});
