import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = "http://localhost:3000/api";

interface ChatSession {
  id: string;
  title: string;
  preview: string;
  date: string;
  messageCount: number;
  category: string;
}

const ChatHistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const getAuthToken = async (): Promise<string | null> => {
    return await AsyncStorage.getItem("authToken");
  };

  const loadChatSessions = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE_URL}/ai-medical/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSessions(data.data.sessions);
        }
      }
    } catch (error) {
      console.error("Error loading chat sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const searchChatHistory = async (query: string) => {
    if (!query.trim()) {
      loadChatSessions();
      return;
    }

    try {
      setSearching(true);
      const token = await getAuthToken();

      const response = await fetch(
        `${API_BASE_URL}/ai-medical/search?query=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.results.length > 0) {
          const searchSessions = data.data.results.map(
            (result: any, index: number) => ({
              id: `search-${index}`,
              title: result.sessionTitle,
              preview: result.message,
              date: result.timestamp,
              messageCount: 1,
              category: result.category || "general",
              isSearchResult: true,
            }),
          );
          setSessions(searchSessions);
        } else {
          setSessions([]);
        }
      }
    } catch (error) {
      console.error("Error searching chat history:", error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    loadChatSessions();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "Hôm qua";
    if (diffDays === 2) return "Hôm kia";
    if (diffDays <= 7) return `${diffDays} ngày trước`;

    return date.toLocaleDateString("vi-VN");
  };

  const renderSessionItem = ({ item }: { item: ChatSession }) => (
    <TouchableOpacity
      style={styles.sessionItem}
      onPress={() => navigation.navigate("ChatWiget" as never)}
    >
      <View style={styles.sessionContent}>
        <Text style={styles.sessionTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.sessionPreview} numberOfLines={2}>
          {item.preview}
        </Text>
        <Text style={styles.sessionDate}>{formatDate(item.date)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

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
        <Text style={styles.headerTitle}>Cuộc trò chuyện của bạn</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#666"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm trong lịch sử..."
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            searchChatHistory(text);
          }}
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Sessions List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Đang tải lịch sử chat...</Text>
        </View>
      ) : searching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Đang tìm kiếm...</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderSessionItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>
                {searchQuery
                  ? "Không tìm thấy kết quả"
                  : "Chưa có cuộc trò chuyện nào"}
              </Text>
            </View>
          }
        />
      )}
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
  emptyContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    color: "#999",
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
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
  listContainer: {
    paddingHorizontal: 16,
  },
  loadingContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    color: "#666",
    fontSize: 16,
    marginTop: 12,
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
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    color: "#333",
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  sessionContent: {
    flex: 1,
    marginRight: 12,
  },
  sessionDate: {
    color: "#999",
    fontSize: 12,
  },
  sessionItem: {
    alignItems: "center",
    borderBottomColor: "#f0f0f0",
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingVertical: 12,
  },
  sessionPreview: {
    color: "#666",
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
  },
  sessionTitle: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
});

export default ChatHistoryScreen;
