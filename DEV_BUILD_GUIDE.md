# 📱 Allsee Dev Build Setup Guide

## What is a Dev Build?
A Dev Build is a custom native build of your Expo app that includes native modules like `react-native-webrtc` and `react-native-maps`. Unlike Expo Go, which can't load these modules, a Dev Build gives you full native functionality while keeping the fast development workflow.

## ✅ What You'll Get
- **Real in-app live streaming** with camera & WebRTC
- **Native maps** with pins and clustering
- **Camera flip** and streaming controls
- All the features that don't work in web preview or Expo Go

---

## 🚀 Build Options

### Option 1: EAS Build (Cloud Build) - **RECOMMENDED**
Expo's cloud service builds your app for you. No local setup needed!

#### Prerequisites:
1. **Expo Account** - Sign up at https://expo.dev
2. **EAS CLI** installed globally

#### Steps:

1. **Install EAS CLI** (if not already installed):
```bash
npm install -g eas-cli
```

2. **Login to Expo**:
```bash
cd /app/frontend
eas login
```

3. **Configure Project**:
```bash
eas build:configure
```

4. **Build for iOS** (if you have a Mac with Xcode):
```bash
eas build --profile development --platform ios
```

5. **Build for Android**:
```bash
eas build --profile development --platform android
```

6. **Wait for Build** (~10-20 minutes):
   - You'll get a link to track progress
   - Once done, download the .apk (Android) or .ipa (iOS)

7. **Install on Device**:
   - **Android**: Download APK directly to phone or use `adb install`
   - **iOS**: Need to register device UDID first, then download via TestFlight or direct install

8. **Start Dev Server**:
```bash
cd /app/frontend
npx expo start --dev-client
```

9. **Open App**: Scan QR code from your Dev Build app

---

### Option 2: Local Build (Your Machine)
Build the app on your own computer. Requires more setup but gives you full control.

#### For Android:

**Prerequisites:**
- Android Studio installed
- Java JDK 17+
- Android SDK configured
- Physical device or emulator

**Steps:**
```bash
cd /app/frontend
npx expo run:android
```

#### For iOS (Mac only):

**Prerequisites:**
- macOS with Xcode 14+
- CocoaPods installed
- iOS device or simulator

**Steps:**
```bash
cd /app/frontend
npx expo run:ios
```

---

## 📋 Current Configuration

Your project is already configured with:

✅ **app.json** - Updated with:
- Camera permissions (iOS & Android)
- Microphone permissions
- Location permissions
- Bundle identifiers (`com.allsee.app`)
- Expo Camera plugin

✅ **eas.json** - Build profiles created:
- `development` - Dev build with debugging
- `preview` - Internal testing build
- `production` - Production-ready build

✅ **Permissions**:
- iOS: NSCameraUsageDescription, NSMicrophoneUsageDescription, NSLocationWhenInUseUsageDescription
- Android: CAMERA, RECORD_AUDIO, ACCESS_FINE_LOCATION, INTERNET

---

## 🎯 Testing Your Dev Build

Once you have the Dev Build installed:

1. **Test Live Streaming**:
   - Go to "Go Live" tab
   - Tap "Create Stream"
   - Camera should open in-app
   - Tap "Go Live" to start broadcasting
   - Check if stream appears on Map tab

2. **Test Native Maps**:
   - Go to "Map" tab
   - Should see actual Google Maps (not list fallback)
   - Live streams appear as pulsing pins
   - Clusters show as grouped pins

3. **Test Multi-POV**:
   - Create multiple streams from different locations
   - They should cluster into events
   - Tap event → see all POVs
   - Switch between camera angles

---

## 🐛 Troubleshooting

### "Command not found: eas"
```bash
npm install -g eas-cli
```

### "Not logged in"
```bash
eas login
```

### "Build failed - Gradle error" (Android)
- Check Java version: `java -version` (should be 17+)
- Clear Gradle cache: `cd android && ./gradlew clean`

### "Provisioning profile error" (iOS)
- Need Apple Developer account ($99/year) for physical devices
- Simulator is free but can't test camera

### "Camera permission denied"
- Uninstall and reinstall the app
- Check Settings → Apps → Allsee → Permissions

### "WebRTC not working"
- Ensure you're using the Dev Build, not Expo Go
- Check if `react-native-whip-whep` is listed in package.json
- Rebuild the app after package changes

---

## 📦 What's Included in Your Build

**Native Modules:**
- ✅ react-native-webrtc (WebRTC streaming)
- ✅ react-native-whip-whep (WHIP/WHEP protocol)
- ✅ react-native-maps (Native maps)
- ✅ expo-camera (Camera access)
- ✅ expo-location (GPS)
- ✅ expo-video (HLS playback)

**All JavaScript code** hot-reloads just like Expo Go!

---

## 💡 Next Steps After Building

1. **Test core features** (streaming, maps, multi-POV)
2. **Report any issues** you find
3. **Add friend presence** badges
4. **Polish UI/UX** based on real device testing
5. **Prepare for production** build when ready

---

## 🆘 Need Help?

If you get stuck:
1. Check Expo docs: https://docs.expo.dev/develop/development-builds/introduction/
2. EAS Build docs: https://docs.expo.dev/build/introduction/
3. Share error messages for debugging

---

## 🎉 You're All Set!

Your project is configured and ready for building. Choose your preferred build method and start testing the real native features!
