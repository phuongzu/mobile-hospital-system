import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ChatOptionScreen: React.FC = () => {
  const navigation = useNavigation();

  const features = [
    {
      id: 1,
      title: "Find Medication Info",
      description: "Look up uses, dosages, and side effects.",
      icon: "medical",
      color: ["#00BCD4", "#00ACC1"],
      screen: "MedicationSearch",
    },
    {
      id: 2,
      title: "Explain Medical Terms",
      description: "Understand complex medical terminology.",
      icon: "book",
      color: ["#26C6DA", "#00ACC1"],
      screen: "TermExplanation",
    },
    {
      id: 3,
      title: "Lifestyle Suggestions",
      description: "Advice on diet and exercise.",
      icon: "heart",
      color: ["#4DD0E1", "#26C6DA"],
      screen: "LifestyleAdvice",
    },
    {
      id: 4,
      title: "Consultation History",
      description: "View previous conversations.",
      icon: "time",
      color: ["#00ACC1", "#0097A7"],
      screen: "ChatHistory",
    },
  ];

  const navigateToFeature = (screen: string) => {
    navigation.navigate(screen as never);
  };

  const handleStartChat = async () => {
    try {
      await AsyncStorage.setItem("lastUsedLanguage", "en");
    } catch (error) {
      console.error("Error saving language preference:", error);
    }
    navigation.navigate("ChatWiget" as never);
  };

  const handleBackToHome = () => {
    navigation.navigate("Home" as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Back Button Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToHome}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={["#00BCD4", "#00ACC1"]}
            style={styles.backButtonGradient}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>HealthAI Assistant</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header with Waveform */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Ionicons name="shield-checkmark" size={24} color="#00BCD4" />
            <Text style={styles.appName}>HealthAI</Text>
          </View>

          {/* Waveform Visual */}
          <View style={styles.waveformContainer}>
            <LinearGradient
              colors={["#00BCD4", "#006064"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.waveformGradient}
            >
              <View style={styles.waveformPattern}>
                {[...Array(50)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.waveformBar,
                      {
                        height: Math.random() * 100 + 20,
                        opacity: 0.6 + Math.random() * 0.4,
                      },
                    ]}
                  />
                ))}
              </View>
            </LinearGradient>
          </View>

          <View style={styles.headerContent}>
            <Text style={styles.mainHeaderTitle}>Your AI Health Assistant</Text>
            <Text style={styles.headerSubtitle}>
              Find medical information, understand medications, and receive
              health care suggestions quickly and easily.
            </Text>
          </View>
        </View>

        {/* Features Grid */}
        <View style={styles.featuresContainer}>
          <Text style={styles.sectionTitle}>Key Features</Text>
          <View style={styles.featuresGrid}>
            {features.map((feature) => (
              <TouchableOpacity
                key={feature.id}
                style={styles.featureCard}
                onPress={() => navigateToFeature(feature.screen)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={feature.color}
                  style={styles.featureIcon}
                >
                  <Ionicons name={feature.icon as any} size={28} color="#fff" />
                </LinearGradient>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>
                  {feature.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Important Notice */}
        <View style={styles.noticeContainer}>
          <View style={styles.noticeHeader}>
            <Ionicons name="warning" size={20} color="#FF9800" />
            <Text style={styles.noticeTitle}>Important Notice</Text>
          </View>
          <Text style={styles.noticeText}>
            AI does not provide medical diagnoses. Information is for reference
            only and does not replace advice from a doctor. In case of
            emergency, call 115 immediately.
          </Text>
        </View>

        {/* Start Chat Button */}
        <TouchableOpacity
          style={styles.startChatButton}
          onPress={handleStartChat}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#00BCD4", "#0097A7"]}
            style={styles.startChatGradient}
          >
            <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
            <Text style={styles.startChatText}>Start Conversation</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  appName: {
    color: "#212121",
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 8,
  },
  backButton: {
    borderRadius: 20,
    elevation: 3,
    height: 40,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: 40,
  },
  backButtonGradient: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  container: {
    backgroundColor: "#FAFAFA",
    flex: 1,
  },
  featureCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 2,
    marginBottom: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    width: "48%",
  },
  featureDescription: {
    color: "#757575",
    fontSize: 12,
    lineHeight: 16,
  },
  featureIcon: {
    alignItems: "center",
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    marginBottom: 12,
    width: 56,
  },
  featureTitle: {
    color: "#212121",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  featuresContainer: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  header: {
    backgroundColor: "#fff",
    marginBottom: 20,
    paddingBottom: 24,
  },
  headerContainer: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomColor: "#E0E0E0",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerContent: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  headerSpacer: {
    width: 40,
  },
  headerSubtitle: {
    color: "#757575",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  headerTitle: {
    color: "#212121",
    fontSize: 18,
    fontWeight: "600",
  },
  headerTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingBottom: 16,
    paddingTop: 20,
  },
  mainHeaderTitle: {
    color: "#212121",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  noticeContainer: {
    backgroundColor: "#FFF3E0",
    borderLeftColor: "#FF9800",
    borderLeftWidth: 4,
    borderRadius: 12,
    marginBottom: 24,
    marginHorizontal: 20,
    padding: 16,
  },
  noticeHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 8,
  },
  noticeText: {
    color: "#E65100",
    fontSize: 13,
    lineHeight: 18,
  },
  noticeTitle: {
    color: "#E65100",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  sectionTitle: {
    color: "#212121",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
  },
  startChatButton: {
    borderRadius: 50,
    elevation: 8,
    marginBottom: 32,
    marginHorizontal: 20,
    overflow: "hidden",
    shadowColor: "#00BCD4",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  startChatGradient: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  startChatText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 8,
  },
  waveformBar: {
    backgroundColor: "#fff",
    borderRadius: 2,
    marginHorizontal: 1,
    width: 3,
  },
  waveformContainer: {
    borderRadius: 16,
    height: 180,
    marginBottom: 20,
    marginHorizontal: 20,
    overflow: "hidden",
  },
  waveformGradient: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  waveformPattern: {
    alignItems: "center",
    flexDirection: "row",
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
});

export default ChatOptionScreen;
