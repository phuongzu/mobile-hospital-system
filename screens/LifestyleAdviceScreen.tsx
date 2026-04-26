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

const LifestyleAdviceScreen: React.FC = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<any>(null);

  const getAuthToken = async (): Promise<string | null> => {
    return await AsyncStorage.getItem("authToken");
  };

  const getAdvice = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      const token = await getAuthToken();

      const response = await fetch(
        `${API_BASE_URL}/ai-medical/lifestyle/${encodeURIComponent(searchQuery)}`,
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
          setAdvice(data.data);
        }
      }
    } catch (error) {
      console.error("Error getting lifestyle advice:", error);
    } finally {
      setLoading(false);
    }
  };

  const popularTopics = [
    "Weight loss",
    "Improved heart health",
    "Improved sleep",
    "Stress reduction",
    "Home exercise",
    "Balanced nutrition",
    "Skin care",
    "Mental health",];

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
        <Text style={styles.headerTitle}>Lifestyle suggestions</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Enter the topic you are interested in..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={getAdvice}
          disabled={loading || !searchQuery.trim()}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="search" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Popular Topics */}
      <View style={styles.popularSection}>
        <Text style={styles.sectionTitle}>Popular topics</Text>
        <View style={styles.topicsGrid}>
          {popularTopics.map((topic, index) => (
            <TouchableOpacity
              key={index}
              style={styles.topicCard}
              onPress={() => {
                setSearchQuery(topic);
                setTimeout(() => getAdvice(), 100);
              }}
            >
              <Ionicons name="heart" size={24} color="#FF9800" />
              <Text style={styles.topicText}>{topic}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Results */}
      <ScrollView style={styles.resultsContainer}>
        {advice ? (
          <View style={styles.adviceInfo}>
            <Text style={styles.topicName}>{advice.topic}</Text>
            <Text style={styles.adviceText}>{advice.advice}</Text>
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <Ionicons name="heart" size={64} color="#ccc" />
            <Text style={styles.placeholderText}>
              Select a topic to receive lifestyle advice
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  adviceInfo: {
    backgroundColor: "#f8f8f8",
    borderColor: "#e0e0e0",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  adviceText: {
    color: "#333",
    fontSize: 14,
    lineHeight: 20,
  },
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
  popularSection: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
  resultsContainer: {
    flex: 1,
    marginHorizontal: 16,
  },
  searchButton: {
    backgroundColor: "#FF9800",
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
    marginBottom: 12,
  },
  topicCard: {
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    borderColor: "#FFE0B2",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
    width: "48%",
  },
  topicName: {
    color: "#333",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  topicText: {
    color: "#E65100",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 8,
    textAlign: "center",
  },
  topicsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
});

export default LifestyleAdviceScreen;
