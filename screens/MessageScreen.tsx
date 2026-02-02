import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
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
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Dimensions,
  Animated,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  ActionSheetIOS,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { MediaTypeOptions, launchImageLibraryAsync } from 'expo-image-picker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io, { Socket } from 'socket.io-client';

const { width } = Dimensions.get('window');

// ==================== INTERFACES ====================
interface User {
  _id: string;
  name: string;
  avatar?: string;
  role: string;
}

interface Message {
  _id: string;
  conversation_id: string;
  sender_id: User;
  receiver_id: User;
  message: string;
  message_type: 'text' | 'image' | 'file';
  media_url?: string;
  media_name?: string;
  media_size?: number;
  media_mime?: string;
  medical_record_id?: string;
  appointment_id?: string;
  read: boolean;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
  edited?: boolean;
  edited_at?: string;
  deleted?: boolean;
  deleted_at?: string;
}

interface Conversation {
  _id: string;
  participant: User;
  last_message?: Message;
  last_message_at: string;
  unread_count: number;
  medical_record_id?: string;
}

const API_BASE_URL = 'http://localhost:3000';
const API_ENDPOINT = `${API_BASE_URL}/api`;

// ==================== UTILITY FUNCTIONS ====================

/**
 * Build proper image URL
 */
const buildMediaUrl = (mediaUrl: string | null | undefined): string => {
  if (!mediaUrl) return '';
  
  // If already a full URL
  if (mediaUrl.startsWith('http')) {
    return mediaUrl;
  }
  
  // If it's a relative path
  const baseUrl = API_BASE_URL;
  const cleanUrl = mediaUrl.startsWith('/') ? mediaUrl : `/${mediaUrl}`;
  return `${baseUrl}${cleanUrl}`;
};

/**
 * Build avatar URL
 */
const buildAvatarUrl = (user?: User): string => {
  if (!user?.avatar) {
    return `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=random&size=150`;
  }
  
  if (user.avatar.startsWith('http')) {
    return user.avatar;
  }
  
  return `${API_BASE_URL}${user.avatar.startsWith('/') ? user.avatar : `/uploads/avatars/${user.avatar}`}`;
};

