import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, Pressable, Alert, Share, 
  Image, ActivityIndicator, TextInput, ScrollView, Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import { Colors } from '../../constants/Colors';
import { 
  Copy, Share2, LogOut, Camera, Image as ImageIcon, 
  Edit3, Check, Trash2, X, RefreshCw, Sparkles 
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileScreen() {
  const { user, logout, updateUserProfile } = useAuthStore();
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || '');

  if (!user) return null;

  const userInitial = (user.name?.charAt(0) || user.email?.charAt(0) || 'U').toUpperCase();
  const hasValidPhoto = !!user.profilePhoto && !user.profilePhoto.includes('unsplash.com');

  const copyId = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(user.uniqueId);
    Alert.alert('Copied!', 'Unique ID copied to clipboard');
  };

  const shareId = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Add me on EventFlow using my Unique ID: ${user.uniqueId}`,
        title: 'Share Unique ID',
      });
    } catch (e) {
      console.log(e);
    }
  };

  const saveProfilePhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploading(true);
    setShowPhotoModal(false);

    try {
      // Optimistically show the local URI
      await updateUserProfile({ profilePhoto: asset.uri });
        
      // Upload to backend to get a permanent URL and avoid SQLITE_FULL
      try {
        const formData = new FormData();
        const filename = asset.uri.split('/').pop() || 'profile.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;
        
        formData.append('image', {
          uri: asset.uri,
          name: filename,
          type,
        } as any);

        const uploadRes = await api.post('/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        if (uploadRes.data && uploadRes.data.url) {
          // Get the base url (e.g. http://192.168.x.x:5000)
          const baseUrl = api.defaults.baseURL?.replace('/api', '') || '';
          const finalUrl = baseUrl + uploadRes.data.url;
          
          await updateUserProfile({ profilePhoto: finalUrl });
          await api.put('/users/profile', { profilePhoto: finalUrl });
        }
      } catch (backendErr) {
        console.log('Backend upload error:', backendErr);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Profile photo updated successfully!');
    } catch (err: any) {
      Alert.alert('Upload Error', 'Could not update profile photo.');
    } finally {
      setUploading(false);
    }
  };

  // 1. Take Photo with Camera
  const takePhotoWithCamera = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please allow camera permissions to take a profile picture.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await saveProfilePhoto(result.assets[0]);
      }
    } catch (err) {
      console.warn('Camera error:', err);
    }
  };

  // 2. Pick Image from Gallery
  const pickFromGallery = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please allow photo gallery permissions to choose a picture.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await saveProfilePhoto(result.assets[0]);
      }
    } catch (err) {
      console.warn('Gallery pick error:', err);
    }
  };

  // 3. Remove Photo
  const removePhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowPhotoModal(false);
    setUploading(true);

    try {
      await updateUserProfile({ profilePhoto: '' });
      try {
        await api.put('/users/profile', { profilePhoto: '' });
      } catch (e) {}
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setUploading(false);
    }
  };

  const handleRegenerateId = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowers = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%&*_-';
    const getRandom = (set: string) => set[Math.floor(Math.random() * set.length)];
    const chars = [
      getRandom(uppers), getRandom(lowers), getRandom(numbers), getRandom(symbols),
      getRandom(uppers), getRandom(lowers), getRandom(numbers), getRandom(symbols)
    ];
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const newId = chars.join(''); // Exact 8 characters

    await updateUserProfile({ uniqueId: newId });
    try {
      await api.post('/auth/sync', { ...user, uniqueId: newId });
    } catch (e) {}

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('New Unique ID Generated! ✨', `Your 8-character Unique ID is:\n\n${newId}`);
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await updateUserProfile({ name: nameInput.trim() });
      try {
        await api.put('/users/profile', { name: nameInput.trim() });
      } catch (e) {}
      setIsEditingName(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Error', 'Could not update name');
    }
  };

  const handleLogout = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await logout();
    router.replace('/(auth)/welcome');
  };

  return (
    <View style={styles.root}>
      {/* Soft Glow Background */}
      <View style={styles.bgGlow} />

      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBox}>
          <Text style={styles.header}>PROFILE</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          
          <View style={styles.content}>
            <View style={styles.premiumCard}>
              {/* Avatar with Interactive Edit Badge */}
              <View style={styles.avatarWrapper}>
                <Pressable 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowPhotoModal(true);
                  }} 
                  style={styles.avatarContainer} 
                  disabled={uploading}
                >
                  {uploading ? (
                    <View style={styles.avatarFallback}>
                      <ActivityIndicator size="large" color={colors.secondary} />
                    </View>
                  ) : hasValidPhoto ? (
                    <Image source={{ uri: user.profilePhoto }} style={styles.avatarImage} />
                  ) : (
                    <LinearGradient colors={[colors.primary, '#3F35C8']} style={styles.avatarFallback}>
                      <Text style={styles.avatarText}>{userInitial}</Text>
                    </LinearGradient>
                  )}

                  <View style={styles.cameraIconBadge}>
                    <Camera color="#FFF" size={14} strokeWidth={2.5} />
                  </View>
                </Pressable>
              </View>

              {hasValidPhoto && (
                <Pressable onPress={removePhoto} style={styles.removePhotoBtn}>
                  <Trash2 color={colors.error} size={14} strokeWidth={2.2} />
                  <Text style={styles.removePhotoText}>Remove Photo</Text>
                </Pressable>
              )}

              {/* Editable Name */}
              {isEditingName ? (
                <View style={styles.editNameRow}>
                  <TextInput
                    style={styles.nameInput}
                    value={nameInput}
                    onChangeText={setNameInput}
                    placeholder="Your Name"
                    placeholderTextColor={colors.textSecondary}
                    autoFocus
                  />
                  <Pressable onPress={handleSaveName} style={styles.saveNameBtn}>
                    <LinearGradient colors={[colors.success, colors.success]} style={styles.saveNameGrad}>
                      <Check color="#FFF" size={16} strokeWidth={2.5} />
                    </LinearGradient>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => setIsEditingName(true)} style={styles.nameRow}>
                  <Text style={styles.name}>{user.name}</Text>
                  <Edit3 color={colors.textSecondary} size={14} strokeWidth={2.2} style={{ marginTop: 2 }} />
                </Pressable>
              )}

              <Text style={styles.username}>@{user.username || user.email.split('@')[0]}</Text>
              <Text style={styles.email}>{user.email}</Text>
              
              {/* Unique ID Box with Refresh Button */}
              <View style={styles.idBox}>
                <View style={styles.idHeaderRow}>
                  <Text style={styles.idLabel}>YOUR UNIQUE ID</Text>
                  <Pressable onPress={handleRegenerateId} style={styles.refreshIdBtn}>
                    <RefreshCw color={colors.secondary} size={12} strokeWidth={2.5} />
                    <Text style={styles.refreshIdText}>Refresh ID</Text>
                  </Pressable>
                </View>
                <Text style={styles.uniqueId}>{user.uniqueId}</Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <Pressable style={styles.actionBtn} onPress={copyId}>
                  <Copy color={colors.text} size={18} strokeWidth={2} />
                  <Text style={styles.actionText}>Copy ID</Text>
                </Pressable>
                
                <Pressable style={styles.actionBtn} onPress={shareId}>
                  <Share2 color={colors.text} size={18} strokeWidth={2} />
                  <Text style={styles.actionText}>Share ID</Text>
                </Pressable>
              </View>
            </View>

            <Pressable style={styles.logoutBtn} onPress={handleLogout}>
              <View style={styles.logoutBtnInner}>
                <LogOut color={colors.error} size={20} strokeWidth={2.5} />
                <Text style={styles.logoutBtnText}>LOG OUT</Text>
              </View>
            </Pressable>
          </View>
        </ScrollView>

        {/* Interactive Photo Selection Modal (Camera vs Gallery) */}
        <Modal
          visible={showPhotoModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPhotoModal(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={{flex: 1}} onPress={() => setShowPhotoModal(false)} />
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>UPDATE PHOTO</Text>
                <Pressable onPress={() => setShowPhotoModal(false)} style={styles.modalCloseBtn}>
                  <X color={colors.textSecondary} size={20} strokeWidth={2.5} />
                </Pressable>
              </View>

              <View style={styles.modalOptionsContainer}>
                {/* Option 1: Take Photo */}
                <Pressable style={styles.modalOptionBtn} onPress={takePhotoWithCamera}>
                  <View style={[styles.modalOptionIconBox, { backgroundColor: colors.primaryLight }]}>
                    <Camera color={colors.primary} size={20} strokeWidth={2.5} />
                  </View>
                  <View style={styles.modalOptionTextCol}>
                    <Text style={styles.modalOptionTitle}>Take Photo</Text>
                    <Text style={styles.modalOptionSub}>Use your phone camera</Text>
                  </View>
                </Pressable>

                {/* Option 2: Choose from Gallery */}
                <Pressable style={styles.modalOptionBtn} onPress={pickFromGallery}>
                  <View style={[styles.modalOptionIconBox, { backgroundColor: colors.secondaryLight }]}>
                    <ImageIcon color={colors.secondary} size={20} strokeWidth={2.5} />
                  </View>
                  <View style={styles.modalOptionTextCol}>
                    <Text style={styles.modalOptionTitle}>Choose from Gallery</Text>
                    <Text style={styles.modalOptionSub}>Upload from device photos</Text>
                  </View>
                </Pressable>

                {/* Option 3: Remove Photo (if set) */}
                {hasValidPhoto && (
                  <Pressable style={[styles.modalOptionBtn, styles.modalOptionDanger]} onPress={removePhoto}>
                    <View style={[styles.modalOptionIconBox, { backgroundColor: colors.dangerLight }]}>
                      <Trash2 color={colors.error} size={20} strokeWidth={2.5} />
                    </View>
                    <View style={styles.modalOptionTextCol}>
                      <Text style={[styles.modalOptionTitle, { color: colors.error }]}>Remove Photo</Text>
                      <Text style={styles.modalOptionSub}>Switch back to initial avatar</Text>
                    </View>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bgGlow: {
    position: 'absolute',
    top: -50,
    right: -100,
    width: 300,
    height: 300,
    backgroundColor: colors.secondaryLight,
    opacity: 0.6,
    borderRadius: 150,
    transform: [{ scaleX: 1.5 }],
  },
  container: {
    flex: 1,
  },
  headerBox: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  header: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 26, 
    color: colors.text, 
  },
  scroll: { 
    paddingBottom: 40 
  },
  content: { 
    padding: 20, 
    gap: 16 
  },
  premiumCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 4,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: colors.secondaryLight,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 36, 
    color: colors.card,
    marginTop: 4,
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  removePhotoText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: colors.error,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  name: { 
    fontFamily: 'Poppins_700Bold', 
    fontSize: 22, 
    color: colors.text, 
    textAlign: 'center' 
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  nameInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: colors.text,
    minWidth: 180,
  },
  saveNameBtn: {
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveNameGrad: {
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: { 
    fontFamily: 'Poppins_600SemiBold', 
    fontSize: 14, 
    color: colors.textSecondary, 
    marginBottom: 2 
  },
  email: { 
    fontFamily: 'Poppins_500Medium', 
    fontSize: 13, 
    color: colors.textSecondary, 
    marginBottom: 24 
  },
  idBox: { 
    width: '100%', 
    backgroundColor: colors.secondaryLight, 
    padding: 16, 
    borderRadius: 16, 
    alignItems: 'center', 
    marginBottom: 24 
  },
  idHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
  },
  idLabel: { 
    fontFamily: 'Poppins_700Bold', 
    fontSize: 11, 
    color: colors.secondary, 
    letterSpacing: 0.8,
  },
  refreshIdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  refreshIdText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
    color: colors.secondary,
  },
  uniqueId: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 24, 
    color: colors.text, 
    letterSpacing: 1.5,
  },
  actionRow: { 
    flexDirection: 'row', 
    gap: 12, 
    width: '100%' 
  },
  actionBtn: { 
    flex: 1, 
    backgroundColor: colors.card, 
    paddingVertical: 14, 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: colors.border, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  actionText: { 
    fontFamily: 'Poppins_600SemiBold', 
    fontSize: 13, 
    color: colors.text 
  },
  logoutBtn: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: colors.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 16,
    color: colors.text,
    letterSpacing: 0.5,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalOptionsContainer: {
    gap: 12,
  },
  modalOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  modalOptionDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  modalOptionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionTextCol: {
    flex: 1,
  },
  modalOptionTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  modalOptionSub: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
