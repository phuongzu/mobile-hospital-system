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
export const COLORS = {
  // Primary - Medical Teal (trust, calm, health)
  primary: '#0B9E8E',
  primaryDark: '#077A6D',
  primaryLight: '#E0F5F3',
  primaryGradientStart: '#0DB8A6',
  primaryGradientEnd: '#0B9E8E',

  // Message Bubbles
  messageBubbleMe: '#0B9E8E',       // teal for sent
  messageBubbleMeEnd: '#0A8B7C',
  messageBubbleThem: '#F0F4F8',     // cool gray for received

  // Status Colors
  success: '#2ECC87',
  error: '#FF5252',
  warning: '#FFB74D',
  online: '#2ECC87',
  offline: '#90A4AE',

  // Backgrounds
  background: '#FFFFFF',
  backgroundSecondary: '#F5F8FA',
  backgroundChat: '#F0F4F8',        // subtle blue-gray chat bg
  backgroundBubbleThem: '#EEF2F7',

  // Text
  text: '#1A2332',
  textSecondary: '#5C7080',
  textLight: '#A0B0BF',
  textOnPrimary: '#FFFFFF',

  // Borders & Dividers
  border: '#E8EDF2',
  divider: '#EDF1F5',

  // Medical Accents
  medicalRed: '#FF6B6B',
  medicalBlue: '#4A90D9',
  medicalGreen: '#2ECC87',
  urgentOrange: '#FF9F43',
};

