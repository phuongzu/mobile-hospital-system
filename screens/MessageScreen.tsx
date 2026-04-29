import React, { useState, useEffect, useRef, useCallback, memo } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as FileSystem from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import * as Haptics from "expo-haptics";
import { MediaTypeOptions, launchImageLibraryAsync } from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import io, { Socket } from "socket.io-client";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import ImageView from "react-native-image-viewing";
import { Search } from "lucide-react-native";
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
} from "lucide-react-native";

const { width, height } = Dimensions.get("window");

// ==================== DESIGN SYSTEM ====================
export const COLORS = {
  primary: "#0A9689",
  primaryDark: "#077A6D",
  primaryLight: "#E3F5F3",
  primaryMid: "#C2EAE7",
  bubbleMe: "#0A9689",
  bubbleMeDark: "#077A6D",
  bubbleThem: "#FFFFFF",
  bg: "#FFFFFF",
  bgList: "#F6F8FA",
  bgChat: "#EDF1F6",
  bgInput: "#F0F2F5",
  bgSecondary: "#F6F8FA",
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  textOnPrimary: "#FFFFFF",
  textMe: "#FFFFFF",
  textThem: "#111827",
  online: "#10B981",
  read: "#0A9689",
  sent: "#9CA3AF",
  divider: "#E5E9EF",
  border: "#DDE2E8",
  error: "#EF4444",
  success: "#10B981",
  warning: "#F59E0B",
  reactionBg: "#FFFFFF",
  reactionActiveBg: "#E3F5F3",
  reactionActiveBorder: "#0A9689",
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
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  bubble: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  float: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 12,
  },
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
  message_type: "text" | "image" | "file";
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
  deleted_for?: string[];
  deleted_for_me?: boolean;
  reactions?: Reaction[];
  reactions_count?: number;
  clientTempId?: string;
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
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

const API_BASE_URL = "http://localhost:3000";
const API_ENDPOINT = `${API_BASE_URL}/api`;

// ==================== UTILITIES ====================
const buildMediaUrl = (url?: string | null): string => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
};

const buildAvatarUrl = (user?: User | null): string => {
  if (!user?.avatar)
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "U")}&background=0A9689&color=fff&size=150&bold=true`;
  if (user.avatar.startsWith("http")) return user.avatar;
  return `${API_BASE_URL}${user.avatar.startsWith("/") ? user.avatar : `/uploads/avatars/${user.avatar}`}`;
};

const formatFileSize = (bytes: number): string => {
  if (!bytes) return "0 B";
  const k = 1024;
  const s = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${s[i]}`;
};

const formatTime = (d?: string | number | Date): string => {
  if (!d) return "";
  const date = new Date(d);
  const diff = (Date.now() - date.getTime()) / 86400000;
  if (diff < 1)
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 2) return "Yesterday";
  if (diff < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const groupReactions = (
  reactions: Reaction[],
  myId: string,
): GroupedReaction[] => {
  const map: Record<string, GroupedReaction> = {};
  reactions.forEach((r) => {
    if (!map[r.emoji])
      map[r.emoji] = {
        emoji: r.emoji,
        count: 0,
        users: [],
        isReactedByMe: false,
      };
    map[r.emoji].count++;
    map[r.emoji].users.push(r.user_id);
    if (r.user_id._id === myId) map[r.emoji].isReactedByMe = true;
  });
  return Object.values(map);
};

// ==================== SCALE PRESS ====================
const ScalePress = ({
  children,
  onPress,
  onLongPress,
  style,
  disabled,
}: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        style={style}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.94,
            useNativeDriver: true,
            speed: 50,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 4,
          }).start()
        }
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

