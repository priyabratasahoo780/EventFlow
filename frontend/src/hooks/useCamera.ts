import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export function useCamera() {
  const [loading, setLoading] = useState(false);

  const takePhoto = async () => {
    setLoading(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required.');
        return null;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        return result.assets[0].uri;
      }
    } catch (err) {
      console.warn('Camera hook error:', err);
    } finally {
      setLoading(false);
    }
    return null;
  };

  const pickFromGallery = async () => {
    setLoading(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Media library permission is required.');
        return null;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        return result.assets[0].uri;
      }
    } catch (err) {
      console.warn('Gallery pick hook error:', err);
    } finally {
      setLoading(false);
    }
    return null;
  };

  return {
    loading,
    takePhoto,
    pickFromGallery,
  };
}
