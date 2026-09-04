declare module 'expo-splash-screen' {
  export function preventAutoHideAsync(): Promise<boolean>;
  export function hide(): void;
  export function hideAsync(): Promise<void>;
  export function setOptions(options: any): void;
}