// ==================== ANIMATED REACTION BUBBLE ====================
const AnimatedReactionBubble = memo(
  ({
    reaction,
    onPress,
    delay = 0,
  }: {
    reaction: GroupedReaction;
    onPress: () => void;
    delay?: number;
  }) => {
    const scale = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.spring(scale, {
            toValue: 1,
            tension: 180,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 160,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }, []);
    return (
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.75}
          style={[
            styles.reactionBubble,
            reaction.isReactedByMe && styles.reactionBubbleActive,
          ]}
        >
          <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
          {reaction.count > 1 && (
            <Text
              style={[
                styles.reactionCount,
                reaction.isReactedByMe && styles.reactionCountActive,
              ]}
            >
              {reaction.count}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  },
);

// ==================== TOAST ====================
const Toast = memo(
  ({
    message,
    type,
    onHide,
  }: {
    message: string;
    type: "success" | "error" | "info";
    onHide: () => void;
  }) => {
    const y = useRef(new Animated.Value(80)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.parallel([
        Animated.spring(y, {
          toValue: 0,
          tension: 60,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
      const t = setTimeout(
        () =>
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(onHide),
        2800,
      );
      return () => clearTimeout(t);
    }, []);
    const bg =
      type === "success"
        ? COLORS.success
        : type === "error"
          ? COLORS.error
          : COLORS.primary;
    const icon =
      type === "success"
        ? "checkmark-circle"
        : type === "error"
          ? "alert-circle"
          : "information-circle";
    return (
      <Animated.View
        style={[
          styles.toast,
          { backgroundColor: bg, transform: [{ translateY: y }], opacity },
        ]}
      >
        <Ionicons name={icon as any} size={20} color="#FFF" />
        <Text style={styles.toastText}>{message}</Text>
      </Animated.View>
    );
  },
);

// ==================== MULTI-IMAGE GRID ====================
const MultiImageGrid = memo(
  ({
    urls,
    onPressImage,
    onLongPress,
  }: {
    urls: string[];
    onPressImage: (url: string, index: number) => void;
    onLongPress: () => void;
  }) => {
    const count = urls.length;
    const maxW = width * 0.62;
    if (count === 1)
      return (
        <TouchableOpacity
          onPress={() => onPressImage(urls[0], 0)}
          onLongPress={onLongPress}
          activeOpacity={0.92}
        >
          <SingleImagePreview uri={urls[0]} maxW={maxW} aspectRatio={1} />
        </TouchableOpacity>
      );
    if (count === 2) {
      const imgW = (maxW - 2) / 2;
      return (
        <TouchableOpacity onLongPress={onLongPress} activeOpacity={1}>
          <View
            style={{
              flexDirection: "row",
              gap: 2,
              borderRadius: RADIUS.image,
              overflow: "hidden",
            }}
          >
            {urls.map((u, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => onPressImage(u, i)}
                activeOpacity={0.88}
              >
                <SingleImagePreview
                  uri={u}
                  maxW={imgW}
                  aspectRatio={1}
                  borderRadius={0}
                />
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
          <View
            style={{
              flexDirection: "row",
              gap: 2,
              borderRadius: RADIUS.image,
              overflow: "hidden",
            }}
          >
            <TouchableOpacity
              onPress={() => onPressImage(urls[0], 0)}
              activeOpacity={0.88}
            >
              <SingleImagePreview
                uri={urls[0]}
                maxW={rightW}
                aspectRatio={0.9}
                borderRadius={0}
              />
            </TouchableOpacity>
            <View style={{ flexDirection: "column", gap: 2 }}>
              {[1, 2].map((i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => onPressImage(urls[i], i)}
                  activeOpacity={0.88}
                >
                  <SingleImagePreview
                    uri={urls[i]}
                    maxW={rightW}
                    aspectRatio={0.45}
                    borderRadius={0}
                  />
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
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 2,
            borderRadius: RADIUS.image,
            overflow: "hidden",
            width: maxW,
          }}
        >
          {shown.map((u, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => onPressImage(u, i)}
              activeOpacity={0.88}
              style={{ position: "relative" }}
            >
              <SingleImagePreview
                uri={u}
                maxW={cellW}
                aspectRatio={1}
                borderRadius={0}
              />
              {i === 3 && extra > 0 && (
                <View style={styles.extraOverlay}>
                  <Text style={styles.extraText}>+{extra}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    );
  },
);

const SingleImagePreview = memo(
  ({
    uri,
    maxW,
    aspectRatio,
    borderRadius = RADIUS.image,
  }: {
    uri: string;
    maxW: number;
    aspectRatio: number;
    borderRadius?: number;
  }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const fade = useRef(new Animated.Value(0)).current;
    return (
      <View
        style={{
          width: maxW,
          height: maxW * aspectRatio,
          backgroundColor: "#E5E9EF",
          borderRadius,
          overflow: "hidden",
        }}
      >
        {!error ? (
          <Animated.Image
            source={{ uri }}
            style={{ width: "100%", height: "100%", opacity: fade }}
            resizeMode="cover"
            onLoad={() => {
              setLoading(false);
              Animated.timing(fade, {
                toValue: 1,
                duration: 220,
                useNativeDriver: true,
              }).start();
            }}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        ) : (
          <View style={styles.imgError}>
            <Ionicons name="image-outline" size={28} color="#9CA3AF" />
          </View>
        )}
        {loading && !error && (
          <View style={[StyleSheet.absoluteFill, styles.imgLoading]}>
            <ActivityIndicator size="small" color="#9CA3AF" />
          </View>
        )}
      </View>
    );
  },
);

// ==================== EMOJI CATEGORIES ====================
const EMOJI_CATS = [
  {
    id: "recent",
    label: "Recent",
    icon: "🕐",
    emojis: ["❤️", "😂", "😮", "😢", "😠", "👍", "🔥", "🎉", "✨", "🙏"],
  },
  {
    id: "smileys",
    label: "Smileys",
    icon: "😊",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "😂",
      "🤣",
      "😊",
      "😇",
      "🙂",
      "😉",
      "😌",
      "😍",
      "🥰",
      "😘",
      "😋",
      "😛",
      "😜",
      "🤪",
      "😎",
      "🥳",
      "😏",
      "😒",
      "😔",
      "😟",
      "😕",
      "😣",
      "😫",
      "😩",
      "🥺",
      "😢",
      "😭",
      "😤",
      "😠",
      "😡",
      "🤬",
      "🤯",
      "😳",
      "😱",
      "😶",
      "🤐",
      "😬",
      "🙄",
      "😴",
      "🤒",
      "🤕",
    ],
  },
  {
    id: "gestures",
    label: "Gestures",
    icon: "👋",
    emojis: [
      "👋",
      "🤚",
      "🖐️",
      "✋",
      "👌",
      "✌️",
      "🤞",
      "👈",
      "👉",
      "👆",
      "👇",
      "☝️",
      "👍",
      "👎",
      "✊",
      "👊",
      "👏",
      "🙌",
      "🤝",
      "🙏",
      "💅",
      "✍️",
      "🤙",
    ],
  },
  {
    id: "hearts",
    label: "Hearts",
    icon: "❤️",
    emojis: [
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "🤎",
      "💔",
      "❣️",
      "💕",
      "💞",
      "💓",
      "💗",
      "💖",
      "💘",
      "💝",
      "💟",
      "💋",
      "🥰",
      "😍",
      "😘",
    ],
  },
  {
    id: "fun",
    label: "Fun",
    icon: "🎉",
    emojis: [
      "🎉",
      "🎊",
      "🎈",
      "🎁",
      "🏆",
      "🥇",
      "⭐",
      "🌟",
      "💫",
      "✨",
      "🔥",
      "💯",
      "🎵",
      "🎶",
      "🎸",
      "🎤",
      "🍕",
      "🍔",
      "🍜",
      "🍣",
      "🍰",
      "🎂",
      "🍫",
      "☕",
      "🚀",
      "🌈",
      "🌸",
      "🌺",
      "🌻",
      "🐶",
      "🐱",
      "🦋",
    ],
  },
];

const EmojiPicker = memo(
  ({
    visible,
    onClose,
    onSelect,
  }: {
    visible: boolean;
    onClose: () => void;
    onSelect: (e: string) => void;
  }) => {
    const y = useRef(new Animated.Value(420)).current;
    const [cat, setCat] = useState(0);
    const CELL = Math.floor((width - 32) / 8);
    useEffect(() => {
      if (visible)
        Animated.spring(y, {
          toValue: 0,
          tension: 65,
          friction: 9,
          useNativeDriver: true,
        }).start();
      else {
        y.setValue(420);
        setCat(0);
      }
    }, [visible]);
    if (!visible) return null;
    return (
      <Modal visible transparent animationType="none" onRequestClose={onClose}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.pickerBackdrop}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[styles.pickerSheet, { transform: [{ translateY: y }] }]}
              >
                <View style={styles.sheetHandle} />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.catScroll}
                  contentContainerStyle={styles.catContent}
                >
                  {EMOJI_CATS.map((c, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setCat(i)}
                      style={[styles.catTab, cat === i && styles.catTabActive]}
                    >
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
                      style={{
                        width: CELL,
                        height: CELL,
                        justifyContent: "center",
                        alignItems: "center",
                        borderRadius: 10,
                      }}
                      onPress={() => onSelect(item)}
                      activeOpacity={0.6}
                    >
                      <Text style={{ fontSize: 28 }}>{item}</Text>
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingBottom: 30,
                  }}
                  showsVerticalScrollIndicator={false}
                />
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  },
);

// ==================== EDIT MODAL ====================
const EditModal = memo(
  ({
    visible,
    message,
    onClose,
    onSave,
  }: {
    visible: boolean;
    message: Message | null;
    onClose: () => void;
    onSave: (id: string, text: string) => Promise<void>;
  }) => {
    const [text, setText] = useState("");
    const [saving, setSaving] = useState(false);
    const y = useRef(new Animated.Value(height)).current;
    useEffect(() => {
      if (visible && message) {
        setText(message.message);
        Animated.spring(y, {
          toValue: 0,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }).start();
      } else y.setValue(height);
    }, [visible, message]);
    const save = async () => {
      if (!message || !text.trim()) return;
      setSaving(true);
      try {
        await onSave(message._id, text.trim());
        onClose();
      } catch {
      } finally {
        setSaving(false);
      }
    };
    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={onClose}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[styles.editSheet, { transform: [{ translateY: y }] }]}
              >
                <View style={styles.sheetHandle} />
                <View style={styles.editHeader}>
                  <Text style={styles.editTitle}>Edit Message</Text>
                  <TouchableOpacity
                    onPress={onClose}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <X size={22} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.editInput}
                  value={text}
                  onChangeText={setText}
                  multiline
                  autoFocus
                  placeholder="Edit your message…"
                  placeholderTextColor={COLORS.textMuted}
                  maxLength={1000}
                />
                <View style={styles.editFooter}>
                  <TouchableOpacity style={styles.editCancel} onPress={onClose}>
                    <Text style={styles.editCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.editSave,
                      (!text.trim() || saving) && { opacity: 0.45 },
                    ]}
                    onPress={save}
                    disabled={!text.trim() || saving}
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
  },
);

// ==================== ACTION SHEET (Android) ====================
const ActionSheet = memo(
  ({
    visible,
    message,
    isMe,
    onClose,
    onEdit,
    onDelete,
    onReact,
    onCopy,
  }: any) => {
    const y = useRef(new Animated.Value(height)).current;
    useEffect(() => {
      if (visible)
        Animated.spring(y, {
          toValue: 0,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }).start();
      else y.setValue(height);
    }, [visible]);
    if (!visible || !message || Platform.OS === "ios") return null;
    const items = [
      {
        label: "React",
        icon: "😊",
        color: COLORS.primary,
        fn: () => {
          onReact(message);
          onClose();
        },
      },
      ...(isMe && message.message_type === "text" && !message.deleted
        ? [
          {
            label: "Edit",
            icon: "✏️",
            color: COLORS.textPrimary,
            fn: () => {
              onEdit(message);
              onClose();
            },
          },
        ]
        : []),
      {
        label: "Copy",
        icon: "📋",
        color: COLORS.textPrimary,
        fn: () => {
          onCopy(message);
          onClose();
        },
      },
      {
        label: "Delete for me",
        icon: "🗑️",
        color: COLORS.error,
        fn: () => {
          onDelete(message, "me");
          onClose();
        },
      },
      ...(isMe
        ? [
          {
            label: "Delete for everyone",
            icon: "⛔",
            color: COLORS.error,
            fn: () => {
              onDelete(message, "everyone");
              onClose();
            },
          },
        ]
        : []),
    ];
    return (
      <Modal visible transparent animationType="none" onRequestClose={onClose}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[styles.actionSheet, { transform: [{ translateY: y }] }]}
              >
                <View style={styles.sheetHandle} />
                {items.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.actionItem}
                    onPress={item.fn}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                    <Text style={[styles.actionLabel, { color: item.color }]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[
                    styles.actionItem,
                    {
                      marginTop: 4,
                      borderTopWidth: 1,
                      borderTopColor: COLORS.divider,
                    },
                  ]}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.actionLabel,
                      {
                        color: COLORS.textSecondary,
                        textAlign: "center",
                        flex: 1,
                      },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  },
);

// ==================== REACTIONS VIEW ====================
const ReactionsView = memo(
  ({
    visible,
    reactions,
    onClose,
  }: {
    visible: boolean;
    reactions: GroupedReaction[];
    onClose: () => void;
  }) => {
    const scale = useRef(new Animated.Value(0.88)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      if (visible) {
        Animated.parallel([
          Animated.spring(scale, {
            toValue: 1,
            tension: 65,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        scale.setValue(0.88);
        opacity.setValue(0);
      }
    }, [visible]);
    if (!visible) return null;
    return (
      <Modal visible transparent animationType="none" onRequestClose={onClose}>
        <Animated.View style={[styles.modalOverlay, { opacity }]}>
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <Animated.View
            style={[styles.reactionsCard, { transform: [{ scale }] }]}
          >
            <View style={styles.reactionsCardHeader}>
              <Text style={styles.reactionsCardTitle}>Reactions</Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {reactions.map((r, i) => (
                <View key={i} style={styles.reactionRow}>
                  <View style={styles.reactionRowLeft}>
                    <Text style={{ fontSize: 24 }}>{r.emoji}</Text>
                    <View style={styles.reactionCountBadge}>
                      <Text style={styles.reactionCountBadgeText}>
                        {r.count}
                      </Text>
                    </View>
                  </View>
                  <View style={{ gap: 8 }}>
                    {r.users.map((u, j) => (
                      <View key={j} style={styles.reactionUser}>
                        <Image
                          source={{ uri: buildAvatarUrl(u) }}
                          style={styles.reactionUserAvatar}
                        />
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
  },
);

// ==================== PENDING IMAGES PREVIEW ====================
const PendingImagesPreview = memo(
  ({
    uris,
    onRemove,
    onSendAll,
  }: {
    uris: string[];
    onRemove: (i: number) => void;
    onSendAll: () => void;
  }) => {
    if (!uris.length) return null;
    return (
      <View style={styles.pendingBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pendingScroll}
        >
          {uris.map((u, i) => (
            <View key={i} style={styles.pendingThumb}>
              <Image
                source={{ uri: u }}
                style={styles.pendingImg}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.pendingRemove}
                onPress={() => onRemove(i)}
              >
                <X size={12} color="#FFF" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addMoreBtn} onPress={onSendAll}>
            <Plus size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </ScrollView>
        <TouchableOpacity style={styles.sendAllBtn} onPress={onSendAll}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryDark]}
            style={styles.sendAllGrad}
          >
            <Send size={16} color="#FFF" />
            <Text style={styles.sendAllText}>
              {uris.length > 1 ? `Send ${uris.length}` : "Send"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  },
);

// ==================== DOCTOR SEARCH MODAL ====================
const DoctorSearchModal = memo(
  ({
    visible,
    onClose,
    onStartChat,
  }: {
    visible: boolean;
    onClose: () => void;
    onStartChat: (doctor: User) => void;
  }) => {
    const [phone, setPhone] = useState("");
    const [searching, setSearching] = useState(false);
    const [found, setFound] = useState<User | null>(null);
    const [error, setError] = useState("");
    const slideY = useRef(new Animated.Value(height)).current;

    useEffect(() => {
      if (visible) {
        Animated.spring(slideY, {
          toValue: 0,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.timing(slideY, {
          toValue: height,
          duration: 240,
          useNativeDriver: true,
        }).start();
        setTimeout(() => {
          setPhone("");
          setFound(null);
          setError("");
        }, 260);
      }
    }, [visible]);

    const search = async () => {
      if (!phone.trim() || searching) return;
      setSearching(true);
      setError("");
      setFound(null);
      try {
        const token = await AsyncStorage.getItem("authToken");
        const res = await axios.get(`${API_ENDPOINT}/messages/search-doctor`, {
          params: { phone: phone.trim() },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.success) {
          setFound(res.data.data);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (e: any) {
        setError(
          e.response?.data?.message || "No doctor found with this phone number",
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setSearching(false);
      }
    };

    const handleStart = () => {
      if (found) onStartChat(found);
    };

    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={onClose}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.doctorSearchSheet,
                  { transform: [{ translateY: slideY }] },
                ]}
              >
                <View style={styles.sheetHandle} />
                <View style={styles.doctorSearchHeader}>
                  <View>
                    <Text style={styles.doctorSearchTitle}>Find a Doctor</Text>
                    <Text style={styles.doctorSearchSubtitle}>
                      Search by phone number to start a chat
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeCircle}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.doctorSearchInputWrap}>
                  <Ionicons
                    name="call-outline"
                    size={20}
                    color={COLORS.textMuted}
                  />
                  <TextInput
                    style={styles.doctorSearchInput}
                    placeholder="Doctor's phone number"
                    placeholderTextColor={COLORS.textMuted}
                    value={phone}
                    onChangeText={(t) => {
                      setPhone(t);
                      setFound(null);
                      setError("");
                    }}
                    keyboardType="phone-pad"
                    autoFocus
                    returnKeyType="search"
                    onSubmitEditing={search}
                  />
                  {phone.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setPhone("");
                        setFound(null);
                        setError("");
                      }}
                    >
                      <X size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
                {!!error && (
                  <View style={styles.doctorSearchError}>
                    <Ionicons
                      name="alert-circle"
                      size={18}
                      color={COLORS.error}
                    />
                    <Text style={styles.doctorSearchErrorText}>{error}</Text>
                  </View>
                )}
                {found && (
                  <View style={styles.doctorFoundCard}>
                    <Image
                      source={{ uri: buildAvatarUrl(found) }}
                      style={styles.doctorFoundAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.doctorFoundName}>{found.name}</Text>
                      <View style={styles.doctorFoundRolePill}>
                        <Ionicons
                          name="medical"
                          size={12}
                          color={COLORS.primary}
                        />
                        <Text style={styles.doctorFoundRoleText}>Doctor</Text>
                      </View>
                      {found.phoneNumber && (
                        <Text style={styles.doctorFoundPhone}>
                          {found.phoneNumber}
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={COLORS.success}
                    />
                  </View>
                )}
                {!found ? (
                  <TouchableOpacity
                    style={[
                      styles.doctorSearchBtn,
                      (!phone.trim() || searching) && { opacity: 0.5 },
                    ]}
                    onPress={search}
                    disabled={!phone.trim() || searching}
                  >
                    {searching ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Search size={18} color="#FFF" />
                        <Text style={styles.doctorSearchBtnText}>Search</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.doctorSearchActions}>
                    <TouchableOpacity
                      style={styles.doctorSearchCancelBtn}
                      onPress={() => {
                        setFound(null);
                        setPhone("");
                      }}
                    >
                      <Text style={styles.doctorSearchCancelText}>
                        Search again
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.doctorSearchStartBtn}
                      onPress={handleStart}
                    >
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
  },
);

// ==================== MAIN COMPONENT ====================
const MessageScreen = () => {
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<Socket | null>(null);
  const selectedConvRef = useRef<Conversation | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deletingMessagesRef = useRef<Set<string>>(new Set());

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [lastSeen, setLastSeen] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const sendTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Pending images
  const [pendingImages, setPendingImages] = useState<
    { uri: string; name: string; mime: string }[]
  >([]);

  // Modals
  const [previewImages, setPreviewImages] = useState<{ uri: string }[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [messageReactions, setMessageReactions] = useState<GroupedReaction[]>(
    [],
  );
  const [showDoctorSearch, setShowDoctorSearch] = useState(false);

  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success" as "success" | "error" | "info",
  });
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") =>
      setToast({ visible: true, message, type }),
    [],
  );

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    selectedConvRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    if (isSocketConnected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [isSocketConnected]);

  const isMe = useCallback(
    (msg: any) => {
      const senderId = (msg.sender_id?._id || msg.sender_id || "").toString();
      return senderId === currentUserId.toString();
    },
    [currentUserId],
  );
  const isSameSender = useCallback(
    (a: Message, b?: Message) => !!b && a.sender_id?._id === b.sender_id?._id,
    [],
  );
  const showAvatar = useCallback(
    (msg: Message, idx: number) => {
      if (isMe(msg)) return false;
      return !isSameSender(msg, messages[idx + 1]);
    },
    [messages, isMe, isSameSender],
  );

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 100);
  }, []);

  const emitTyping = useCallback(
    (start: boolean) => {
      if (socketRef.current?.connected && selectedConversation) {
        socketRef.current.emit(start ? "typing_start" : "typing_stop", {
          conversationId: selectedConversation._id,
          userId: currentUserId,
        });
      }
    },
    [selectedConversation, currentUserId],
  );

  const handleTextChange = (t: string) => {
    setNewMessage(t);
    if (t.length > 0) {
      emitTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => emitTyping(false), 1000);
    } else emitTyping(false);
  };

  // ==================== SOCKET HANDLERS ====================

  const handleNewMessage = useCallback(
    (rawMsg: any) => {
      if (!rawMsg) return;

      const msg: Message = {
        _id: rawMsg._id || rawMsg.message?._id,
        clientTempId: rawMsg.clientTempId,
        conversation_id:
          rawMsg.conversation_id ||
          rawMsg.conversationId ||
          rawMsg.message?.conversation_id,
        sender_id:
          rawMsg.sender_id || rawMsg.senderId || rawMsg.message?.sender_id,
        receiver_id:
          rawMsg.receiver_id ||
          rawMsg.receiverId ||
          rawMsg.message?.receiver_id,
        message:
          rawMsg.message?.message || rawMsg.message || rawMsg.content || "",
        message_type:
          rawMsg.message_type || rawMsg.message?.message_type || "text",
        media_url: rawMsg.media_url || rawMsg.message?.media_url,
        media_urls: rawMsg.media_urls || rawMsg.message?.media_urls,
        media_name: rawMsg.media_name || rawMsg.message?.media_name,
        media_size: rawMsg.media_size || rawMsg.message?.media_size,
        media_mime: rawMsg.media_mime || rawMsg.message?.media_mime,
        read: rawMsg.read || rawMsg.message?.read || false,
        timestamp:
          rawMsg.timestamp ||
          rawMsg.message?.timestamp ||
          new Date().toISOString(),
        createdAt:
          rawMsg.createdAt ||
          rawMsg.message?.createdAt ||
          new Date().toISOString(),
        updatedAt:
          rawMsg.updatedAt ||
          rawMsg.message?.updatedAt ||
          new Date().toISOString(),
        edited: rawMsg.edited || rawMsg.message?.edited || false,
        deleted: rawMsg.deleted || rawMsg.message?.deleted || false,
        reactions: rawMsg.reactions || rawMsg.message?.reactions || [],
        reactions_count:
          rawMsg.reactions_count || rawMsg.message?.reactions_count || 0,
      };

      const convId = msg.conversation_id;
      const active = selectedConvRef.current;

      // Update conversations list
      setConversations((prev) => {
        const existing = prev.find((c) => c._id === convId);
        if (existing) {
          return prev
            .map((c) =>
              c._id === convId
                ? {
                  ...c,
                  last_message: msg,
                  last_message_at: msg.timestamp || msg.createdAt,
                  unread_count:
                    active?._id === convId ? 0 : (c.unread_count || 0) + 1,
                }
                : c,
            )
            .sort(
              (a, b) =>
                new Date(b.last_message_at).getTime() -
                new Date(a.last_message_at).getTime(),
            );
        }
        return prev;
      });

      // ✅ [MOBILE FIX] Always reset sending state if this is our message (clientTempId matches)
      const senderIdStr = (
        msg.sender_id?._id ||
        msg.sender_id ||
        ""
      ).toString();
      const currentIdStr = currentUserId.toString();

      if (msg.clientTempId && senderIdStr === currentIdStr) {
        setSending(false);
        if (sendTimeoutRef.current) {
          clearTimeout(sendTimeoutRef.current);
          sendTimeoutRef.current = null;
        }
      }

      // ✅ Update messages list if this is the active conversation
      if (active?._id === convId) {
        setMessages((prev) => {
          if (msg.clientTempId) {
            const tempIndex = prev.findIndex(
              (m) => m.clientTempId === msg.clientTempId,
            );
            if (tempIndex !== -1) {
              const updated = [...prev];
              updated[tempIndex] = {
                ...msg,
                clientTempId: undefined,
                status: "sent",
              };
              return updated;
            }
          }
          if (prev.some((m) => m._id === msg._id)) {
            return prev;
          }

          return [...prev, msg];
        });
        if (socketRef.current?.connected && senderIdStr !== currentIdStr) {
          socketRef.current.emit("mark_as_read", { conversationId: convId });
        }

        setTimeout(() => scrollToBottom(), 150);
      }
    },
    [currentUserId, scrollToBottom],
  );

  const sendTextMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    const text = newMessage.trim();
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    setNewMessage("");
    setSending(true);
    emitTyping(false);
    if (sendTimeoutRef.current) {
      clearTimeout(sendTimeoutRef.current);
      sendTimeoutRef.current = null;
    }

    const tempMsg: Message = {
      _id: tempId,
      clientTempId: tempId,
      conversation_id: selectedConversation._id,
      sender_id: currentUser || {
        _id: currentUserId,
        name: "You",
        role: "patient",
      },
      receiver_id: selectedConversation.participant,
      message: text,
      message_type: "text",
      read: false,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "sending",
    };

    setMessages((prev) => [...prev, tempMsg]);
    setTimeout(() => scrollToBottom(), 100);

    // Set timeout để fallback nếu không nhận được phản hồi
    sendTimeoutRef.current = setTimeout(() => {
      console.log("⏰ Send timeout for tempId:", tempId);
      setMessages((prev) => prev.filter((m) => m.clientTempId !== tempId));
      setSending(false);
      showToast("Message send timeout", "error");
      sendTimeoutRef.current = null;
    }, 12000);

    try {
      const token = await AsyncStorage.getItem("authToken");
      if (socketRef.current?.connected) {
        socketRef.current.emit(
          "send_message",
          {
            conversationId: selectedConversation._id,
            receiverId: selectedConversation.participant._id,
            message: text,
            messageType: "text",
            clientTempId: tempId,
          },
          (res: any) => {
            if (res?.success) {
              console.log("✅ Send ACK received, resolve bubble");
              setMessages((prev) =>
                prev.map((m) =>
                  m.clientTempId === tempId || m._id === tempId
                    ? {
                      ...m,
                      _id: res.messageId || res.data?._id,
                      clientTempId: undefined,
                      status: "sent",
                    }
                    : m,
                ),
              );
              setSending(false);
              if (sendTimeoutRef.current) {
                clearTimeout(sendTimeoutRef.current);
                sendTimeoutRef.current = null;
              }
            } else {
              console.warn("Socket ACK error, falling back to REST");
              sendViaRest(tempId, text, token);
            }
          },
        );
      } else {
        await sendViaRest(tempId, text, token);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("Send error:", error);
      setMessages((prev) => prev.filter((m) => m.clientTempId !== tempId));
      setSending(false);
      showToast("Failed to send", "error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
        sendTimeoutRef.current = null;
      }
    }
  };

  // ✅ Helper for Mobile REST fallback
  const sendViaRest = async (
    tempId: string,
    text: string,
    token: string | null,
  ) => {
    try {
      const res = await axios.post(
        `${API_ENDPOINT}/messages/send`,
        {
          receiver_id: selectedConversation?.participant._id,
          message: text,
          message_type: "text",
          clientTempId: tempId,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data.success) {
        const savedMsg = res.data.data?.message || res.data.data;
        setMessages((prev) =>
          prev.map((m) =>
            m.clientTempId === tempId || m._id === tempId
              ? { ...savedMsg, clientTempId: undefined, status: "sent" }
              : m,
          ),
        );
        setSending(false);
        if (sendTimeoutRef.current) {
          clearTimeout(sendTimeoutRef.current);
          sendTimeoutRef.current = null;
        }
      } else {
        throw new Error("REST send failed");
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.clientTempId !== tempId));
      setSending(false);
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
        sendTimeoutRef.current = null;
      }
    }
  };

  useEffect(() => {
    return () => {
      if (sendTimeoutRef.current) clearTimeout(sendTimeoutRef.current);
    };
  }, []);

  // ✅ FIXED: Proper socket listener for message_deleted event
  const handleMessageDeleted = useCallback(
    (data: any) => {
      console.log("🗑️ Received message_deleted event:", data);

      const messageId = data.messageId || data.message?._id;
      if (!messageId) return;

      const conversationId =
        data.conversationId || data.message?.conversation_id;
      if (conversationId !== selectedConvRef.current?._id) return;

      const { type, userId } = data;

      console.log(`📝 Processing delete: messageId=${messageId}, type=${type}`);

      // ✅ CASE 1: Deleted for EVERYONE
      if (type === "everyone") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? {
                ...msg,
                deleted: true,
                deleted_for_me: true,
                message: "This message was deleted",
                message_type: "text",
                media_url: undefined,
                media_urls: undefined,
                media_name: undefined,
                media_mime: undefined,
                media_size: undefined,
                reactions: [],
                reactions_count: 0,
                edited: false,
              }
              : msg,
          ),
        );
        setConversations((prev) =>
          prev.map((conv) =>
            conv._id === conversationId && conv.last_message?._id === messageId
              ? {
                ...conv,
                last_message: {
                  ...conv.last_message,
                  deleted: true,
                  deleted_for_me: true,
                  message: "This message was deleted",
                  message_type: "text",
                } as any,
              }
              : conv,
          ),
        );
      }
      // ✅ CASE 2: Deleted for ME ONLY
      else if (type === "me") {
        if (userId !== currentUserId) {
          console.log(
            `ℹ️ Delete is for another user (${userId}), skipping local update`,
          );
          return;
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? {
                ...msg,
                deleted_for_me: true,
                message: "This message was deleted for you",
                message_type: "text",
                media_url: undefined,
                media_urls: undefined,
                media_name: undefined,
                reactions: [],
                reactions_count: 0,
              }
              : msg,
          ),
        );

        // ✅ Update last_message preview if applicable
        setConversations((prev) =>
          prev.map((conv) =>
            conv._id === conversationId && conv.last_message?._id === messageId
              ? {
                ...conv,
                last_message: {
                  ...conv.last_message,
                  deleted_for_me: true,
                  message: "This message was deleted for you",
                } as any,
              }
              : conv,
          ),
        );
      }
    },
    [currentUserId],
  );

  const handleMessageEdited = useCallback((data: any) => {
    if (data.conversationId === selectedConvRef.current?._id) {
      setMessages((prev) =>
        prev.map((m) => (m._id === data.message._id ? data.message : m)),
      );
    }
  }, []);

  const handleReactionAdded = useCallback((data: any) => {
    if (data.conversationId === selectedConvRef.current?._id) {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.messageId
            ? {
              ...m,
              reactions: data.message?.reactions || data.reactions,
              reactions_count: data.message?.reactions?.length || 0,
            }
            : m,
        ),
      );
    }
  }, []);

  const handleReactionRemoved = useCallback((data: any) => {
    if (data.conversationId === selectedConvRef.current?._id) {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.messageId
            ? {
              ...m,
              reactions: data.message?.reactions || data.reactions,
              reactions_count: data.message?.reactions?.length || 0,
            }
            : m,
        ),
      );
    }
  }, []);

  const handleTypingStart = useCallback(
    (data: any) => {
      if (
        data.conversationId === selectedConvRef.current?._id &&
        data.userId !== currentUserId
      ) {
        setTypingUsers((prev) => [...new Set([...prev, data.userId])]);
      }
    },
    [currentUserId],
  );

  const handleTypingStop = useCallback((data: any) => {
    if (data.conversationId === selectedConvRef.current?._id) {
      setTypingUsers((prev) => prev.filter((id) => id !== data.userId));
    }
  }, []);

  const handleMessagesRead = useCallback(
    (data: any) => {
      console.log("📖 [MOBILE] Received messages_read event:", data);
      const convId = data.conversationId || data.conversation_id;
      
      if (convId === selectedConvRef.current?._id) {
        console.log("📖 [MOBILE] Updating messages as read for conversation:", convId);
        setMessages((prev) =>
          prev.map((m) => {
            const senderId = (m.sender_id?._id || m.sender_id || "").toString();
            if (senderId === currentUserId.toString()) {
              return { ...m, read: true };
            }
            return m;
          }),
        );
      }
    },
    [currentUserId],
  );

  const connectSocket = async (userId: string) => {
    const token = await AsyncStorage.getItem("authToken");
    if (!token || socketRef.current?.connected) return;

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }

    socketRef.current = io(API_BASE_URL, {
      auth: { token, userId },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // ✅ Handler cho message_sent_success
    const handleMessageSentSuccess = (data: any) => {
      console.log("✅ Message sent success:", data);

      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
        sendTimeoutRef.current = null;
      }

      setSending(false); // ← Reset sending state

      if (data.clientTempId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.clientTempId === data.clientTempId
              ? {
                ...msg,
                _id: data.messageId,
                clientTempId: undefined,
                status: "sent",
              }
              : msg,
          ),
        );
      }
    };

    // ✅ Handler cho message_error
    const handleMessageError = (data: any) => {
      console.error("❌ Message error:", data);

      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
        sendTimeoutRef.current = null;
      }

      setSending(false); // ← Reset sending state

      if (data.clientTempId) {
        setMessages((prev) =>
          prev.filter((m) => m.clientTempId !== data.clientTempId),
        );
      }

      showToast(data.error || "Failed to send", "error");
    };

    socketRef.current.on("connect", () => {
      console.log("✅ Mobile socket connected");
      setIsSocketConnected(true);
      if (selectedConvRef.current) {
        socketRef.current?.emit(
          "join_conversation",
          selectedConvRef.current._id,
        );
      }
    });

    socketRef.current.on("disconnect", () => {
      console.log("❌ Mobile socket disconnected");
      setIsSocketConnected(false);
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
      setIsSocketConnected(false);
    });

    socketRef.current.on("new_message", (data: any) => {
      console.log("📨 Received new_message event:", data);
      handleNewMessage(data);
    });

    socketRef.current.on("message_sent_success", handleMessageSentSuccess);
    socketRef.current.on("message_error", handleMessageError);
    socketRef.current.on("message_edited", handleMessageEdited);
    socketRef.current.on("message_deleted", handleMessageDeleted);
    socketRef.current.on("reaction_added", handleReactionAdded);
    socketRef.current.on("reaction_removed", handleReactionRemoved);
    socketRef.current.on("typing_start", handleTypingStart);
    socketRef.current.on("typing_stop", handleTypingStop);
    socketRef.current.on("messages_read", handleMessagesRead);
    socketRef.current.on("user_online", (d) =>
      setOnlineUsers((prev) => new Set([...prev, d.userId])),
    );
    socketRef.current.on("user_offline", (d) => {
      setOnlineUsers((prev) => {
        const s = new Set(prev);
        s.delete(d.userId);
        return s;
      });
      if (d.lastSeen)
        setLastSeen((prev) => ({ ...prev, [d.userId]: d.lastSeen }));
    });
  };

  // Join conversation when selected
  useEffect(() => {
    if (!selectedConversation) return;

    if (socketRef.current?.connected) {
      socketRef.current.emit("join_conversation", selectedConversation._id);
      console.log("📱 Joined conversation room:", selectedConversation._id);
    }

    return () => {
      if (socketRef.current?.connected && selectedConversation) {
        socketRef.current.emit("leave_conversation", selectedConversation._id);
        console.log("📱 Left conversation room:", selectedConversation._id);
      }
    };
  }, [selectedConversation]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("authToken");
      const res = await axios.get(`${API_ENDPOINT}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success)
        setConversations(
          (res.data.data || []).map((c: any) => ({
            _id: c._id,
            participant: c.participant,
            last_message: c.last_message,
            last_message_at: c.last_message_at || c.last_message?.createdAt,
            unread_count: c.unread_count || 0,
            medical_record_id: c.medical_record_id,
            appointment_id: c.appointment_id,
          })),
        );
    } catch {
      showToast("Failed to load conversations", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      setMessageLoading(true);
      const token = await AsyncStorage.getItem("authToken");
      const res = await axios.get(
        `${API_ENDPOINT}/messages/conversations/${convId}/messages`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data.success) {
        setMessages(res.data.data || []);
        if (socketRef.current?.connected)
          socketRef.current.emit("mark_as_read", { conversationId: convId });
        setConversations((p) =>
          p.map((c) => (c._id === convId ? { ...c, unread_count: 0 } : c)),
        );
        setTimeout(() => scrollToBottom(false), 300);
      }
    } catch {
      showToast("Failed to load messages", "error");
    } finally {
      setMessageLoading(false);
    }
  };

  const startChatWithDoctor = async (doctor: User) => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const res = await axios.post(
        `${API_ENDPOINT}/messages/conversations/find-or-create`,
        { participantId: doctor._id },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data.success) {
        const conversation = res.data.data;
        setConversations((prev) => {
          if (prev.some((c) => c._id === conversation._id)) return prev;
          return [conversation, ...prev];
        });
        setShowDoctorSearch(false);
        setSelectedConversation(conversation);
        loadMessages(conversation._id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      showToast(
        e.response?.data?.message || "Failed to create conversation",
        "error",
      );
    }
  };

  const editMessage = async (messageId: string, newText: string) => {
    const token = await AsyncStorage.getItem("authToken");
    const res = await axios.patch(
      `${API_ENDPOINT}/messages/${messageId}/edit`,
      { newMessage: newText },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.data.success) {
      setMessages((p) =>
        p.map((m) => (m._id === messageId ? { ...m, ...res.data.data } : m)),
      );
      showToast("Message edited", "success");
    }
  };

  // ✅ FIXED: Delete message with proper optimistic update
  const deleteMessage = async (msg: Message, type: "me" | "everyone") => {
    if (!msg._id || msg._id.startsWith("temp_")) {
      showToast("Cannot delete a message that is still sending", "info");
      return;
    }
    if (deletingMessagesRef.current.has(msg._id)) return;
    deletingMessagesRef.current.add(msg._id);

    Alert.alert(
      "Delete Message",
      `Delete this message ${type === "everyone" ? "for everyone" : "for you only"}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => deletingMessagesRef.current.delete(msg._id),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const originalMessage = { ...msg };

            // Optimistic update
            const deletedMessage =
              type === "me"
                ? {
                  ...msg,
                  deleted_for_me: true,
                  deleted: false,
                  message: "This message was deleted for you",
                  message_type: "text" as const,
                  media_url: undefined,
                  media_urls: undefined,
                  media_name: undefined,
                  reactions: [],
                  reactions_count: 0,
                }
                : {
                  ...msg,
                  deleted: true,
                  deleted_for_me: true,
                  message: "This message was deleted",
                  message_type: "text" as const,
                  media_url: undefined,
                  media_urls: undefined,
                  media_name: undefined,
                  edited: false,
                  reactions: [],
                  reactions_count: 0,
                };

            setMessages((prev) =>
              prev.map((m) => (m._id === msg._id ? deletedMessage : m)),
            );

            if (selectedConversation?.last_message?._id === msg._id) {
              setConversations((prev) =>
                prev.map((c) =>
                  c._id === selectedConversation._id
                    ? { ...c, last_message: deletedMessage as Message }
                    : c,
                ),
              );
            }

            try {
              const token = await AsyncStorage.getItem("authToken");
              await deleteViaRest(msg, type, token);

              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              showToast(
                type === "everyone"
                  ? "Deleted for everyone"
                  : "Deleted for you",
                "success",
              );
            } catch (error) {
              console.error("Delete failed:", error);
              // Rollback
              setMessages((prev) =>
                prev.map((m) => (m._id === msg._id ? originalMessage : m)),
              );
              if (selectedConversation?.last_message?._id === msg._id) {
                setConversations((prev) =>
                  prev.map((c) =>
                    c._id === selectedConversation._id
                      ? { ...c, last_message: originalMessage as Message }
                      : c,
                  ),
                );
              }
              showToast("Failed to delete message", "error");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              deletingMessagesRef.current.delete(msg._id);
            }
          },
        },
      ],
    );
  };
  // ✅ Helper to delete via REST API (with proper data transformation)
  const deleteViaRest = async (
    msg: Message,
    type: "me" | "everyone",
    token: string | null,
    retryCount = 0,
  ) => {
    // ✅ Double-check ID before making the request
    if (!msg._id || msg._id.startsWith("temp_")) {
      throw new Error("Invalid message ID");
    }

    try {
      const res = await axios.delete(`${API_ENDPOINT}/messages/${msg._id}`, {
        params: { type }, // ✅ Use params object instead of query string interpolation
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.data.success) {
        throw new Error("REST delete failed");
      }

      return true;
    } catch (err: any) {
      // ✅ Don't retry on 400/403/404 — these are logic errors, not transient failures
      const status = err?.response?.status;
      if (status === 400 || status === 403 || status === 404) {
        throw err; // fail immediately, no retry
      }

      console.error(`REST delete error (attempt ${retryCount + 1}):`, err);
      if (retryCount < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (retryCount + 1)),
        );
        return deleteViaRest(msg, type, token, retryCount + 1);
      }
      throw err;
    }
  };
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        console.log(`🌐 ${config.method?.toUpperCase()} ${config.url}`);
        console.log("📦 Body:", config.data);
        console.log("🔑 Headers:", config.headers);
        if (config.method === "delete") {
          console.log("🗑️ DELETE REQUEST DETAILS:", {
            url: config.url,
            params: config.params,
            data: config.data,
            fullUrl: `${config.baseURL || ""}${config.url}`,
          });
        }

        return config;
      },
      (error) => {
        console.error("❌ Request error:", error);
        return Promise.reject(error);
      },
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => {
        if (response.config.method === "delete") {
          console.log("✅ DELETE RESPONSE:", {
            status: response.status,
            data: response.data,
            url: response.config.url,
          });
        }
        return response;
      },
      (error) => {
        if (error.config?.method === "delete") {
          console.error("❌ DELETE ERROR:", {
            status: error.response?.status,
            data: error.response?.data,
            url: error.config?.url,
          });
        }
        return Promise.reject(error);
      },
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  const addReaction = async (msgId: string, emoji: string) => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const res = await axios.post(
        `${API_ENDPOINT}/messages/${msgId}/react`,
        { reaction: emoji },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data.success) {
        setMessages((p) =>
          p.map((m) => (m._id === msgId ? res.data.data.message : m)),
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {
      showToast("Failed to react", "error");
    }
  };

  const fetchReactions = async (msgId: string) => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const q = selectedConversation?._id
        ? `?conversationId=${selectedConversation._id}`
        : "";
      const res = await axios.get(
        `${API_ENDPOINT}/messages/${msgId}/reactions${q}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data.success) {
        setMessageReactions(res.data.data.reactions || []);
        setShowReactions(true);
      }
    } catch {
      showToast("Failed to load reactions", "error");
    }
  };

  const pickImages = async () => {
    try {
      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.length) {
        const imgs = result.assets.map((a) => ({
          uri: a.uri,
          name: a.fileName || `img_${Date.now()}.jpg`,
          mime: a.mimeType || "image/jpeg",
        }));
        setPendingImages((prev) => [...prev, ...imgs]);
      }
    } catch {
      showToast("Failed to pick images", "error");
    }
  };

  const sendPendingImages = async () => {
    if (!selectedConversation || !pendingImages.length) return;
    const toSend = [...pendingImages];
    setPendingImages([]);
    setUploadingMedia(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      for (const img of toSend) {
        const tempId = `temp_img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        // Optimistic update for each image
        const tempMsg: Message = {
          _id: tempId,
          clientTempId: tempId,
          conversation_id: selectedConversation._id,
          sender_id: currentUser || { _id: currentUserId, name: "You", role: "patient" },
          receiver_id: selectedConversation.participant,
          message: "",
          message_type: "image",
          media_url: img.uri,
          media_urls: [img.uri],
          read: false,
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: "sending",
        };
        setMessages(prev => [...prev, tempMsg]);
        setTimeout(() => scrollToBottom(), 100);

        const fd = new FormData();
        fd.append("receiver_id", selectedConversation.participant._id);
        fd.append("message_type", "image");
        fd.append("clientTempId", tempId);
        fd.append("file", {
          uri: img.uri,
          name: img.name,
          type: img.mime,
        } as any);
        const res = await axios.post(
          `${API_ENDPOINT}/messages/send-with-media`,
          fd,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
          },
        );
        if (res.data.success) {
          handleNewMessage(res.data.data);
          setTimeout(() => scrollToBottom(), 100);
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (toSend.length > 1)
        showToast(`${toSend.length} photos sent`, "success");
    } catch {
      showToast("Failed to send images", "error");
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleDownload = async (msg: Message) => {
    if (!msg.media_url) return;
    Alert.alert("Download", `Download "${msg.media_name || "file"}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Download",
        onPress: async () => {
          try {
            const dl = FileSystem.createDownloadResumable(
              buildMediaUrl(msg.media_url),
              ((FileSystem as any).documentDirectory || "") +
              (msg.media_name || "file"),
              {},
            );
            const r = await dl.downloadAsync();
            if (r?.uri) {
              showToast("Downloaded!", "success");
              if (Platform.OS === "android")
                await IntentLauncher.startActivityAsync(
                  "android.intent.action.VIEW",
                  { data: r.uri, flags: 1 },
                );
            }
          } catch {
            showToast("Download failed", "error");
          }
        },
      },
    ]);
  };

  const onLongPress = (msg: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessage(msg);
    setShowActions(true);
    if (Platform.OS === "ios") {
      const opts: string[] = ["React"];
      const destructive: number[] = [];
      if (isMe(msg) && msg.message_type === "text" && !msg.deleted)
        opts.push("Edit");
      opts.push("Copy");
      opts.push("Delete for me");
      destructive.push(opts.length - 1);
      if (isMe(msg) && !msg.deleted && !msg.read) {
        opts.push("Delete for everyone");
        destructive.push(opts.length - 1);
      }
      opts.push("Cancel");
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: opts,
          cancelButtonIndex: opts.length - 1,
          destructiveButtonIndex: destructive,
        },
        (bi) => {
          const o = opts[bi];
          if (o === "React") setShowEmoji(true);
          else if (o === "Edit") setShowEdit(true);
          else if (o === "Copy") copyMsg(msg);
          else if (o === "Delete for me") deleteMessage(msg, "me");
          else if (o === "Delete for everyone") deleteMessage(msg, "everyone");
        },
      );
    }
  };

  const copyMsg = async (msg: Message) => {
    await Clipboard.setStringAsync(msg.message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast("Copied", "success");
  };

  const onEmojiSelect = async (emoji: string) => {
    if (selectedMessage) {
      await addReaction(selectedMessage._id, emoji);
      setShowEmoji(false);
      setSelectedMessage(null);
      if (selectedConversation) loadMessages(selectedConversation._id);
    } else {
      setNewMessage((p) => p + emoji);
      setShowEmoji(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const s = await AsyncStorage.getItem("userData");
        if (!s) return;
        const u = JSON.parse(s);
        setCurrentUserId(u._id);
        setCurrentUser(u);
        await connectSocket(u._id);
        await loadConversations();
      } catch (e) {
        console.error(e);
      }
    };
    init();
    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      deletingMessagesRef.current.clear();
    };
  }, []);

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const participantName = c.participant?.name || "";
    return participantName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const renderContent = (item: Message) => {
    if (item.deleted === true) {
      return (
        <View style={styles.deletedRow}>
          <Ban size={13} color={COLORS.textMuted} />
          <Text style={styles.deletedText}>This message was deleted</Text>
        </View>
      );
    }
    if (item.deleted_for_me === true) {
      return (
        <View style={styles.deletedRow}>
          <Ionicons name="eye-off-outline" size={13} color={COLORS.textMuted} />
          <Text style={styles.deletedText}>
            This message was deleted for you
          </Text>
        </View>
      );
    }

    const me = isMe(item);
    if (item.message_type === "image") {
      const urls: string[] = [];
      if (item.media_urls?.length)
        urls.push(...item.media_urls.map(buildMediaUrl));
      else if (item.media_url) urls.push(buildMediaUrl(item.media_url));
      return (
        <View>
          <MultiImageGrid
            urls={urls}
            onPressImage={(url, index) => {
              setPreviewImages(urls.map((u) => ({ uri: u })));
              setPreviewIndex(index);
              setPreviewVisible(true);
            }}
            onLongPress={() => onLongPress(item)}
          />
          {item.message ? (
            <Text style={[styles.caption, me && styles.captionMe]}>
              {item.message}
            </Text>
          ) : null}
        </View>
      );
    }
    if (item.message_type === "file")
      return (
        <ScalePress
          onPress={() => handleDownload(item)}
          onLongPress={() => onLongPress(item)}
          style={styles.fileCard}
        >
          <View style={styles.fileIconWrap}>
            <Paperclip size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fileName} numberOfLines={2}>
              {item.media_name || "File"}
            </Text>
            {!!item.media_size && (
              <Text style={styles.fileSize}>
                {formatFileSize(item.media_size)}
              </Text>
            )}
          </View>
          <Download size={18} color={COLORS.primary} />
        </ScalePress>
      );
    return (
      <View>
        <Text
          style={[styles.msgText, me ? styles.msgTextMe : styles.msgTextThem]}
        >
          {item.message}
        </Text>
        {item.edited && (
          <Text
            style={[
              styles.editedHint,
              me
                ? { color: "rgba(255,255,255,0.55)" }
                : { color: COLORS.textMuted },
            ]}
          >
            edited
          </Text>
        )}
      </View>
    );
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const me = isMe(item);
    const prev = messages[index - 1];
    const next = messages[index + 1];
    const firstInGroup = !prev || !isSameSender(prev, item);
    const lastInGroup = !next || !isSameSender(item, next);
    const showAv = showAvatar(item, index);
    const rxns = item.reactions?.length
      ? groupReactions(item.reactions, currentUserId)
      : [];
    const hasRxn = rxns.length > 0;

    // ✅ KIỂM TRA deleted_for_me TRƯỚC
    const isDeletedForMe =
      item.deleted_for_me ||
      (Array.isArray(item.deleted_for) &&
        item.deleted_for.includes(currentUserId));
    if (isDeletedForMe && !item.deleted) {
      return (
        <View
          style={[
            styles.msgRow,
            me ? styles.msgRowMe : styles.msgRowThem,
            { marginTop: 12, marginBottom: 3 },
          ]}
        >
          {!me && (
            <View style={styles.avatarSlot}>
              {showAv ? (
                <Image
                  source={{ uri: buildAvatarUrl(item.sender_id) }}
                  style={styles.msgAvatar}
                />
              ) : (
                <View style={styles.avatarGhost} />
              )}
            </View>
          )}
          <View
            style={[
              styles.bubble,
              styles.bubbleThem,
              styles.bubbleDeleted,
              { alignSelf: me ? "flex-end" : "flex-start" },
            ]}
          >
            <Text style={styles.deletedText}>
              This message was deleted for you
            </Text>
          </View>
        </View>
      );
    }

    // ✅ Hiển thị message đã xóa cho mọi người
    if (item.deleted) {
      return (
        <View
          style={[
            styles.msgRow,
            me ? styles.msgRowMe : styles.msgRowThem,
            { marginTop: 12, marginBottom: 3 },
          ]}
        >
          {!me && (
            <View style={styles.avatarSlot}>
              {showAv ? (
                <Image
                  source={{ uri: buildAvatarUrl(item.sender_id) }}
                  style={styles.msgAvatar}
                />
              ) : (
                <View style={styles.avatarGhost} />
              )}
            </View>
          )}
          <View
            style={[
              styles.bubble,
              styles.bubbleThem,
              styles.bubbleDeleted,
              { alignSelf: me ? "flex-end" : "flex-start" },
            ]}
          >
            <Text style={styles.deletedText}>Message deleted</Text>
          </View>
        </View>
      );
    }

    const isImg = item.message_type === "image" && !item.deleted;
    const myTL = 20,
      myTR = firstInGroup ? 20 : 6,
      myBR = lastInGroup ? 6 : 6,
      myBL = 20;
    const thTL = firstInGroup ? 20 : 6,
      thTR = 20,
      thBL = lastInGroup ? 6 : 6,
      thBR = 20;

    return (
      <View
        style={[
          styles.msgRow,
          me ? styles.msgRowMe : styles.msgRowThem,
          firstInGroup && { marginTop: 12 },
          { marginBottom: hasRxn ? 26 : 3 },
        ]}
      >
        {!me && (
          <View style={styles.avatarSlot}>
            {showAv ? (
              <Image
                source={{ uri: buildAvatarUrl(item.sender_id) }}
                style={styles.msgAvatar}
              />
            ) : (
              <View style={styles.avatarGhost} />
            )}
          </View>
        )}

        <View
          style={[
            styles.msgWrap,
            me ? { alignItems: "flex-end" } : { alignItems: "flex-start" },
          ]}
        >
          <Pressable
            onLongPress={() => onLongPress(item)}
            style={[
              styles.bubble,
              isImg
                ? styles.bubbleImg
                : me
                  ? styles.bubbleMe
                  : styles.bubbleThem,
              {
                borderTopLeftRadius: me ? myTL : thTL,
                borderTopRightRadius: me ? myTR : thTR,
                borderBottomRightRadius: me ? myBR : thBR,
                borderBottomLeftRadius: me ? myBL : thBL,
              },
              (item.deleted || item.deleted_for_me) && styles.bubbleDeleted,
            ]}
          >
            {me && !isImg && !item.deleted && !item.deleted_for_me && (
              <LinearGradient
                colors={[COLORS.bubbleMe, COLORS.bubbleMeDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            {renderContent(item)}
          </Pressable>

          {hasRxn && (
            <View
              style={[
                styles.rxnRow,
                me
                  ? { justifyContent: "flex-end" }
                  : { justifyContent: "flex-start" },
              ]}
            >
              {rxns.map((r, i) => (
                <AnimatedReactionBubble
                  key={r.emoji}
                  reaction={r}
                  onPress={() => fetchReactions(item._id)}
                  delay={i * 40}
                />
              ))}
            </View>
          )}

          <Text
            style={[
              styles.msgTime,
              me ? { textAlign: "right" } : { textAlign: "left" },
            ]}
          >
            {formatTime(item.timestamp)}
          </Text>
        </View>

        {me && lastInGroup && !item.deleted && !item.deleted_for_me && (
          <View style={styles.receiptSlot}>
            {item.read ? (
              <CheckCheck size={14} color={COLORS.read} />
            ) : (
              <Check size={14} color={COLORS.sent} />
            )}
          </View>
        )}
      </View>
    );
  };

  // Chat Screen
  if (selectedConversation) {
    const pOnline = onlineUsers.has(selectedConversation.participant._id);
    const pLastSeen = lastSeen[selectedConversation.participant._id];

    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

        <ImageView
          images={previewImages}
          imageIndex={previewIndex}
          visible={previewVisible}
          onRequestClose={() => setPreviewVisible(false)}
          swipeToCloseEnabled
          doubleTapToZoomEnabled
        />
        <ActionSheet
          visible={showActions}
          message={selectedMessage}
          isMe={selectedMessage ? isMe(selectedMessage) : false}
          onClose={() => setShowActions(false)}
          onEdit={(m: Message) => {
            setSelectedMessage(m);
            setShowEdit(true);
          }}
          onDelete={(m: Message, t: "me" | "everyone") => deleteMessage(m, t)}
          onReact={(m: Message) => {
            setSelectedMessage(m);
            setShowEmoji(true);
          }}
          onCopy={copyMsg}
        />
        <EditModal
          visible={showEdit}
          message={selectedMessage}
          onClose={() => {
            setShowEdit(false);
            setSelectedMessage(null);
          }}
          onSave={editMessage}
        />
        <EmojiPicker
          visible={showEmoji}
          onClose={() => setShowEmoji(false)}
          onSelect={onEmojiSelect}
        />
        <ReactionsView
          visible={showReactions}
          reactions={messageReactions}
          onClose={() => setShowReactions(false)}
        />

        <View style={styles.chatHeader}>
          <TouchableOpacity
            onPress={() => {
              setSelectedConversation(null);
              setMessages([]);
              emitTyping(false);
              setPendingImages([]);
            }}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={26} color={COLORS.primary} />
          </TouchableOpacity>

          <View style={{ position: "relative" }}>
            <Image
              source={{ uri: buildAvatarUrl(selectedConversation.participant) }}
              style={styles.chatHeaderAvatar}
            />
            {isSocketConnected && pOnline && (
              <Animated.View
                style={[styles.chatOnlineDot, { opacity: pulseAnim }]}
              />
            )}
          </View>

          <View style={styles.chatHeaderMeta}>
            <Text style={styles.chatHeaderName} numberOfLines={1}>
              {selectedConversation.participant.name}
            </Text>
            <Text
              style={[
                styles.chatHeaderSub,
                pOnline && { color: COLORS.online },
              ]}
            >
              {typingUsers.length > 0
                ? "typing…"
                : pOnline
                  ? "Active now"
                  : pLastSeen
                    ? `Active ${formatTime(pLastSeen)}`
                    : selectedConversation.participant.role}
            </Text>
          </View>

          <View style={styles.chatHeaderActions}>
            {[Phone, Video, Info].map((Icon, i) => (
              <TouchableOpacity
                key={i}
                style={styles.headerActionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon size={20} color={COLORS.primary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.chatBg}>
          {messageLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
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
          )}
        </View>

        {pendingImages.length > 0 && (
          <PendingImagesPreview
            uris={pendingImages.map((i) => i.uri)}
            onRemove={(i) =>
              setPendingImages((p) => p.filter((_, j) => j !== i))
            }
            onSendAll={sendPendingImages}
          />
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={90}
        >
          <View style={styles.inputBar}>
            {uploadingMedia ? (
              <View style={styles.uploadingRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.uploadingText}>Sending...</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  onPress={pickImages}
                  style={styles.inputIconBtn}
                >
                  <ImageIcon size={22} color={COLORS.primary} />
                </TouchableOpacity>

                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="Message…"
                    placeholderTextColor={COLORS.textMuted}
                    value={newMessage}
                    onChangeText={handleTextChange}
                    multiline
                    maxLength={1000}
                  />
                </View>

                {newMessage.trim() ? (
                  <TouchableOpacity
                    onPress={sendTextMessage}
                    style={[
                      styles.sendBtn,
                      (sending || uploadingMedia) && { opacity: 0.6 },
                    ]}
                    disabled={sending || uploadingMedia}
                  >
                    <LinearGradient
                      colors={[COLORS.primary, COLORS.primaryDark]}
                      style={styles.sendBtnGrad}
                    >
                      {sending ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Send size={17} color="#FFF" />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedMessage(null);
                      setShowEmoji(true);
                    }}
                    style={styles.inputIconBtn}
                    disabled={sending} // ✅ Disable khi đang gửi
                  >
                    <Smile size={23} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>

        {toast.visible && (
          <Toast
            message={toast.message}
            type={toast.type}
            onHide={() => setToast((t) => ({ ...t, visible: false }))}
          />
        )}
      </SafeAreaView>
    );
  }

  // Conversations List Screen
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <DoctorSearchModal
        visible={showDoctorSearch}
        onClose={() => setShowDoctorSearch(false)}
        onStartChat={startChatWithDoctor}
      />

      <View style={styles.listHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Home" as never)}
            style={styles.backIconBtn}
          >
            <ChevronLeft size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.listTitle}>Messages</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity
            onPress={() => setShowDoctorSearch(true)}
            style={styles.addDoctorBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Plus size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={styles.connectionDot}>
            <Animated.View
              style={[
                styles.connDotInner,
                {
                  opacity: pulseAnim,
                  backgroundColor: isSocketConnected
                    ? COLORS.online
                    : COLORS.textMuted,
                },
              ]}
            />
          </View>
        </View>
      </View>

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
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <X size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(c) => c._id}
          contentContainerStyle={{ paddingBottom: 30 }}
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
            <View style={styles.emptyList}>
              <Text style={{ fontSize: 60 }}>💬</Text>
              <Text style={styles.emptyTitle}>
                {searchQuery ? "No results found" : "No conversations"}
              </Text>
              <Text style={styles.emptySub}>
                {searchQuery
                  ? "Try a different name"
                  : "Tap + to chat with a doctor"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ScalePress
              onPress={() => {
                setSelectedConversation(item);
                loadMessages(item._id);
              }}
              style={styles.convItem}
            >
              <View style={styles.convAvatarWrap}>
                <Image
                  source={{ uri: buildAvatarUrl(item.participant) }}
                  style={styles.convAvatar}
                />
                {isSocketConnected && onlineUsers.has(item.participant._id) && (
                  <Animated.View
                    style={[styles.convOnlineDot, { opacity: pulseAnim }]}
                  />
                )}
              </View>
              <View style={styles.convBody}>
                <View style={styles.convTop}>
                  <Text
                    style={[
                      styles.convName,
                      item.unread_count > 0 && { fontWeight: "800" },
                    ]}
                    numberOfLines={1}
                  >
                    {item.participant.name}
                  </Text>
                  <Text
                    style={[
                      styles.convTime,
                      item.unread_count > 0 && {
                        color: COLORS.primary,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {formatTime(item.last_message_at)}
                  </Text>
                </View>
                <View style={styles.convBottom}>
                  <Text
                    style={[
                      styles.convPreview,
                      item.unread_count > 0 && {
                        color: COLORS.textPrimary,
                        fontWeight: "600",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.last_message?.deleted
                      ? "Message deleted"
                      : item.last_message?.deleted_for_me
                        ? "This message was deleted"
                        : item.last_message?.message_type === "image"
                          ? "📷 Photo"
                          : item.last_message?.message_type === "file"
                            ? "📎 File"
                            : item.last_message?.message || "Start chatting"}
                  </Text>
                  {item.unread_count > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>
                        {item.unread_count > 99 ? "99+" : item.unread_count}
                      </Text>
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
      )}

      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onHide={() => setToast((t) => ({ ...t, visible: false }))}
        />
      )}
    </SafeAreaView>
  );
};

// ==================== STYLES ====================
const styles = StyleSheet.create({
  actionItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  actionLabel: { fontSize: 16, fontWeight: "500" },

  actionSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    paddingTop: 14,
    width: "100%",
    ...SHADOW.float,
  },
  addDoctorBtn: {
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    width: 38,
  },

  addMoreBtn: {
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryMid,
    borderRadius: 10,
    borderStyle: "dashed",
    borderWidth: 1.5,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  avatarGhost: { height: 30, width: 30 },
  avatarSlot: {
    alignSelf: "flex-end",
    marginBottom: 2,
    marginRight: 6,
    width: 30,
  },
  backBtn: { marginRight: 2, padding: 6 },
  backIconBtn: {
    alignItems: "center",
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  bubble: {
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...SHADOW.bubble,
  },

  bubbleDeleted: {
    backgroundColor: COLORS.bgSecondary,
    borderColor: COLORS.divider,
    borderWidth: 1,
  },
  bubbleImg: { backgroundColor: "transparent", overflow: "hidden", padding: 0 },

  bubbleMe: { backgroundColor: COLORS.bubbleMe },
  bubbleThem: { backgroundColor: COLORS.bubbleThem },
  caption: {
    color: COLORS.textThem,
    fontSize: 13.5,
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  captionMe: { color: COLORS.textMe },
  catContent: { gap: 6, paddingHorizontal: 14 },
  catLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingVertical: 8,
    textTransform: "uppercase",
  },
  catScroll: { maxHeight: 56 },
  catTab: {
    alignItems: "center",
    backgroundColor: COLORS.bgSecondary,
    borderColor: "transparent",
    borderRadius: 12,
    borderWidth: 1.5,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  catTabActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  center: { alignItems: "center", flex: 1, justifyContent: "center" },
  chatBg: { backgroundColor: COLORS.bgChat, flex: 1 },
  chatHeader: {
    alignItems: "center",
    backgroundColor: COLORS.bg,
    borderBottomColor: COLORS.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...SHADOW.bubble,
  },
  chatHeaderActions: { flexDirection: "row", gap: 4 },
  chatHeaderAvatar: {
    borderRadius: 20,
    height: 40,
    marginRight: 10,
    width: 40,
  },
  chatHeaderMeta: { flex: 1 },

  chatHeaderName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  chatHeaderSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 1 },
  chatOnlineDot: {
    backgroundColor: COLORS.online,
    borderColor: COLORS.bg,
    borderRadius: 5,
    borderWidth: 2,
    bottom: 0,
    height: 10,
    position: "absolute",
    right: 8,
    width: 10,
  },
  closeCircle: {
    alignItems: "center",
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 17,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  connDotInner: { borderRadius: 5, height: 10, width: 10 },
  connectionDot: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  convAvatar: { borderRadius: 26, height: 52, width: 52 },
  convAvatarWrap: { flexShrink: 0, marginRight: 14, position: "relative" },
  convBody: { flex: 1, minWidth: 0 },

  convBottom: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  convItem: {
    alignItems: "center",
    backgroundColor: COLORS.bg,
    borderBottomColor: COLORS.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  convName: {
    color: COLORS.textPrimary,
    flex: 1,
    fontSize: 15.5,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  convOnlineDot: {
    backgroundColor: COLORS.online,
    borderColor: COLORS.bg,
    borderRadius: 6,
    borderWidth: 2.5,
    bottom: 1,
    height: 12,
    position: "absolute",
    right: 1,
    width: 12,
  },
  convPreview: {
    color: COLORS.textSecondary,
    flex: 1,
    fontSize: 13.5,
    marginRight: 8,
  },

  convTime: {
    color: COLORS.textMuted,
    flexShrink: 0,
    fontSize: 12,
    marginLeft: 10,
  },
  convTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  deletedRow: { alignItems: "center", flexDirection: "row", gap: 5 },
  deletedText: { color: COLORS.textMuted, fontSize: 13.5, fontStyle: "italic" },
  doctorFoundAvatar: { borderRadius: 30, height: 60, width: 60 },
  doctorFoundCard: {
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryMid,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    marginBottom: 20,
    padding: 16,
  },
  doctorFoundName: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  doctorFoundPhone: { color: COLORS.textSecondary, fontSize: 13 },

  doctorFoundRolePill: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: COLORS.bg,
    borderRadius: 20,
    flexDirection: "row",
    gap: 4,
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  doctorFoundRoleText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  doctorSearchActions: { flexDirection: "row", gap: 12 },
  doctorSearchBtn: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.input,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 15,
  },
  doctorSearchBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },

  doctorSearchCancelBtn: {
    alignItems: "center",
    backgroundColor: COLORS.bgSecondary,
    borderRadius: RADIUS.input,
    flex: 1,
    paddingVertical: 14,
  },
  doctorSearchCancelText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: "600",
  },
  doctorSearchError: {
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: RADIUS.sm,
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    padding: 12,
  },
  doctorSearchErrorText: { color: COLORS.error, flex: 1, fontSize: 13 },
  doctorSearchHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  doctorSearchInput: { color: COLORS.textPrimary, flex: 1, fontSize: 16 },

  doctorSearchInputWrap: {
    alignItems: "center",
    backgroundColor: COLORS.bgInput,
    borderColor: COLORS.divider,
    borderRadius: RADIUS.input,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  doctorSearchSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
    width: "100%",
    ...SHADOW.float,
  },

  doctorSearchStartBtn: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.input,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 14,
  },
  doctorSearchStartText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  doctorSearchSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  doctorSearchTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },

  editCancel: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },

  editCancelText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: "700",
  },
  editFooter: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  editHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  editInput: {
    backgroundColor: COLORS.bgInput,
    borderColor: COLORS.divider,
    borderRadius: RADIUS.card,
    borderWidth: 1.5,
    color: COLORS.textPrimary,
    fontSize: 15,
    marginBottom: 16,
    maxHeight: 180,
    minHeight: 90,
    padding: 14,
    textAlignVertical: "top",
  },
  editSave: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    minWidth: 80,
    paddingHorizontal: 24,
    paddingVertical: 11,
    ...SHADOW.card,
  },
  editSaveText: { color: "#FFF", fontSize: 15, fontWeight: "800" },

  editSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    width: "100%",
    ...SHADOW.float,
  },
  editTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "800" },
  editedHint: { fontSize: 11, fontStyle: "italic", marginTop: 2 },
  emptyChat: {
    alignItems: "center",
    flex: 1,
    gap: 10,
    justifyContent: "center",
    minHeight: 380,
  },

  emptyList: { alignItems: "center", gap: 10, paddingTop: 100 },
  emptySub: { color: COLORS.textSecondary, fontSize: 14 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: "700" },
  extraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
    justifyContent: "center",
  },
  extraText: { color: "#FFF", fontSize: 22, fontWeight: "800" },
  fileCard: {
    alignItems: "center",
    backgroundColor: COLORS.bg,
    borderColor: COLORS.divider,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 200,
    padding: 12,
  },
  fileIconWrap: {
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  fileName: { color: COLORS.textPrimary, fontSize: 13.5, fontWeight: "600" },
  fileSize: { color: COLORS.textSecondary, fontSize: 11.5, marginTop: 2 },

  headerActionBtn: {
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  imgError: {
    alignItems: "center",
    backgroundColor: "#F0F2F5",
    flex: 1,
    justifyContent: "center",
  },
  imgLoading: {
    alignItems: "center",
    backgroundColor: "#E5E9EF",
    justifyContent: "center",
  },
  input: {
    color: COLORS.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 90,
    paddingVertical: 9,
  },
  inputBar: {
    alignItems: "flex-end",
    backgroundColor: COLORS.bg,
    borderTopColor: COLORS.divider,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputIconBtn: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    marginBottom: 1,
    width: 38,
  },
  inputWrap: {
    backgroundColor: COLORS.bgInput,
    borderColor: COLORS.divider,
    borderRadius: RADIUS.input,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: "center",
    maxHeight: 108,
    minHeight: 38,
    paddingHorizontal: 15,
  },
  listHeader: {
    alignItems: "center",
    borderBottomColor: COLORS.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 14,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "ios" ? 6 : 16,
  },

  listTitle: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  medBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: COLORS.primaryLight,
    borderRadius: 6,
    flexDirection: "row",
    gap: 3,
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },

  medBadgeText: { color: COLORS.primary, fontSize: 11, fontWeight: "700" },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "flex-end",
  },
  msgAvatar: { borderRadius: 15, height: 30, width: 30 },
  msgListContent: { paddingBottom: 8, paddingHorizontal: 12, paddingTop: 12 },
  msgRow: { alignItems: "flex-end", flexDirection: "row", marginBottom: 3 },
  msgRowMe: { justifyContent: "flex-end" },
  msgRowThem: { justifyContent: "flex-start" },

  msgText: { fontSize: 15.5, letterSpacing: 0.1, lineHeight: 22 },
  msgTextMe: { color: COLORS.textMe },
  msgTextThem: { color: COLORS.textThem },
  msgTime: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 3,
    paddingHorizontal: 2,
  },
  msgWrap: { maxWidth: "74%" },
  pendingBar: {
    alignItems: "center",
    backgroundColor: COLORS.bg,
    borderTopColor: COLORS.divider,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pendingImg: { borderRadius: 10, height: 58, width: 58 },
  pendingRemove: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 10,
    height: 18,
    justifyContent: "center",
    position: "absolute",
    right: -5,
    top: -5,
    width: 18,
  },
  pendingScroll: { gap: 8, paddingRight: 4 },

  pendingThumb: { position: "relative" },
  pickerBackdrop: {
    backgroundColor: "rgba(0,0,0,0.42)",
    flex: 1,
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    height: height * 0.54,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    paddingTop: 10,
    ...SHADOW.float,
  },

  reactionBubble: {
    alignItems: "center",
    backgroundColor: COLORS.reactionBg,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    ...SHADOW.bubble,
  },
  reactionBubbleActive: {
    backgroundColor: COLORS.reactionActiveBg,
    borderColor: COLORS.reactionActiveBorder,
  },
  reactionCount: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  reactionCountActive: { color: COLORS.primary },
  reactionCountBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  reactionCountBadgeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  reactionEmoji: { fontSize: 13 },
  reactionRow: {
    alignItems: "flex-start",
    borderBottomColor: COLORS.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  reactionRowLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    width: 56,
  },
  reactionUser: { alignItems: "center", flexDirection: "row", gap: 8 },

  reactionUserAvatar: { borderRadius: 14, height: 28, width: 28 },
  reactionUserName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  reactionsCard: {
    backgroundColor: COLORS.bg,
    borderRadius: 22,
    maxHeight: height * 0.65,
    overflow: "hidden",
    width: width - 48,
    ...SHADOW.float,
  },
  reactionsCardHeader: {
    alignItems: "center",
    borderBottomColor: COLORS.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18,
  },
  reactionsCardTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  receiptSlot: {
    alignSelf: "flex-end",
    marginBottom: 4,
    marginLeft: 3,
    width: 18,
  },
  root: { backgroundColor: COLORS.bg, flex: 1 },
  rxnRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    marginTop: -6,
    paddingHorizontal: 4,
  },
  searchInput: { color: COLORS.textPrimary, flex: 1, fontSize: 15 },
  searchWrap: {
    alignItems: "center",
    backgroundColor: COLORS.bgInput,
    borderColor: COLORS.divider,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    height: 44,
    margin: 14,
    paddingHorizontal: 14,
  },
  sendAllBtn: { marginLeft: 4 },
  sendAllGrad: {
    alignItems: "center",
    borderRadius: RADIUS.pill,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendAllText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  sendBtn: { marginBottom: 1 },
  sendBtnGrad: {
    alignItems: "center",
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    width: 38,
    ...SHADOW.card,
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: COLORS.border,
    borderRadius: 2,
    height: 4,
    marginBottom: 14,
    width: 38,
  },
  toast: {
    alignItems: "center",
    borderRadius: 16,
    bottom: 30,
    flexDirection: "row",
    gap: 10,
    left: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    position: "absolute",
    right: 18,
    zIndex: 9999,
    ...SHADOW.float,
  },
  toastText: { color: "#FFF", flex: 1, fontSize: 14, fontWeight: "600" },
  unreadBadge: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 20,
    justifyContent: "center",
    minWidth: 20,
    paddingHorizontal: 6,
  },
  unreadText: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  uploadingRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    paddingVertical: 10,
  },
  uploadingText: { color: COLORS.primary, fontSize: 14, fontWeight: "600" },
});

export default MessageScreen;
