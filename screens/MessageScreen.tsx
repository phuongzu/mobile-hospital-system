import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  SafeAreaView,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

interface Message {
  _id: string;
  sender_id: {
    _id: string;
    name: string;
    avatar?: string;
    role: string;
  };
  receiver_id: {
    _id: string;
    name: string;
    avatar?: string;
    role: string;
  };
  message: string;
  message_type: 'text' | 'image' | 'file';
  read: boolean;
  timestamp: string;
  medical_record_id?: string;
}

interface Conversation {
  _id: string;
  participant: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
    role: string;
  };
  last_message?: Message;
  last_message_at: string;
  unread_count: number;
  medical_record_id?: string;
}

type RootStackParamList = {
  Message: undefined;
  Home: undefined;
  Profile: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

const API_BASE_URL = 'http://localhost:3000/api';

const MessageScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const flatListRef = useRef<FlatList>(null);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'chats' | 'people'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [pollingAnimation] = useState(new Animated.Value(0));
  const [lastPollTime, setLastPollTime] = useState<string>('');
  const [isPollingActive, setIsPollingActive] = useState(true);
  const [newMessageIndicator, setNewMessageIndicator] = useState(false);

  // Load current user ID và conversations khi screen được focus
  useFocusEffect(
    React.useCallback(() => {
      loadCurrentUser();
      loadConversations();
      startPollingAnimation();
      return () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
      };
    }, [])
  );

  const startPollingAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pollingAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pollingAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const loadCurrentUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        setCurrentUserId(user._id);
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const getAuthToken = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  const loadConversations = async (showIndicator: boolean = false) => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Error', 'Please login again');
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/messages/conversations`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        const prevCount = conversations.reduce((sum, conv) => sum + conv.unread_count, 0);
        const newCount = response.data.data.reduce((sum: number, conv: Conversation) => sum + conv.unread_count, 0);
        
        setConversations(response.data.data || []);
        
        // Hiển thị indicator nếu có tin nhắn mới
        if (showIndicator && newCount > prevCount) {
          setNewMessageIndicator(true);
          setTimeout(() => setNewMessageIndicator(false), 2000);
        }
        
        setLastPollTime(new Date().toLocaleTimeString());
      } else {
        Alert.alert('Error', 'Failed to load conversations');
      }
    } catch (error: any) {
      console.error('Error loading conversations:', error);
      if (error.response?.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
      } else {
        Alert.alert('Error', 'Unable to load conversations');
      }
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    // Clear existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    // Poll for new messages every 5 seconds
    const interval = setInterval(() => {
      if (selectedConversation) {
        loadMessages(selectedConversation._id);
      }
      loadConversations(true); // Refresh conversations list với indicator
    }, 5000);

    setPollingInterval(interval);
  };

  const loadMessages = async (conversationId: string) => {
    try {
      setMessageLoading(true);
      const token = await getAuthToken();
      if (!token) return;

      const response = await axios.get(
        `${API_BASE_URL}/messages/conversations/${conversationId}/messages`,
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        const previousMessagesCount = messages.length;
        const newMessages = response.data.data || [];
        setMessages(newMessages);
        
        // Nếu có tin nhắn mới, hiển thị indicator
        if (newMessages.length > previousMessagesCount) {
          setNewMessageIndicator(true);
          setTimeout(() => setNewMessageIndicator(false), 1500);
        }
        
        // Mark messages as read
        await markMessagesAsRead(conversationId);
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
      if (error.response?.status !== 401) {
        Alert.alert('Error', 'Unable to load messages');
      }
    } finally {
      setMessageLoading(false);
    }
  };

  const markMessagesAsRead = async (conversationId: string) => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      await axios.patch(
        `${API_BASE_URL}/messages/conversations/${conversationId}/read`,
        {},
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      setSending(true);
      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Error', 'Please login again');
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/messages/send`,
        {
          receiver_id: selectedConversation.participant._id,
          message: newMessage.trim(),
          message_type: 'text',
          medical_record_id: selectedConversation.medical_record_id
        },
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        setNewMessage('');
        // Add new message to the list
        setMessages(prev => [...prev, response.data.data.message]);
        // Refresh conversations to update last message
        loadConversations();
        
        // Auto scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        Alert.alert('Error', 'Failed to send message');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
      
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatMessageTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (error) {
      return dateString;
    }
  };

  const isSameDay = (date1: string, date2: string) => {
    try {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      return d1.toDateString() === d2.toDateString();
    } catch (error) {
      return false;
    }
  };

  const getAvatarUrl = (avatarPath: string | undefined): string => {
    if (!avatarPath) return 'https://via.placeholder.com/40';
    
    if (avatarPath.startsWith('http')) {
      return avatarPath;
    }
    
    // Nếu avatar là đường dẫn relative
    return `${API_BASE_URL}/uploads/avatars/${avatarPath}`;
  };

  const renderMessageItem = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_id._id === currentUserId;
    const showAvatar = index === 0 || 
      (messages[index - 1] && messages[index - 1].sender_id._id !== item.sender_id._id) ||
      !isSameDay(item.timestamp, messages[index - 1]?.timestamp);

    const showDateHeader = index === 0 || 
      !isSameDay(item.timestamp, messages[index - 1]?.timestamp);

    return (
      <View>
        {showDateHeader && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>
              {new Date(item.timestamp).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
          </View>
        )}
        
        <View style={[
          styles.messageContainer,
          isMe ? styles.myMessageContainer : styles.theirMessageContainer
        ]}>
          {!isMe && showAvatar && (
            <Image
              source={{ uri: getAvatarUrl(item.sender_id.avatar) }}
              style={styles.messageAvatar}
              defaultSource={{ uri: 'https://via.placeholder.com/40' }}
            />
          )}
          
          <View style={[
            styles.messageBubble,
            isMe ? styles.myMessageBubble : styles.theirMessageBubble,
            !isMe && !showAvatar && styles.continuationMessage
          ]}>
            {!isMe && showAvatar && (
              <Text style={styles.senderName}>{item.sender_id.name}</Text>
            )}
            <Text style={[
              styles.messageText,
              isMe ? styles.myMessageText : styles.theirMessageText
            ]}>
              {item.message}
            </Text>
            <Text style={[
              styles.messageTime,
              isMe ? styles.myMessageTime : styles.theirMessageTime
            ]}>
              {formatMessageTime(item.timestamp)}
              {isMe && (item.read ? ' ✓✓' : ' ✓')}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[
        styles.conversationItem,
        selectedConversation?._id === item._id && styles.selectedConversation
      ]}
      onPress={() => {
        setSelectedConversation(item);
        loadMessages(item._id);
      }}
    >
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: getAvatarUrl(item.participant.avatar) }}
          style={styles.avatar}
          defaultSource={{ uri: 'https://via.placeholder.com/56' }}
        />
        {item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>
              {item.unread_count > 9 ? '9+' : item.unread_count}
            </Text>
          </View>
        )}
        {item.participant.role === 'doctor' && (
          <View style={styles.roleBadge}>
            <Icon name="verified" size={12} color="#1877F2" />
          </View>
        )}
      </View>
      
      <View style={styles.conversationInfo}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName} numberOfLines={1}>
            {item.participant.name}
            {item.participant.role === 'doctor' && ' 👨‍⚕️'}
            {item.participant.role === 'patient' && ' 👤'}
          </Text>
          <Text style={styles.conversationTime}>
            {formatTime(item.last_message_at)}
          </Text>
        </View>
        
        <View style={styles.conversationPreview}>
          <Text 
            style={[
              styles.lastMessage,
              item.unread_count > 0 && styles.unreadMessage
            ]}
            numberOfLines={2}
          >
            {item.last_message?.message || 'Start a conversation...'}
          </Text>
          {item.unread_count > 0 && (
            <View style={styles.unreadIndicator} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Polling indicator animation
  const pollingOpacity = pollingAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  if (selectedConversation) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        
        {/* Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              setSelectedConversation(null);
              setMessages([]);
            }}
          >
            <Icon name="arrow-back" size={24} color="#1877F2" />
          </TouchableOpacity>
          
          <View style={styles.chatPartnerInfo}>
            <Image
              source={{ uri: getAvatarUrl(selectedConversation.participant.avatar) }}
              style={styles.chatAvatar}
              defaultSource={{ uri: 'https://via.placeholder.com/40' }}
            />
            <View>
              <Text style={styles.chatPartnerName}>
                {selectedConversation.participant.name}
                {selectedConversation.participant.role === 'doctor' && ' 👨‍⚕️'}
              </Text>
              <Text style={styles.chatPartnerStatus}>
                {selectedConversation.participant.role === 'doctor' ? 'Doctor' : 'Patient'}
                {selectedConversation.medical_record_id && ' • Medical Record Linked'}
              </Text>
            </View>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton}>
              <Icon name="videocam" size={24} color="#1877F2" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <Icon name="call" size={24} color="#1877F2" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <Icon name="more-vert" size={24} color="#1877F2" />
            </TouchableOpacity>
          </View>
        </View>

        {/* New Message Indicator */}
        {newMessageIndicator && (
          <Animated.View style={[styles.newMessageIndicator, { opacity: pollingOpacity }]}>
            <Icon name="arrow-upward" size={16} color="#FFFFFF" />
            <Text style={styles.newMessageIndicatorText}>New messages</Text>
          </Animated.View>
        )}

        {/* Messages List */}
        <KeyboardAvoidingView 
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {messageLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1877F2" />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item._id}
              renderItem={renderMessageItem}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
              ListEmptyComponent={
                <View style={styles.emptyChatState}>
                  <Icon name="chat-bubble-outline" size={64} color="#E4E6EB" />
                  <Text style={styles.emptyChatStateTitle}>Start a conversation</Text>
                  <Text style={styles.emptyChatStateText}>
                    Send your first message to {selectedConversation.participant.name}
                  </Text>
                </View>
              }
            />
          )}

          {/* Message Input */}
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.attachmentButton}>
              <Icon name="attach-file" size={24} color="#65676B" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.emojiButton}>
              <Icon name="emoji-emotions" size={24} color="#65676B" />
            </TouchableOpacity>
            
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
                placeholderTextColor="#65676B"
                multiline
                maxLength={1000}
                editable={!sending}
              />
            </View>
            
            <TouchableOpacity 
              style={[
                styles.sendButton,
                (!newMessage.trim() || sending) && styles.sendButtonDisabled
              ]}
              onPress={sendMessage}
              disabled={!newMessage.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Icon 
                  name="send" 
                  size={20} 
                  color="#FFFFFF" 
                />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header với nút Back về Home */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.homeButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Icon name="home" size={24} color="#1877F2" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Messages</Text>
        
        <View style={styles.headerActions}>
          {/* Polling Indicator */}
          <View style={styles.pollingIndicatorContainer}>
            <Animated.View style={[styles.pollingDot, { opacity: pollingOpacity }]} />
            <Text style={styles.pollingText}>
              {isPollingActive ? 'Live' : 'Paused'}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={() => {
              loadConversations(true);
              setNewMessageIndicator(true);
              setTimeout(() => setNewMessageIndicator(false), 1000);
            }}
          >
            <Icon name="refresh" size={24} color="#1877F2" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={() => setIsPollingActive(!isPollingActive)}
          >
            <Icon 
              name={isPollingActive ? 'pause' : 'play-arrow'} 
              size={24} 
              color="#1877F2" 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Last Poll Time */}
      {lastPollTime && (
        <View style={styles.lastPollContainer}>
          <Text style={styles.lastPollText}>
            Last updated: {lastPollTime}
          </Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="search" size={20} color="#65676B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="#65676B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close" size={20} color="#65676B" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chats' && styles.activeTab]}
          onPress={() => setActiveTab('chats')}
        >
          <Text style={[styles.tabText, activeTab === 'chats' && styles.activeTabText]}>
            <Icon name="chat" size={16} /> Chats
          </Text>
          <View style={styles.unreadTotalBadge}>
            <Text style={styles.unreadTotalCount}>
              {conversations.reduce((sum, conv) => sum + conv.unread_count, 0)}
            </Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'people' && styles.activeTab]}
          onPress={() => setActiveTab('people')}
        >
          <Text style={[styles.tabText, activeTab === 'people' && styles.activeTabText]}>
            <Icon name="people" size={16} /> People
          </Text>
        </TouchableOpacity>
      </View>

      {/* New Message Notification */}
      {newMessageIndicator && (
        <Animated.View style={[styles.globalNotification, { opacity: pollingOpacity }]}>
          <Icon name="notifications" size={16} color="#FFFFFF" />
          <Text style={styles.globalNotificationText}>New messages received!</Text>
        </Animated.View>
      )}

      {/* Conversations List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1877F2" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
          <Animated.Text style={[styles.pollingStatus, { opacity: pollingOpacity }]}>
            Polling for new messages...
          </Animated.Text>
        </View>
      ) : (
        <FlatList
          data={conversations.filter(conv => 
            conv.participant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            conv.participant.email.toLowerCase().includes(searchQuery.toLowerCase())
          )}
          keyExtractor={(item) => item._id}
          renderItem={renderConversationItem}
          style={styles.conversationsList}
          contentContainerStyle={styles.conversationsContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => loadConversations(true)}
              colors={['#1877F2']}
              tintColor="#1877F2"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="chat-bubble-outline" size={80} color="#E4E6EB" />
              <Text style={styles.emptyStateTitle}>No conversations yet</Text>
              <Text style={styles.emptyStateText}>
                {searchQuery ? 'No conversations match your search' : 'Start a conversation with your doctor or patient'}
              </Text>
              <TouchableOpacity style={styles.startChatButton}>
                <Icon name="add-comment" size={20} color="#FFFFFF" />
                <Text style={styles.startChatButtonText}>Start New Chat</Text>
              </TouchableOpacity>
            </View>
          }
          ListHeaderComponent={
            conversations.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderText}>
                  {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // Header Styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E6EB',
  },
  homeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1E21',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    padding: 8,
    marginLeft: 8,
  },
  // Polling Indicator
  pollingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F0F2F5',
    borderRadius: 12,
  },
  pollingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 4,
  },
  pollingText: {
    fontSize: 12,
    color: '#65676B',
    fontWeight: '500',
  },
  lastPollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
  },
  lastPollText: {
    fontSize: 11,
    color: '#65676B',
  },
  pollingStatus: {
    fontSize: 12,
    color: '#1877F2',
    marginTop: 8,
  },
  // Search Styles
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1C1E21',
  },
  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E6EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#1877F2',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#65676B',
  },
  activeTabText: {
    color: '#1877F2',
  },
  unreadTotalBadge: {
    backgroundColor: '#1877F2',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadTotalCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  // Notification Styles
  globalNotification: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: '#1877F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  globalNotificationText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  newMessageIndicator: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: '#1877F2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  newMessageIndicatorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  // List Header
  listHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
  },
  listHeaderText: {
    fontSize: 12,
    color: '#65676B',
    fontWeight: '500',
  },
  // Conversations List Styles
  conversationsList: {
    flex: 1,
  },
  conversationsContent: {
    paddingBottom: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  selectedConversation: {
    backgroundColor: '#F0F7FF',
    borderLeftWidth: 4,
    borderLeftColor: '#1877F2',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  roleBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E6EB',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#1877F2',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  unreadCount: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1E21',
    flex: 1,
  },
  conversationTime: {
    fontSize: 12,
    color: '#65676B',
  },
  conversationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#65676B',
    marginRight: 8,
  },
  unreadMessage: {
    color: '#1C1E21',
    fontWeight: '500',
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1877F2',
  },
  // Chat Header Styles
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E6EB',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  chatPartnerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  chatPartnerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1E21',
  },
  chatPartnerStatus: {
    fontSize: 12,
    color: '#65676B',
  },
  headerButton: {
    padding: 8,
    marginLeft: 16,
  },
  // Chat Container Styles
  chatContainer: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateHeaderText: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    fontSize: 12,
    color: '#65676B',
    fontWeight: '500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  theirMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '70%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 2,
  },
  myMessageBubble: {
    backgroundColor: '#1877F2',
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  continuationMessage: {
    marginLeft: 40, // Space for avatar
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1877F2',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: '#1C1E21',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: '#E4E6EB',
  },
  theirMessageTime: {
    color: '#65676B',
  },
  // Input Styles
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E4E6EB',
  },
  attachmentButton: {
    padding: 8,
    marginRight: 8,
  },
  emojiButton: {
    padding: 8,
    marginRight: 8,
  },
  textInputContainer: {
    flex: 1,
    backgroundColor: '#F0F2F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
  },
  textInput: {
    fontSize: 16,
    color: '#1C1E21',
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1877F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#E4E6EB',
  },
  // Loading and Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#65676B',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1E21',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#65676B',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyChatState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyChatStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1E21',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyChatStateText: {
    fontSize: 14,
    color: '#65676B',
    textAlign: 'center',
  },
  startChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1877F2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  startChatButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MessageScreen;