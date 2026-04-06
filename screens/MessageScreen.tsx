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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Haptics from 'expo-haptics';
import { MediaTypeOptions, launchImageLibraryAsync } from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io, { Socket } from 'socket.io-client';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import ImageView from 'react-native-image-viewing';
import { Search } from 'lucide-react-native';
import {
  Smile,
  Send,
  ImageIcon,
  X,
  Check,
  CheckCheck,
  Paperclip,
  Download,
  Ban,
  ChevronLeft,
  Phone,
  Video,
  Info,
  Plus,
} from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

// ==================== DESIGN SYSTEM ====================
export const COLORS = {
  primary: '#0A9689',
  primaryDark: '#077A6D',
  primaryLight: '#E3F5F3',
  primaryMid: '#C2EAE7',
  bubbleMe: '#0A9689',
  bubbleMeDark: '#077A6D',
  bubbleThem: '#FFFFFF',
  bg: '#FFFFFF',
  bgList: '#F6F8FA',
  bgChat: '#EDF1F6',
  bgInput: '#F0F2F5',
  bgSecondary: '#F6F8FA',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textOnPrimary: '#FFFFFF',
  textMe: '#FFFFFF',
  textThem: '#111827',
  online: '#10B981',
  read: '#0A9689',
  sent: '#9CA3AF',
  divider: '#E5E9EF',
  border: '#DDE2E8',
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  reactionBg: '#FFFFFF',
  reactionActiveBg: '#E3F5F3',
  reactionActiveBorder: '#0A9689',
};

export const RADIUS = {
  bubble: 20,
  image: 16,
  input: 24,
  pill: 100,
  card: 14,
  sm: 8,
  md: 12,
};

export const SHADOW = {
  card: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  bubble: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  float: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 20, elevation: 12 },
};

// ==================== INTERFACES ====================
interface User {
  _id: string;
  name: string;
  avatar?: string;
  role: string;
  phoneNumber?: string;
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
  media_urls?: string[];
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

// ==================== UTILITIES ====================
const buildMediaUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
};

const buildAvatarUrl = (user?: User | null): string => {
  if (!user?.avatar)
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=0A9689&color=fff&size=150&bold=true`;
  if (user.avatar.startsWith('http')) return user.avatar;
  return `${API_BASE_URL}${user.avatar.startsWith('/') ? user.avatar : `/uploads/avatars/${user.avatar}`}`;
};

const formatFileSize = (bytes: number): string => {
  if (!bytes) return '0 B';
  const k = 1024;
  const s = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${s[i]}`;
};

const formatTime = (d?: string | number | Date): string => {
  if (!d) return '';
  const date = new Date(d);
  const diff = (Date.now() - date.getTime()) / 86400000;
  if (diff < 1) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 2) return 'Yesterday';
  if (diff < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const groupReactions = (reactions: Reaction[], myId: string): GroupedReaction[] => {
  const map: Record<string, GroupedReaction> = {};
  reactions.forEach(r => {
    if (!map[r.emoji]) map[r.emoji] = { emoji: r.emoji, count: 0, users: [], isReactedByMe: false };
    map[r.emoji].count++;
    map[r.emoji].users.push(r.user_id);
    if (r.user_id._id === myId) map[r.emoji].isReactedByMe = true;
  });
  return Object.values(map);
};

// ==================== SCALE PRESS ====================
const ScalePress = ({ children, onPress, onLongPress, style, disabled }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        style={style}
        onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }).start()}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

// ==================== ANIMATED REACTION BUBBLE ====================
const AnimatedReactionBubble = memo(({ reaction, onPress, delay = 0 }: {
  reaction: GroupedReaction; onPress: () => void; delay?: number;
}) => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 180, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}
        style={[styles.reactionBubble, reaction.isReactedByMe && styles.reactionBubbleActive]}>
        <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
        {reaction.count > 1 && (
          <Text style={[styles.reactionCount, reaction.isReactedByMe && styles.reactionCountActive]}>{reaction.count}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

// ==================== TOAST ====================
const Toast = memo(({ message, type, onHide }: { message: string; type: 'success' | 'error' | 'info'; onHide: () => void }) => {
  const y = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(y, { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() =>
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(onHide), 2800);
    return () => clearTimeout(t);
  }, []);
  const bg = type === 'success' ? COLORS.success : type === 'error' ? COLORS.error : COLORS.primary;
  const icon = type === 'success' ? 'checkmark-circle' : type === 'error' ? 'alert-circle' : 'information-circle';
  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, transform: [{ translateY: y }], opacity }]}>
      <Ionicons name={icon as any} size={20} color="#FFF" />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
});