/**
 * Format file size
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ==================== IMAGE MESSAGE COMPONENT ====================
const ImageMessage = memo(({ 
  message,
  isMyMessage,
  onPress,
  onLongPress
}: { 
  message: Message;
  isMyMessage: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  
  const imageUrl = buildMediaUrl(message.media_url);
  
  return (
    <View>
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.8}
        style={styles.imageMessageContainer}
        delayLongPress={500}
      >
        <Image
          source={{ uri: imageUrl }}
          style={styles.mediaImage}
          resizeMode="cover"
          onLoadStart={() => setImageLoading(true)}
          onLoadEnd={() => setImageLoading(false)}
          onError={() => {
            setImageLoading(false);
            setImageError(true);
          }}
        />
        
        {imageLoading && (
          <View style={styles.imageLoadingOverlay}>
            <ActivityIndicator size="small" color="#FFF" />
          </View>
        )}
        
        {imageError && (
          <View style={styles.imageErrorOverlay}>
            <Ionicons name="alert-circle-outline" size={24} color="#FFF" />
            <Text style={styles.imageErrorText}>Failed to load image</Text>
          </View>
        )}
      </TouchableOpacity>

      {message.message ? (
        <View style={styles.imageCaptionContainer}>
          <Text style={styles.imageCaption}>{message.message}</Text>
        </View>
      ) : null}
    </View>
  );
});

// ==================== IMAGE PREVIEW MODAL ====================
const ImagePreviewModal = memo(({ 
  visible, 
  imageUrl, 
  onClose 
}: { 
  visible: boolean; 
  imageUrl: string; 
  onClose: () => void;
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      setError(false);
    }
  }, [visible, imageUrl]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              {/* Close Button */}
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>

              {/* Image Container */}
              <View style={styles.imageContainer}>
                {loading && !error && (
                  <View style={styles.imageLoading}>
                    <ActivityIndicator size="large" color="#FFF" />
                    <Text style={styles.loadingText}>Loading image...</Text>
                  </View>
                )}

                {error && (
                  <View style={styles.imageError}>
                    <Ionicons name="alert-circle-outline" size={64} color="#FFF" />
                    <Text style={styles.errorText}>Failed to load image</Text>
                    <TouchableOpacity 
                      style={styles.retryButton}
                      onPress={() => {
                        setError(false);
                        setLoading(true);
                      }}
                    >
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Image
                  source={{ uri: imageUrl }}
                  style={styles.fullImage}
                  resizeMode="contain"
                  onLoadStart={() => setLoading(true)}
                  onLoadEnd={() => setLoading(false)}
                  onError={() => {
                    setError(true);
                    setLoading(false);
                  }}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// ==================== MESSAGE ACTIONS MENU ====================
interface MessageActionsMenuProps {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message, type: 'me' | 'everyone') => void;
  isMyMessage: boolean;
}

// Thay thế phần MessageActionsMenu hiện tại bằng code này:

const MessageActionsMenu = memo<MessageActionsMenuProps>(({
  visible,
  message,
  onClose,
  onEdit,
  onDelete,
  isMyMessage,
}) => {
  // Hiển thị ActionSheet cho iOS
  const showActionSheet = useCallback(() => {
    if (!message) return;
    
    const options = [];
    const destructiveButtonIndexes = [];
    
    if (isMyMessage && message.message_type === 'text' && !message.deleted) {
      options.push('Edit');
    }
    
    if (isMyMessage) {
      options.push('Delete for me');
      options.push('Delete for everyone');
      destructiveButtonIndexes.push(options.length - 2, options.length - 1);
    } else {
      options.push('Delete for me');
      destructiveButtonIndexes.push(options.length - 1);
    }
    
    options.push('Cancel');
    const cancelButtonIndex = options.length - 1;

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex: destructiveButtonIndexes,
      },
      (buttonIndex) => {
        if (buttonIndex === cancelButtonIndex) return;
        
        const selectedOption = options[buttonIndex];
        
        switch (selectedOption) {
          case 'Edit':
            onEdit(message);
            break;
          case 'Delete for me':
            onDelete(message, 'me');
            break;
          case 'Delete for everyone':
            onDelete(message, 'everyone');
            break;
        }
        
        onClose();
      }
    );
  }, [message, isMyMessage, onEdit, onDelete, onClose]);

  // Effect để hiển thị ActionSheet trên iOS
  useEffect(() => {
    if (visible && Platform.OS === 'ios' && message) {
      showActionSheet();
    }
  }, [visible, message, showActionSheet]);

  // Android: hiển thị modal
  if (Platform.OS === 'android' && visible && message) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.actionSheetOverlay}>
            <View style={styles.actionSheetContainer}>
              {isMyMessage && message.message_type === 'text' && !message.deleted && (
                <TouchableOpacity
                  style={styles.actionSheetButton}
                  onPress={() => {
                    onEdit(message);
                    onClose();
                  }}
                >
                  <Ionicons name="create-outline" size={20} color="#000" style={styles.actionSheetIcon} />
                  <Text style={styles.actionSheetText}>Edit</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={styles.actionSheetButton}
                onPress={() => {
                  onDelete(message, 'me');
                  onClose();
                }}
              >
                <Ionicons name="trash-outline" size={20} color="#FF3B30" style={styles.actionSheetIcon} />
                <Text style={[styles.actionSheetText, styles.destructiveText]}>Delete for me</Text>
              </TouchableOpacity>
              
              {isMyMessage && (
                <TouchableOpacity
                  style={styles.actionSheetButton}
                  onPress={() => {
                    onDelete(message, 'everyone');
                    onClose();
                  }}
                >
                  <Ionicons name="trash-bin-outline" size={20} color="#FF3B30" style={styles.actionSheetIcon} />
                  <Text style={[styles.actionSheetText, styles.destructiveText]}>Delete for everyone</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.actionSheetButton, styles.cancelButton]}
                onPress={onClose}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  }

  // iOS: không render gì cả vì đã sử dụng ActionSheetIOS
  return null;
});

// Đặt display name cho component
MessageActionsMenu.displayName = 'MessageActionsMenu';
// ==================== EDIT MESSAGE MODAL ====================
interface EditMessageModalProps {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
  onSave: (messageId: string, newMessage: string) => Promise<void>;
}

