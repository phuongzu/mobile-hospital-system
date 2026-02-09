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
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Haptics from 'expo-haptics';
import { MediaTypeOptions, launchImageLibraryAsync } from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io, { Socket } from 'socket.io-client';

const { width, height } = Dimensions.get('window');

// ==================== CONSTANTS ====================
const COLORS = {
  primary: '#0084FF',
  primaryDark: '#0066CC',
  primaryLight: '#E7F3FF',
  success: '#00C853',
  error: '#FF3B30',
  warning: '#FF9500',
  background: '#FFFFFF',
  backgroundSecondary: '#F0F2F5',
  text: '#050505',
  textSecondary: '#65676B',
  textLight: '#B0B3B8',
  border: '#E4E6EB',
  messageBubbleMe: '#0084FF',
  messageBubbleThem: '#E4E6EB',
  online: '#31A24C',
  offline: '#8E8E93',
};

const SIZES = {
  avatarSmall: 32,
  avatarMedium: 40,
  avatarLarge: 56,
  iconSmall: 20,
  iconMedium: 24,
  iconLarge: 28,
  borderRadius: 20,
  spacing: 12,
};

// ==================== INTERFACES ====================
interface User {
  _id: string;
  name: string;
  avatar?: string;
  role: string;
}

interface Reaction {
  user_id: User;
  emoji: string;
  createdAt: string;
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
  read_at?: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
  edited?: boolean;
  edited_at?: string;
  deleted?: boolean;
  deleted_at?: string;
  deleted_by?: string;
  reactions?: Reaction[];
  reactions_count?: number;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

interface Conversation {
  _id: string;
  participant: User;
  last_message?: Message;
  last_message_at: string;
  unread_count: number;
  medical_record_id?: string;
  appointment_id?: string;
}

interface GroupedReaction {
  emoji: string;
  count: number;
  users: User[];
  isReactedByMe: boolean;
}

const API_BASE_URL = 'http://localhost:3000';
const API_ENDPOINT = `${API_BASE_URL}/api`;

// ==================== UTILITY FUNCTIONS ====================
const buildMediaUrl = (mediaUrl: string | null | undefined): string => {
  if (!mediaUrl) return '';
  if (mediaUrl.startsWith('http')) return mediaUrl;
  const baseUrl = API_BASE_URL;
  const cleanUrl = mediaUrl.startsWith('/') ? mediaUrl : `/${mediaUrl}`;
  return `${baseUrl}${cleanUrl}`;
};

const buildAvatarUrl = (user?: User): string => {
  if (!user?.avatar) {
    return `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=0084FF&color=fff&size=150&bold=true`;
  }
  if (user.avatar.startsWith('http')) return user.avatar;
  return `${API_BASE_URL}${user.avatar.startsWith('/') ? user.avatar : `/uploads/avatars/${user.avatar}`}`;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatTime = (dateStr?: string | number | Date): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

const formatMessageTime = (dateStr?: string | number | Date): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ==================== ANIMATED COMPONENTS ====================
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PressableScale = ({ children, onPress, onLongPress, style, ...props }: any) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, { transform: [{ scale: scaleAnim }] }]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
};

