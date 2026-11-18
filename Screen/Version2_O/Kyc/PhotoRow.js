// Profile photo row. Not a KYC check: it reuses the existing upload
// (ProfilePic → /api/users/uploadProfilePic) exactly as Profile does, so the
// customer is never asked for a photo again.
import React, {useContext, useState} from 'react';
import {ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {AppContext} from '../../Context/AppContext';
import {ProfilePic} from '../../Services/UserApi';
import {UPLOAD_PHOTO_OPTIONS} from '../../utils/photoPicker';
import {C, F, LOGOS} from './theme';
import {DocTile} from './ui';
import {rowStyles as r} from './StepRow';

// The server fills profilePicture with this placeholder until a photo is
// uploaded (CompleteProfileScreen treats it the same way).
const isPlaceholder = url => !url || /\/defaultProfile\//.test(url);

/** The customer's own photo, or null while they still have the placeholder. */
export const ownPhoto = gs =>
  [gs?.userProfile, gs?.userDetails?.profilePicture].find(u => typeof u === 'string' && !isPlaceholder(u)) || null;

export default function PhotoRow() {
  const {globalState, setGlobalState} = useContext(AppContext);
  const current = ownPhoto(globalState);
  const [uploading, setUploading] = useState(false);

  const upload = async asset => {
    if (!asset?.uri) {
      return;
    }
    const form = new FormData();
    form.append('email', globalState?.userDetails?.email);
    form.append('profile', {
      uri: asset.uri,
      type: asset.type || 'image/jpeg',
      name: asset.fileName || 'profile.jpg',
    });
    setUploading(true);
    try {
      const {data: res} = await ProfilePic(form);
      if (res?.success) {
        setGlobalState(prev => ({...prev, userProfile: asset.uri}));
      } else {
        Alert.alert('Photo not saved', res?.message || 'Please try again.');
      }
    } catch (e) {
      Alert.alert('Photo not saved', e?.response?.data?.message || 'Please check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  const pick = from => {
    const launch = from === 'camera' ? launchCamera : launchImageLibrary;
    const opts = from === 'camera' ? {...UPLOAD_PHOTO_OPTIONS, cameraType: 'front', saveToPhotos: false} : UPLOAD_PHOTO_OPTIONS;
    launch(opts, res => {
      if (!res?.didCancel && !res?.errorCode) {
        upload(res?.assets?.[0]);
      }
    });
  };

  const choose = () =>
    Alert.alert(current ? 'Change profile photo' : 'Add profile photo', 'A clear photo of your face, facing the camera.', [
      {text: 'Take photo', onPress: () => pick('camera')},
      {text: 'Choose from gallery', onPress: () => pick('library')},
      {text: 'Cancel', style: 'cancel'},
    ]);

  return (
    <Pressable
      onPress={choose}
      disabled={uploading}
      accessibilityRole="button"
      style={({pressed}) => [r.card, pressed && r.pressed]}>
      {current ? (
        <Image source={{uri: current}} style={st.avatar} />
      ) : (
        <DocTile logo={LOGOS.photo} />
      )}
      <View style={r.body}>
        <Text style={r.title}>Profile photo</Text>
        <Text style={r.sub} numberOfLines={2}>
          {uploading ? 'Uploading…' : current ? 'Added · tap to change' : 'A clear photo of your face for your Fracspace profile'}
        </Text>
      </View>
      {uploading ? (
        <ActivityIndicator color={C.navy} />
      ) : current ? (
        <Icon name="check-circle" size={22} color={C.success} />
      ) : (
        <Text style={st.add}>Add</Text>
      )}
    </Pressable>
  );
}

const st = StyleSheet.create({
  avatar: {width: 48, height: 48, borderRadius: 24, backgroundColor: C.navyTint},
  add: {fontFamily: F.bodySemi, fontSize: 14, color: C.navy},
});
