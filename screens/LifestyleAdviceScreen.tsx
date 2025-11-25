import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://localhost:3000/api';

const LifestyleAdviceScreen: React.FC = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<any>(null);

  const getAuthToken = async (): Promise<string | null> => {
    return await AsyncStorage.getItem('authToken');
  };

  const getAdvice = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      const token = await getAuthToken();
      
      const response = await fetch(`${API_BASE_URL}/ai-medical/lifestyle/${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAdvice(data.data);
        }
      }
    } catch (error) {
      console.error('Error getting lifestyle advice:', error);
    } finally {
      setLoading(false);
    }
  };

  const popularTopics = [
    'Giảm cân',
    'Tăng cường sức khỏe tim',
    'Cải thiện giấc ngủ',
    'Giảm căng thẳng',
    'Tập thể dục tại nhà',
    'Dinh dưỡng cân bằng',
    'Chăm sóc da',
    'Sức khỏe tinh thần'
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
        <Text style={styles.headerTitle}>Gợi ý lối sống</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Nhập chủ đề bạn quan tâm..."
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
        <Text style={styles.sectionTitle}>Chủ đề phổ biến</Text>
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
              Chọn chủ đề để nhận lời khuyên về lối sống
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
  },
  searchButton: {
    backgroundColor: '#FF9800',
    padding: 8,
    borderRadius: 8,
  },
  popularSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  topicCard: {
    width: '48%',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  topicText: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  resultsContainer: {
    flex: 1,
    marginHorizontal: 16,
  },
  adviceInfo: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  topicName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  adviceText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  placeholderText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});

export default LifestyleAdviceScreen;