export const SIZES = {
  avatarSmall: 32,
  avatarMedium: 40,
  avatarLarge: 56,
  iconSmall: 20,
  iconMedium: 24,
  iconLarge: 28,
  borderRadius: 22,
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
  clientTempId?: string;
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

// Helper function to group reactions
const groupReactionsByEmoji = (reactions: Reaction[], currentUserId: string): GroupedReaction[] => {
  const grouped: Record<string, GroupedReaction> = {};
  
  reactions.forEach(reaction => {
    if (!grouped[reaction.emoji]) {
      grouped[reaction.emoji] = {
        emoji: reaction.emoji,
        count: 0,
        users: [],
        isReactedByMe: false
      };
    }
    grouped[reaction.emoji].count++;
    grouped[reaction.emoji].users.push(reaction.user_id);
    if (reaction.user_id._id === currentUserId) {
      grouped[reaction.emoji].isReactedByMe = true;
    }
  });
  
  return Object.values(grouped);
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
const Toast = memo(({ message, type, onHide }: { message: string; type: 'success' | 'error' | 'info'; onHide: () => void }) => {
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

    const timer = setTimeout(() => {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onHide());
    }, 2800);

    return () => clearTimeout(timer);
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
    <View>
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
  }, [visible]);

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
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
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
    </Modal>
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

  if (!visible) return null;

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
                  <Text style={styles.reactionItemCount}>{reaction.count}</Text>
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
  }, []);

  const hideToast = useCallback(() => {
    setToastVisible(false);
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
    return message.sender_id?._id === currentUserId;
  }, [currentUserId]);

  const isSameSender = useCallback((currentMsg: Message, nextMsg?: Message): boolean => {
    if (!nextMsg) return false;
    return currentMsg.sender_id?._id === nextMsg.sender_id?._id;
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

  const hasUserReacted = useCallback((message: Message, emoji: string): boolean => {
    if (!message.reactions) return false;
    return message.reactions.some(
      reaction => reaction.emoji === emoji && reaction.user_id?._id === currentUserId
    );
  }, [currentUserId]);

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
      clientTempId: rawMsg.clientTempId,
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

  const connectSocket = async (userId: string) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token || socketRef.current?.connected) return;

      socketRef.current = io(API_BASE_URL, {
        auth: { token, userId },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current.on('connect', () => {
        console.log('✅ Socket connected', userId);
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
          setSending(false);
        } else {
          setSending(false);
          showToast('Failed to send', 'error');
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
          if (data.type === 'everyone') {
            setMessages(prev => prev.map(msg =>
              msg._id === data.message._id ? data.message : msg
            ));
          } else {
            setMessages(prev => prev.filter(msg => msg._id !== data.message._id));
          }
        }
      });

      // Reaction events
      socketRef.current.on('reaction_added', (data) => {
        if (data.conversationId === selectedConvRef.current?._id) {
          setMessages(prev => prev.map(msg =>
            msg._id === data.messageId
              ? { 
                  ...msg, 
                  reactions: data.reactions || [],
                  reactions_count: data.reactions?.length || 0 
                }
              : msg
          ));
        }
      });

      socketRef.current.on('reaction_removed', (data) => {
        if (data.conversationId === selectedConvRef.current?._id) {
          setMessages(prev => prev.map(msg =>
            msg._id === data.messageId
              ? { 
                  ...msg, 
                  reactions: data.reactions || [],
                  reactions_count: data.reactions?.length || 0 
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
            read: msg.sender_id?._id === currentUserId ? true : msg.read
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
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    setNewMessage('');
    setSending(true);
    emitTypingStop();

    const tempMsg: Message = {
      _id: tempId,
      clientTempId: tempId,
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
          messageType: 'text',
          clientTempId: tempId
        });
      } else {
        const response = await axios.post(
          `${API_ENDPOINT}/messages/send`,
          {
            receiver_id: selectedConversation.participant._id,
            message: msgText,
            message_type: 'text',
            clientTempId: tempId
          },
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (response.data.success) {
          handlerRef.current?.(response.data.data?.message || response.data.data);
        }
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        `${API_ENDPOINT}/messages/${messageId}/edit`,
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
        `${API_ENDPOINT}/messages/${message._id}`,
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
        `${API_ENDPOINT}/messages/${messageId}/react`,
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

      const convIdParam = selectedConversation?._id ? `?conversationId=${selectedConversation._id}` : '';
      const response = await axios.get(
        `${API_ENDPOINT}/messages/${messageId}/reactions${convIdParam}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      console.debug('Fetch reactions response:', response.data);

      if (response.data.success) {
          const reactions = response.data.data.reactions || [];
          setMessageReactions(reactions);
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
      
      // Refresh messages to show new reaction
      if (selectedConversation) {
        loadMessages(selectedConversation._id);
      }
    }
  };

  const handleViewReactions = (message: Message) => {
    getMessageReactions(message._id);
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
    
    const reactions = item.reactions || [];
    const groupedReactions = reactions.length > 0 
      ? groupReactionsByEmoji(reactions, currentUserId)
      : [];
      const hasReactions = groupedReactions.length > 0;

    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.myMessageRow : styles.theirMessageRow,
          isFirstInGroup && styles.messageRowFirst,
          hasReactions ? { marginBottom: 28 } : { marginBottom: 4 },

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

        <View style={styles.messageWrapper}>
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

          {groupedReactions.length > 0 && (
            <View style={[
              styles.reactionsContainer,
              isMe ? styles.reactionsContainerRight : styles.reactionsContainerLeft
            ]}>
              {groupedReactions.map((reaction, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.reactionBubble,
                    reaction.isReactedByMe && styles.reactionBubbleActive
                  ]}
                  onPress={() => handleViewReactions(item)}
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
        if (!userDataStr) {
          console.error('❌ No user data found');
          return;
        }
        
        const userData = JSON.parse(userDataStr);
        
        setCurrentUserId(userData._id);
        setCurrentUser(userData);
        
        await connectSocket(userData._id);
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
          <Toast message={toastMessage} type={toastType} onHide={hideToast} />
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
        <Toast message={toastMessage} type={toastType} onHide={hideToast} />
      )}
    </SafeAreaView>
  );
};

// ==================== STYLES ====================
export const styles = StyleSheet.create({

  // ── BASE ──────────────────────────────────────────────
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },

  // ── TOAST ─────────────────────────────────────────────
  toast: {
    position: 'absolute',
    bottom: 28,
    left: 20,
    right: 20,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#0B9E8E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 1000,
  },
  toastText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    letterSpacing: 0.1,
  },

  // ── CONVERSATIONS LIST HEADER ──────────────────────────
  conversationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.8,
  },
  headerTitleAccent: {
    color: COLORS.primary,
  },
  homeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── SEARCH ────────────────────────────────────────────
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
  },
  searchInnerContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: COLORS.text,
    letterSpacing: 0.1,
  },

  // ── CONVERSATIONS LIST ─────────────────────────────────
  conversationsListContent: {
    paddingTop: 4,
    paddingBottom: 30,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
  },
  conversationAvatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  conversationAvatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  conversationAvatar: {
    width: SIZES.avatarLarge,
    height: SIZES.avatarLarge,
    borderRadius: SIZES.avatarLarge / 2,
    borderWidth: 2,
    borderColor: COLORS.primaryLight,
  },
  conversationStatusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: COLORS.online,
    borderWidth: 2.5,
    borderColor: COLORS.background,
  },
  conversationContent: {
    flex: 1,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  conversationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    letterSpacing: -0.2,
  },
  unreadConversationName: {
    fontWeight: '800',
    color: COLORS.text,
  },
  conversationTime: {
    fontSize: 12,
    color: COLORS.textLight,
    marginLeft: 8,
    letterSpacing: 0.2,
  },
  unreadConversationTime: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  conversationLastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conversationLastMessage: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    flex: 1,
    marginRight: 8,
    letterSpacing: 0.1,
  },
  unreadConversationLastMessage: {
    color: COLORS.text,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  medicalRecordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    backgroundColor: COLORS.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  medicalRecordText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  emptyConversationsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    gap: 12,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyConversationsText: {
    fontSize: 18,
    color: COLORS.text,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  emptyConversationsSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },

  // ── CHAT HEADER ───────────────────────────────────────
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerBackButton: {
    padding: 6,
    marginRight: 2,
    borderRadius: 10,
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
    borderWidth: 2,
    borderColor: COLORS.primaryLight,
  },
  headerStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
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
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
    marginBottom: 1,
  },
  headerUserStatus: {
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 0.1,
  },
  headerUserStatusOnline: {
    fontSize: 12,
    color: COLORS.online,
    fontWeight: '600',
  },
  headerUserStatusTyping: {
    fontSize: 12,
    color: COLORS.primary,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── CHAT CONTAINER & MESSAGES ──────────────────────────
  chatContainer: {
    flex: 1,
    backgroundColor: COLORS.backgroundChat,
  },
  messagesListContent: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 12,
  },
  emptyMessagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
    gap: 12,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMessagesText: {
    fontSize: 17,
    color: COLORS.text,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  emptyMessagesSubtext: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  // ── MESSAGE ROWS ───────────────────────────────────────
  messageRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  theirMessageRow: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  messageRowFirst: {
    marginTop: 12,
  },
  messageRowWithReaction: {
    marginBottom: 24,
  },
  avatarContainer: {
    width: SIZES.avatarSmall,
    marginRight: 8,
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  messageAvatar: {
    width: SIZES.avatarSmall,
    height: SIZES.avatarSmall,
    borderRadius: SIZES.avatarSmall / 2,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
  },
  avatarPlaceholder: {
    width: SIZES.avatarSmall,
    height: SIZES.avatarSmall,
  },

  // ── MESSAGE WRAPPER & BUBBLES ──────────────────────────
  messageWrapper: {
    maxWidth: '72%',
  },
  messageBubble: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  // My messages (teal gradient look)
  myMessageBubble: {
    backgroundColor: COLORS.messageBubbleMe,
    borderBottomRightRadius: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    alignSelf: 'flex-end',
  },
  myMessageBubbleFirst: {
    borderTopRightRadius: 20,
  },
  myMessageBubbleLast: {
    borderBottomRightRadius: 4,
  },
  myMessageBubbleMiddle: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },

  theirMessageBubble: {
  backgroundColor: '#E2E8F0',  
  borderBottomLeftRadius: 6,
  alignSelf: 'flex-start',
},
  theirMessageBubbleFirst: {
    borderTopLeftRadius: 20,
  },
  theirMessageBubbleLast: {
    borderBottomLeftRadius: 4,
  },
  theirMessageBubbleMiddle: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },

  deletedMessageBubble: {
    backgroundColor: COLORS.backgroundSecondary,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // ── MESSAGE TEXT ───────────────────────────────────────
  messageText: {
    fontSize: 15.5,
    lineHeight: 21,
    letterSpacing: 0.1,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: COLORS.text,
  },
  editedText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  myEditedText: {
    color: 'rgba(255,255,255,0.65)',
  },
  theirEditedText: {
    color: COLORS.textLight,
  },
  readReceiptContainer: {
    marginLeft: 5,
    alignSelf: 'flex-end',
    marginBottom: 6,
  },

  // ── DELETED MESSAGE ────────────────────────────────────
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

  // ── TIMESTAMP LABEL ────────────────────────────────────
  timestampLabel: {
    textAlign: 'center',
    fontSize: 11.5,
    color: COLORS.textLight,
    letterSpacing: 0.4,
    fontWeight: '500',
    marginVertical: 10,
  },

  // ── IMAGE MESSAGE ──────────────────────────────────────
  imageMessageContainer: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  mediaImage: {
    width: width * 0.58,
    height: width * 0.58,
    backgroundColor: COLORS.backgroundSecondary,
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,158,142,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageErrorText: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 8,
  },
  imageCaptionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  imageCaption: {
    fontSize: 13.5,
    color: '#FFF',
    lineHeight: 18,
  },

  // ── FILE MESSAGE ───────────────────────────────────────
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    minWidth: width * 0.48,
    gap: 12,
  },
  fileIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileInfoContainer: {
    flex: 1,
  },
  fileName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 3,
    letterSpacing: -0.1,
  },
  fileSize: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 3,
  },
  fileMessage: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
  },

  // ── REACTIONS ─────────────────────────────────────────
reactionsContainer: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  marginTop: -8,   
  gap: 3,
  paddingHorizontal: 6,
},
reactionsContainerLeft: {
  justifyContent: 'flex-start',
},
reactionsContainerRight: {
  justifyContent: 'flex-end',
},
  reactionBubble: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: COLORS.background,
  borderRadius: 12,
  paddingHorizontal: 7,
  paddingVertical: 3,
  gap: 2,
  borderWidth: 1.5,
  borderColor: COLORS.border,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.08,
  shadowRadius: 3,
  elevation: 2,
},

  reactionBubbleActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  reactionEmoji: {
    fontSize: 10,
  },
reactionCount: {
  fontSize: 11,
  color: COLORS.textSecondary,
  fontWeight: '700',
},
  reactionCountActive: {
    color: COLORS.primary,
  },

  // ── INPUT AREA ─────────────────────────────────────────
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 10 : 10,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    gap: 8,
  },
  uploadingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  uploadingText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  inputActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  textInputContainer: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 22,
    paddingHorizontal: 16,
    minHeight: 38,
    maxHeight: 110,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  textInputContainerFocused: {
    borderColor: COLORS.primary,
    backgroundColor: '#FAFFFE',
  },
  textInput: {
    fontSize: 15,
    color: COLORS.text,
    paddingVertical: 9,
    maxHeight: 90,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },

  // ── IMAGE PREVIEW MODAL ────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 20, 30, 0.96)',
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
    top: Platform.OS === 'ios' ? 54 : 24,
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  imageContainer: {
    width: '100%',
    height: '82%',
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
    gap: 12,
  },
  errorText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  retryButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── EMOJI PICKER ───────────────────────────────────────
  emojiPickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,20,30,0.45)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  emojiPickerContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  emojiPickerHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  emojiPickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 18,
    letterSpacing: -0.2,
  },
  emojiPickerContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
  },
  emojiButton: {
    width: '20%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  emojiText: {
    fontSize: 34,
  },

  // ── ACTION SHEET ───────────────────────────────────────
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,20,30,0.45)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 14,
  },
  actionSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  actionSheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    gap: 16,
  },
  actionSheetIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionSheetIcon: {
    marginRight: 0,
  },
  actionSheetText: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  cancelButton: {
    marginTop: 6,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ── EDIT MODAL ─────────────────────────────────────────
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,20,30,0.45)',
    justifyContent: 'flex-end',
  },
  editModalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 22,
    paddingBottom: Platform.OS === 'ios' ? 36 : 22,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  editTextInput: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 16,
    padding: 16,
    fontSize: 15.5,
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top',
    marginBottom: 20,
    color: COLORS.text,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    lineHeight: 22,
  },
  editModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  editCancelButton: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.backgroundSecondary,
  },
  editCancelText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  editSaveButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 90,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  editSaveButtonDisabled: {
    backgroundColor: COLORS.textLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  editSaveText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // ── REACTIONS VIEW MODAL ───────────────────────────────
  reactionsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,20,30,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  reactionsModalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 22,
    width: '100%',
    maxHeight: '72%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 20,
  },
  reactionsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  reactionsModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  reactionsModalList: {
    maxHeight: 380,
    paddingHorizontal: 20,
  },
  reactionItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  reactionItemEmojiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  reactionItemEmoji: {
    fontSize: 26,
  },
  reactionItemCount: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  reactionItemUsers: {
    gap: 8,
  },
  reactionUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reactionUserAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
  },
  reactionItemUserName: {
    fontSize: 14.5,
    color: COLORS.text,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});


export default MessageScreen;