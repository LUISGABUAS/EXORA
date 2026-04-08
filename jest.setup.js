// Mock native modules that aren't available in the Jest environment

// react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const RN = require('react-native');
  return {
    GestureHandlerRootView: RN.View,
    Swipeable: RN.View,
    DrawerLayout: RN.View,
    State: {},
    ScrollView: RN.ScrollView,
    PanGestureHandler: RN.View,
    TapGestureHandler: RN.View,
    FlatList: RN.FlatList,
    TouchableOpacity: RN.TouchableOpacity,
    TouchableWithoutFeedback: RN.TouchableWithoutFeedback,
  };
});

// react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  const animLayout = { duration: () => animLayout, delay: () => animLayout };
  const Animated = {
    View: RN.View,
    Text: RN.Text,
    createAnimatedComponent: comp => comp,
  };
  return {
    __esModule: true,
    default: Animated,
    View: RN.View,
    Text: RN.Text,
    createAnimatedComponent: comp => comp,
    FadeInDown: animLayout,
    SlideInDown: animLayout,
    SlideOutDown: animLayout,
    useSharedValue: jest.fn(init => ({ value: init })),
    useAnimatedStyle: jest.fn(() => ({})),
    withTiming: jest.fn(val => val),
    withSpring: jest.fn(val => val),
    runOnJS: jest.fn(fn => fn),
  };
});

// react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  const frame = { x: 0, y: 0, width: 0, height: 0 };
  const SafeAreaContext = React.createContext({
    insets,
    frame,
    onInsetsChange: () => {},
  });
  return {
    SafeAreaProvider: ({ children }) => React.createElement(
      SafeAreaContext.Provider,
      { value: { insets, frame, onInsetsChange: () => {} } },
      children,
    ),
    SafeAreaView: ({ children, ...props }) => React.createElement(View, props, children),
    SafeAreaInsetsContext: SafeAreaContext,
    SafeAreaFrameContext: React.createContext(frame),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});

// react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return props => React.createElement(Text, null, props.name);
});

// react-native-vision-camera
jest.mock('react-native-vision-camera', () => ({
  Camera: 'Camera',
  useCameraDevice: jest.fn(() => null),
}));

// react-native-sqlite-storage
jest.mock('react-native-sqlite-storage', () => ({
  openDatabase: jest.fn(() => ({
    transaction: jest.fn((fn) => {
      const tx = {
        executeSql: jest.fn(() => Promise.resolve([{ rows: { raw: () => [], length: 0 } }])),
      };
      return Promise.resolve(fn(tx));
    }),
    executeSql: jest.fn(() => Promise.resolve([{ rows: { raw: () => [], length: 0 } }])),
  })),
  enablePromise: jest.fn(),
}));

// @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// @react-native-google-signin/google-signin
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({ idToken: 'mock' })),
    getTokens: jest.fn(() => Promise.resolve({ idToken: 'mock' })),
  },
}));

// @supabase/supabase-js
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signInWithOtp: jest.fn(),
      verifyOtp: jest.fn(),
      signInWithIdToken: jest.fn(),
      signOut: jest.fn(),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
    from: jest.fn(() => ({
      upsert: jest.fn(() => Promise.resolve({ error: null })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  })),
}));

// react-native-url-polyfill
jest.mock('react-native-url-polyfill/auto', () => {});

// react-native-fs
jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/tmp',
  writeFile: jest.fn(() => Promise.resolve()),
  readFile: jest.fn(() => Promise.resolve('')),
}));

// react-native-share
jest.mock('react-native-share', () => ({
  open: jest.fn(() => Promise.resolve()),
}));

// @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

// react-native-document-picker (used by fileService)
jest.mock('react-native-document-picker', () => ({
  pick: jest.fn(),
  types: { allFiles: '*/*' },
}));

// react-native-image-picker (used by fileService)
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));

// @react-native-ml-kit/text-recognition
jest.mock('@react-native-ml-kit/text-recognition', () => ({
  __esModule: true,
  default: {
    recognize: jest.fn(() => Promise.resolve({ text: '', blocks: [] })),
  },
}));

// react-native-purchases (RevenueCat)
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    getOfferings: jest.fn(() => Promise.resolve({ current: null })),
    purchasePackage: jest.fn(() => Promise.resolve({ customerInfo: { entitlements: { active: {} } } })),
    restorePurchases: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
    getCustomerInfo: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
  },
}));

// react-native-push-notification
jest.mock('react-native-push-notification', () => ({
  configure: jest.fn(),
  createChannel: jest.fn((_channel, cb) => cb && cb()),
  localNotificationSchedule: jest.fn(),
  cancelLocalNotification: jest.fn(),
  cancelAllLocalNotifications: jest.fn(),
}));

// @react-native-voice/voice
jest.mock('@react-native-voice/voice', () => ({
  __esModule: true,
  default: {
    start: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve()),
    destroy: jest.fn(() => Promise.resolve()),
    removeAllListeners: jest.fn(),
    onSpeechResults: null,
    onSpeechPartialResults: null,
    onSpeechError: null,
  },
}));
