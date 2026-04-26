import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
  StatusBar,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
import { ThemeContext } from "../contexts/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const SettingsScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Navigate to ProfileScreen (route name is 'Profile')
  const handleEditProfile = () => {
    navigation.navigate("Profile");
  };
  const { isDarkMode, toggleDarkMode } = useContext(ThemeContext);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [language, setLanguage] = useState("English");
  const [userEmail, setUserEmail] = useState("user@example.com");
  const [userName, setUserName] = useState("John Doe");
  const scrollY = new Animated.Value(0);

  // Header background animation
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // Load settings and check biometric availability on component mount
  useEffect(() => {
    checkBiometricAvailability();
    loadSettings();
    checkNotificationPermissions();
  }, []);

  const checkNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(status === "granted");
  };

  const checkBiometricAvailability = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      setBiometricAvailable(hasHardware && isEnrolled);

      if (hasHardware && isEnrolled) {
        const savedBiometric = await AsyncStorage.getItem("biometricEnabled");
        if (savedBiometric !== null) {
          setBiometricEnabled(JSON.parse(savedBiometric));
        }
      }
    } catch (error) {
      console.error("Error checking biometric availability:", error);
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem("userSettings");
      if (settings) {
        const parsedSettings = JSON.parse(settings);
        setNotificationsEnabled(parsedSettings.notificationsEnabled ?? true);
        setLanguage(parsedSettings.language || "English");

        const userData = await AsyncStorage.getItem("userData");
        if (userData) {
          const parsedUserData = JSON.parse(userData);
          setUserEmail(parsedUserData.email || "user@example.com");
          setUserName(parsedUserData.name || "John Doe");
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        setNotificationsEnabled(true);
        await AsyncStorage.setItem(
          "userSettings",
          JSON.stringify({
            notificationsEnabled: true,
            language,
          }),
        );

        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Notifications Enabled",
            body: "You'll now receive important updates from HealthApp.",
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 2,
          }
        });
      } else {
        Alert.alert(
          "Permission Required",
          "Please enable notifications in your device settings to receive alerts.",
          [{ text: "OK" }],
        );
      }
    } else {
      setNotificationsEnabled(false);
      await AsyncStorage.setItem(
        "userSettings",
        JSON.stringify({
          notificationsEnabled: false,
          language,
        }),
      );
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Authenticate to enable biometric login",
        });

        if (result.success) {
          setBiometricEnabled(true);
          await AsyncStorage.setItem("biometricEnabled", JSON.stringify(true));
        }
      } catch (error) {
        Alert.alert(
          "Authentication Failed",
          "Could not enable biometric login.",
        );
      }
    } else {
      setBiometricEnabled(false);
      await AsyncStorage.setItem("biometricEnabled", JSON.stringify(false));
    }
  };

  const handleLanguageSelect = async (newLanguage: string) => {
    setLanguage(newLanguage);
    await AsyncStorage.setItem(
      "userSettings",
      JSON.stringify({
        notificationsEnabled,
        language: newLanguage,
      }),
    );
  };

  const handleContactUs = () => {
    Linking.openURL(`mailto:support@healthapp.com?subject=App Support`);
  };

  const handleHelpCenter = () => {
    Linking.openURL("https://healthapp.com/help");
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL("https://healthapp.com/privacy");
  };

  const handleTermsOfService = () => {
    Linking.openURL("https://healthapp.com/terms");
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove(["userToken", "biometricEnabled"]);
          navigation.reset({
            index: 0,
            routes: [{ name: "Login" as never }],
          });
        },
      },
    ]);
  };

  const navigateToScreen = (screenName: string) => {
    if (screenName === "ChangePassword") {
      navigation.navigate("ChangePassword");
      return;
    }
    Alert.alert("Navigation", `This would navigate to ${screenName}`);
  };

  type SettingsItem = {
    id: number;
    title: string;
    icon: string;
    action: () => void;
    value?: string;
    hasSwitch?: boolean;
    switchValue?: boolean;
    onSwitchChange?: (value: boolean) => Promise<void> | void;
    disabled?: boolean;
    isDestructive?: boolean;
    type?: "normal" | "danger";
  };

  const settingsSections: {
    title: string;
    items: SettingsItem[];
  }[] = [
      {
        title: "ACCOUNT",
        items: [
          {
            id: 1,
            title: "Personal Information",
            icon: "person-circle-outline",
            action: () => navigateToScreen("PersonalInfo"),
            value: userName,
          },
          {
            id: 2,
            title: "Change Password",
            icon: "key-outline",
            action: () => navigateToScreen("ChangePassword"),
          },
          {
            id: 3,
            title: "Payment Methods",
            icon: "wallet-outline",
            action: () => navigateToScreen("PaymentMethods"),
            value: "3 cards",
          },
        ],
      },
      {
        title: "PREFERENCES",
        items: [
          {
            id: 4,
            title: "Notifications",
            icon: "notifications-outline",
            action: () => { },
            hasSwitch: true,
            switchValue: notificationsEnabled,
            onSwitchChange: handleNotificationToggle,
          },
          {
            id: 5,
            title: "Dark Mode",
            icon: "moon-outline",
            action: () => { },
            hasSwitch: true,
            switchValue: isDarkMode,
            onSwitchChange: toggleDarkMode,
          },
          {
            id: 6,
            title: "Language",
            icon: "globe-outline",
            action: () => {
              Alert.alert("Select Language", "Choose your preferred language", [
                {
                  text: "English",
                  onPress: () => handleLanguageSelect("English"),
                },
                {
                  text: "Spanish",
                  onPress: () => handleLanguageSelect("Spanish"),
                },
                { text: "French", onPress: () => handleLanguageSelect("French") },
                { text: "Cancel", style: "cancel" },
              ]);
            },
            value: language,
          },
        ],
      },
      {
        title: "SECURITY",
        items: [
          {
            id: 7,
            title: Platform.OS === "ios" ? "Face ID" : "Fingerprint",
            icon: Platform.OS === "ios" ? "scan-outline" : "finger-print-outline",
            action: () => { },
            hasSwitch: true,
            switchValue: biometricEnabled,
            onSwitchChange: handleBiometricToggle,
            disabled: !biometricAvailable,
          },
          {
            id: 8,
            title: "Two-Factor Auth",
            icon: "shield-checkmark-outline",
            action: () => navigateToScreen("TwoFactorAuth"),
            value: "Inactive",
          },
        ],
      },
      {
        title: "SUPPORT",
        items: [
          {
            id: 9,
            title: "Help Center",
            icon: "help-buoy-outline",
            action: handleHelpCenter,
          },
          {
            id: 10,
            title: "Contact Support",
            icon: "chatbubble-ellipses-outline",
            action: handleContactUs,
          },
          {
            id: 11,
            title: "Privacy Policy",
            icon: "document-lock-outline",
            action: handlePrivacyPolicy,
          },
          {
            id: 12,
            title: "Terms of Service",
            icon: "document-text-outline",
            action: handleTermsOfService,
          },
        ],
      },
      {
        title: "ABOUT",
        items: [
          {
            id: 13,
            title: "App Version",
            icon: "information-circle-outline",
            action: () => { },
            value: "1.2.4",
          },
          {
            id: 14,
            title: "Rate App",
            icon: "star-outline",
            action: () => {
              Linking.openURL(
                Platform.OS === "ios"
                  ? "itms-apps://itunes.apple.com/app/idYOUR_APP_ID"
                  : "market://details?id=com.healthapp",
              );
            },
          },
          {
            id: 15,
            title: "Log Out",
            icon: "log-out-outline",
            action: handleLogout,
            type: "danger",
          },
        ],
      },
    ];

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      {/* Animated Header Background */}
      <Animated.View
        style={[
          styles.headerBackground,
          { opacity: headerOpacity },
          isDarkMode && styles.headerBackgroundDark,
        ]}
      />

      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="chevron-back"
            size={28}
            color={isDarkMode ? "#fff" : "#333"}
          />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}
        >
          Settings
        </Text>
        <View style={styles.headerRight} />
      </View>

      <Animated.ScrollView
        style={styles.scrollView}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >
        {/* User Profile Card */}
        <LinearGradient
          colors={isDarkMode ? ["#2563eb", "#1e40af"] : ["#3b82f6", "#2563eb"]}
          style={styles.profileCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color="#fff" />
          </View>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userEmail}>{userEmail}</Text>
          <TouchableOpacity style={styles.editProfileButton}>
            <Text style={styles.editProfileText} onPress={handleEditProfile}>
              Edit Profile
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Settings Sections */}
        {settingsSections.map((section, sectionIndex) => (
          <View
            key={section.title}
            style={[styles.section, sectionIndex === 0 && styles.firstSection]}
          >
            <Text
              style={[
                styles.sectionTitle,
                isDarkMode && styles.sectionTitleDark,
              ]}
            >
              {section.title}
            </Text>
            <View
              style={[
                styles.sectionContent,
                isDarkMode && styles.sectionContentDark,
              ]}
            >
              {section.items.map((item, itemIndex) => (
                <React.Fragment key={item.id}>
                  <TouchableOpacity
                    style={[
                      styles.settingItem,
                      isDarkMode && styles.settingItemDark,
                      item.disabled && styles.disabledItem,
                      item.type === "danger" && styles.dangerItem,
                    ]}
                    onPress={item.action}
                    disabled={item.disabled}
                  >
                    <View
                      style={[
                        styles.iconContainer,
                        item.type === "danger" && styles.dangerIconContainer,
                        isDarkMode && styles.iconContainerDark,
                      ]}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={20}
                        color={
                          item.type === "danger"
                            ? "#ef4444"
                            : isDarkMode
                              ? "#60a5fa"
                              : "#3b82f6"
                        }
                      />
                    </View>

                    <Text
                      style={[
                        styles.settingText,
                        isDarkMode && styles.settingTextDark,
                        item.type === "danger" && styles.dangerText,
                        item.disabled && styles.disabledText,
                      ]}
                    >
                      {item.title}
                    </Text>

                    <View style={styles.settingRight}>
                      {item.value && (
                        <Text
                          style={[
                            styles.settingValue,
                            isDarkMode && styles.settingValueDark,
                          ]}
                        >
                          {item.value}
                        </Text>
                      )}

                      {item.hasSwitch ? (
                        <Switch
                          value={item.switchValue}
                          onValueChange={item.onSwitchChange}
                          trackColor={{
                            false: isDarkMode ? "#374151" : "#d1d5db",
                            true: "#10b981",
                          }}
                          thumbColor={item.switchValue ? "#ffffff" : "#f9fafb"}
                          disabled={item.disabled}
                        />
                      ) : (
                        !item.value && (
                          <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={isDarkMode ? "#6b7280" : "#9ca3af"}
                          />
                        )
                      )}
                    </View>
                  </TouchableOpacity>

                  {itemIndex < section.items.length - 1 && (
                    <View
                      style={[
                        styles.separator,
                        isDarkMode && styles.separatorDark,
                      ]}
                    />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text
            style={[styles.footerText, isDarkMode && styles.footerTextDark]}
          >
            HealthApp v1.2.4
          </Text>
          <Text
            style={[
              styles.footerSubtext,
              isDarkMode && styles.footerSubtextDark,
            ]}
          >
            © {new Date().getFullYear()} HealthApp Inc.
          </Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 32,
    height: 64,
    justifyContent: "center",
    marginBottom: 12,
    width: 64,
  },
  backButton: {
    marginRight: 8,
    padding: 8,
  },
  container: {
    backgroundColor: "#f8fafc",
    flex: 1,
  },
  containerDark: {
    backgroundColor: "#111827",
  },
  dangerIconContainer: {
    backgroundColor: "#fee2e2",
  },
  dangerItem: {
    backgroundColor: "#fef2f2",
  },
  dangerText: {
    color: "#dc2626",
  },
  disabledItem: {
    opacity: 0.5,
  },
  disabledText: {
    color: "#9ca3af",
  },
  editProfileButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  editProfileText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
  },
  firstSection: {
    marginTop: 8,
  },
  footer: {
    alignItems: "center",
    marginTop: 8,
    padding: 24,
  },
  footerSubtext: {
    color: "#9ca3af",
    fontSize: 12,
  },
  footerSubtextDark: {
    color: "#6b7280",
  },
  footerText: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  footerTextDark: {
    color: "#9ca3af",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 40,
    zIndex: 2,
  },
  headerBackground: {
    backgroundColor: "#ffffff",
    height: 120,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1,
  },
  headerBackgroundDark: {
    backgroundColor: "#1f2937",
  },
  headerRight: {
    width: 40,
  },
  headerTitle: {
    color: "#111827",
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  headerTitleDark: {
    color: "#f9fafb",
  },
  iconContainer: {
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    height: 32,
    justifyContent: "center",
    marginRight: 12,
    width: 32,
  },
  iconContainerDark: {
    backgroundColor: "#374151",
  },
  profileCard: {
    alignItems: "center",
    borderRadius: 20,
    elevation: 8,
    margin: 16,
    marginTop: 8,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  scrollView: {
    flex: 1,
    zIndex: 0,
  },
  section: {
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    elevation: 2,
    marginHorizontal: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  sectionContentDark: {
    backgroundColor: "#1f2937",
  },
  sectionTitle: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  sectionTitleDark: {
    color: "#9ca3af",
  },
  separator: {
    backgroundColor: "#f3f4f6",
    height: 1,
    marginLeft: 60,
  },
  separatorDark: {
    backgroundColor: "#374151",
  },
  settingItem: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 56,
    padding: 16,
  },
  settingItemDark: {
    backgroundColor: "#1f2937",
  },
  settingRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  settingText: {
    color: "#374151",
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
  settingTextDark: {
    color: "#f9fafb",
  },
  settingValue: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "400",
  },
  settingValueDark: {
    color: "#9ca3af",
  },
  userEmail: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginBottom: 16,
  },
  userName: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
  },
});

export default SettingsScreen;
