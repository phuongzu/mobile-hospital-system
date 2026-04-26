import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");
const moderateScale = (size: number, factor = 0.5) =>
  size + ((width / 375) * size - size) * factor;

type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

interface ForgotPasswordProps {
  navigation: StackNavigationProp<RootStackParamList, "ForgotPassword">;
  route: RouteProp<RootStackParamList, "ForgotPassword">;
}

const API_BASE_URL = "http://localhost:3000/api/auth";

// Step Indicator Component
const StepIndicator = ({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) => {
  return (
    <View style={styles.stepContainer}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <View key={index} style={styles.stepRow}>
          <View
            style={[
              styles.stepDot,
              currentStep > index && styles.stepDotCompleted,
              currentStep === index && styles.stepDotActive,
            ]}
          >
            {currentStep > index && (
              <Ionicons
                name="checkmark"
                size={moderateScale(12)}
                color="#FFFFFF"
              />
            )}
          </View>
          {index < totalSteps - 1 && (
            <View
              style={[
                styles.stepLine,
                currentStep > index && styles.stepLineCompleted,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );
};

// Animated Input Field Component
const AnimatedInput = React.forwardRef(
  (
    {
      label,
      value,
      onChangeText,
      placeholder,
      keyboardType = "default",
      secureTextEntry = false,
      icon,
      error,
      autoFocus = false,
      editable = true,
    }: {
      label: string;
      value: string;
      onChangeText: (text: string) => void;
      placeholder: string;
      keyboardType?: any;
      secureTextEntry?: boolean;
      icon: string;
      error?: string;
      autoFocus?: boolean;
      editable?: boolean;
    },
    ref: any,
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const animatedValue = useRef(new Animated.Value(0)).current;

    const handleFocus = () => {
      setIsFocused(true);
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    };

    const handleBlur = () => {
      setIsFocused(false);
      if (!value) {
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }).start();
      }
    };

    const borderColor = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: ["#E2E8F0", "#4A90E2"],
    });

    const labelPosition = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [moderateScale(16), moderateScale(8)],
    });

    const labelSize = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [moderateScale(16), moderateScale(12)],
    });

    const labelColor = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: ["#64748B", "#4A90E2"],
    });

    return (
      <View style={styles.inputContainer}>
        <Animated.Text
          style={[
            styles.inputLabel,
            {
              transform: [{ translateY: labelPosition }],
              fontSize: labelSize,
              color: labelColor,
            },
          ]}
        >
          {label}
        </Animated.Text>
        <Animated.View
          style={[
            styles.inputWrapper,
            {
              borderColor: error ? "#EF4444" : borderColor,
              backgroundColor: editable ? "#FFFFFF" : "#F8FAFC",
            },
          ]}
        >
          <Ionicons
            name={icon as any}
            size={moderateScale(20)}
            color={error ? "#EF4444" : isFocused ? "#4A90E2" : "#64748B"}
            style={styles.inputIcon}
          />
          <TextInput
            ref={ref}
            style={[styles.textInput, !editable && styles.inputDisabled]}
            value={value}
            onChangeText={onChangeText}
            placeholder={isFocused ? placeholder : ""}
            placeholderTextColor="#94A3B8"
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
            autoFocus={autoFocus}
            editable={editable}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
          {error && (
            <Ionicons
              name="warning-outline"
              size={moderateScale(16)}
              color="#EF4444"
            />
          )}
        </Animated.View>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  },
);

