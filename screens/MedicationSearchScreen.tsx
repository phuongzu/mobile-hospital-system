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

const MedicationSearchScreen: React.FC = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [medicationInfo, setMedicationInfo] = useState<any>(null);

  const getAuthToken = async (): Promise<string | null> => {
    return await AsyncStorage.getItem('authToken');
  };

  const searchMedication = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      const token = await getAuthToken();
      
      const response = await fetch(`${API_BASE_URL}/ai-medical/medication/${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMedicationInfo(data.data);
        }
      }
    } catch (error) {
      console.error('Error searching medication:', error);
    } finally {
      setLoading(false);
    }
  };

  const popularMedications = [
    'Paracetamol',
    'Amoxicillin',
    'Ibuprofen',
    'Metformin',
    'Atorvastatin',
    'Omeprazole',
    'Aspirin',
    'Vitamin C'
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
        <Text style={styles.headerTitle}>Tìm thông tin thuốc</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Nhập tên thuốc cần tìm..."
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
        <Text style={styles.sectionTitle}>Thuốc phổ biến</Text>
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
            <Text style={styles.medicationText}>{medicationInfo.information}</Text>
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <Ionicons name="medical" size={64} color="#ccc" />
            <Text style={styles.placeholderText}>
              Nhập tên thuốc để tra cứu thông tin
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
    backgroundColor: '#4CAF50',
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
    marginBottom: 8,
  },
  popularContainer: {
    flexDirection: 'row',
  },
  medicationChip: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  medicationChipText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  resultsContainer: {
    flex: 1,
    marginHorizontal: 16,
  },
  medicationInfo: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  medicationName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  medicationText: {
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

export default MedicationSearchScreen;