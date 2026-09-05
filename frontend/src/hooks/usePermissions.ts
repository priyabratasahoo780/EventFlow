import { useState } from 'react';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Contacts from 'expo-contacts';

export function usePermissions() {
  const [permissions, setPermissions] = useState({
    location: false,
    camera: false,
    mediaLibrary: false,
    contacts: false,
  });

  const requestAllPermissions = async () => {
    const locStatus = await Location.requestForegroundPermissionsAsync();
    const camStatus = await ImagePicker.requestCameraPermissionsAsync();
    const libStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const conStatus = await Contacts.requestPermissionsAsync();

    const updated = {
      location: locStatus.status === 'granted',
      camera: camStatus.status === 'granted',
      mediaLibrary: libStatus.status === 'granted',
      contacts: conStatus.status === 'granted',
    };

    setPermissions(updated);
    return updated;
  };

  return {
    permissions,
    requestAllPermissions,
  };
}
