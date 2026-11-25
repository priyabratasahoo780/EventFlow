
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { geofencingService } from './geofencingService';

const { ActivityTransitionModule } = NativeModules as {
  ActivityTransitionModule?: {
    startActivityTransitionUpdates(): Promise<string>;
    stopActivityTransitionUpdates(): Promise<string>;
    addListener(eventName: string): void;
    removeListeners(count: number): void;
  };
};

const isAvailable = Platform.OS === 'android' && !!ActivityTransitionModule;

class ActivityRecognitionService {
  private subscription: any = null;
  private emitter: NativeEventEmitter | null = null;

 
  async start() {
    if (!isAvailable) {
      console.log('[ActivityRecognition] EC3: Not available on this platform/build. Skipping.');
      return;
    }

    try {
      await ActivityTransitionModule!.startActivityTransitionUpdates();
      console.log('[ActivityRecognition] EC3: ✅ Activity transition monitoring started.');

      this.emitter = new NativeEventEmitter(ActivityTransitionModule as any);

      this.subscription = this.emitter.addListener(
        'ActivityTransition_VehicleToWalking',
        this.onVehicleToWalking
      );
    } catch (e) {
      console.error('[ActivityRecognition] EC3: Failed to start:', e);
    }
  }

  
  private onVehicleToWalking = async () => {
    console.log('[ActivityRecognition] EC3: 🅿️ Vehicle → Walking transition detected! Triggering network geofence check...');
    try {
      await geofencingService.forceGeofenceCheck();
    } catch (e) {
      console.error('[ActivityRecognition] EC3: forceGeofenceCheck failed:', e);
    }
  };

  async stop() {
    if (!isAvailable) return;
    try {
      this.subscription?.remove();
      this.subscription = null;
      await ActivityTransitionModule!.stopActivityTransitionUpdates();
      console.log('[ActivityRecognition] EC3: 🛑 Activity transition monitoring stopped.');
    } catch (e) {
      console.error('[ActivityRecognition] EC3: Failed to stop:', e);
    }
  }
}

export const activityRecognitionService = new ActivityRecognitionService();
