import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";

const ChangePasswordScreen = () => {
  const navigation = useNavigation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      // Replace with your API endpoint and auth token logic
      const token = await AsyncStorage.getItem("authToken");
      await axios.post(
        "http://localhost:3000/api/auth/change-password",
        {
          currentPassword,
          newPassword,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      Alert.alert("Success", "Password changed successfully!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message || "Failed to change password.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={28} color="#1976D2" />
      </TouchableOpacity>
      <Text style={styles.title}>Change Password</Text>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Current Password</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          placeholder="Enter current password"
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>New Password</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="Enter new password"
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Confirm New Password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Confirm new password"
        />
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={handleChangePassword}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Change Password</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    marginBottom: 16,
    width: 40,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#1976D2",
    borderRadius: 16,
    elevation: 8,
    marginTop: 16,
    paddingVertical: 16,
    shadowColor: "#1976D2",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  container: {
    backgroundColor: "#F5F7FA",
    flex: 1,
    padding: 24,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  input: {
    backgroundColor: "#fff",
    borderColor: "#E0E0E0",
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    padding: 14,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: "#666",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
  },
  title: {
    color: "#1976D2",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 32,
    textAlign: "center",
  },
});

export default ChangePasswordScreen;
