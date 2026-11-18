import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import React, {forwardRef, useState, useEffect, useContext} from 'react';
import {View,Text,TouchableOpacity,Image,StyleSheet,Dimensions,} from 'react-native';
import Svg, {G, Path} from 'react-native-svg';
import { AppContext } from '../Context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DarkNavBar, NavCore, navBottom } from '../Version2_O/SpecialSection/HubNavBar';
import { markTap, sinceTap } from '../Version2_O/SpecialSection/perf';
// import { CoOwnContext } from './CoOwnContext';

const {width} = Dimensions.get('window');
const TAB_WIDTH = width / 5;
const CENTRE = 2;
// Room above the bar for its shadow (the SVG starts this far above the bar).
const SHADOW = 14;
// Soft shadow along the bar's top edge and the active tab's curve, drawn as
// stacked strokes under the white fill: elevation draws nothing here because
// the bar's shape is an SVG, not a View with a background.
// Eight faint layers, each 3pt wider, overlap into a smooth fade: darkest
// at the edge (~12%), gone by 12pt out.
const SHADOW_STROKES = Array.from({length: 8}, (_, i) => ({width: 23 - i * 3, opacity: 0.015}));



const BottomNavi = forwardRef(({state, navigation}, ref) => {
    const [selected, setSelected] = useState(state.index);

    const { globalState } = useContext(AppContext);
    const isVerified = globalState?.userDetails?.verification;
    const insets = useSafeAreaInsets();

    useEffect(() => {
        setSelected(state.index);
    }, [state.index]);

    const tabs = [
        {
            icon: 'https://duixj37yn5405.cloudfront.net/appImages/home.png',
            notActive:
            'https://duixj37yn5405.cloudfront.net/appImages/home1.png',
            label: 'Home',
            navi: 'HomeStack',
            nav: 'HomePage',
        },
        {
            icon: isVerified ? 'https://duixj37yn5405.cloudfront.net/appImages/wallet-01+(1).png' : 'https://duixj37yn5405.cloudfront.net/appImages/ProfileVeri.png',
            notActive: isVerified ? 'https://duixj37yn5405.cloudfront.net/appImages/NotActiveWallet.png' : 'https://duixj37yn5405.cloudfront.net/appImages/ProfVeriNotActive.png',
            label: isVerified ? 'Wallet' : 'Verification',
            navi: 'VerificationOrWallet',
            nav: 'VerificationOrWallet',
        },
        {
            centre: true,
            label: 'Special',
            navi: 'SpecialSectionStack',
            nav: 'Hub',
        },
        {
            icon: 'https://duixj37yn5405.cloudfront.net/appImages/Portfolio.png',
            notActive:
            'https://duixj37yn5405.cloudfront.net/appImages/portfolio1.png',
            label: 'Portfolio',
            navi: 'DashboardStack',
            nav: 'Owned',
        },
        {
            icon: 'https://duixj37yn5405.cloudfront.net/appImages/user.png',
            notActive:
            'https://duixj37yn5405.cloudfront.net/appImages/profile11.png',
            label: 'Profile',
            navi: 'ProfileStack',
            nav: 'Profile',
        },
    ];

    const currentRoute = state.routes[state.index];
    const nestedRoute = getFocusedRouteNameFromRoute(currentRoute);
    const routeName = nestedRoute ?? currentRoute.name;

    //   console.log("▶ Stack:", currentRoute.name, "| nested:", nestedRoute, "| route:", routeName);

    const TAB_ROUTE_MAP = {
        HomeStack: ['HomeStack', 'HomePage', 'Home'],
        DashboardStack: ['DashboardStack', 'Owned'],
        SpecialSectionStack: ['SpecialSectionStack', 'Hub'],
        ProfileStack: ['ProfileStack', 'Profile'],
        VerificationOrWallet: [
            'VerificationOrWallet',
            'ProfileVerification',
            'WalletStack',
            'WalletAmount',
        ],
    };

    const allowedRoutes = TAB_ROUTE_MAP[currentRoute.name];

    if (allowedRoutes && !allowedRoutes.includes(routeName)) {
        return null;
    }

    const goTo = index => {
        const tab = tabs[index];
        if (tab.navi === 'SpecialSectionStack') {
            markTap('Hub');
        }
        setSelected(index);
        if (tab.navi) {
            navigation.navigate(tab.navi, {
                screen: tab.nav,
            });
        }
    };

    // Special Section: the design's floating dark pill instead of the white bar.
    if (currentRoute.name === 'SpecialSectionStack') {
        sinceTap('tab bar render');
        return <DarkNavBar tabs={tabs} onPress={goTo} bottom={navBottom(insets)} />;
    }

    // The top edge, with the dip under the active tab.
    const getEdgePath = index => {
        const center = index * TAB_WIDTH + TAB_WIDTH / 2;
        const left = center - 45;
        const c1 = center - 30;
        const c2 = center + 30;
        const right = center + 45;

        return `
        M0 0 
        H${left} 
        C${c1} 0, ${c1} 40, ${center} 40 
        C${c2} 40, ${c2} 0, ${right} 0 
        H${width}
        `;
    };
    const getArcPath = index => `${getEdgePath(index)} V90 H0 Z`;
    const arcIndex = selected === CENTRE ? -10 : selected;

  return (
    <View style={{height: 70, width: '100%', position: 'absolute', bottom: insets.bottom, shadowColor: '#000',elevation:10}}>
        {/* Arc background */}
        <Svg width={width} height={90 + SHADOW} style={styles.arc} pointerEvents="none">
            <G transform={`translate(0 ${SHADOW})`}>
                {SHADOW_STROKES.map(sh => (
                    <Path key={sh.width} d={getEdgePath(arcIndex)} fill="none" stroke="#000" strokeOpacity={sh.opacity} strokeWidth={sh.width} />
                ))}
                <Path d={getArcPath(arcIndex)} fill="#FFFFFF" />
            </G>
        </Svg>

        {/* Floating Circle */}
        {selected !== CENTRE && (
            <View
                style={[
                    styles.circle,
                    {left: selected * TAB_WIDTH + (TAB_WIDTH - 50) / 2},
                ]}
            >
                <Image
                    resizeMode="contain"
                    source={{uri: tabs[selected].icon}}
                    style={{width: 28, height: 28}}
                />
            </View>
        )}

        {/* Tab Bar */}
        <View style={styles.tabBar}>
            {tabs.map((tab, index) => {
                const isActive = selected === index;
                if (tab.centre) {
                    return (
                        <View key={index} style={styles.tab}>
                            <NavCore onPress={() => goTo(index)} style={styles.core} />
                        </View>
                    );
                }
                return (
                    <TouchableOpacity
                        key={index}
                        onPress={() => goTo(index)}
                        style={styles.tab}
                    >
                        {!isActive && (
                            <Image resizeMode="contain" source={{uri: tab.notActive}} style={{width: 22, height: 22}}/>
                        )}
                        <Text
                            style={{fontFamily:isActive ? 'Montserrat-SemiBold' : 'Montserrat-Medium',fontSize: 12,color: isActive ? '#021265' : '#9DB2CE',marginTop: isActive ? 35 : 4,textAlign:'center'}}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    </View>

//     <View style={styles.bottomShadowWrapper}>
//   <View style={styles.bottomNavContainer}>

//     {/* Arc background */}
//     <Svg width={width} height={90} style={StyleSheet.absoluteFill}>
//       <Path d={getArcPath(selected)} fill="#FFFFFF" />
//     </Svg>

//     {/* Floating Circle */}
//     <View
//       style={[
//         styles.circle,
//         { left: selected * TAB_WIDTH + (TAB_WIDTH - 50) / 2 },
//       ]}
//     >
//       <Image
//         resizeMode="contain"
//         source={{ uri: tabs[selected].icon }}
//         style={{ width: 25, height: 25 }}
//       />
//     </View>

//     {/* Tab Bar */}
//     <View style={styles.tabBar}>
//       {tabs.map((tab, index) => {
//         const isActive = selected === index;
//         return (
//           <TouchableOpacity
//             key={index}
//             onPress={() => {
//               setSelected(index);
//               if (tab.navi) {
//                 navigation.navigate(tab.navi, {
//                   screen: tab.nav,
//                 });
//               }
//             }}
//             style={styles.tab}
//           >
//             {!isActive && (
//               <Image
//                 resizeMode="contain"
//                 source={{ uri: tab.notActive }}
//                 style={{ width: 22, height: 22 }}
//               />
//             )}
//             <Text
//               style={{
//                 fontFamily: isActive
//                   ? 'Montserrat-SemiBold'
//                   : 'Montserrat-Medium',
//                 fontSize: 12,
//                 color: isActive ? '#021265' : '#9DB2CE',
//                 marginTop: isActive ? 35 : 4,
//                 textAlign: 'center',
//               }}
//             >
//               {tab.label}
//             </Text>
//           </TouchableOpacity>
//         );
//       })}
//     </View>

//   </View>
// </View>

  );
});

const styles = StyleSheet.create({
  arc: {position: 'absolute', top: -SHADOW, left: 0},
  circle: {
    position: 'absolute',
    top: -15,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: {width: 0, height: 3},
    shadowRadius: 4,
    elevation: 6,
    borderWidth:0.5,
    borderColor:'#0000006b'
  },
  tabBar: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    height: 70,
    width: '100%',
    justifyContent: 'space-between',
  },
  core: {
    position: 'absolute',
    top: -16,
  },
  tab: {
    width: TAB_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BottomNavi;