const EditMessageModal: React.FC<EditMessageModalProps> = ({
  visible,
  message,
  onClose,
  onSave,
}) => {
  const [editingText, setEditingText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && message) {
      setEditingText(message.message);
    }
  }, [visible, message]);

  const handleSave = async () => {
    if (!message || !editingText.trim()) return;
    
    setSaving(true);
    try {
      await onSave(message._id, editingText.trim());
      onClose();
    } catch (error) {
      console.error('Error saving message:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.editModalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.editModalContent}>
              <View style={styles.editModalHeader}>
                <Text style={styles.editModalTitle}>Edit Message</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color="#000" />
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={styles.editTextInput}
                value={editingText}
                onChangeText={setEditingText}
                multiline
                autoFocus
                placeholder="Edit your message..."
                maxLength={1000}
              />
              
              <View style={styles.editModalFooter}>
                <TouchableOpacity
                  style={styles.editCancelButton}
                  onPress={onClose}
                  disabled={saving}
                >
                  <Text style={styles.editCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.editSaveButton,
                    (!editingText.trim() || saving) && styles.editSaveButtonDisabled
                  ]}
                  onPress={handleSave}
                  disabled={!editingText.trim() || saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.editSaveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// ==================== MAIN COMPONENT ====================
const MessageScreen = () => {
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<Socket | null>(null);
  const selectedConvRef = useRef<Conversation | null>(null);
  const handlerRef = useRef<((msg: any) => void) | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  // Image preview modal state
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Message actions state
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Status pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ==================== EFFECTS ====================
  useEffect(() => {
    selectedConvRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    if (isSocketConnected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 1000,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true
          }),
        ])
      ).start();
    }
  }, [isSocketConnected]);

  // ==================== HELPER FUNCTIONS ====================
  const safeFormatTime = useCallback((dateStr?: string | number | Date): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    if (diff < oneDay) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diff < oneDay * 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }, []);

  const isMyMessage = useCallback((message: Message): boolean => {
    return message.sender_id._id === currentUserId;
  }, [currentUserId]);

  const isSameSender = useCallback((currentMsg: Message, nextMsg?: Message): boolean => {
    if (!nextMsg) return false;
    return currentMsg.sender_id._id === nextMsg.sender_id._id;
  }, []);

  const shouldShowAvatar = useCallback((message: Message, index: number): boolean => {
    const isMe = isMyMessage(message);
    if (isMe) return false;

    const nextMessage = messages[index + 1];
    if (!nextMessage) return true;

    return !isSameSender(message, nextMessage);
  }, [messages, isMyMessage, isSameSender]);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  // ==================== SOCKET HANDLING ====================
  handlerRef.current = (rawMsg: any) => {
    if (!rawMsg) return;

    const normalizedMsg: Message = {
      _id: rawMsg._id || rawMsg.message?._id,
      conversation_id: rawMsg.conversation_id || rawMsg.conversationId || rawMsg.message?.conversation_id,
      sender_id: rawMsg.sender_id || rawMsg.senderId || rawMsg.message?.sender_id,
      receiver_id: rawMsg.receiver_id || rawMsg.receiverId || rawMsg.message?.receiver_id,
      message: rawMsg.message?.message || rawMsg.message || rawMsg.content || '',
      message_type: rawMsg.message_type || rawMsg.message?.message_type || 'text',
      media_url: rawMsg.media_url || rawMsg.message?.media_url,
      media_name: rawMsg.media_name || rawMsg.message?.media_name,
      media_size: rawMsg.media_size || rawMsg.message?.media_size,
      media_mime: rawMsg.media_mime || rawMsg.message?.media_mime,
      read: rawMsg.read || rawMsg.message?.read || false,
      timestamp: rawMsg.timestamp || rawMsg.message?.timestamp || new Date().toISOString(),
      createdAt: rawMsg.createdAt || rawMsg.message?.createdAt || new Date().toISOString(),
      updatedAt: rawMsg.updatedAt || rawMsg.message?.updatedAt || new Date().toISOString(),
      edited: rawMsg.edited || rawMsg.message?.edited || false,
      edited_at: rawMsg.edited_at || rawMsg.message?.edited_at,
      deleted: rawMsg.deleted || rawMsg.message?.deleted || false,
      deleted_at: rawMsg.deleted_at || rawMsg.message?.deleted_at,
    };

    const convId = normalizedMsg.conversation_id;
    const active = selectedConvRef.current;

    setConversations(prev => {
      const updated = prev.map(conv => {
        if (conv._id === convId) {
          return {
            ...conv,
            last_message: normalizedMsg,
            last_message_at: normalizedMsg.timestamp || normalizedMsg.createdAt,
            unread_count: (active?._id === convId) ? 0 : (conv.unread_count || 0) + 1
          };
        }
        return conv;
      });

      return [...updated].sort((a, b) => 
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );
    });

    if (active?._id === convId) {
      setMessages(prev => {
        if (prev.some(m => m._id === normalizedMsg._id)) return prev;

        if (isMyMessage(normalizedMsg)) {
          const tempIdx = prev.findIndex(m => 
            m._id && m._id.startsWith('temp_') && m.message === normalizedMsg.message
          );
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = normalizedMsg;
            return updated;
          }
        }

        return [...prev, normalizedMsg];
      });

      if (socketRef.current?.connected && !isMyMessage(normalizedMsg)) {
        socketRef.current.emit('mark_as_read', { conversationId: convId });
      }

      setTimeout(scrollToBottom, 150);
    }
  };

  const connectSocket = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token || socketRef.current?.connected) return;

      socketRef.current = io(API_BASE_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current.on('connect', () => {
        console.log('✅ Socket connected');
        setIsSocketConnected(true);
      });

      socketRef.current.on('disconnect', () => {
        console.log('❌ Socket disconnected');
        setIsSocketConnected(false);
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
      });

      // Socket events
      socketRef.current.on('new_message', (data) => {
        handlerRef.current?.(data);
      });

      socketRef.current.on('receive_message', (data) => {
        handlerRef.current?.(data.message || data);
      });

      socketRef.current.on('message_sent', (data) => {
        if (data.success) {
          handlerRef.current?.(data.message || data.data?.message);
        }
      });

      socketRef.current.on('message_edited', (data) => {
        if (data.conversationId === selectedConvRef.current?._id) {
          setMessages(prev => prev.map(msg => 
            msg._id === data.message._id ? data.message : msg
          ));
        }
      });

      socketRef.current.on('message_deleted', (data) => {
        if (data.conversationId === selectedConvRef.current?._id) {
          setMessages(prev => prev.map(msg => 
            msg._id === data.message._id ? data.message : msg
          ));
        }
      });

      socketRef.current.on('typing_start', (data) => {
        if (data.conversationId === selectedConvRef.current?._id && data.userId !== currentUserId) {
          setTypingUsers(prev => [...new Set([...prev, data.userId])]);
        }
      });

      socketRef.current.on('typing_stop', (data) => {
        if (data.conversationId === selectedConvRef.current?._id) {
          setTypingUsers(prev => prev.filter(id => id !== data.userId));
        }
      });

      socketRef.current.on('messages_read', (data) => {
        if (data.conversationId === selectedConvRef.current?._id) {
          setMessages(prev => prev.map(msg => ({
            ...msg,
            read: msg.sender_id._id === currentUserId ? true : msg.read
          })));
        }
      });

    } catch (error) {
      console.error('❌ Socket connection error:', error);
    }
  };

  // ==================== API FUNCTIONS ====================
  const loadConversations = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.get(`${API_ENDPOINT}/messages/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data.success) {
        const formattedConversations = (response.data.data || []).map((conv: any) => ({
          _id: conv._id,
          participant: conv.participant,
          last_message: conv.last_message,
          last_message_at: conv.last_message_at || conv.last_message?.createdAt,
          unread_count: conv.unread_count || 0,
          medical_record_id: conv.medical_record_id
        }));
        setConversations(formattedConversations);
      }
    } catch (error) {
      console.error('❌ Error loading conversations:', error);
      Alert.alert('Error', 'Failed to load conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      setMessageLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.get(
        `${API_ENDPOINT}/messages/conversations/${conversationId}/messages`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.data.success) {
        const messagesData = response.data.data || [];
        setMessages(messagesData);

        if (socketRef.current?.connected) {
          socketRef.current.emit('mark_as_read', { conversationId });
        }

        setConversations(prev => prev.map(conv => 
          conv._id === conversationId ? { ...conv, unread_count: 0 } : conv
        ));

        setTimeout(scrollToBottom, 300);
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setMessageLoading(false);
    }
  };

  const sendTextMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    const msgText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const tempId = `temp_${Date.now()}`;
    const tempMsg: Message = {
      _id: tempId,
      conversation_id: selectedConversation._id,
      sender_id: currentUser || { _id: currentUserId, name: 'You', role: 'patient' },
      receiver_id: selectedConversation.participant,
      message: msgText,
      message_type: 'text',
      read: false,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, tempMsg]);
    setTimeout(scrollToBottom, 100);

    try {
      const token = await AsyncStorage.getItem('authToken');

      if (socketRef.current?.connected) {
        socketRef.current.emit('send_message', {
          conversationId: selectedConversation._id,
          receiverId: selectedConversation.participant._id,
          message: msgText,
          messageType: 'text'
        });
        setSending(false);
      } else {
        const response = await axios.post(
          `${API_ENDPOINT}/messages/send`,
          {
            receiver_id: selectedConversation.participant._id,
            message: msgText,
            message_type: 'text'
          },
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (response.data.success) {
          handlerRef.current?.(response.data.data?.message || response.data.data);
        }
        setSending(false);
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setMessages(prev => prev.filter(m => m._id !== tempId));
      Alert.alert('Error', 'Failed to send message');
      setSending(false);
    }
  };

  const editMessage = async (messageId: string, newMessageText: string) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      const response = await axios.patch(
        `${API_ENDPOINT}/messages/messages/${messageId}/edit`,
        { newMessage: newMessageText },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.data.success) {
        const updatedMessage = response.data.data;
        setMessages(prev => prev.map(msg => 
          msg._id === messageId ? { ...msg, ...updatedMessage } : msg
        ));
        
        setConversations(prev => prev.map(conv => 
          conv._id === selectedConversation?._id 
            ? { ...conv, last_message: updatedMessage }
            : conv
        ));
        
        Alert.alert('Success', 'Message updated successfully');
      }
    } catch (error) {
      console.error('❌ Error editing message:', error);
      Alert.alert('Error', 'Failed to edit message');
      throw error;
    }
  };

  const deleteMessage = async (message: Message, type: 'me' | 'everyone') => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      const response = await axios.delete(
        `${API_ENDPOINT}/messages/messages/${message._id}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          data: { type }
        }
      );

      if (response.data.success) {
        if (type === 'everyone') {
          const deletedMessage = response.data.data;
          setMessages(prev => prev.map(msg => 
            msg._id === message._id ? { ...msg, ...deletedMessage } : msg
          ));
          
          if (selectedConversation?.last_message?._id === message._id) {
            setConversations(prev => prev.map(conv => 
              conv._id === selectedConversation._id 
                ? { ...conv, last_message: deletedMessage }
                : conv
            ));
          }
        } else if (type === 'me') {
          setMessages(prev => prev.filter(msg => msg._id !== message._id));
        }
        
        Alert.alert('Success', 'Message deleted successfully');
        return true;
      }
    } catch (error) {
      console.error('❌ Error deleting message:', error);
      Alert.alert('Error', 'Failed to delete message');
      throw error;
    }
  };

  const sendMediaMessage = async (mediaType: 'image' | 'file', uri: string, fileName: string, mimeType: string) => {
    if (!selectedConversation || uploadingMedia) return;

    setUploadingMedia(true);

    try {
      const token = await AsyncStorage.getItem('authToken');
      
      const formData = new FormData();
      formData.append('receiver_id', selectedConversation.participant._id);
      formData.append('message_type', mediaType);

      // @ts-ignore
      const file = {
        uri,
        name: fileName,
        type: mimeType,
      };
      formData.append('file', file as any);

      const response = await axios.post(
        `${API_ENDPOINT}/messages/send-with-media`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        handlerRef.current?.(response.data.data);
        
        setTimeout(scrollToBottom, 150);
        
        Alert.alert('Success', 'Image sent successfully!');
      }
    } catch (error: any) {
      console.error('❌ Error sending media:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to send media');
    } finally {
      setUploadingMedia(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = asset.fileName || `image_${Date.now()}.jpg`;
        
        await sendMediaMessage('image', asset.uri, fileName, asset.mimeType || 'image/jpeg');
      }
    } catch (error) {
      console.error('❌ Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleDownloadFile = async (message: Message) => {
    if (!message.media_url) return;

    try {
      const fileUrl = buildMediaUrl(message.media_url);
      const fileName = message.media_name || `file_${Date.now()}`;

      Alert.alert(
        'Download File',
        `Do you want to download "${fileName}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Download',
            onPress: async () => {
              const downloadResumable = FileSystem.createDownloadResumable(
                fileUrl,
                ((FileSystem as any).documentDirectory || '') + fileName,
                {}
              );

              try {
                const result = await downloadResumable.downloadAsync();
                if (result && result.uri) {
                  const { uri } = result;
                  Alert.alert('Success', `File saved to: ${uri}`);

                  if (Platform.OS === 'android') {
                    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                      data: uri,
                      flags: 1,
                    });
                  }
                } else {
                  Alert.alert('Error', 'Download failed');
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to download file');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('❌ Error downloading file:', error);
      Alert.alert('Error', 'Failed to download file');
    }
  };

  // ==================== MESSAGE ACTIONS HANDLERS ====================
  const handleMessageLongPress = (message: Message) => {
    setSelectedMessage(message);
    setShowActionsMenu(true);
  };

  const handleEditMessage = (message: Message) => {
    setSelectedMessage(message);
    setShowEditModal(true);
  };

  const handleDeleteMessage = async (message: Message, type: 'me' | 'everyone') => {
    try {
      await deleteMessage(message, type);
    } catch (error) {
      // Error already handled in deleteMessage function
    }
  };

  // ==================== RENDER FUNCTIONS ====================
  const renderMessageContent = (message: Message) => {
    if (message.deleted) {
      return (
        <View style={styles.deletedMessageContainer}>
          <Ionicons name="trash-outline" size={16} color="#999" />
          <Text style={styles.deletedMessageText}>
            This message was deleted
          </Text>
        </View>
      );
    }

    switch (message.message_type) {
      case 'image':
        const imageUrl = buildMediaUrl(message.media_url);
        
        return (
          <ImageMessage
            message={message}
            isMyMessage={isMyMessage(message)}
            onPress={() => setPreviewImage(imageUrl)}
            onLongPress={() => handleMessageLongPress(message)}
          />
        );

      case 'file':
        return (
          <TouchableOpacity
            onPress={() => handleDownloadFile(message)}
            onLongPress={() => handleMessageLongPress(message)}
            style={styles.fileContainer}
            activeOpacity={0.7}
            delayLongPress={500}
          >
            <View style={styles.fileIconContainer}>
              <Ionicons name="document-attach" size={32} color="#4A90E2" />
            </View>

            <View style={styles.fileInfoContainer}>
              <Text style={styles.fileName} numberOfLines={2}>
                {message.media_name || 'Download file'}
              </Text>
              
              {message.media_size ? (
                <Text style={styles.fileSize}>
                  {formatFileSize(message.media_size)}
                </Text>
              ) : null}

              {message.message ? (
                <Text style={styles.fileMessage} numberOfLines={2}>
                  {message.message}
                </Text>
              ) : null}
            </View>

            <Ionicons name="download-outline" size={24} color="#4A90E2" />
          </TouchableOpacity>
        );

      default:
        return (
          <View>
            <Text style={[
              styles.messageText,
              isMyMessage(message) ? styles.myMessageText : styles.theirMessageText
            ]}>
              {message.message}
            </Text>
            {message.edited && (
              <Text style={[
                styles.editedText,
                isMyMessage(message) ? styles.myEditedText : styles.theirEditedText
              ]}>
                (edited)
              </Text>
            )}
          </View>
        );
    }
  };

  const renderMessageItem = ({ item, index }: { item: Message, index: number }) => {
    const isMe = isMyMessage(item);
    const showAvatar = shouldShowAvatar(item, index);
    const isLastInGroup = !isSameSender(item, messages[index + 1]);

    return (
      <TouchableOpacity
        onLongPress={() => handleMessageLongPress(item)}
        delayLongPress={500}
        activeOpacity={0.9}
        style={[
          styles.messageContainer,
          isMe ? styles.myMessageContainer : styles.theirMessageContainer
        ]}
      >
        {!isMe && showAvatar && (
          <Image
            source={{ uri: buildAvatarUrl(item.sender_id) }}
            style={styles.messageAvatar}
          />
        )}

        {!isMe && !showAvatar && (
          <View style={styles.avatarPlaceholder} />
        )}

        <View style={styles.messageContentContainer}>
          <View style={[
            styles.messageBubble,
            isMe ? styles.myMessageBubble : styles.theirMessageBubble,
            isLastInGroup && (isMe ? styles.myMessageBubbleGroup : styles.theirMessageBubbleGroup),
            item.deleted && styles.deletedMessageBubble
          ]}>
            {renderMessageContent(item)}
          </View>

          {isLastInGroup && !item.deleted && (
            <View style={styles.messageMetaContainer}>
              <Text style={styles.messageTime}>
                {safeFormatTime(item.timestamp || item.createdAt)}
              </Text>

              {isMe && item.read && (
                <View style={styles.readReceiptContainer}>
                  <Image
                    source={{ uri: buildAvatarUrl(item.receiver_id) }}
                    style={styles.readReceiptAvatar}
                  />
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ==================== INITIALIZATION ====================
  useEffect(() => {
    const init = async () => {
      try {
        const userDataStr = await AsyncStorage.getItem('userData');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          setCurrentUserId(userData._id);
          setCurrentUser(userData);
        }

        await connectSocket();
        await loadConversations();
      } catch (error) {
        console.error('❌ Initialization error:', error);
      }
    };

    init();

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // ==================== RENDER SELECTED CONVERSATION ====================
  if (selectedConversation) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
        
        {/* Image Preview Modal */}
        <ImagePreviewModal
          visible={!!previewImage}
          imageUrl={previewImage || ''}
          onClose={() => setPreviewImage(null)}
        />

        {/* Message Actions Menu */}
        <MessageActionsMenu
          visible={showActionsMenu}
          message={selectedMessage}
          onClose={() => setShowActionsMenu(false)}
          onEdit={handleEditMessage}
          onDelete={handleDeleteMessage}
          isMyMessage={selectedMessage ? isMyMessage(selectedMessage) : false}
        />

        {/* Edit Message Modal */}
        <EditMessageModal
          visible={showEditModal}
          message={selectedMessage}
          onClose={() => {
            setShowEditModal(false);
            setSelectedMessage(null);
          }}
          onSave={editMessage}
        />

        {/* Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity
            onPress={() => {
              setSelectedConversation(null);
              setMessages([]);
            }}
            style={styles.headerBackButton}
          >
            <Ionicons name="chevron-back" size={28} color="#000" />
          </TouchableOpacity>

          <View style={styles.headerUserInfo}>
            <View style={styles.headerAvatarContainer}>
              <Image
                source={{ uri: buildAvatarUrl(selectedConversation.participant) }}
                style={styles.headerAvatar}
              />
              {isSocketConnected && (
                <Animated.View 
                  style={[
                    styles.headerStatusDot,
                    styles.headerStatusDotActive,
                    { opacity: pulseAnim }
                  ]} 
                />
              )}
            </View>

            <View style={styles.headerUserDetails}>
              <Text style={styles.headerUserName}>
                {selectedConversation.participant.name}
              </Text>
              {typingUsers.length > 0 ? (
                <Text style={styles.headerUserStatusTyping}>
                  Typing...
                </Text>
              ) : (
                <Text style={styles.headerUserStatus}>
                  {selectedConversation.participant.role}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerActionButton}>
              <Ionicons name="call-outline" size={24} color="#4A90E2" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionButton}>
              <Ionicons name="videocam-outline" size={24} color="#4A90E2" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages List */}
        <View style={styles.chatContainer}>
          {messageLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#4A90E2" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item, index) => item._id || index.toString()}
              renderItem={renderMessageItem}
              contentContainerStyle={styles.messagesListContent}
              onContentSizeChange={scrollToBottom}
              onLayout={scrollToBottom}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyMessagesContainer}>
                  <Ionicons name="chatbubbles-outline" size={64} color="#CCC" />
                  <Text style={styles.emptyMessagesText}>
                    No messages yet. Start a conversation!
                  </Text>
                </View>
              }
            />
          )}
        </View>

        {/* Input Area */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.inputContainer}>
            {uploadingMedia ? (
              <View style={styles.uploadingIndicator}>
                <ActivityIndicator size="small" color="#4A90E2" />
                <Text style={styles.uploadingText}>Uploading image...</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  onPress={pickImage}
                  style={styles.inputActionButton}
                  disabled={uploadingMedia}
                >
                  <Ionicons name="image" size={28} color="#4A90E2" />
                </TouchableOpacity>

                <View style={styles.textInputContainer}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Type a message..."
                    placeholderTextColor="#999"
                    value={newMessage}
                    onChangeText={setNewMessage}
                    multiline
                    onFocus={() => {
                      if (socketRef.current?.connected && selectedConversation) {
                        socketRef.current.emit('typing_start', {
                          conversationId: selectedConversation._id
                        });
                      }
                    }}
                    onBlur={() => {
                      if (socketRef.current?.connected && selectedConversation) {
                        socketRef.current.emit('typing_stop', {
                          conversationId: selectedConversation._id
                        });
                      }
                    }}
                  />

                  <TouchableOpacity style={styles.emojiButton}>
                    <Ionicons name="happy-outline" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={sendTextMessage}
                  style={styles.sendButton}
                  disabled={!newMessage.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="send" size={20} color="#FFF" />
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ==================== RENDER CONVERSATIONS LIST ====================
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      {/* Conversations Header */}
      <View style={styles.conversationsHeader}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Home' as never)}
          activeOpacity={0.8}
          style={styles.homeButton}
        >
          <Ionicons name="home" size={24} color="#0084FF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Chats</Text>

        <TouchableOpacity style={styles.editButton}>
          <Ionicons name="create-outline" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInnerContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="#999"
          />
        </View>
      </View>

      {/* Conversations List */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0084FF" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.conversationsListContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadConversations();
              }}
              colors={['#0084FF']}
              tintColor="#0084FF"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyConversationsContainer}>
              <Ionicons name="chatbubbles-outline" size={80} color="#DDD" />
              <Text style={styles.emptyConversationsText}>
                No conversations yet
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                setSelectedConversation(item);
                loadMessages(item._id);
              }}
              style={styles.conversationItem}
              activeOpacity={0.7}
            >
              <View style={styles.conversationAvatarContainer}>
                <Image
                  source={{ uri: buildAvatarUrl(item.participant) }}
                  style={styles.conversationAvatar}
                />
                {isSocketConnected && (
                  <Animated.View 
                    style={[
                      styles.conversationStatusRing,
                      { opacity: pulseAnim }
                    ]} 
                  />
                )}
              </View>

              <View style={styles.conversationContent}>
                <View style={styles.conversationHeaderRow}>
                  <Text style={[
                    styles.conversationName,
                    item.unread_count > 0 && styles.unreadConversationName
                  ]} numberOfLines={1}>
                    {item.participant.name}
                  </Text>

                  <Text style={styles.conversationTime}>
                    {safeFormatTime(item.last_message_at)}
                  </Text>
                </View>

                <View style={styles.conversationLastMessageRow}>
                  <Text style={[
                    styles.conversationLastMessage,
                    item.unread_count > 0 && styles.unreadConversationLastMessage
                  ]} numberOfLines={2}>
                    {item.last_message?.deleted 
                      ? 'This message was deleted'
                      : item.last_message?.message_type === 'image' 
                      ? '📷 Image' 
                      : item.last_message?.message_type === 'file'
                      ? '📎 File'
                      : item.last_message?.message || 'Start a conversation'}
                  </Text>

                  {item.unread_count > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {item.unread_count > 99 ? '99+' : item.unread_count}
                      </Text>
                    </View>
                  ) : (
                    <Ionicons name="checkmark-done" size={16} color="#4A90E2" />
                  )}
                </View>

                {item.medical_record_id && (
                  <View style={styles.medicalRecordBadge}>
                    <Ionicons name="document-text" size={12} color="#0084FF" />
                    <Text style={styles.medicalRecordText}>Medical Record</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
};

// ==================== STYLES ====================
const styles = StyleSheet.create({
  // Base
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Conversations List
  conversationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000',
  },
  homeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0084FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E1F0FF',
  },
  editButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchInnerContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#000',
  },
  conversationsListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
  },
  conversationAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  conversationAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  conversationStatusRing: {
    position: 'absolute',
    bottom: 0,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#31A24C',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#050505',
    flex: 1,
  },
  unreadConversationName: {
    fontWeight: '700',
    color: '#000',
  },
  conversationTime: {
    fontSize: 12,
    color: '#65676B',
  },
  conversationLastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conversationLastMessage: {
    fontSize: 14,
    color: '#65676B',
    flex: 1,
    marginRight: 8,
  },
  unreadConversationLastMessage: {
    color: '#000',
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#0084FF',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  medicalRecordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  medicalRecordText: {
    fontSize: 12,
    color: '#0084FF',
    marginLeft: 4,
    fontWeight: '500',
  },
  emptyConversationsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyConversationsText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },

  // Chat Screen
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#FFF',
  },
  headerBackButton: {
    padding: 6,
    marginRight: 4,
  },
  headerUserInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  headerStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#CCC',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  headerStatusDotActive: {
    backgroundColor: '#31A24C',
  },
  headerUserDetails: {
    flex: 1,
  },
  headerUserName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  headerUserStatus: {
    fontSize: 13,
    color: '#65676B',
  },
  headerUserStatusTyping: {
    fontSize: 13,
    color: '#0084FF',
    fontStyle: 'italic',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    padding: 6,
  },
  chatContainer: {
    flex: 1,
  },
  messagesListContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  emptyMessagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  emptyMessagesText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  theirMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    marginRight: 8,
  },
  messageContentContainer: {
    maxWidth: '75%',
  },
  messageBubble: {
    borderRadius: 20,
    padding: 12,
    marginBottom: 2,
  },
  myMessageBubble: {
    backgroundColor: '#0084FF',
    borderBottomRightRadius: 4,
  },
  myMessageBubbleGroup: {
    borderBottomRightRadius: 20,
  },
  theirMessageBubble: {
    backgroundColor: '#E4E6EB',
    borderBottomLeftRadius: 4,
  },
  theirMessageBubbleGroup: {
    borderBottomLeftRadius: 20,
  },
  deletedMessageBubble: {
    backgroundColor: 'rgba(228, 230, 235, 0.5)',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: '#FFF',
  },
  theirMessageText: {
    color: '#050505',
  },
  editedText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  myEditedText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  theirEditedText: {
    color: 'rgba(101, 103, 107, 0.7)',
  },
  messageMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  messageTime: {
    fontSize: 12,
    color: '#65676B',
    marginRight: 6,
  },
  readReceiptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readReceiptAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },

  // Deleted Message
  deletedMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deletedMessageText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
    marginLeft: 4,
  },

  // Media Message Styles
  imageMessageContainer: {
    position: 'relative',
    borderRadius: 18,
    overflow: 'hidden',
  },
  mediaImage: {
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageErrorText: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 4,
  },
  imageCaptionContainer: {
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 8,
    borderRadius: 12,
  },
  imageCaption: {
    fontSize: 14,
    color: '#333',
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    minWidth: width * 0.5,
  },
  fileIconContainer: {
    marginRight: 12,
  },
  fileInfoContainer: {
    flex: 1,
    marginRight: 12,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  fileMessage: {
    fontSize: 13,
    color: '#666',
  },

  // Input Area
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E5E5E5',
  },
  uploadingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  uploadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '500',
  },
  inputActionButton: {
    padding: 8,
    marginRight: 4,
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    borderRadius: 20,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    minHeight: 40,
    maxHeight: 100,
  },
  textInput: {
    flex: 1,
    color: '#000',
    fontSize: 16,
    paddingVertical: 8,
    maxHeight: 80,
  },
  emojiButton: {
    padding: 4,
    marginLeft: 4,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0084FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },

  // Image Preview Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  imageContainer: {
    width: '100%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  imageLoading: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    marginTop: 12,
    fontSize: 14,
  },
  imageError: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FFF',
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0084FF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Action Sheet Styles
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  actionSheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5E5',
  },
  actionSheetIcon: {
    marginRight: 12,
  },
  actionSheetText: {
    fontSize: 16,
    color: '#000',
  },
  destructiveText: {
    color: '#FF3B30',
  },
  cancelButton: {
    borderBottomWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },

  // Edit Modal Styles
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  editTextInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  editModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  editCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  editCancelText: {
    fontSize: 16,
    color: '#666',
  },
  editSaveButton: {
    backgroundColor: '#0084FF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editSaveButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  editSaveText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
});

export default MessageScreen;