// ==================== MULTI-IMAGE GRID ====================
const MultiImageGrid = memo(({ urls, onPressImage, onLongPress }: {
  urls: string[]; onPressImage: (url: string, index: number) => void; onLongPress: () => void;
}) => {
  const count = urls.length;
  const maxW = width * 0.62;
  if (count === 1) return (
    <TouchableOpacity onPress={() => onPressImage(urls[0], 0)} onLongPress={onLongPress} activeOpacity={0.92}>
      <SingleImagePreview uri={urls[0]} maxW={maxW} aspectRatio={1} />
    </TouchableOpacity>
  );
  if (count === 2) {
    const imgW = (maxW - 2) / 2;
    return (
      <TouchableOpacity onLongPress={onLongPress} activeOpacity={1}>
        <View style={{ flexDirection: 'row', gap: 2, borderRadius: RADIUS.image, overflow: 'hidden' }}>
          {urls.map((u, i) => (
            <TouchableOpacity key={i} onPress={() => onPressImage(u, i)} activeOpacity={0.88}>
              <SingleImagePreview uri={u} maxW={imgW} aspectRatio={1} borderRadius={0} />
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    );
  }
  if (count === 3) {
    const rightW = (maxW - 2) / 2;
    return (
      <TouchableOpacity onLongPress={onLongPress} activeOpacity={1}>
        <View style={{ flexDirection: 'row', gap: 2, borderRadius: RADIUS.image, overflow: 'hidden' }}>
          <TouchableOpacity onPress={() => onPressImage(urls[0], 0)} activeOpacity={0.88}>
            <SingleImagePreview uri={urls[0]} maxW={rightW} aspectRatio={0.9} borderRadius={0} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'column', gap: 2 }}>
            {[1, 2].map(i => (
              <TouchableOpacity key={i} onPress={() => onPressImage(urls[i], i)} activeOpacity={0.88}>
                <SingleImagePreview uri={urls[i]} maxW={rightW} aspectRatio={0.45} borderRadius={0} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    );
  }
  const cellW = (maxW - 2) / 2;
  const shown = urls.slice(0, 4);
  const extra = count - 4;
  return (
    <TouchableOpacity onLongPress={onLongPress} activeOpacity={1}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, borderRadius: RADIUS.image, overflow: 'hidden', width: maxW }}>
        {shown.map((u, i) => (
          <TouchableOpacity key={i} onPress={() => onPressImage(u, i)} activeOpacity={0.88} style={{ position: 'relative' }}>
            <SingleImagePreview uri={u} maxW={cellW} aspectRatio={1} borderRadius={0} />
            {i === 3 && extra > 0 && (
              <View style={styles.extraOverlay}><Text style={styles.extraText}>+{extra}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </TouchableOpacity>
  );
});

const SingleImagePreview = memo(({ uri, maxW, aspectRatio, borderRadius = RADIUS.image }: {
  uri: string; maxW: number; aspectRatio: number; borderRadius?: number;
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  return (
    <View style={{ width: maxW, height: maxW * aspectRatio, backgroundColor: '#E5E9EF', borderRadius, overflow: 'hidden' }}>
      {!error ? (
        <Animated.Image
          source={{ uri }} style={{ width: '100%', height: '100%', opacity: fade }}
          resizeMode="cover"
          onLoad={() => { setLoading(false); Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start(); }}
          onError={() => { setLoading(false); setError(true); }}
        />
      ) : (
        <View style={styles.imgError}><Ionicons name="image-outline" size={28} color="#9CA3AF" /></View>
      )}
      {loading && !error && (
        <View style={[StyleSheet.absoluteFill, styles.imgLoading]}><ActivityIndicator size="small" color="#9CA3AF" /></View>
      )}
    </View>
  );
});

// ==================== EMOJI CATEGORIES ====================
const EMOJI_CATS = [
  { id: 'recent', label: 'Recent', icon: '🕐', emojis: ['❤️', '😂', '😮', '😢', '😠', '👍', '🔥', '🎉', '✨', '🙏'] },
  { id: 'smileys', label: 'Smileys', icon: '😊', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😜', '🤪', '😎', '🥳', '😏', '😒', '😔', '😟', '😕', '😣', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '😱', '😶', '🤐', '😬', '🙄', '😴', '🤒', '🤕'] },
  { id: 'gestures', label: 'Gestures', icon: '👋', emojis: ['👋', '🤚', '🖐️', '✋', '👌', '✌️', '🤞', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '👏', '🙌', '🤝', '🙏', '💅', '✍️', '🤙'] },
  { id: 'hearts', label: 'Hearts', icon: '❤️', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💋', '🥰', '😍', '😘'] },
  { id: 'fun', label: 'Fun', icon: '🎉', emojis: ['🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '⭐', '🌟', '💫', '✨', '🔥', '💯', '🎵', '🎶', '🎸', '🎤', '🍕', '🍔', '🍜', '🍣', '🍰', '🎂', '🍫', '☕', '🚀', '🌈', '🌸', '🌺', '🌻', '🐶', '🐱', '🦋'] },
];

const EmojiPicker = memo(({ visible, onClose, onSelect }: {
  visible: boolean; onClose: () => void; onSelect: (e: string) => void;
}) => {
  const y = useRef(new Animated.Value(420)).current;
  const [cat, setCat] = useState(0);
  const CELL = Math.floor((width - 32) / 8);
  useEffect(() => {
    if (visible) Animated.spring(y, { toValue: 0, tension: 65, friction: 9, useNativeDriver: true }).start();
    else { y.setValue(420); setCat(0); }
  }, [visible]);
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.pickerBackdrop}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.pickerSheet, { transform: [{ translateY: y }] }]}>
              <View style={styles.sheetHandle} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
                {EMOJI_CATS.map((c, i) => (
                  <TouchableOpacity key={i} onPress={() => setCat(i)} style={[styles.catTab, cat === i && styles.catTabActive]}>
                    <Text style={{ fontSize: 20 }}>{c.icon}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.catLabel}>{EMOJI_CATS[cat].label}</Text>
              <FlatList
                data={EMOJI_CATS[cat].emojis}
                keyExtractor={(_, i) => `${cat}-${i}`}
                numColumns={8}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={{ width: CELL, height: CELL, justifyContent: 'center', alignItems: 'center', borderRadius: 10 }}
                    onPress={() => onSelect(item)} activeOpacity={0.6}
                  >
                    <Text style={{ fontSize: 28 }}>{item}</Text>
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
                showsVerticalScrollIndicator={false}
              />
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// ==================== EDIT MODAL ====================
const EditModal = memo(({ visible, message, onClose, onSave }: {
  visible: boolean; message: Message | null; onClose: () => void;
  onSave: (id: string, text: string) => Promise<void>;
}) => {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const y = useRef(new Animated.Value(height)).current;
  useEffect(() => {
    if (visible && message) { setText(message.message); Animated.spring(y, { toValue: 0, tension: 65, friction: 8, useNativeDriver: true }).start(); }
    else y.setValue(height);
  }, [visible, message]);
  const save = async () => {
    if (!message || !text.trim()) return;
    setSaving(true);
    try { await onSave(message._id, text.trim()); onClose(); } catch { } finally { setSaving(false); }
  };
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.editSheet, { transform: [{ translateY: y }] }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.editHeader}>
                <Text style={styles.editTitle}>Edit Message</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <X size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.editInput} value={text} onChangeText={setText}
                multiline autoFocus placeholder="Edit your message…"
                placeholderTextColor={COLORS.textMuted} maxLength={1000}
              />
              <View style={styles.editFooter}>
                <TouchableOpacity style={styles.editCancel} onPress={onClose}>
                  <Text style={styles.editCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editSave, (!text.trim() || saving) && { opacity: 0.45 }]}
                  onPress={save} disabled={!text.trim() || saving}
                >
                  {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.editSaveText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// ==================== ACTION SHEET (Android) ====================
const ActionSheet = memo(({ visible, message, isMe, onClose, onEdit, onDelete, onReact, onCopy }: any) => {
  const y = useRef(new Animated.Value(height)).current;
  useEffect(() => {
    if (visible) Animated.spring(y, { toValue: 0, tension: 65, friction: 8, useNativeDriver: true }).start();
    else y.setValue(height);
  }, [visible]);
  if (!visible || !message || Platform.OS === 'ios') return null;
  const items = [
    { label: 'React', icon: '😊', color: COLORS.primary, fn: () => { onReact(message); onClose(); } },
    ...(isMe && message.message_type === 'text' && !message.deleted
      ? [{ label: 'Edit', icon: '✏️', color: COLORS.textPrimary, fn: () => { onEdit(message); onClose(); } }] : []),
    { label: 'Copy', icon: '📋', color: COLORS.textPrimary, fn: () => { onCopy(message); onClose(); } },
    { label: 'Delete for me', icon: '🗑️', color: COLORS.error, fn: () => { onDelete(message, 'me'); onClose(); } },
    ...(isMe ? [{ label: 'Delete for everyone', icon: '⛔', color: COLORS.error, fn: () => { onDelete(message, 'everyone'); onClose(); } }] : []),
  ];
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.actionSheet, { transform: [{ translateY: y }] }]}>
              <View style={styles.sheetHandle} />
              {items.map((item, i) => (
                <TouchableOpacity key={i} style={styles.actionItem} onPress={item.fn} activeOpacity={0.7}>
                  <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                  <Text style={[styles.actionLabel, { color: item.color }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.actionItem, { marginTop: 4, borderTopWidth: 1, borderTopColor: COLORS.divider }]} onPress={onClose} activeOpacity={0.7}>
                <Text style={[styles.actionLabel, { color: COLORS.textSecondary, textAlign: 'center', flex: 1 }]}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// ==================== REACTIONS VIEW ====================
const ReactionsView = memo(({ visible, reactions, onClose }: {
  visible: boolean; reactions: GroupedReaction[]; onClose: () => void;
}) => {
  const scale = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 65, friction: 7, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else { scale.setValue(0.88); opacity.setValue(0); }
  }, [visible]);
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.modalOverlay, { opacity }]}>
        <TouchableWithoutFeedback onPress={onClose}><View style={StyleSheet.absoluteFill} /></TouchableWithoutFeedback>
        <Animated.View style={[styles.reactionsCard, { transform: [{ scale }] }]}>
          <View style={styles.reactionsCardHeader}>
            <Text style={styles.reactionsCardTitle}>Reactions</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <X size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {reactions.map((r, i) => (
              <View key={i} style={styles.reactionRow}>
                <View style={styles.reactionRowLeft}>
                  <Text style={{ fontSize: 24 }}>{r.emoji}</Text>
                  <View style={styles.reactionCountBadge}><Text style={styles.reactionCountBadgeText}>{r.count}</Text></View>
                </View>
                <View style={{ gap: 8 }}>
                  {r.users.map((u, j) => (
                    <View key={j} style={styles.reactionUser}>
                      <Image source={{ uri: buildAvatarUrl(u) }} style={styles.reactionUserAvatar} />
                      <Text style={styles.reactionUserName}>{u.name}</Text>
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

// ==================== PENDING IMAGES PREVIEW ====================
const PendingImagesPreview = memo(({ uris, onRemove, onSendAll }: {
  uris: string[]; onRemove: (i: number) => void; onSendAll: () => void;
}) => {
  if (!uris.length) return null;
  return (
    <View style={styles.pendingBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pendingScroll}>
        {uris.map((u, i) => (
          <View key={i} style={styles.pendingThumb}>
            <Image source={{ uri: u }} style={styles.pendingImg} resizeMode="cover" />
            <TouchableOpacity style={styles.pendingRemove} onPress={() => onRemove(i)}>
              <X size={12} color="#FFF" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addMoreBtn} onPress={onSendAll}>
          <Plus size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </ScrollView>
      <TouchableOpacity style={styles.sendAllBtn} onPress={onSendAll}>
        <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.sendAllGrad}>
          <Send size={16} color="#FFF" />
          <Text style={styles.sendAllText}>{uris.length > 1 ? `Send ${uris.length}` : 'Send'}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
});

// ==================== DOCTOR SEARCH MODAL ====================
// Extracted as a standalone component so it is NEVER rendered inside renderMessage
const DoctorSearchModal = memo(({ visible, onClose, onStartChat }: {
  visible: boolean;
  onClose: () => void;
  onStartChat: (doctor: User) => void;
}) => {
  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<User | null>(null);
  const [error, setError] = useState('');
  const slideY = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, tension: 65, friction: 8, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideY, { toValue: height, duration: 240, useNativeDriver: true }).start();
      // Reset state after close animation
      setTimeout(() => { setPhone(''); setFound(null); setError(''); }, 260);
    }
  }, [visible]);

  const search = async () => {
    if (!phone.trim() || searching) return;
    setSearching(true);
    setError('');
    setFound(null);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const res = await axios.get(`${API_ENDPOINT}/messages/search-doctor`, {
        params: { phone: phone.trim() },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setFound(res.data.data);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      setError(e.response?.data?.message || 'No doctor found with this phone number');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSearching(false);
    }
  };

  const handleStart = () => {
    if (found) onStartChat(found);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.doctorSearchSheet, { transform: [{ translateY: slideY }] }]}>
              <View style={styles.sheetHandle} />

              {/* Header */}
              <View style={styles.doctorSearchHeader}>
                <View>
                  <Text style={styles.doctorSearchTitle}>Find a Doctor</Text>
                  <Text style={styles.doctorSearchSubtitle}>Search by phone number to start a chat</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeCircle}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Input */}
              <View style={styles.doctorSearchInputWrap}>
                <Ionicons name="call-outline" size={20} color={COLORS.textMuted} />
                <TextInput
                  style={styles.doctorSearchInput}
                  placeholder="Doctor's phone number"
                  placeholderTextColor={COLORS.textMuted}
                  value={phone}
                  onChangeText={t => { setPhone(t); setFound(null); setError(''); }}
                  keyboardType="phone-pad"
                  autoFocus
                  returnKeyType="search"
                  onSubmitEditing={search}
                />
                {phone.length > 0 && (
                  <TouchableOpacity onPress={() => { setPhone(''); setFound(null); setError(''); }}>
                    <X size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Error */}
              {!!error && (
                <View style={styles.doctorSearchError}>
                  <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                  <Text style={styles.doctorSearchErrorText}>{error}</Text>
                </View>
              )}

              {/* Found card */}
              {found && (
                <View style={styles.doctorFoundCard}>
                  <Image source={{ uri: buildAvatarUrl(found) }} style={styles.doctorFoundAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.doctorFoundName}>{found.name}</Text>
                    <View style={styles.doctorFoundRolePill}>
                      <Ionicons name="medical" size={12} color={COLORS.primary} />
                      <Text style={styles.doctorFoundRoleText}>Doctor</Text>
                    </View>
                    {found.phoneNumber && <Text style={styles.doctorFoundPhone}>{found.phoneNumber}</Text>}
                  </View>
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                </View>
              )}

              {/* Buttons */}
              {!found ? (
                <TouchableOpacity
                  style={[styles.doctorSearchBtn, (!phone.trim() || searching) && { opacity: 0.5 }]}
                  onPress={search}
                  disabled={!phone.trim() || searching}
                >
                  {searching
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <><Search size={18} color="#FFF" /><Text style={styles.doctorSearchBtnText}>Search</Text></>
                  }
                </TouchableOpacity>
              ) : (
                <View style={styles.doctorSearchActions}>
                  <TouchableOpacity style={styles.doctorSearchCancelBtn}
                    onPress={() => { setFound(null); setPhone(''); }}>
                    <Text style={styles.doctorSearchCancelText}>Search again</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.doctorSearchStartBtn} onPress={handleStart}>
                    <Send size={16} color="#FFF" />
                    <Text style={styles.doctorSearchStartText}>Message</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [lastSeen, setLastSeen] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [registeredConversations, setRegisteredConversations] = useState<Set<string>>(new Set());


  // Pending images
  const [pendingImages, setPendingImages] = useState<{ uri: string; name: string; mime: string }[]>([]);

  // Modals
  const [previewImages, setPreviewImages] = useState<{ uri: string }[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [messageReactions, setMessageReactions] = useState<GroupedReaction[]>([]);

  // ── Doctor search — lives on the CONVERSATION LIST screen ──
  const [showDoctorSearch, setShowDoctorSearch] = useState(false);

  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type }), []);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => { selectedConvRef.current = selectedConversation; }, [selectedConversation]);

  useEffect(() => {
    if (isSocketConnected) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])).start();
    }
  }, [isSocketConnected]);

  const isMe = useCallback((msg: Message) => msg.sender_id?._id === currentUserId, [currentUserId]);
  const isSameSender = useCallback((a: Message, b?: Message) => !!b && a.sender_id?._id === b.sender_id?._id, []);
  const showAvatar = useCallback((msg: Message, idx: number) => {
    if (isMe(msg)) return false;
    return !isSameSender(msg, messages[idx + 1]);
  }, [messages, isMe, isSameSender]);

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 100);
  }, []);

  const emitTyping = useCallback((start: boolean) => {
    if (socketRef.current?.connected && selectedConversation) {
      socketRef.current.emit(start ? 'typing_start' : 'typing_stop', {
        conversationId: selectedConversation._id, userId: currentUserId,
      });
    }
  }, [selectedConversation, currentUserId]);

  const handleTextChange = (t: string) => {
    setNewMessage(t);
    if (t.length > 0) {
      emitTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => emitTyping(false), 1000);
    } else emitTyping(false);
  };

  // Socket handler
  handlerRef.current = (rawMsg: any) => {
    if (!rawMsg) return;
    const msg: Message = {
      _id: rawMsg._id || rawMsg.message?._id,
      clientTempId: rawMsg.clientTempId,
      conversation_id: rawMsg.conversation_id || rawMsg.conversationId || rawMsg.message?.conversation_id,
      sender_id: rawMsg.sender_id || rawMsg.senderId || rawMsg.message?.sender_id,
      receiver_id: rawMsg.receiver_id || rawMsg.receiverId || rawMsg.message?.receiver_id,
      message: rawMsg.message?.message || rawMsg.message || rawMsg.content || '',
      message_type: rawMsg.message_type || rawMsg.message?.message_type || 'text',
      media_url: rawMsg.media_url || rawMsg.message?.media_url,
      media_urls: rawMsg.media_urls || rawMsg.message?.media_urls,
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
    const convId = msg.conversation_id;
    const active = selectedConvRef.current;
    setConversations(prev => [...prev.map(c => c._id === convId
      ? { ...c, last_message: msg, last_message_at: msg.timestamp || msg.createdAt, unread_count: active?._id === convId ? 0 : (c.unread_count || 0) + 1 }
      : c
    )].sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()));
    if (active?._id === convId) {
      setMessages(prev => {
        if (prev.some(m => m._id === msg._id)) return prev;
        if (isMe(msg)) {
          const ti = prev.findIndex(m => m._id?.startsWith('temp_') && m.message === msg.message);
          if (ti !== -1) { const u = [...prev]; u[ti] = msg; return u; }
        }
        return [...prev, msg];
      });
      if (socketRef.current?.connected && !isMe(msg))
        socketRef.current.emit('mark_as_read', { conversationId: convId });
      setTimeout(() => scrollToBottom(), 150);
    }
  };

  const connectSocket = async (userId: string) => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token || socketRef.current?.connected) return;
    socketRef.current = io(API_BASE_URL, { auth: { token, userId }, transports: ['websocket'], reconnection: true });
    socketRef.current.on('connect', () => setIsSocketConnected(true));
    socketRef.current.on('disconnect', () => setIsSocketConnected(false));
    socketRef.current.on('new_message', d => handlerRef.current?.(d));
    socketRef.current.on('receive_message', d => handlerRef.current?.(d.message || d));
    socketRef.current.on('message_sent', d => {
      if (d.success) { handlerRef.current?.(d.message || d.data?.message); setSending(false); }
      else { setSending(false); showToast('Failed to send', 'error'); }
    });
    socketRef.current.on('message_edited', d => {
      if (d.conversationId === selectedConvRef.current?._id)
        setMessages(p => p.map(m => m._id === d.message._id ? d.message : m));
    });
    socketRef.current.on('message_deleted', d => {
      if (d.conversationId === selectedConvRef.current?._id) {
        if (d.type === 'everyone') setMessages(p => p.map(m => m._id === d.message._id ? d.message : m));
        else setMessages(p => p.filter(m => m._id !== d.message._id));
      }
    });
    socketRef.current.on('reaction_added', d => {
      if (d.conversationId === selectedConvRef.current?._id)
        setMessages(p => p.map(m => m._id === d.messageId ? { ...m, reactions: d.reactions || [], reactions_count: d.reactions?.length || 0 } : m));
    });
    socketRef.current.on('reaction_removed', d => {
      if (d.conversationId === selectedConvRef.current?._id)
        setMessages(p => p.map(m => m._id === d.messageId ? { ...m, reactions: d.reactions || [], reactions_count: d.reactions?.length || 0 } : m));
    });
    socketRef.current.on('typing_start', d => {
      if (d.conversationId === selectedConvRef.current?._id && d.userId !== currentUserId)
        setTypingUsers(p => [...new Set([...p, d.userId])]);
    });
    socketRef.current.on('typing_stop', d => {
      if (d.conversationId === selectedConvRef.current?._id)
        setTypingUsers(p => p.filter(id => id !== d.userId));
    });
    socketRef.current.on('messages_read', d => {
      if (d.conversationId === selectedConvRef.current?._id)
        setMessages(p => p.map(m => ({ ...m, read: m.sender_id?._id === currentUserId ? true : m.read })));
    });
    socketRef.current.on('user_online', d => setOnlineUsers(p => new Set([...p, d.userId])));
    socketRef.current.on('user_offline', d => {
      setOnlineUsers(p => { const s = new Set(p); s.delete(d.userId); return s; });
      if (d.lastSeen) setLastSeen(p => ({ ...p, [d.userId]: d.lastSeen }));
    });
  };

  const loadConversations = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const res = await axios.get(`${API_ENDPOINT}/messages/conversations`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success)
        setConversations((res.data.data || []).map((c: any) => ({
          _id: c._id, participant: c.participant, last_message: c.last_message,
          last_message_at: c.last_message_at || c.last_message?.createdAt,
          unread_count: c.unread_count || 0, medical_record_id: c.medical_record_id, appointment_id: c.appointment_id,
        })));
    } catch { showToast('Failed to load conversations', 'error'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const loadMessages = async (convId: string) => {
    try {
      setMessageLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const res = await axios.get(`${API_ENDPOINT}/messages/conversations/${convId}/messages`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) {
        setMessages(res.data.data || []);
        if (socketRef.current?.connected) socketRef.current.emit('mark_as_read', { conversationId: convId });
        setConversations(p => p.map(c => c._id === convId ? { ...c, unread_count: 0 } : c));
        setTimeout(() => scrollToBottom(false), 300);
      }
    } catch { showToast('Failed to load messages', 'error'); }
    finally { setMessageLoading(false); }
  };

  // ── Start chat with a found doctor ──
  const startChatWithDoctor = async (doctor: User) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const res = await axios.post(
        `${API_ENDPOINT}/messages/conversations/find-or-create`,
        { participantId: doctor._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        const conversation = res.data.data;
        setConversations(prev => {
          if (prev.some(c => c._id === conversation._id)) return prev;
          return [conversation, ...prev];
        });
        setShowDoctorSearch(false);
        setSelectedConversation(conversation);
        loadMessages(conversation._id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Failed to create conversation', 'error');
    }
  };

  const sendTextMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;
    const text = newMessage.trim();
    const tempId = `temp_${Date.now()}`;
    setNewMessage(''); setSending(true); emitTyping(false);
    const tempMsg: Message = {
      _id: tempId, clientTempId: tempId, conversation_id: selectedConversation._id,
      sender_id: currentUser || { _id: currentUserId, name: 'You', role: 'patient' },
      receiver_id: selectedConversation.participant, message: text, message_type: 'text',
      read: false, timestamp: new Date().toISOString(), createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), status: 'sending',
    };
    setMessages(p => [...p, tempMsg]);
    setTimeout(() => scrollToBottom(), 100);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (socketRef.current?.connected) {
        socketRef.current.emit('send_message', {
          conversationId: selectedConversation._id, receiverId: selectedConversation.participant._id,
          message: text, messageType: 'text', clientTempId: tempId,
        });
      } else {
        const res = await axios.post(`${API_ENDPOINT}/messages/send`,
          { receiver_id: selectedConversation.participant._id, message: text, message_type: 'text', clientTempId: tempId },
          { headers: { Authorization: `Bearer ${token}` } });
        if (res.data.success) handlerRef.current?.(res.data.data?.message || res.data.data);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      setMessages(p => p.filter(m => m._id !== tempId));
      showToast('Failed to send', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSending(false);
    }
  };

  const editMessage = async (messageId: string, newText: string) => {
    const token = await AsyncStorage.getItem('authToken');
    const res = await axios.patch(`${API_ENDPOINT}/messages/${messageId}/edit`, { newMessage: newText }, { headers: { Authorization: `Bearer ${token}` } });
    if (res.data.success) {
      setMessages(p => p.map(m => m._id === messageId ? { ...m, ...res.data.data } : m));
      showToast('Message edited', 'success');
    }
  };

  const deleteMessage = async (msg: Message, type: 'me' | 'everyone') => {
    Alert.alert('Delete Message', `Delete this message ${type === 'everyone' ? 'for everyone' : 'for you only'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('authToken');
            const res = await axios.delete(`${API_ENDPOINT}/messages/${msg._id}`, { headers: { Authorization: `Bearer ${token}` }, data: { type } });
            if (res.data.success) {
              if (type === 'everyone') setMessages(p => p.map(m => m._id === msg._id ? { ...m, ...res.data.data } : m));
              else setMessages(p => p.filter(m => m._id !== msg._id));
              showToast('Deleted', 'success');
            }
          } catch { showToast('Failed to delete', 'error'); }
        }
      }
    ]);
  };

  const addReaction = async (msgId: string, emoji: string) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const res = await axios.post(`${API_ENDPOINT}/messages/${msgId}/react`, { reaction: emoji }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) {
        setMessages(p => p.map(m => m._id === msgId ? res.data.data.message : m));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch { showToast('Failed to react', 'error'); }
  };

  const fetchReactions = async (msgId: string) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const q = selectedConversation?._id ? `?conversationId=${selectedConversation._id}` : '';
      const res = await axios.get(`${API_ENDPOINT}/messages/${msgId}/reactions${q}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) { setMessageReactions(res.data.data.reactions || []); setShowReactions(true); }
    } catch { showToast('Failed to load reactions', 'error'); }
  };

  const pickImages = async () => {
    try {
      const result = await launchImageLibraryAsync({ mediaTypes: MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.85 });
      if (!result.canceled && result.assets?.length) {
        const imgs = result.assets.map(a => ({ uri: a.uri, name: a.fileName || `img_${Date.now()}.jpg`, mime: a.mimeType || 'image/jpeg' }));
        setPendingImages(prev => [...prev, ...imgs]);
      }
    } catch { showToast('Failed to pick images', 'error'); }
  };

  const sendPendingImages = async () => {
    if (!selectedConversation || !pendingImages.length) return;
    const toSend = [...pendingImages];
    setPendingImages([]);
    setUploadingMedia(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      for (const img of toSend) {
        const fd = new FormData();
        fd.append('receiver_id', selectedConversation.participant._id);
        fd.append('message_type', 'image');
        fd.append('file', { uri: img.uri, name: img.name, type: img.mime } as any);
        const res = await axios.post(`${API_ENDPOINT}/messages/send-with-media`, fd, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
        if (res.data.success) { handlerRef.current?.(res.data.data); setTimeout(() => scrollToBottom(), 100); }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (toSend.length > 1) showToast(`${toSend.length} photos sent`, 'success');
    } catch { showToast('Failed to send images', 'error'); }
    finally { setUploadingMedia(false); }
  };

  const handleDownload = async (msg: Message) => {
    if (!msg.media_url) return;
    Alert.alert('Download', `Download "${msg.media_name || 'file'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Download', onPress: async () => {
          try {
            const dl = FileSystem.createDownloadResumable(buildMediaUrl(msg.media_url), ((FileSystem as any).documentDirectory || '') + (msg.media_name || 'file'), {});
            const r = await dl.downloadAsync();
            if (r?.uri) { showToast('Downloaded!', 'success'); if (Platform.OS === 'android') await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: r.uri, flags: 1 }); }
          } catch { showToast('Download failed', 'error'); }
        }
      }
    ]);
  };

  const onLongPress = (msg: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessage(msg);
    setShowActions(true);
    if (Platform.OS === 'ios') {
      const opts: string[] = ['React'];
      const destructive: number[] = [];
      if (isMe(msg) && msg.message_type === 'text' && !msg.deleted) opts.push('Edit');
      opts.push('Copy');
      opts.push('Delete for me');
      destructive.push(opts.length - 1);
      if (isMe(msg)) { opts.push('Delete for everyone'); destructive.push(opts.length - 1); }
      opts.push('Cancel');
      ActionSheetIOS.showActionSheetWithOptions({ options: opts, cancelButtonIndex: opts.length - 1, destructiveButtonIndex: destructive }, bi => {
        const o = opts[bi];
        if (o === 'React') setShowEmoji(true);
        else if (o === 'Edit') setShowEdit(true);
        else if (o === 'Copy') copyMsg(msg);
        else if (o === 'Delete for me') deleteMessage(msg, 'me');
        else if (o === 'Delete for everyone') deleteMessage(msg, 'everyone');
      });
    }
  };

  const copyMsg = async (msg: Message) => {
    await Clipboard.setStringAsync(msg.message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast('Copied', 'success');
  };

  const onEmojiSelect = async (emoji: string) => {
    if (selectedMessage) {
      await addReaction(selectedMessage._id, emoji);
      setShowEmoji(false);
      setSelectedMessage(null);
      if (selectedConversation) loadMessages(selectedConversation._id);
    } else {
      setNewMessage(p => p + emoji);
      setShowEmoji(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const s = await AsyncStorage.getItem('userData');
        if (!s) return;
        const u = JSON.parse(s);
        setCurrentUserId(u._id);
        setCurrentUser(u);
        await connectSocket(u._id);
        await loadConversations();
      } catch (e) { console.error(e); }
    };
    init();
    return () => { socketRef.current?.disconnect(); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); };
  }, []);

  // ── Filtered conversations based on search ──
  const filteredConversations = conversations.filter(c => {
    if (!searchQuery.trim()) return true;
    return c.participant.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // ── RENDER MESSAGE CONTENT ──
  // NOTE: This function ONLY returns the content of the bubble.
  // It must never include navigation headers, modals, or screen-level UI.
  const renderContent = (item: Message) => {
    if (item.deleted) return (
      <View style={styles.deletedRow}>
        <Ban size={13} color={COLORS.textMuted} />
        <Text style={styles.deletedText}>Message deleted</Text>
      </View>
    );
    const me = isMe(item);
    if (item.message_type === 'image') {
      const urls: string[] = [];
      if (item.media_urls?.length) urls.push(...item.media_urls.map(buildMediaUrl));
      else if (item.media_url) urls.push(buildMediaUrl(item.media_url));
      return (
        <View>
          <MultiImageGrid
            urls={urls}
            onPressImage={(url, index) => { setPreviewImages(urls.map(u => ({ uri: u }))); setPreviewIndex(index); setPreviewVisible(true); }}
            onLongPress={() => onLongPress(item)}
          />
          {item.message ? <Text style={[styles.caption, me && styles.captionMe]}>{item.message}</Text> : null}
        </View>
      );
    }
    if (item.message_type === 'file') return (
      <ScalePress onPress={() => handleDownload(item)} onLongPress={() => onLongPress(item)} style={styles.fileCard}>
        <View style={styles.fileIconWrap}><Paperclip size={22} color={COLORS.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fileName} numberOfLines={2}>{item.media_name || 'File'}</Text>
          {!!item.media_size && <Text style={styles.fileSize}>{formatFileSize(item.media_size)}</Text>}
        </View>
        <Download size={18} color={COLORS.primary} />
      </ScalePress>
    );
    return (
      <View>
        <Text style={[styles.msgText, me ? styles.msgTextMe : styles.msgTextThem]}>{item.message}</Text>
        {item.edited && <Text style={[styles.editedHint, me ? { color: 'rgba(255,255,255,0.55)' } : { color: COLORS.textMuted }]}>edited</Text>}
      </View>
    );
  };

  // ── RENDER MESSAGE ROW ──
  // This function returns ONLY the message row JSX.
  // Screen-level elements (headers, modals) must never be placed here.
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const me = isMe(item);
    const prev = messages[index - 1];
    const next = messages[index + 1];
    const firstInGroup = !prev || !isSameSender(prev, item);
    const lastInGroup = !next || !isSameSender(item, next);
    const showAv = showAvatar(item, index);
    const rxns = item.reactions?.length ? groupReactions(item.reactions, currentUserId) : [];
    const hasRxn = rxns.length > 0;
    const isImg = item.message_type === 'image' && !item.deleted;
    const myTL = 20, myTR = firstInGroup ? 20 : 6, myBR = lastInGroup ? 6 : 6, myBL = 20;
    const thTL = firstInGroup ? 20 : 6, thTR = 20, thBL = lastInGroup ? 6 : 6, thBR = 20;

    return (
      <View style={[
        styles.msgRow,
        me ? styles.msgRowMe : styles.msgRowThem,
        firstInGroup && { marginTop: 12 },
        { marginBottom: hasRxn ? 26 : 3 },
      ]}>
        {/* Avatar */}
        {!me && (
          <View style={styles.avatarSlot}>
            {showAv
              ? <Image source={{ uri: buildAvatarUrl(item.sender_id) }} style={styles.msgAvatar} />
              : <View style={styles.avatarGhost} />
            }
          </View>
        )}

        <View style={[styles.msgWrap, me ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
          <Pressable
            onLongPress={() => onLongPress(item)}
            style={[
              styles.bubble,
              isImg ? styles.bubbleImg : (me ? styles.bubbleMe : styles.bubbleThem),
              { borderTopLeftRadius: me ? myTL : thTL, borderTopRightRadius: me ? myTR : thTR, borderBottomRightRadius: me ? myBR : thBR, borderBottomLeftRadius: me ? myBL : thBL },
              item.deleted && styles.bubbleDeleted,
            ]}
          >
            {me && !isImg && !item.deleted && (
              <LinearGradient colors={[COLORS.bubbleMe, COLORS.bubbleMeDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            )}
            {renderContent(item)}
          </Pressable>

          {/* Reactions */}
          {hasRxn && (
            <View style={[styles.rxnRow, me ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
              {rxns.map((r, i) => (
                <AnimatedReactionBubble key={r.emoji} reaction={r} onPress={() => fetchReactions(item._id)} delay={i * 40} />
              ))}
            </View>
          )}

          {/* Timestamp */}
          <Text style={[styles.msgTime, me ? { textAlign: 'right' } : { textAlign: 'left' }]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>

        {/* Read receipt */}
        {me && lastInGroup && !item.deleted && (
          <View style={styles.receiptSlot}>
            {item.read ? <CheckCheck size={14} color={COLORS.read} /> : <Check size={14} color={COLORS.sent} />}
          </View>
        )}
      </View>
    );
  };

  // ── CHAT SCREEN ──
  if (selectedConversation) {
    const pOnline = onlineUsers.has(selectedConversation.participant._id);
    const pLastSeen = lastSeen[selectedConversation.participant._id];

    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

        <ImageView
          images={previewImages} imageIndex={previewIndex}
          visible={previewVisible} onRequestClose={() => setPreviewVisible(false)}
          swipeToCloseEnabled doubleTapToZoomEnabled
        />
        <ActionSheet
          visible={showActions} message={selectedMessage} isMe={selectedMessage ? isMe(selectedMessage) : false}
          onClose={() => setShowActions(false)}
          onEdit={(m: Message) => { setSelectedMessage(m); setShowEdit(true); }}
          onDelete={(m: Message, t: 'me' | 'everyone') => deleteMessage(m, t)}
          onReact={(m: Message) => { setSelectedMessage(m); setShowEmoji(true); }}
          onCopy={copyMsg}
        />
        <EditModal visible={showEdit} message={selectedMessage} onClose={() => { setShowEdit(false); setSelectedMessage(null); }} onSave={editMessage} />
        <EmojiPicker visible={showEmoji} onClose={() => setShowEmoji(false)} onSelect={onEmojiSelect} />
        <ReactionsView visible={showReactions} reactions={messageReactions} onClose={() => setShowReactions(false)} />

        {/* ── Chat Header ── */}
        <View style={styles.chatHeader}>
          <TouchableOpacity
            onPress={() => { setSelectedConversation(null); setMessages([]); emitTyping(false); setPendingImages([]); }}
            style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={26} color={COLORS.primary} />
          </TouchableOpacity>

          <View style={{ position: 'relative' }}>
            <Image source={{ uri: buildAvatarUrl(selectedConversation.participant) }} style={styles.chatHeaderAvatar} />
            {isSocketConnected && pOnline && (
              <Animated.View style={[styles.chatOnlineDot, { opacity: pulseAnim }]} />
            )}
          </View>

          <View style={styles.chatHeaderMeta}>
            <Text style={styles.chatHeaderName} numberOfLines={1}>{selectedConversation.participant.name}</Text>
            <Text style={[styles.chatHeaderSub, pOnline && { color: COLORS.online }]}>
              {typingUsers.length > 0 ? 'typing…' : pOnline ? 'Active now' : pLastSeen ? `Active ${formatTime(pLastSeen)}` : selectedConversation.participant.role}
            </Text>
          </View>

          <View style={styles.chatHeaderActions}>
            {[Phone, Video, Info].map((Icon, i) => (
              <TouchableOpacity key={i} style={styles.headerActionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon size={20} color={COLORS.primary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Messages ── */}
        <View style={styles.chatBg}>
          {messageLoading
            ? <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
            : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(m, i) => m._id || String(i)}
                renderItem={renderMessage}
                contentContainerStyle={styles.msgListContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyChat}>
                    <Text style={{ fontSize: 52 }}>💬</Text>
                    <Text style={styles.emptyTitle}>No messages yet</Text>
                    <Text style={styles.emptySub}>Say hello!</Text>
                  </View>
                }
              />
            )
          }
        </View>

        {/* Pending images */}
        {pendingImages.length > 0 && (
          <PendingImagesPreview
            uris={pendingImages.map(i => i.uri)}
            onRemove={i => setPendingImages(p => p.filter((_, j) => j !== i))}
            onSendAll={sendPendingImages}
          />
        )}

        {/* ── Input bar ── */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
          <View style={styles.inputBar}>
            {uploadingMedia ? (
              <View style={styles.uploadingRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.uploadingText}>Sending…</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity onPress={pickImages} style={styles.inputIconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <ImageIcon size={22} color={COLORS.primary} />
                </TouchableOpacity>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input} placeholder="Message…" placeholderTextColor={COLORS.textMuted}
                    value={newMessage} onChangeText={handleTextChange} multiline maxLength={1000}
                  />
                </View>
                {newMessage.trim() ? (
                  <TouchableOpacity onPress={sendTextMessage} style={[styles.sendBtn, sending && { opacity: 0.6 }]} disabled={sending}>
                    <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.sendBtnGrad}>
                      {sending ? <ActivityIndicator size="small" color="#FFF" /> : <Send size={17} color="#FFF" />}
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => { setSelectedMessage(null); setShowEmoji(true); }} style={styles.inputIconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Smile size={23} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>

        {toast.visible && <Toast message={toast.message} type={toast.type} onHide={() => setToast(t => ({ ...t, visible: false }))} />}
      </SafeAreaView>
    );
  }

  // ── CONVERSATIONS LIST SCREEN ──
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* ── Doctor search modal — rendered at screen level, outside any list ── */}
      <DoctorSearchModal
        visible={showDoctorSearch}
        onClose={() => setShowDoctorSearch(false)}
        onStartChat={startChatWithDoctor}
      />

      {/* Header */}
      <View style={styles.listHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Home' as never)} style={styles.backIconBtn}>
            <ChevronLeft size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.listTitle}>Messages</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* ── Find doctor button — only here in the conversation list ── */}
          <TouchableOpacity
            onPress={() => setShowDoctorSearch(true)}
            style={styles.addDoctorBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Plus size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={styles.connectionDot}>
            <Animated.View style={[styles.connDotInner, { opacity: pulseAnim, backgroundColor: isSocketConnected ? COLORS.online : COLORS.textMuted }]} />
          </View>
        </View>
      </View>

      {/* Search bar — filters existing conversations by name */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={17} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations…"
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading && !refreshing
        ? <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        : (
          <FlatList
            data={filteredConversations}
            keyExtractor={c => c._id}
            contentContainerStyle={{ paddingBottom: 30 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadConversations(); }} colors={[COLORS.primary]} tintColor={COLORS.primary} />
            }
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={{ fontSize: 60 }}>💬</Text>
                <Text style={styles.emptyTitle}>
                  {searchQuery ? 'No results found' : 'No conversations'}
                </Text>
                <Text style={styles.emptySub}>
                  {searchQuery ? 'Try a different name' : 'Tap + to chat with a doctor'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <ScalePress
                onPress={() => { setSelectedConversation(item); loadMessages(item._id); }}
                style={styles.convItem}
              >
                <View style={styles.convAvatarWrap}>
                  <Image source={{ uri: buildAvatarUrl(item.participant) }} style={styles.convAvatar} />
                  {isSocketConnected && onlineUsers.has(item.participant._id) && (
                    <Animated.View style={[styles.convOnlineDot, { opacity: pulseAnim }]} />
                  )}
                </View>
                <View style={styles.convBody}>
                  <View style={styles.convTop}>
                    <Text style={[styles.convName, item.unread_count > 0 && { fontWeight: '800' }]} numberOfLines={1}>
                      {item.participant.name}
                    </Text>
                    <Text style={[styles.convTime, item.unread_count > 0 && { color: COLORS.primary, fontWeight: '700' }]}>
                      {formatTime(item.last_message_at)}
                    </Text>
                  </View>
                  <View style={styles.convBottom}>
                    <Text style={[styles.convPreview, item.unread_count > 0 && { color: COLORS.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
                      {item.last_message?.deleted ? 'Message deleted'
                        : item.last_message?.message_type === 'image' ? '📷 Photo'
                          : item.last_message?.message_type === 'file' ? '📎 File'
                            : item.last_message?.message || 'Start chatting'}
                    </Text>
                    {item.unread_count > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text>
                      </View>
                    )}
                  </View>
                  {item.medical_record_id && (
                    <View style={styles.medBadge}>
                      <Ionicons name="medical" size={11} color={COLORS.primary} />
                      <Text style={styles.medBadgeText}>Medical</Text>
                    </View>
                  )}
                </View>
              </ScalePress>
            )}
          />
        )
      }

      {toast.visible && <Toast message={toast.message} type={toast.type} onHide={() => setToast(t => ({ ...t, visible: false }))} />}
    </SafeAreaView>
  );
};

// ==================== STYLES ====================
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  toast: { position: 'absolute', bottom: 30, left: 18, right: 18, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 9999, ...SHADOW.float },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '600', flex: 1 },

  // List header
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: Platform.OS === 'ios' ? 6 : 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  listTitle: { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
  backIconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.bgSecondary, justifyContent: 'center', alignItems: 'center' },
  connectionDot: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  connDotInner: { width: 10, height: 10, borderRadius: 5 },
  addDoctorBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },

  // Search bar
  searchWrap: { flexDirection: 'row', alignItems: 'center', margin: 14, paddingHorizontal: 14, height: 44, backgroundColor: COLORS.bgInput, borderRadius: RADIUS.pill, gap: 8, borderWidth: 1, borderColor: COLORS.divider },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary },

  // Conversation row
  convItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  convAvatarWrap: { position: 'relative', marginRight: 14, flexShrink: 0 },
  convAvatar: { width: 52, height: 52, borderRadius: 26 },
  convOnlineDot: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.online, borderWidth: 2.5, borderColor: COLORS.bg },
  convBody: { flex: 1, minWidth: 0 },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  convName: { fontSize: 15.5, fontWeight: '600', color: COLORS.textPrimary, flex: 1, letterSpacing: -0.2 },
  convTime: { fontSize: 12, color: COLORS.textMuted, marginLeft: 10, flexShrink: 0 },
  convBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  convPreview: { fontSize: 13.5, color: COLORS.textSecondary, flex: 1, marginRight: 8 },
  unreadBadge: { backgroundColor: COLORS.primary, borderRadius: 12, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  medBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 5, backgroundColor: COLORS.primaryLight, alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, gap: 3 },
  medBadgeText: { fontSize: 11, color: COLORS.primary, fontWeight: '700' },
  emptyList: { alignItems: 'center', paddingTop: 100, gap: 10 },

  // Chat header
  chatHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.divider, backgroundColor: COLORS.bg, ...SHADOW.bubble },
  backBtn: { padding: 6, marginRight: 2 },
  chatHeaderAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  chatOnlineDot: { position: 'absolute', bottom: 0, right: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.online, borderWidth: 2, borderColor: COLORS.bg },
  chatHeaderMeta: { flex: 1 },
  chatHeaderName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.3 },
  chatHeaderSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  chatHeaderActions: { flexDirection: 'row', gap: 4 },
  headerActionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },

  // Chat body
  chatBg: { flex: 1, backgroundColor: COLORS.bgChat },
  msgListContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 380, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  emptySub: { fontSize: 14, color: COLORS.textSecondary },

  // Message row
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 3 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },
  avatarSlot: { width: 30, marginRight: 6, alignSelf: 'flex-end', marginBottom: 2 },
  msgAvatar: { width: 30, height: 30, borderRadius: 15 },
  avatarGhost: { width: 30, height: 30 },
  msgWrap: { maxWidth: '74%' },
  msgTime: { fontSize: 10, color: COLORS.textMuted, marginTop: 3, paddingHorizontal: 2 },

  // Bubble
  bubble: { overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 10, ...SHADOW.bubble },
  bubbleMe: { backgroundColor: COLORS.bubbleMe },
  bubbleThem: { backgroundColor: COLORS.bubbleThem },
  bubbleImg: { backgroundColor: 'transparent', padding: 0, overflow: 'hidden' },
  bubbleDeleted: { backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.divider },

  msgText: { fontSize: 15.5, lineHeight: 22, letterSpacing: 0.1 },
  msgTextMe: { color: COLORS.textMe },
  msgTextThem: { color: COLORS.textThem },
  editedHint: { fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  caption: { fontSize: 13.5, color: COLORS.textThem, marginTop: 6, paddingHorizontal: 2, lineHeight: 18 },
  captionMe: { color: COLORS.textMe },

  deletedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  deletedText: { fontSize: 13.5, color: COLORS.textMuted, fontStyle: 'italic' },

  fileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: RADIUS.card, padding: 12, gap: 10, minWidth: 200, borderWidth: 1, borderColor: COLORS.divider },
  fileIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  fileName: { fontSize: 13.5, fontWeight: '600', color: COLORS.textPrimary },
  fileSize: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },

  receiptSlot: { width: 18, alignSelf: 'flex-end', marginBottom: 4, marginLeft: 3 },

  rxnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: -6, paddingHorizontal: 4 },
  reactionBubble: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.reactionBg, borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 3, gap: 3, borderWidth: 1.5, borderColor: COLORS.border, ...SHADOW.bubble },
  reactionBubbleActive: { backgroundColor: COLORS.reactionActiveBg, borderColor: COLORS.reactionActiveBorder },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '700' },
  reactionCountActive: { color: COLORS.primary },

  extraOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'center', alignItems: 'center' },
  extraText: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  imgLoading: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E9EF' },
  imgError: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F2F5' },

  pendingBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: COLORS.divider, paddingHorizontal: 14, paddingVertical: 8, gap: 10 },
  pendingScroll: { gap: 8, paddingRight: 4 },
  pendingThumb: { position: 'relative' },
  pendingImg: { width: 58, height: 58, borderRadius: 10 },
  pendingRemove: { position: 'absolute', top: -5, right: -5, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  addMoreBtn: { width: 58, height: 58, borderRadius: 10, backgroundColor: COLORS.primaryLight, borderWidth: 1.5, borderColor: COLORS.primaryMid, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  sendAllBtn: { marginLeft: 4 },
  sendAllGrad: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.pill },
  sendAllText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: COLORS.divider, gap: 8 },
  inputIconBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center', marginBottom: 1 },
  inputWrap: { flex: 1, backgroundColor: COLORS.bgInput, borderRadius: RADIUS.input, paddingHorizontal: 15, minHeight: 38, maxHeight: 108, justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.divider },
  input: { fontSize: 15, color: COLORS.textPrimary, paddingVertical: 9, maxHeight: 90, lineHeight: 20 },
  sendBtn: { marginBottom: 1 },
  sendBtnGrad: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', ...SHADOW.card },
  uploadingRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 10 },
  uploadingText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },

  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end', alignItems: 'center' },
  sheetHandle: { width: 38, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },

  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: COLORS.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingBottom: Platform.OS === 'ios' ? 34 : 20, paddingTop: 10, height: height * 0.54, ...SHADOW.float },
  catScroll: { maxHeight: 56 },
  catContent: { paddingHorizontal: 14, gap: 6 },
  catTab: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.bgSecondary, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  catTabActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  catLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, paddingHorizontal: 20, paddingVertical: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  editSheet: { backgroundColor: COLORS.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20, width: '100%', ...SHADOW.float },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  editTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  editInput: { backgroundColor: COLORS.bgInput, borderRadius: RADIUS.card, padding: 14, fontSize: 15, minHeight: 90, maxHeight: 180, textAlignVertical: 'top', color: COLORS.textPrimary, borderWidth: 1.5, borderColor: COLORS.divider, marginBottom: 16 },
  editFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  editCancel: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgSecondary },
  editCancelText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '700' },
  editSave: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 11, borderRadius: RADIUS.sm, minWidth: 80, alignItems: 'center', ...SHADOW.card },
  editSaveText: { fontSize: 15, color: '#FFF', fontWeight: '800' },

  actionSheet: { backgroundColor: COLORS.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingBottom: Platform.OS === 'ios' ? 34 : 20, paddingTop: 14, width: '100%', ...SHADOW.float },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 22, gap: 14 },
  actionLabel: { fontSize: 16, fontWeight: '500' },

  reactionsCard: { backgroundColor: COLORS.bg, borderRadius: 22, width: width - 48, maxHeight: height * 0.65, overflow: 'hidden', ...SHADOW.float },
  reactionsCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  reactionsCardTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  reactionRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: COLORS.divider, gap: 16 },
  reactionRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 56 },
  reactionCountBadge: { backgroundColor: COLORS.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  reactionCountBadgeText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  reactionUser: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reactionUserAvatar: { width: 28, height: 28, borderRadius: 14 },
  reactionUserName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },

  // Doctor search sheet
  doctorSearchSheet: { backgroundColor: COLORS.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28, width: '100%', ...SHADOW.float },
  doctorSearchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  doctorSearchTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  doctorSearchSubtitle: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  closeCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.bgSecondary, justifyContent: 'center', alignItems: 'center' },
  doctorSearchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgInput, borderRadius: RADIUS.input, paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderWidth: 1.5, borderColor: COLORS.divider, marginBottom: 16 },
  doctorSearchInput: { flex: 1, fontSize: 16, color: COLORS.textPrimary },
  doctorSearchError: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEE2E2', borderRadius: RADIUS.sm, padding: 12, marginBottom: 16 },
  doctorSearchErrorText: { flex: 1, fontSize: 13, color: COLORS.error },
  doctorSearchBtn: { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: RADIUS.input },
  doctorSearchBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  doctorFoundCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.card, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.primaryMid },
  doctorFoundAvatar: { width: 60, height: 60, borderRadius: 30 },
  doctorFoundName: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  doctorFoundRolePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.bg, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginBottom: 4 },
  doctorFoundRoleText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  doctorFoundPhone: { fontSize: 13, color: COLORS.textSecondary },
  doctorSearchActions: { flexDirection: 'row', gap: 12 },
  doctorSearchCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.input, backgroundColor: COLORS.bgSecondary, alignItems: 'center' },
  doctorSearchCancelText: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary },
  doctorSearchStartBtn: { flex: 1, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: RADIUS.input },
  doctorSearchStartText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});

export default MessageScreen;