// ==================== TOAST COMPONENT ====================
const Toast = memo(({ message, type }: { message: string; type: 'success' | 'error' | 'info' }) => {
  const slideAnim = useRef(new Animated.Value(100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const backgroundColor = 
    type === 'success' ? COLORS.success : 
    type === 'error' ? COLORS.error : 
    COLORS.primary;

  const icon = 
    type === 'success' ? 'checkmark-circle' : 
    type === 'error' ? 'alert-circle' : 
    'information-circle';

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color="#FFF" />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
});

// ==================== IMAGE MESSAGE COMPONENT ====================
const ImageMessage = memo(({
  message,
  isMyMessage,
  onPress,
  onLongPress,
  onReactionPress,
  reactions,
}: {
  message: Message;
  isMyMessage: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onReactionPress?: () => void;
  reactions?: GroupedReaction[];
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const imageUrl = buildMediaUrl(message.media_url);

  return (
    <View style={styles.imageMessageWrapper}>
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.imageMessageContainer}
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
            <Ionicons name="image-outline" size={32} color="#FFF" />
            <Text style={styles.imageErrorText}>Failed to load</Text>
          </View>
        )}

        {message.message && (
          <View style={styles.imageCaptionContainer}>
            <Text style={styles.imageCaption}>{message.message}</Text>
          </View>
        )}
      </PressableScale>

      {reactions && reactions.length > 0 && (
        <View style={[
          styles.reactionsContainer,
          isMyMessage && styles.reactionsContainerRight
        ]}>
          {reactions.map((reaction, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.reactionBubble,
                reaction.isReactedByMe && styles.reactionBubbleActive
              ]}
              onPress={onReactionPress}
              activeOpacity={0.7}
            >
              <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              {reaction.count > 1 && (
                <Text style={styles.reactionCount}>{reaction.count}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
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
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setLoading(true);
      setError(false);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
  }, [visible, imageUrl]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.modalOverlay, { opacity: opacityAnim }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.imageContainer}>
            {loading && !error && (
              <View style={styles.imageLoading}>
                <ActivityIndicator size="large" color="#FFF" />
                <Text style={styles.loadingText}>Loading...</Text>
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
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});

// ==================== EMOJI REACTION PICKER ====================
const EMOJI_REACTIONS = ['❤️', '😂', '😮', '😢', '😠', '👍', '👎', '🔥'];

const EmojiReactionPicker = memo(({
  visible,
  onClose,
  onEmojiSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
}) => {
  const slideAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(100);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.emojiPickerBackdrop}>
        <TouchableWithoutFeedback>
          <Animated.View
            style={[
              styles.emojiPickerContainer,
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            <View style={styles.emojiPickerHandle} />
            <Text style={styles.emojiPickerTitle}>React to message</Text>
            
            <View style={styles.emojiPickerContent}>
              {EMOJI_REACTIONS.map((emoji, index) => (
                <PressableScale
                  key={index}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onEmojiSelect(emoji);
                    onClose();
                  }}
                  style={styles.emojiButton}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </PressableScale>
              ))}
            </View>
          </Animated.View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
});

// ==================== EDIT MESSAGE MODAL ====================
const EditMessageModal = memo(({
  visible,
  message,
  onClose,
  onSave,
}: {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
  onSave: (messageId: string, newMessage: string) => Promise<void>;
}) => {
  const [editingText, setEditingText] = useState('');
  const [saving, setSaving] = useState(false);
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible && message) {
      setEditingText(message.message);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(height);
    }
  }, [visible, message]);

  const handleSave = async () => {
    if (!message || !editingText.trim()) return;

    setSaving(true);
    try {
      await onSave(message._id, editingText.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Error saving message:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.editModalOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.editModalContent,
                { transform: [{ translateY: slideAnim }] }
              ]}
            >
              <View style={styles.editModalHeader}>
                <Text style={styles.editModalTitle}>Edit Message</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.editTextInput}
                value={editingText}
                onChangeText={setEditingText}
                multiline
                autoFocus
                placeholder="Edit your message..."
                placeholderTextColor={COLORS.textLight}
                maxLength={1000}
              />

              <View style={styles.editModalFooter}>
                <TouchableOpacity
                  style={styles.editCancelButton}
                  onPress={onClose}
                  disabled={saving}
                  activeOpacity={0.7}
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
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.editSaveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// ==================== MESSAGE ACTIONS MODAL ====================
const MessageActionsModal = memo(({
  visible,
  message,
  isMyMessage,
  onClose,
  onEdit,
  onDelete,
  onReact,
  onCopy,
}: {
  visible: boolean;
  message: Message | null;
  isMyMessage: boolean;
  onClose: () => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message, type: 'me' | 'everyone') => void;
  onReact: (message: Message) => void;
  onCopy: (message: Message) => void;
}) => {
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(height);
    }
  }, [visible]);

  if (!visible || !message || Platform.OS === 'ios') return null;

  const actionItems = [
    {
      label: 'React',
      icon: 'heart-outline',
      color: COLORS.primary,
      onPress: () => {
        onReact(message);
        onClose();
      },
    },
    ...(isMyMessage && message.message_type === 'text' && !message.deleted
      ? [{
          label: 'Edit',
          icon: 'create-outline',
          color: COLORS.text,
          onPress: () => {
            onEdit(message);
            onClose();
          },
        }]
      : []
    ),
    {
      label: 'Copy',
      icon: 'copy-outline',
      color: COLORS.text,
      onPress: () => {
        onCopy(message);
        onClose();
      },
    },
    {
      label: 'Delete for me',
      icon: 'trash-outline',
      color: COLORS.error,
      onPress: () => {
        onDelete(message, 'me');
        onClose();
      },
    },
    ...(isMyMessage
      ? [{
          label: 'Delete for everyone',
          icon: 'trash-bin-outline',
          color: COLORS.error,
          onPress: () => {
            onDelete(message, 'everyone');
            onClose();
          },
        }]
      : []
    ),
  ];

  return (
    <Modal
      visible={visible && Platform.OS === 'android'}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.actionSheetOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.actionSheetContainer,
                { transform: [{ translateY: slideAnim }] }
              ]}
            >
              <View style={styles.actionSheetHandle} />
              
              {actionItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.actionSheetButton}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <Ionicons name={item.icon as any} size={22} color={item.color} style={styles.actionSheetIcon} />
                  <Text style={[styles.actionSheetText, { color: item.color }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={[styles.actionSheetButton, styles.cancelButton]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// ==================== REACTIONS VIEW MODAL ====================
const ReactionsViewModal = memo(({
  visible,
  reactions,
  onClose,
}: {
  visible: boolean;
  reactions: GroupedReaction[];
  onClose: () => void;
}) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.reactionsModalOverlay, { opacity: opacityAnim }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.reactionsModalContent,
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          <View style={styles.reactionsModalHeader}>
            <Text style={styles.reactionsModalTitle}>Reactions</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.reactionsModalList} showsVerticalScrollIndicator={false}>
            {reactions.map((reaction, index) => (
              <View key={index} style={styles.reactionItem}>
                <View style={styles.reactionItemEmojiContainer}>
                  <Text style={styles.reactionItemEmoji}>{reaction.emoji}</Text>
                  <Text style={styles.reactionItemCountBadge}>{reaction.count}</Text>
                </View>
                
                <View style={styles.reactionItemUsers}>
                  {reaction.users.map((user, userIndex) => (
                    <View key={userIndex} style={styles.reactionUserItem}>
                      <Image
                        source={{ uri: buildAvatarUrl(user) }}
                        style={styles.reactionUserAvatar}
                      />
                      <Text style={styles.reactionItemUserName} numberOfLines={1}>
                        {user.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});

// ==================== MAIN COMPONENT ====================
const MessageScreen = () => {
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<Socket | null>(null);
  const selectedConvRef = useRef<Conversation | null>(null);
  const handlerRef = useRef<((msg: any) => void) | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State Management
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
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [toastVisible, setToastVisible] = useState(false);

  // Modal & UI State
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReactionsView, setShowReactionsView] = useState(false);
  const [messageReactions, setMessageReactions] = useState<GroupedReaction[]>([]);

  // Online status
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [lastSeen, setLastSeen] = useState<Record<string, string>>({});
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Toast notification handler
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);

    setTimeout(() => {
      setToastVisible(false);
    }, 3000);
  }, []);

  // ==================== EFFECTS ====================
  useEffect(() => {
    selectedConvRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    if (isSocketConnected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
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

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 100);
  }, []);

  // Typing indicator
  const emitTypingStart = useCallback(() => {
    if (socketRef.current?.connected && selectedConversation) {
      socketRef.current.emit('typing_start', {
        conversationId: selectedConversation._id,
        userId: currentUserId,
      });
    }
  }, [selectedConversation, currentUserId]);

  const emitTypingStop = useCallback(() => {
    if (socketRef.current?.connected && selectedConversation) {
      socketRef.current.emit('typing_stop', {
        conversationId: selectedConversation._id,
        userId: currentUserId,
      });
    }
  }, [selectedConversation, currentUserId]);

  const handleTextChange = (text: string) => {
    setNewMessage(text);

    if (text.length > 0) {
      emitTypingStart();
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        emitTypingStop();
      }, 1000);
    } else {
      emitTypingStop();
    }
  };

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
      reactions: rawMsg.reactions || rawMsg.message?.reactions || [],
      reactions_count: rawMsg.reactions_count || rawMsg.message?.reactions_count || 0,
    };

    const convId = normalizedMsg.conversation_id;
    const active = selectedConvRef.current;

    // Update conversations list
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

    // Update messages list if active conversation
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

      setTimeout(() => scrollToBottom(), 150);
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

      // Message events
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

      // Reaction events
      socketRef.current.on('reaction_added', (data) => {
        if (data.conversationId === selectedConvRef.current?._id && data.message) {
          setMessages(prev => prev.map(msg =>
            msg._id === data.messageId
              ? { 
                  ...msg, 
                  reactions: data.message.reactions || [],
                  reactions_count: data.message.reactions_count || 0 
                }
              : msg
          ));
        }
      });

      socketRef.current.on('reaction_removed', (data) => {
        if (data.conversationId === selectedConvRef.current?._id && data.message) {
          setMessages(prev => prev.map(msg =>
            msg._id === data.messageId
              ? { 
                  ...msg, 
                  reactions: data.message.reactions || [],
                  reactions_count: data.message.reactions_count || 0 
                }
              : msg
          ));
        }
      });

      // Typing events
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

      // Read receipts
      socketRef.current.on('messages_read', (data) => {
        if (data.conversationId === selectedConvRef.current?._id) {
          setMessages(prev => prev.map(msg => ({
            ...msg,
            read: msg.sender_id._id === currentUserId ? true : msg.read
          })));
        }
      });

      // Online status
      socketRef.current.on('user_online', (data) => {
        setOnlineUsers(prev => new Set([...prev, data.userId]));
      });

      socketRef.current.on('user_offline', (data) => {
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.userId);
          return newSet;
        });
        if (data.lastSeen) {
          setLastSeen(prev => ({
            ...prev,
            [data.userId]: data.lastSeen || ''
          }));
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
          medical_record_id: conv.medical_record_id,
          appointment_id: conv.appointment_id
        }));
        setConversations(formattedConversations);
      }
    } catch (error) {
      console.error('❌ Error loading conversations:', error);
      showToast('Failed to load conversations', 'error');
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

        setTimeout(() => scrollToBottom(false), 300);
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      showToast('Failed to load messages', 'error');
    } finally {
      setMessageLoading(false);
    }
  };

  const sendTextMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    const msgText = newMessage.trim();
    setNewMessage('');
    setSending(true);
    emitTypingStop();

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
      status: 'sending',
    };

    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => scrollToBottom(), 100);

    try {
      const token = await AsyncStorage.getItem('authToken');

      if (socketRef.current?.connected) {
        socketRef.current.emit('send_message', {
          conversationId: selectedConversation._id,
          receiverId: selectedConversation.participant._id,
          message: msgText,
          messageType: 'text'
        });
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
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSending(false);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setMessages(prev => prev.filter(m => m._id !== tempId));
      showToast('Failed to send message', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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

        showToast('Message edited', 'success');
      }
    } catch (error) {
      console.error('❌ Error editing message:', error);
      showToast('Failed to edit message', 'error');
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

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('Message deleted', 'success');
        return true;
      }
    } catch (error) {
      console.error('❌ Error deleting message:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast('Failed to delete message', 'error');
      throw error;
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    try {
      const token = await AsyncStorage.getItem('authToken');

      const response = await axios.post(
        `${API_ENDPOINT}/messages/messages/${messageId}/react`,
        { reaction: emoji },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.data.success) {
        const updatedMessage = response.data.data.message;
        setMessages(prev => prev.map(msg =>
          msg._id === messageId ? updatedMessage : msg
        ));

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        showToast(`Reacted with ${emoji}`, 'success');
      }
    } catch (error) {
      console.error('❌ Error adding reaction:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast('Failed to add reaction', 'error');
    }
  };

  const getMessageReactions = async (messageId: string) => {
    try {
      const token = await AsyncStorage.getItem('authToken');

      const response = await axios.get(
        `${API_ENDPOINT}/messages/messages/${messageId}/reactions`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.data.success) {
        setMessageReactions(response.data.data.reactions || []);
        setShowReactionsView(true);
      }
    } catch (error) {
      console.error('❌ Error fetching reactions:', error);
      showToast('Failed to load reactions', 'error');
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
        setTimeout(() => scrollToBottom(), 150);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('Media sent!', 'success');
      }
    } catch (error: any) {
      console.error('❌ Error sending media:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(error.response?.data?.message || 'Failed to send media', 'error');
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
      showToast('Failed to pick image', 'error');
    }
  };

  const handleDownloadFile = async (message: Message) => {
    if (!message.media_url) return;

    try {
      const fileUrl = buildMediaUrl(message.media_url);
      const fileName = message.media_name || `file_${Date.now()}`;

      Alert.alert(
        'Download File',
        `Download "${fileName}"?`,
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
                  showToast('File downloaded!', 'success');

                  if (Platform.OS === 'android') {
                    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                      data: uri,
                      flags: 1,
                    });
                  }
                } else {
                  showToast('Download failed', 'error');
                }
              } catch (error) {
                showToast('Failed to download file', 'error');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('❌ Error downloading file:', error);
      showToast('Failed to download file', 'error');
    }
  };

  // ==================== MESSAGE ACTIONS ====================
  const handleMessageLongPress = (message: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessage(message);
    setShowActionsMenu(true);

    if (Platform.OS === 'ios') {
      const options: string[] = [];
      const destructiveButtonIndexes: number[] = [];

      options.push('React');

      if (isMyMessage(message) && message.message_type === 'text' && !message.deleted) {
        options.push('Edit');
      }

      options.push('Copy');

      if (isMyMessage(message)) {
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
            case 'React':
              setShowEmojiPicker(true);
              break;
            case 'Edit':
              handleEditMessage(message);
              break;
            case 'Copy':
              handleCopyMessage(message);
              break;
            case 'Delete for me':
              handleDeleteMessage(message, 'me');
              break;
            case 'Delete for everyone':
              handleDeleteMessage(message, 'everyone');
              break;
          }
        }
      );
    }
  };

  const handleEditMessage = (message: Message) => {
    setSelectedMessage(message);
    setShowEditModal(true);
  };

  const handleDeleteMessage = async (message: Message, type: 'me' | 'everyone') => {
    Alert.alert(
      'Delete Message',
      `Delete this message for ${type === 'everyone' ? 'everyone' : 'you only'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessage(message, type);
            } catch (error) {
              console.error('Error deleting message:', error);
            }
          }
        }
      ]
    );
  };

  const handleReactMessage = (message: Message) => {
    setSelectedMessage(message);
    setShowEmojiPicker(true);
  };

  const handleCopyMessage = async (message: Message) => {
    await Clipboard.setStringAsync(message.message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast('Copied to clipboard', 'success');
  };

  const handleReactionSelect = async (emoji: string) => {
    if (selectedMessage) {
      await addReaction(selectedMessage._id, emoji);
      setShowEmojiPicker(false);
    }
  };

  // ==================== RENDER FUNCTIONS ====================
  const renderMessageContent = (message: Message) => {
    if (message.deleted) {
      return (
        <View style={styles.deletedMessageContainer}>
          <Ionicons name="ban-outline" size={14} color={COLORS.textLight} />
          <Text style={styles.deletedMessageText}>Message deleted</Text>
        </View>
      );
    }

    // Group reactions by emoji
    const groupedReactions: Record<string, GroupedReaction> = {};
    (message.reactions || []).forEach(reaction => {
      if (!groupedReactions[reaction.emoji]) {
        groupedReactions[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: [],
          isReactedByMe: false
        };
      }
      groupedReactions[reaction.emoji].count++;
      groupedReactions[reaction.emoji].users.push(reaction.user_id);
      if (reaction.user_id._id === currentUserId) {
        groupedReactions[reaction.emoji].isReactedByMe = true;
      }
    });
    const reactions = Object.values(groupedReactions);

    switch (message.message_type) {
      case 'image':
        const imageUrl = buildMediaUrl(message.media_url);

        return (
          <ImageMessage
            message={message}
            isMyMessage={isMyMessage(message)}
            onPress={() => setPreviewImage(imageUrl)}
            onLongPress={() => handleMessageLongPress(message)}
            onReactionPress={() => getMessageReactions(message._id)}
            reactions={reactions}
          />
        );

      case 'file':
        return (
          <View>
            <PressableScale
              onPress={() => handleDownloadFile(message)}
              onLongPress={() => handleMessageLongPress(message)}
              style={styles.fileContainer}
            >
              <View style={styles.fileIconContainer}>
                <Ionicons name="document-attach" size={28} color={COLORS.primary} />
              </View>

              <View style={styles.fileInfoContainer}>
                <Text style={styles.fileName} numberOfLines={2}>
                  {message.media_name || 'Download file'}
                </Text>

                {message.media_size && (
                  <Text style={styles.fileSize}>
                    {formatFileSize(message.media_size)}
                  </Text>
                )}

                {message.message && (
                  <Text style={styles.fileMessage} numberOfLines={2}>
                    {message.message}
                  </Text>
                )}
              </View>

              <Ionicons name="download-outline" size={20} color={COLORS.primary} />
            </PressableScale>

            {reactions.length > 0 && (
              <View style={[
                styles.reactionsContainer,
                isMyMessage(message) && styles.reactionsContainerRight
              ]}>
                {reactions.map((reaction, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.reactionBubble,
                      reaction.isReactedByMe && styles.reactionBubbleActive
                    ]}
                    onPress={() => getMessageReactions(message._id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                    {reaction.count > 1 && (
                      <Text style={styles.reactionCount}>{reaction.count}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
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
                Edited
              </Text>
            )}

            {reactions.length > 0 && (
              <View style={[
                styles.reactionsContainer,
                isMyMessage(message) && styles.reactionsContainerRight
              ]}>
                {reactions.map((reaction, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.reactionBubble,
                      reaction.isReactedByMe && styles.reactionBubbleActive
                    ]}
                    onPress={() => getMessageReactions(message._id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                    {reaction.count > 1 && (
                      <Text style={styles.reactionCount}>{reaction.count}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        );
    }
  };

  const renderMessageItem = ({ item, index }: { item: Message; index: number }) => {
    const isMe = isMyMessage(item);
    const showAvatar = shouldShowAvatar(item, index);
    const prevMessage = messages[index - 1];
    const isFirstInGroup = !prevMessage || !isSameSender(prevMessage, item);
    const nextMessage = messages[index + 1];
    const isLastInGroup = !nextMessage || !isSameSender(item, nextMessage);

    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.myMessageRow : styles.theirMessageRow,
          isFirstInGroup && styles.messageRowFirst,
        ]}
      >
        {!isMe && (
          <View style={styles.avatarContainer}>
            {showAvatar ? (
              <Image
                source={{ uri: buildAvatarUrl(item.sender_id) }}
                style={styles.messageAvatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}
          </View>
        )}

        <PressableScale
          onLongPress={() => handleMessageLongPress(item)}
          style={[
            styles.messageBubble,
            isMe ? styles.myMessageBubble : styles.theirMessageBubble,
            isFirstInGroup && (isMe ? styles.myMessageBubbleFirst : styles.theirMessageBubbleFirst),
            isLastInGroup && (isMe ? styles.myMessageBubbleLast : styles.theirMessageBubbleLast),
            item.deleted && styles.deletedMessageBubble
          ]}
        >
          {renderMessageContent(item)}
        </PressableScale>

        {isMe && isLastInGroup && !item.deleted && (
          <View style={styles.readReceiptContainer}>
            {item.read ? (
              <Ionicons name="checkmark-done" size={16} color={COLORS.primary} />
            ) : (
              <Ionicons name="checkmark" size={16} color={COLORS.textLight} />
            )}
          </View>
        )}
      </View>
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
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // ==================== RENDER SELECTED CONVERSATION ====================
  if (selectedConversation) {
    const participantOnline = onlineUsers.has(selectedConversation.participant._id);
    const participantLastSeen = lastSeen[selectedConversation.participant._id];

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

        {/* Modals */}
        <ImagePreviewModal
          visible={!!previewImage}
          imageUrl={previewImage || ''}
          onClose={() => setPreviewImage(null)}
        />

        <MessageActionsModal
          visible={showActionsMenu}
          message={selectedMessage}
          isMyMessage={selectedMessage ? isMyMessage(selectedMessage) : false}
          onClose={() => setShowActionsMenu(false)}
          onEdit={handleEditMessage}
          onDelete={handleDeleteMessage}
          onReact={handleReactMessage}
          onCopy={handleCopyMessage}
        />

        <EditMessageModal
          visible={showEditModal}
          message={selectedMessage}
          onClose={() => {
            setShowEditModal(false);
            setSelectedMessage(null);
          }}
          onSave={editMessage}
        />

        <EmojiReactionPicker
          visible={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onEmojiSelect={handleReactionSelect}
        />

        <ReactionsViewModal
          visible={showReactionsView}
          reactions={messageReactions}
          onClose={() => setShowReactionsView(false)}
        />

        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity
            onPress={() => {
              setSelectedConversation(null);
              setMessages([]);
              emitTypingStop();
            }}
            style={styles.headerBackButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={28} color={COLORS.primary} />
          </TouchableOpacity>

          <View style={styles.headerUserInfo}>
            <View style={styles.headerAvatarContainer}>
              <Image
                source={{ uri: buildAvatarUrl(selectedConversation.participant) }}
                style={styles.headerAvatar}
              />
              {isSocketConnected && participantOnline && (
                <Animated.View
                  style={[
                    styles.headerStatusDot,
                    { opacity: pulseAnim }
                  ]}
                />
              )}
            </View>

            <View style={styles.headerUserDetails}>
              <Text style={styles.headerUserName} numberOfLines={1}>
                {selectedConversation.participant.name}
              </Text>
              {typingUsers.length > 0 ? (
                <Text style={styles.headerUserStatusTyping}>Typing...</Text>
              ) : participantOnline ? (
                <Text style={styles.headerUserStatusOnline}>Active now</Text>
              ) : participantLastSeen ? (
                <Text style={styles.headerUserStatus}>
                  Active {formatTime(participantLastSeen)}
                </Text>
              ) : (
                <Text style={styles.headerUserStatus}>
                  {selectedConversation.participant.role}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerActionButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="call-outline" size={22} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="videocam-outline" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="information-circle-outline" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages List */}
        <View style={styles.chatContainer}>
          {messageLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item, index) => item._id || index.toString()}
              renderItem={renderMessageItem}
              contentContainerStyle={styles.messagesListContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyMessagesContainer}>
                  <Ionicons name="chatbubble-ellipses-outline" size={64} color={COLORS.border} />
                  <Text style={styles.emptyMessagesText}>
                    No messages yet
                  </Text>
                  <Text style={styles.emptyMessagesSubtext}>
                    Start the conversation!
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
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.uploadingText}>Sending...</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  onPress={pickImage}
                  style={styles.inputActionButton}
                  disabled={uploadingMedia}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="images" size={24} color={COLORS.primary} />
                </TouchableOpacity>

                <View style={styles.textInputContainer}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Message..."
                    placeholderTextColor={COLORS.textLight}
                    value={newMessage}
                    onChangeText={handleTextChange}
                    multiline
                    maxLength={1000}
                  />
                </View>

                {newMessage.trim() ? (
                  <TouchableOpacity
                    style={styles.sendButton}
                    onPress={sendTextMessage}
                    disabled={sending}
                    activeOpacity={0.8}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Ionicons name="send" size={18} color="#FFF" />
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.inputActionButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="happy-outline" size={24} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>

        {/* Toast */}
        {toastVisible && (
          <Toast message={toastMessage} type={toastType} />
        )}
      </SafeAreaView>
    );
  }

  // ==================== RENDER CONVERSATIONS LIST ====================
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.conversationsHeader}>
        <View style={styles.headerLeft}>
          <PressableScale
            onPress={() => navigation.navigate('Home' as never)}
            style={styles.homeButton}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </PressableScale>
          <Text style={styles.headerTitle}>Chats</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="create-outline" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInnerContainer}>
          <Ionicons name="search" size={18} color={COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={COLORS.textLight}
          />
        </View>
      </View>

      {/* Conversations List */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
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
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyConversationsContainer}>
              <Ionicons name="chatbubbles-outline" size={80} color={COLORS.border} />
              <Text style={styles.emptyConversationsText}>
                No conversations
              </Text>
              <Text style={styles.emptyConversationsSubtext}>
                Start chatting with your contacts
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => {
                setSelectedConversation(item);
                loadMessages(item._id);
              }}
              style={styles.conversationItem}
            >
              <View style={styles.conversationAvatarContainer}>
                <Image
                  source={{ uri: buildAvatarUrl(item.participant) }}
                  style={styles.conversationAvatar}
                />
                {isSocketConnected && onlineUsers.has(item.participant._id) && (
                  <Animated.View
                    style={[
                      styles.conversationStatusDot,
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

                  <Text style={[
                    styles.conversationTime,
                    item.unread_count > 0 && styles.unreadConversationTime
                  ]}>
                    {formatTime(item.last_message_at)}
                  </Text>
                </View>

                <View style={styles.conversationLastMessageRow}>
                  <Text style={[
                    styles.conversationLastMessage,
                    item.unread_count > 0 && styles.unreadConversationLastMessage
                  ]} numberOfLines={1}>
                    {item.last_message?.deleted
                      ? 'Message deleted'
                      : item.last_message?.message_type === 'image'
                      ? '📷 Photo'
                      : item.last_message?.message_type === 'file'
                      ? '📎 File'
                      : item.last_message?.message || 'Start chatting'}
                  </Text>

                  {item.unread_count > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {item.unread_count > 99 ? '99+' : item.unread_count}
                      </Text>
                    </View>
                  )}
                </View>

                {item.medical_record_id && (
                  <View style={styles.medicalRecordBadge}>
                    <Ionicons name="medical" size={12} color={COLORS.primary} />
                    <Text style={styles.medicalRecordText}>Medical</Text>
                  </View>
                )}
              </View>
            </PressableScale>
          )}
        />
      )}

      {/* Toast */}
      {toastVisible && (
        <Toast message={toastMessage} type={toastType} />
      )}
    </SafeAreaView>
  );
};

// ==================== STYLES ====================
const styles = StyleSheet.create({
  // Base
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },

  // Conversations List Header
  conversationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  homeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
  },
  searchInnerContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 36,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: COLORS.text,
  },

  // Conversations List
  conversationsListContent: {
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
  },
  conversationAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  conversationAvatar: {
    width: SIZES.avatarLarge,
    height: SIZES.avatarLarge,
    borderRadius: SIZES.avatarLarge / 2,
  },
  conversationStatusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.online,
    borderWidth: 2,
    borderColor: COLORS.background,
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
    color: COLORS.text,
    flex: 1,
  },
  unreadConversationName: {
    fontWeight: '700',
  },
  conversationTime: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  unreadConversationTime: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  conversationLastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conversationLastMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  unreadConversationLastMessage: {
    color: COLORS.text,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  medicalRecordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  medicalRecordText: {
    fontSize: 12,
    color: COLORS.primary,
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
    fontSize: 18,
    color: COLORS.textSecondary,
    marginTop: 16,
    fontWeight: '600',
  },
  emptyConversationsSubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 8,
  },

  // Chat Screen Header
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  headerBackButton: {
    padding: 4,
    marginRight: 4,
  },
  headerUserInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  headerAvatar: {
    width: SIZES.avatarMedium,
    height: SIZES.avatarMedium,
    borderRadius: SIZES.avatarMedium / 2,
  },
  headerStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.online,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  headerUserDetails: {
    flex: 1,
  },
  headerUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  headerUserStatus: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  headerUserStatusOnline: {
    fontSize: 12,
    color: COLORS.online,
    fontWeight: '500',
  },
  headerUserStatusTyping: {
    fontSize: 12,
    color: COLORS.primary,
    fontStyle: 'italic',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  headerActionButton: {
    padding: 6,
  },

  // Chat Container
  chatContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    fontSize: 18,
    color: COLORS.textSecondary,
    marginTop: 16,
    fontWeight: '600',
  },
  emptyMessagesSubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 8,
  },

  // Messages
  messageRow: {
    flexDirection: 'row',
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  theirMessageRow: {
    justifyContent: 'flex-start',
  },
  messageRowFirst: {
    marginTop: 8,
  },
  avatarContainer: {
    width: SIZES.avatarSmall,
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  messageAvatar: {
    width: SIZES.avatarSmall,
    height: SIZES.avatarSmall,
    borderRadius: SIZES.avatarSmall / 2,
  },
  avatarPlaceholder: {
    width: SIZES.avatarSmall,
    height: SIZES.avatarSmall,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  myMessageBubble: {
    backgroundColor: COLORS.messageBubbleMe,
  },
  myMessageBubbleFirst: {
    borderTopRightRadius: 18,
  },
  myMessageBubbleLast: {
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: COLORS.messageBubbleThem,
  },
  theirMessageBubbleFirst: {
    borderTopLeftRadius: 18,
  },
  theirMessageBubbleLast: {
    borderBottomLeftRadius: 4,
  },
  deletedMessageBubble: {
    backgroundColor: COLORS.backgroundSecondary,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFF',
  },
  theirMessageText: {
    color: COLORS.text,
  },
  editedText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  myEditedText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  theirEditedText: {
    color: COLORS.textLight,
  },
  readReceiptContainer: {
    marginLeft: 4,
    alignSelf: 'flex-end',
    marginBottom: 4,
  },

  // Deleted Message
  deletedMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deletedMessageText: {
    fontSize: 14,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },

  // Image Message
  imageMessageWrapper: {
    position: 'relative',
  },
  imageMessageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  mediaImage: {
    width: width * 0.6,
    height: width * 0.6,
    backgroundColor: COLORS.backgroundSecondary,
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
    marginTop: 8,
  },
  imageCaptionContainer: {
    marginTop: 8,
    paddingHorizontal: 8,
  },
  imageCaption: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  // File Message
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.text,
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  fileMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // Reactions
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  reactionsContainerRight: {
    justifyContent: 'flex-end',
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  reactionBubbleActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  // Input Area
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  uploadingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  uploadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  inputActionButton: {
    padding: 8,
    marginBottom: 4,
  },
  textInputContainer: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 20,
    paddingHorizontal: 14,
    marginHorizontal: 6,
    minHeight: 36,
    maxHeight: 100,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 15,
    color: COLORS.text,
    paddingVertical: 8,
    maxHeight: 80,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Emoji Picker
  emojiPickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  emojiPickerContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 12,
  },
  emojiPickerHandle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  emojiPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  emojiPickerContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  emojiButton: {
    width: '20%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  emojiText: {
    fontSize: 32,
  },

  // Action Sheet
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 12,
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  actionSheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  actionSheetIcon: {
    marginRight: 16,
  },
  actionSheetText: {
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Edit Modal
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  editModalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
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
    color: COLORS.text,
  },
  editTextInput: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top',
    marginBottom: 20,
    color: COLORS.text,
  },
  editModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  editCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  editCancelText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  editSaveButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  editSaveButtonDisabled: {
    backgroundColor: COLORS.textLight,
  },
  editSaveText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },

  // Reactions View Modal
  reactionsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionsModalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    width: '85%',
    maxHeight: '70%',
    padding: 20,
  },
  reactionsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reactionsModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  reactionsModalList: {
    maxHeight: 400,
  },
  reactionItem: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  reactionItemEmojiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reactionItemEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  reactionItemCountBadge: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  reactionItemUsers: {
    gap: 8,
  },
  reactionUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reactionUserAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  reactionItemUserName: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
});

export default MessageScreen;