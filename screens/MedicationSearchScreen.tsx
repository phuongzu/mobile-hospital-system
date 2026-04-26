import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = "http://localhost:3000/api";

const MedicationSearchScreen: React.FC = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [medicationInfo, setMedicationInfo] = useState<any>(null);

  const getAuthToken = async (): Promise<string | null> => {
    return await AsyncStorage.getItem("authToken");
  };

  const searchMedication = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      const token = await getAuthToken();

      const response = await fetch(
        `${API_BASE_URL}/ai-medical/medication/${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMedicationInfo(data.data);
        }
      }
    } catch (error) {
      console.error("Error searching medication:", error);
    } finally {
      setLoading(false);
    }
  };

  const popularMedications = [
    "Paracetamol",
    "Amoxicillin",
    "Ibuprofen",
    "Metformin",
    "Atorvastatin",
    "Omeprazole",
    "Aspirin",
    "Vitamin C",
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find drug information</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Enter the drug name you want to find..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={searchMedication}
          disabled={loading || !searchQuery.trim()}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="search" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Popular Medications */}
      <View style={styles.popularSection}>
        <Text style={styles.sectionTitle}>Popular Medications</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.popularContainer}>
            {popularMedications.map((med, index) => (
              <TouchableOpacity
                key={index}
                style={styles.medicationChip}
                onPress={() => {
                  setSearchQuery(med);
                  setTimeout(() => searchMedication(), 100);
                }}
              >
                <Text style={styles.medicationChipText}>{med}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Results */}
      <ScrollView style={styles.resultsContainer}>
        {medicationInfo ? (
          <View style={styles.medicationInfo}>
            <Text style={styles.medicationName}>{medicationInfo.name}</Text>
            <Text style={styles.medicationText}>
              {medicationInfo.information}
            </Text>
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <Ionicons name="medical" size={64} color="#ccc" />
            <Text style={styles.placeholderText}>
              Enter the drug name you want to find
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  container: {
    backgroundColor: "#fff",
    flex: 1,
  },
  header: {
    alignItems: "center",
    borderBottomColor: "#f0f0f0",
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: "#333",
    fontSize: 18,
    fontWeight: "600",
  },
  medicationChip: {
    backgroundColor: "#E3F2FD",
    borderColor: "#BBDEFB",
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  medicationChipText: {
    color: "#1976D2",
    fontSize: 14,
    fontWeight: "500",
  },
  medicationInfo: {
    backgroundColor: "#f8f8f8",
    borderColor: "#e0e0e0",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  medicationName: {
    color: "#333",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  medicationText: {
    color: "#333",
    fontSize: 14,
    lineHeight: 20,
  },
  placeholderContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingVertical: 60,
  },
  placeholderText: {
    color: "#999",
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },
  popularContainer: {
    flexDirection: "row",
  },
  popularSection: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
  resultsContainer: {
    flex: 1,
    marginHorizontal: 16,
  },
  searchButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    padding: 8,
  },
  searchContainer: {
    alignItems: "center",
    backgroundColor: "#f8f8f8",
    borderColor: "#e0e0e0",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    margin: 16,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: "#333",
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
});

export default MedicationSearchScreen;
