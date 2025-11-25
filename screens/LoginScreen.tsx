import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import AsyncStorage from '@react-native-async-storage/async-storage';

type NavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(100))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Function to validate email format
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Function to validate password strength
  const isPasswordValid = (password: string) => {
    return password.length >= 6;
  };

  const handleLogin = async () => {
    // Check required fields
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please enter both email and password.');
      return;
    }

    // Validate email format
    if (!isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.\nExample: user@example.com');
      return;
    }

    // Validate password length
    if (!isPasswordValid(password)) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      // Use actual server IP address instead of localhost
      // For Android devices, you may need to use 10.0.2.2 instead of localhost
      const API_BASE_URL = 'http://localhost:3000'; // Replace with your server IP
      
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: email.toLowerCase().trim(),
        password,
      });

      const { data } = response.data;
      const { accessToken, refreshToken, name, role } = data;

      // Validate token before saving
      if (!accessToken) {
        Alert.alert('Login Failed', 'No authentication token received. Please try again.');
        return;
      }

      // Save token and user info to AsyncStorage
      await AsyncStorage.multiSet([
        ['authToken', accessToken],
        ['refreshToken', refreshToken || ''],
        ['userName', name || ''],
        ['userEmail', email],
        ['userRole', role || 'patient'],
        ['userData', JSON.stringify(data)]
      ]);

      console.log('Login successful, role:', role);

      Alert.alert('🎉 Login Successful', `Welcome back, ${name}!`);
      
      // Navigate based on role
      if (role === 'patient') {
        navigation.replace('Home');
      }
    } catch (error: any) {
      let errorTitle = 'Login Failed';
      let errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      
      // Handle different types of errors
      if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
        errorTitle = 'Connection Error';
        errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
      } 
      else if (error.response?.status === 400) {
        errorTitle = 'Invalid Request';
        errorMessage = 'The information you entered is not valid. Please check your email and password format.';
      }
      else if (error.response?.status === 401) {
        errorTitle = 'Login Failed';
        errorMessage = 'Your email or password is incorrect. Please check your credentials and try again.';
      }
      else if (error.response?.status === 403) {
        errorTitle = 'Account Disabled';
        errorMessage = 'Your account has been temporarily disabled. Please contact support for assistance.';
      }
      else if (error.response?.status === 404) {
        errorTitle = 'Service Unavailable';
        errorMessage = 'The authentication service is currently unavailable. Please try again later.';
      }
      else if (error.response?.status === 422) {
        errorTitle = 'Invalid Data';
        errorMessage = 'The login information format is incorrect. Please check your email and password.';
      }
      else if (error.response?.status === 429) {
        errorTitle = 'Too Many Attempts';
        errorMessage = 'Too many login attempts. Please wait 15 minutes before trying again.';
      }
      else if (error.response?.status >= 500) {
        errorTitle = 'Server Error';
        errorMessage = 'Our servers are currently experiencing issues. Please try again in a few minutes.';
      }
      else if (error.message?.includes('timeout')) {
        errorTitle = 'Connection Timeout';
        errorMessage = 'The connection to the server timed out. Please check your internet connection and try again.';
      }
      else if (error.message?.includes('ENOTFOUND') || error.message?.includes('ECONNREFUSED')) {
        errorTitle = 'Server Unreachable';
        errorMessage = 'Unable to connect to the server. Please check if the server is running and try again.';
      }
      
      // Use server message only if it's user-friendly
      if (error.response?.data?.message && isUserFriendlyError(error.response.data.message)) {
        errorMessage = error.response.data.message;
      }
      
      Alert.alert(errorTitle, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to check if server error message is user-friendly
  const isUserFriendlyError = (message: string): boolean => {
    const technicalTerms = ['jwt', 'token', 'undefined', 'null', 'object', 'failed', 'error'];
    return !technicalTerms.some(term => message.toLowerCase().includes(term));
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.logoContainer}>
            <Image source={require('../assets/logo.jpg')} style={styles.logo} />
            <Text style={styles.title}>Hospital Patient Portal</Text>
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Icon name="email" size={20} color="#1976d2" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor="#90a4ae"
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEmail}
                value={email}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Icon name="lock" size={20} color="#1976d2" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#90a4ae"
                secureTextEntry
                onChangeText={setPassword}
                value={password}
                editable={!isLoading}
                onSubmitEditing={handleLogin}
              />
            </View>

            <TouchableOpacity 
              style={[
                styles.loginButton, 
                isLoading && styles.loginButtonDisabled
              ]} 
              onPress={handleLogin} 
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.forgotButton}>
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} disabled={isLoading}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')} disabled={isLoading}>
              <Text style={styles.signupText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e3f2fd',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0d47a1',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#424242',
    fontSize: 16,
  },
  loginButton: {
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: '#1976d2',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  loginButtonDisabled: {
    backgroundColor: '#90caf9',
    elevation: 0,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  forgotButton: {
    alignSelf: 'center',
    marginTop: 16,
  },
  forgotText: {
    color: '#1976d2',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#424242',
    marginRight: 8,
  },
  signupText: {
    color: '#1976d2',
    fontWeight: '600',
  },
});

export default LoginScreen;