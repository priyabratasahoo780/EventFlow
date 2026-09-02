import { Stack, useRouter } from 'expo-router';
import { StyleSheet, View, Text, Image, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Home } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.container}>
        {/* Animated Illustration */}
        <Animated.View entering={ZoomIn.duration(800).springify()} style={styles.imageContainer}>
          <View style={styles.imageGlow} />
          <Image 
            source={require('../assets/images/404-illustration.jpg')} 
            style={styles.illustration}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Text Content */}
        <Animated.View entering={FadeInDown.delay(300).duration(800).springify()} style={styles.textContainer}>
          <View style={styles.errorBadge}>
            <Text style={styles.errorBadgeText}>404 ERROR</Text>
          </View>
          <Text style={styles.title}>Looks like you're lost</Text>
          <Text style={styles.subtitle}>
            The page or event you are looking for has been moved, deleted, or possibly never existed.
          </Text>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View entering={FadeInDown.delay(500).duration(800).springify()} style={styles.actionContainer}>
          <Pressable 
            style={({ pressed }) => [styles.btnWrapper, pressed && { opacity: 0.9 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.replace('/(tabs)');
            }}
          >
            <LinearGradient
              colors={['#FF7A00', '#FF5C00']}
              style={styles.primaryBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Home color="#FFFFFF" size={20} strokeWidth={2.5} />
              <Text style={styles.primaryBtnText}>Back to Home</Text>
            </LinearGradient>
          </Pressable>

          <Pressable 
            style={({ pressed }) => [styles.secondaryBtn, pressed && { backgroundColor: '#FFF0E5' }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/');
              }
            }}
          >
            <ArrowLeft color="#FF7A00" size={20} strokeWidth={2.5} />
            <Text style={styles.secondaryBtnText}>Go Back</Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF5EA',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  imageGlow: {
    position: 'absolute',
    width: width * 0.6,
    height: width * 0.6,
    backgroundColor: '#FF7A00',
    borderRadius: width * 0.3,
    opacity: 0.15,
    transform: [{ scale: 1.2 }],
    filter: [{ blur: 40 }], // pseudo blur for glow effect
  },
  illustration: {
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: 40,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  errorBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorBadgeText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 12,
    color: '#EF4444',
    letterSpacing: 1,
  },
  title: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 28,
    color: '#182235',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    color: '#667085',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  actionContainer: {
    width: '100%',
    gap: 16,
  },
  btnWrapper: {
    width: '100%',
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    gap: 12,
  },
  primaryBtnText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FF7A00',
    gap: 12,
  },
  secondaryBtnText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 16,
    color: '#FF7A00',
  },
});
