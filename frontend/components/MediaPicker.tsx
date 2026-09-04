import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Alert, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, Video, Trash2, Play, X } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { Video as ExpoVideo, ResizeMode } from 'expo-av';

interface Props {
  imageUri?: string;
  videoUri?: string;
  onSelectImage: (uri?: string) => void;
  onSelectVideo: (uri?: string) => void;
}

export default function MediaPicker({ imageUri, videoUri, onSelectImage, onSelectVideo }: Props) {
  const [loading, setLoading] = useState(false);
  const [previewVideo, setPreviewVideo] = useState(false);

  const takePhoto = async () => {
    setLoading(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to snap photos.');
        setLoading(false);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onSelectImage(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Camera error:', e);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    setLoading(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo library permission is required.');
        setLoading(false);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onSelectImage(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Gallery pick error:', e);
    } finally {
      setLoading(false);
    }
  };

  const pickVideo = async () => {
    setLoading(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Media library permission is required.');
        setLoading(false);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onSelectVideo(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Video pick error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>IMAGE & MEDIA ATTACHMENTS</Text>

      <View style={styles.btnRow}>
        <Pressable style={styles.actionBtn} onPress={takePhoto} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#182235" />
          ) : (
            <>
              <Camera color="#182235" size={18} strokeWidth={2.5} />
              <Text style={styles.btnText}>Camera</Text>
            </>
          )}
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={pickImage} disabled={loading}>
          <ImageIcon color="#182235" size={18} strokeWidth={2.5} />
          <Text style={styles.btnText}>Gallery</Text>
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={pickVideo} disabled={loading}>
          <Video color="#182235" size={18} strokeWidth={2.5} />
          <Text style={styles.btnText}>Video</Text>
        </Pressable>
      </View>

      {imageUri ? (
        <View style={styles.previewCard}>
          <View style={styles.previewContainer}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
            <Pressable style={styles.removeBtn} onPress={() => onSelectImage(undefined)}>
              <Trash2 color="#FFF" size={14} />
            </Pressable>
          </View>
          <View style={styles.retakeCol}>
            <Text style={styles.attachedTitle}>Image Attached</Text>
            <Text style={styles.attachedSub}>Poster, screenshot, or document</Text>
            <Pressable style={styles.retakeBtn} onPress={takePhoto}>
              <Text style={styles.retakeBtnText}>Retake Photo</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {videoUri ? (
        <>
          <Pressable style={styles.videoCard} onPress={() => setPreviewVideo(true)}>
            <View style={styles.videoIconBox}>
              <Play color="#FFF" size={20} fill="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.videoTitle} numberOfLines={1}>
                {videoUri.split('/').pop() || 'presentation-instructions.mp4'}
              </Text>
              <Text style={styles.videoSub}>Tap to preview video</Text>
            </View>
            <Pressable style={styles.videoRemoveBtn} onPress={() => onSelectVideo(undefined)}>
              <Trash2 color={Colors.light.danger} size={18} />
            </Pressable>
          </Pressable>

          <Modal visible={previewVideo} animationType="slide" transparent={false} onRequestClose={() => setPreviewVideo(false)}>
            <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 16 }}>
                <Pressable onPress={() => setPreviewVideo(false)} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 }}>
                  <X color="#FFF" size={24} />
                </Pressable>
              </View>
              <ExpoVideo
                source={{ uri: videoUri }}
                style={{ flex: 1 }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
              />
            </SafeAreaView>
          </Modal>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  label: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: '#667085',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF3',
    borderRadius: 16,
    paddingVertical: 14,
    shadowColor: '#182235',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  btnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    color: '#182235',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: '#E9EDF3',
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
  },
  previewContainer: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removeBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.light.danger,
    borderRadius: 12,
    padding: 4,
  },
  retakeCol: {
    flex: 1,
    justifyContent: 'center',
  },
  attachedTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: '#182235',
  },
  attachedSub: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#667085',
    marginBottom: 6,
  },
  retakeBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9EDF3',
  },
  retakeBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: '#FF7A00',
  },
  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: '#E9EDF3',
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
  },
  videoIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#4B3FDC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: '#182235',
  },
  videoSub: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#667085',
  },
  videoRemoveBtn: {
    padding: 6,
  },
});