// Countdown Timer Component
const CountdownTimer = ({
  duration,
  onFinish,
}: {
  duration: number;
  onFinish: () => void;
}) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  React.useEffect(() => {
    if (timeLeft === 0) {
      onFinish();
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, onFinish]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <View style={styles.timerContainer}>
      <Text style={styles.timerText}>
        Code expires in {formatTime(timeLeft)}
      </Text>
    </View>
  );
};

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ navigation }) => {
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  // Form states
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI states
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [countdownActive, setCountdownActive] = useState(false);
  const [serverMessage, setServerMessage] = useState("");

  // Refs for input focus
  const codeRef = useRef<TextInput>(null);
  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= 6;
  };

  // Clear all errors
  const clearErrors = () => {
    setErrors({});
    setServerMessage("");
  };

  // Step 1: Request reset code
  const handleSendCode = async () => {
    clearErrors();

    // Validate email
    if (!email.trim()) {
      setErrors({ email: "Email is required" });
      return;
    }

    if (!validateEmail(email)) {
      setErrors({ email: "Please enter a valid email address" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (data.success) {
        setServerMessage(
          data.message || "Verification code has been sent to your email",
        );
        setCountdownActive(true);
        setCurrentStep(2);

        // Auto-focus verification code input
        setTimeout(() => {
          codeRef.current?.focus();
        }, 500);
      } else {
        setErrors({
          server: data.message || "Failed to send verification code",
        });
      }
    } catch (error) {
      setErrors({
        server: "Network error. Please check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify code and reset password in one step
  const handleVerifyAndReset = async () => {
    clearErrors();

    if (!verificationCode.trim()) {
      setErrors({ code: "Verification code is required" });
      return;
    }

    if (verificationCode.trim().length !== 6) {
      setErrors({ code: "Verification code must be 6 digits" });
      return;
    }

    if (!newPassword || !confirmPassword) {
      setErrors({ password: "New password and confirmation are required" });
      return;
    }

    if (!validatePassword(newPassword)) {
      setErrors({
        password: "Password must be at least 6 characters long",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/verify-reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: verificationCode.trim(),
          newPassword: newPassword,
          confirmPassword: confirmPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert(
          "Success",
          data.message ||
            "Your password has been reset successfully. You can now login with your new password.",
          [
            {
              text: "Go to Login",
              onPress: () => navigation.navigate("Login"),
            },
          ],
        );
      } else {
        setErrors({ server: data.message || "Failed to reset password" });
      }
    } catch (error) {
      setErrors({
        server: "Network error. Please check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Resend verification code
  const handleResendCode = async () => {
    setLoading(true);
    clearErrors();

    try {
      const response = await fetch(`${API_BASE_URL}/resend-verification-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (data.success) {
        setCountdownActive(true);
        setServerMessage(
          data.message || "New verification code sent to your email",
        );
        setVerificationCode(""); // Clear previous code
      } else {
        setErrors({ server: data.message || "Failed to resend code" });
      }
    } catch (error) {
      setErrors({
        server: "Network error. Please check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Reset Your Password</Text>
            <Text style={styles.stepDescription}>
              Enter your email address and we'll send a verification code to
              reset your password.
            </Text>

            <AnimatedInput
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your registered email"
              keyboardType="email-address"
              icon="mail-outline"
              error={errors.email}
              autoFocus={true}
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSendCode}
              disabled={loading}
            >
              <LinearGradient
                colors={["#4A90E2", "#63A4FF"]}
                style={styles.buttonGradient}
              >
                {loading ? (
                  <Text style={styles.buttonText}>Sending Code...</Text>
                ) : (
                  <>
                    <Ionicons
                      name="send-outline"
                      size={moderateScale(20)}
                      color="#FFFFFF"
                    />
                    <Text style={styles.buttonText}>
                      Send Verification Code
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Reset Your Password</Text>
            <Text style={styles.stepDescription}>
              Enter the verification code sent to {email} and your new password.
            </Text>

            <AnimatedInput
              ref={codeRef}
              label="Verification Code"
              value={verificationCode}
              onChangeText={(text) =>
                setVerificationCode(text.replace(/[^0-9]/g, "").slice(0, 6))
              }
              placeholder="Enter 6-digit code"
              keyboardType="number-pad"
              icon="lock-closed-outline"
              error={errors.code}
              editable={!loading}
            />

            <AnimatedInput
              ref={newPasswordRef}
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              secureTextEntry={true}
              icon="lock-closed-outline"
              error={errors.password}
              editable={!loading}
            />

            <AnimatedInput
              ref={confirmPasswordRef}
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm your new password"
              secureTextEntry={true}
              icon="lock-closed-outline"
              error={errors.confirmPassword}
              editable={!loading}
            />

            {countdownActive && (
              <CountdownTimer
                duration={900} // 15 minutes
                onFinish={() => setCountdownActive(false)}
              />
            )}

            <View style={styles.passwordRequirements}>
              <Text style={styles.requirementsTitle}>
                Password Requirements:
              </Text>
              <View style={styles.requirementItem}>
                <Ionicons
                  name={
                    newPassword.length >= 6
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={moderateScale(16)}
                  color={newPassword.length >= 6 ? "#10B981" : "#94A3B8"}
                />
                <Text
                  style={[
                    styles.requirementText,
                    newPassword.length >= 6 && styles.requirementMet,
                  ]}
                >
                  At least 6 characters long
                </Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  (loading || countdownActive) && styles.buttonDisabled,
                ]}
                onPress={handleResendCode}
                disabled={loading || countdownActive}
              >
                <Text style={styles.secondaryButtonText}>Resend Code</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleVerifyAndReset}
                disabled={
                  loading ||
                  verificationCode.length !== 6 ||
                  !newPassword ||
                  !confirmPassword ||
                  newPassword.length < 6
                }
              >
                <LinearGradient
                  colors={["#4A90E2", "#63A4FF"]}
                  style={styles.buttonGradient}
                >
                  {loading ? (
                    <Text style={styles.buttonText}>Resetting...</Text>
                  ) : (
                    <>
                      <Ionicons
                        name="refresh-outline"
                        size={moderateScale(20)}
                        color="#FFFFFF"
                      />
                      <Text style={styles.buttonText}>Reset Password</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                clearErrors();
                setCurrentStep(1);
                setVerificationCode("");
                setNewPassword("");
                setConfirmPassword("");
              }}
              disabled={loading}
            >
              <Ionicons
                name="arrow-back"
                size={moderateScale(16)}
                color="#4A90E2"
              />
              <Text style={styles.backButtonText}>Back to Email</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButtonHeader}
              onPress={() => navigation.goBack()}
            >
              <Ionicons
                name="arrow-back"
                size={moderateScale(24)}
                color="#1E293B"
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Forgot Password</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressSection}>
            <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
            <Text style={styles.stepText}>
              Step {currentStep} of {totalSteps}
            </Text>
          </View>

          {/* Server Message */}
          {serverMessage ? (
            <View style={styles.successMessage}>
              <Ionicons
                name="checkmark-circle"
                size={moderateScale(20)}
                color="#10B981"
              />
              <Text style={styles.successMessageText}>{serverMessage}</Text>
            </View>
          ) : null}

          {/* Server Error */}
          {errors.server ? (
            <View style={styles.errorMessage}>
              <Ionicons
                name="warning-outline"
                size={moderateScale(20)}
                color="#EF4444"
              />
              <Text style={styles.errorMessageText}>{errors.server}</Text>
            </View>
          ) : null}

          {/* Step Content */}
          {renderStepContent()}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Remember your password?{" "}
              <Text
                style={styles.footerLink}
                onPress={() => navigation.navigate("Login")}
              >
                Back to Login
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: moderateScale(12),
  },
  backButtonHeader: {
    padding: moderateScale(8),
  },
  backButtonText: {
    color: "#4A90E2",
    fontSize: moderateScale(14),
    fontWeight: "600",
    marginLeft: moderateScale(8),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    alignItems: "center",
    borderRadius: moderateScale(12),
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: moderateScale(24),
    paddingVertical: moderateScale(16),
  },
  buttonRow: {
    flexDirection: "row",
    gap: moderateScale(12),
    marginBottom: moderateScale(16),
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: moderateScale(16),
    fontWeight: "600",
    marginLeft: moderateScale(8),
  },
  container: {
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
  errorMessage: {
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
    borderRadius: moderateScale(12),
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: moderateScale(24),
    padding: moderateScale(16),
  },
  errorMessageText: {
    color: "#991B1B",
    flex: 1,
    fontSize: moderateScale(14),
    fontWeight: "500",
    marginLeft: moderateScale(8),
  },
  errorText: {
    color: "#EF4444",
    fontSize: moderateScale(12),
    marginLeft: moderateScale(4),
    marginTop: moderateScale(4),
  },
  footer: {
    alignItems: "center",
    marginTop: moderateScale(32),
  },
  footerLink: {
    color: "#4A90E2",
    fontWeight: "600",
  },
  footerText: {
    color: "#64748B",
    fontSize: moderateScale(14),
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: moderateScale(8),
    paddingVertical: moderateScale(16),
  },
  headerSpacer: {
    width: moderateScale(40),
  },
  headerTitle: {
    color: "#1E293B",
    fontSize: moderateScale(24),
    fontWeight: "700",
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: moderateScale(24),
  },
  inputDisabled: {
    color: "#94A3B8",
  },
  inputIcon: {
    marginRight: moderateScale(12),
  },
  inputLabel: {
    fontWeight: "500",
    left: moderateScale(52),
    position: "absolute",
    zIndex: 1,
  },
  inputWrapper: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(12),
    borderWidth: 2,
    flexDirection: "row",
    paddingHorizontal: moderateScale(16),
  },
  keyboardAvoid: {
    flex: 1,
  },
  passwordRequirements: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: moderateScale(12),
    borderWidth: 1,
    marginBottom: moderateScale(24),
    padding: moderateScale(16),
  },
  primaryButton: {
    borderRadius: moderateScale(12),
    elevation: 4,
    flex: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  progressSection: {
    alignItems: "center",
    marginBottom: moderateScale(32),
  },
  requirementItem: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: moderateScale(8),
  },
  requirementMet: {
    color: "#10B981",
    fontWeight: "500",
  },
  requirementText: {
    color: "#64748B",
    fontSize: moderateScale(12),
    marginLeft: moderateScale(8),
  },
  requirementsTitle: {
    color: "#1E293B",
    fontSize: moderateScale(14),
    fontWeight: "600",
    marginBottom: moderateScale(12),
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: moderateScale(24),
    paddingHorizontal: moderateScale(24),
  },
  scrollView: {
    flex: 1,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: moderateScale(12),
    borderWidth: 2,
    flex: 1,
    paddingVertical: moderateScale(16),
  },
  secondaryButtonText: {
    color: "#64748B",
    fontSize: moderateScale(16),
    fontWeight: "600",
  },
  stepContainer: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: moderateScale(8),
  },
  stepContent: {
    flex: 1,
  },
  stepDescription: {
    color: "#64748B",
    fontSize: moderateScale(16),
    lineHeight: moderateScale(24),
    marginBottom: moderateScale(32),
    textAlign: "center",
  },
  stepDot: {
    alignItems: "center",
    backgroundColor: "#E2E8F0",
    borderRadius: moderateScale(12),
    height: moderateScale(24),
    justifyContent: "center",
    width: moderateScale(24),
  },
  stepDotActive: {
    backgroundColor: "#4A90E2",
  },
  stepDotCompleted: {
    backgroundColor: "#10B981",
  },
  stepLine: {
    backgroundColor: "#E2E8F0",
    height: 2,
    width: moderateScale(50),
  },
  stepLineCompleted: {
    backgroundColor: "#10B981",
  },
  stepRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  stepText: {
    color: "#64748B",
    fontSize: moderateScale(14),
    fontWeight: "500",
  },
  stepTitle: {
    color: "#1E293B",
    fontSize: moderateScale(28),
    fontWeight: "700",
    marginBottom: moderateScale(8),
    textAlign: "center",
  },
  successMessage: {
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
    borderRadius: moderateScale(12),
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: moderateScale(24),
    padding: moderateScale(16),
  },
  successMessageText: {
    color: "#065F46",
    flex: 1,
    fontSize: moderateScale(14),
    fontWeight: "500",
    marginLeft: moderateScale(8),
  },
  textInput: {
    color: "#1E293B",
    flex: 1,
    fontSize: moderateScale(16),
    fontWeight: "500",
    paddingVertical: moderateScale(16),
  },
  timerContainer: {
    alignItems: "center",
    marginBottom: moderateScale(24),
  },
  timerText: {
    color: "#F59E0B",
    fontSize: moderateScale(14),
    fontWeight: "500",
  },
});

export default ForgotPassword;
