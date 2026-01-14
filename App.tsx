import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View, StyleSheet, LogBox } from 'react-native';
import HomeScreen from './screens/HomeScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ForgotPassword from './screens/ForgotPassword';
import FindDoctorScreen from './screens/FindDoctorScreen';
import BookingScreen from './screens/AppointmentScreen';
import HistoryAppointment from './screens/HistoryAppointment';
import ProfileScreen from './screens/ProfileScreen';
import DoctorDetail from './screens/DoctorDetail';
import SettingsScreen from './screens/SettingsScreen';
import RecordDetail from './screens/RecordDetail';
import ChangePasswordScreen from './screens/ChangePasswordScreen';
import FeedbackScreen from './screens/FeedbackScreen';
import MessageScreen from './screens/MessageScreen';
import ChatWiget from './screens/ChatWiget';
import ChatOption from './screens/ChatOptionScreen';
import ChatHistoryScreen from './screens/ChatHistoryScreen';
import MedicationSearchScreen from './screens/MedicationSearchScreen';
import TermExplanationScreen from './screens/TermExplanationScreen';
import LifestyleAdviceScreen from './screens/LifestyleAdviceScreen';

import { io } from 'socket.io-client';


LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Home: undefined;
  Appointments: undefined;
  FindDoctor: undefined;
  HistoryAppointment: undefined;
  Message: undefined;
  Profile: undefined;
  DoctorDetail: undefined;
  Settings: undefined;
  RecordDetail: undefined;
  ChangePassword: undefined;
  Feedback: undefined;
  ChatWiget: undefined;
  ChatOption: undefined;
  ChatHistory: undefined;
  MedicationSearch: undefined;
  TermExplanation: undefined;
  LifestyleAdvice: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = React.createRef<NavigationContainerRef<RootStackParamList>>();

const App = () => {
  // Socket.io client for real-time communication
  const [socket] = useState(() => io('http://localhost:3000', { transports: ['websocket'] }));

  useEffect(() => {
    if (!socket) return;
    socket.on('chat:receive', (data) => {
      console.log('Received chat message:', data);
      // TODO: update chat UI state here
    });
    socket.on('notification:receive', (data) => {
      console.log('Received notification:', data);
      // TODO: update notification UI state here
    });
    return () => {
      socket.off('chat:receive');
      socket.off('notification:receive');
    };
  }, [socket]);
  const [appState, setAppState] = useState<{
    ready: boolean;
    showOnboarding: boolean;
  }>({
    ready: false,
    showOnboarding: false,
  });

  const checkFirstLaunch = useCallback(async () => {
    try {
      const hasLaunched = await AsyncStorage.getItem('@hasLaunched');
      if (hasLaunched === null) {
        await AsyncStorage.setItem('@hasLaunched', 'true');
        return true;
      }
      return false;
    } catch (error) {
      console.error('AsyncStorage error:', error);
      return false;
    }
  }, []);

  const initializeApp = useCallback(async () => {
    try {
      const shouldShowOnboarding = await checkFirstLaunch();
      setAppState({
        ready: true,
        showOnboarding: shouldShowOnboarding,
      });
    } catch (error) {
      console.error('Initialization error:', error);
      setAppState(prev => ({ ...prev, ready: true }));
    }
  }, [checkFirstLaunch]);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  const screenOptions: NativeStackNavigationOptions = {
    headerShown: false,
    animation: 'fade',
    gestureEnabled: false,
  };

  if (!appState.ready) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator 
          size="large" 
          color="#1976d2" 
          accessibilityLabel="Loading app"
        />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={screenOptions}
        initialRouteName={appState.showOnboarding ? 'Onboarding' : 'Login'}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} options={{animationTypeForReplace: 'pop',}} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="FindDoctor" component={FindDoctorScreen} />
        <Stack.Screen name="Appointments" component={BookingScreen} />
        <Stack.Screen name="HistoryAppointment" component={HistoryAppointment} />
        <Stack.Screen name="Message" component={MessageScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="DoctorDetail" component={DoctorDetail} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="RecordDetail" component={RecordDetail} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        <Stack.Screen name="Feedback" component={FeedbackScreen} />
        <Stack.Screen name="ChatWiget" component={ChatWiget} />
        <Stack.Screen name="ChatOption" component={ChatOption} />
        <Stack.Screen name="ChatHistory" component={ChatHistoryScreen} />
        <Stack.Screen name="MedicationSearch" component={MedicationSearchScreen} />
        <Stack.Screen name="TermExplanation" component={TermExplanationScreen} />
        <Stack.Screen name="LifestyleAdvice" component={LifestyleAdviceScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});

export default App;