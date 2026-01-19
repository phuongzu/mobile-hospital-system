
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
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io, { Socket } from 'socket.io-client';

const { width } = Dimensions.get('window');

interface Message {
  _id: string;
  conversation_id: string;
  sender_id: any;
  receiver_id: any;
  message: string;
  message_type: 'text' | 'image' | 'file';
  read: boolean;
  timestamp: string;
}

interface Conversation {
  _id: string;
  participant: any;
  last_message?: Message;
  last_message_at: string;
  unread_count: number;
}

const API_BASE_URL = 'http://localhost:3000';
const API_ENDPOINT = `${API_BASE_URL}/api`;

const MessageScreen = () => {
  const navigation = useNavigation<any>();
  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<Socket | null>(null);
  const selectedConvRef = useRef<Conversation | null>(null);
  const handlerRef = useRef<any>(null);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Status pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    selectedConvRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    if (isSocketConnected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isSocketConnected]);

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

  const extractMessageText = useCallback((m: any): string => {
    if (!m) return '';
    if (typeof m === 'string') return m;
    const text = m.message || m.content || m.text || m.body || m.msg || m.message_text || '';
    return typeof text === 'string' ? text.trim() : JSON.stringify(text).trim();
  }, []);

  const getSenderId = (sender: any): string => {
    if (!sender) return '';
    return typeof sender === 'object' ? sender._id : sender;
  };

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  handlerRef.current = (rawMsg: any) => {
    if (!rawMsg) return;
    const convId = rawMsg.conversationId || rawMsg.conversation_id;
    const normalizedMsg: Message = { 
      ...rawMsg, 
      conversation_id: convId,
      message: extractMessageText(rawMsg),
      timestamp: rawMsg.timestamp || new Date().toISOString()
    };
    
    const active = selectedConvRef.current;
    setConversations(prev => {
      const updated = prev.map(conv => {
        if (conv._id === convId) {
          return {
            ...conv,
            last_message: normalizedMsg,
            last_message_at: normalizedMsg.timestamp,
            unread_count: (active?._id === convId) ? 0 : (conv.unread_count || 0) + 1
          };
        }
        return conv;
      });
      return [...updated].sort((a,b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    });

    if (active?._id === convId) {
      setMessages(prev => {
        if (prev.some(m => m._id === normalizedMsg._id)) return prev;
        const sId = getSenderId(normalizedMsg.sender_id);
        if (sId === currentUserId) {
          const tempIdx = prev.findIndex(m => m._id.startsWith('temp_') && extractMessageText(m) === normalizedMsg.message);
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = normalizedMsg;
            return updated;
          }
        }
        return [...prev, normalizedMsg];
      });
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
      });
      socketRef.current.on('connect', () => setIsSocketConnected(true));
      socketRef.current.on('disconnect', () => setIsSocketConnected(false));
      socketRef.current.on('new_message', (data) => handlerRef.current?.(data));
      socketRef.current.on('receive_message', (data) => handlerRef.current?.(data.message || data));
      socketRef.current.on('message_sent', (data) => {
        if (data.success) handlerRef.current?.(data.message);
      });
    } catch (error) { console.error(error); }
  };

  const loadConversations = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.get(`${API_ENDPOINT}/messages/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.success) {
        setConversations((response.data.data || []).map((c: any) => ({
          ...c,
          last_message: c.last_message ? { ...c.last_message, message: extractMessageText(c.last_message) } : undefined
        })).sort((a:any, b:any) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()));
      }
    } catch (error) { console.error(error); } finally { setLoading(false); setRefreshing(false); }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      setMessageLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.get(`${API_ENDPOINT}/messages/conversations/${conversationId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.success) {
        setMessages((response.data.data || []).map((m: any) => ({ ...m, message: extractMessageText(m) })));
        if (socketRef.current?.connected) socketRef.current.emit('mark_as_read', { conversationId });
        setTimeout(scrollToBottom, 300);
      }
    } catch (error) { console.error(error); } finally { setMessageLoading(false); }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;
    const msgText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const tempId = `temp_${Date.now()}`;
    const tempMsg: any = {
      _id: tempId,
      sender_id: { _id: currentUserId, name: 'You' },
      receiver_id: selectedConversation.participant,
      message: msgText,
      message_type: 'text',
      read: false,
      timestamp: new Date().toISOString(),
      conversation_id: selectedConversation._id
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(scrollToBottom, 100);
    
    if (socketRef.current?.connected) {
      socketRef.current.emit('send_message', {
        conversationId: selectedConversation._id,
        receiverId: selectedConversation.participant._id,
        message: msgText,
        messageType: 'text'
      });
      setSending(false);
    } else {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const res = await axios.post(`${API_ENDPOINT}/messages/send`, {
          receiver_id: selectedConversation.participant._id,
          message: msgText,
          message_type: 'text'
        }, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.data.success) handlerRef.current?.(res.data.data.message || res.data.data);
      } catch (error) {
        setMessages(prev => prev.filter(m => m._id !== tempId));
      } finally { setSending(false); }
    }
  };

  useEffect(() => {
    const init = async () => {
      const userDataStr = await AsyncStorage.getItem('userData');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        setCurrentUserId(userData._id);
      }
      connectSocket();
      loadConversations();
    };
    init();
    return () => { socketRef.current?.disconnect(); };
  }, []);

  const getAvatar = (path?: string) => {
    if (!path) return 'https://ui-avatars.com/api/?name=User&background=random';
    if (path.startsWith('http')) return path;
    return `${API_BASE_URL}/uploads/avatars/${path}`;
  };

  if (selectedConversation) {
    return (
      <SafeAreaView style={styles.chatSafeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.messengerHeader}>
          <TouchableOpacity onPress={() => setSelectedConversation(null)} style={styles.headerActionBtn}>
            <Ionicons name="chevron-back" size={28} color="#0084FF" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.headerPartnerInfo}>
            <View style={styles.headerAvatarContainer}>
              <Image source={{ uri: getAvatar(selectedConversation.participant.avatar) }} style={styles.headerAvatar} />
              <View style={styles.headerStatusDot} />
            </View>
            <View>
              <Text style={styles.headerName} numberOfLines={1}>{selectedConversation.participant.name}</Text>
              <Text style={styles.headerSubtext}>Active now</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerRightActions}>
            <TouchableOpacity style={styles.headerActionBtn}>
              <Ionicons name="call" size={22} color="#0084FF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionBtn}>
              <Ionicons name="videocam" size={24} color="#0084FF" />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView 
          style={styles.chatKeyboardArea} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {messageLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color="#0084FF" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item, index) => item._id || index.toString()}
              contentContainerStyle={styles.messageListContent}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              renderItem={({ item, index }) => {
                const isMe = getSenderId(item.sender_id) === currentUserId;
                const nextMsg = messages[index + 1];
                const isLastInGroup = !nextMsg || getSenderId(nextMsg.sender_id) !== getSenderId(item.sender_id);
                
                return (
                  <View style={[styles.msgContainer, isMe ? styles.myMsgContainer : styles.theirMsgContainer]}>
                    <View style={styles.msgBubbleRow}>
                      {!isMe && isLastInGroup && (
                        <Image source={{ uri: getAvatar(selectedConversation.participant.avatar) }} style={styles.smallAvatar} />
                      )}
                      {!isMe && !isLastInGroup && <View style={styles.smallAvatarPlaceholder} />}
                      
                      {isMe ? (
                        <LinearGradient
                          colors={['#0084FF', '#00C6FF']}
                          start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                          style={[styles.msgBubble, styles.myBubble, !isLastInGroup && { borderBottomRightRadius: 20 }]}
                        >
                          <Text style={[styles.msgText, styles.myText]}>{extractMessageText(item)}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={[styles.msgBubble, styles.theirBubble, !isLastInGroup && { borderBottomLeftRadius: 20 }]}>
                          <Text style={[styles.msgText, styles.theirText]}>{extractMessageText(item)}</Text>
                        </View>
                      )}
                    </View>
                    {isLastInGroup && isMe && item.read && (
                       <View style={styles.readIndicator}>
                          <Image source={{ uri: getAvatar(selectedConversation.participant.avatar) }} style={styles.readAvatar} />
                       </View>
                    )}
                  </View>
                );
              }}
            />
          )}

          <View style={styles.messengerInputBar}>
            <TouchableOpacity style={styles.inputActionBtn}>
              <Ionicons name="add-circle" size={26} color="#0084FF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.inputActionBtn}>
              <Ionicons name="camera" size={26} color="#0084FF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.inputActionBtn}>
              <Ionicons name="images" size={24} color="#0084FF" />
            </TouchableOpacity>
            
            <View style={styles.inputWrapper}>
              <TextInput 
                style={styles.textInputArea} 
                value={newMessage} 
                onChangeText={setNewMessage} 
                placeholder="Aa" 
                multiline 
                placeholderTextColor="#999" 
              />
              <TouchableOpacity style={styles.emojiBtn}>
                <Ionicons name="happy-outline" size={24} color="#0084FF" />
              </TouchableOpacity>
            </View>

            {newMessage.trim().length > 0 ? (
              <TouchableOpacity onPress={sendMessage} style={styles.sendIconBtn}>
                <Ionicons name="send" size={24} color="#0084FF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.sendIconBtn}>
                <Ionicons name="thumbs-up" size={26} color="#0084FF" />
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.listHeader}>
        <TouchableOpacity 
          style={styles.homeBtn}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.8}
        >
          <Ionicons name="home" size={22} color="#0084FF" />
        </TouchableOpacity>
        
        <Text style={styles.listHeaderTitle}>Chats</Text>
        
        <TouchableOpacity style={styles.editBtn}>
          <Ionicons name="create-outline" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBarArea}>
        <View style={styles.searchInner}>
          <Ionicons name="search" size={20} color="#8E8E93" />
          <TextInput placeholder="Search" style={styles.searchInput} placeholderTextColor="#8E8E93" />
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#0084FF" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.conversationList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadConversations(); }} />}
          renderItem={({ item }) => (
            <TouchableOpacity 
              onPress={() => { setSelectedConversation(item); loadMessages(item._id); }} 
              style={styles.conversationItem}
              activeOpacity={0.6}
            >
              <View style={styles.itemAvatarContainer}>
                <Image source={{ uri: getAvatar(item.participant.avatar) }} style={styles.itemAvatar} />
                <Animated.View style={[styles.activeStatusRing, { opacity: pulseAnim }]} />
              </View>
              
              <View style={styles.itemContent}>
                <Text style={[styles.itemName, item.unread_count > 0 && styles.unreadName]}>
                  {item.participant.name}
                </Text>
                <View style={styles.itemLastRow}>
                  <Text style={[styles.itemLastMsg, item.unread_count > 0 && styles.unreadMsg]} numberOfLines={1}>
                    {extractMessageText(item.last_message) || 'You sent a wave'}
                  </Text>
                  <Text style={styles.itemDot}> • </Text>
                  <Text style={styles.itemTime}>{safeFormatTime(item.last_message_at)}</Text>
                </View>
              </View>

              {item.unread_count > 0 ? (
                <View style={styles.unreadBlueDot} />
              ) : (
                <Ionicons name="checkmark-circle-outline" size={16} color="#DDD" />
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 12,
    backgroundColor: '#FFF'
  },
  listHeaderTitle: { fontSize: 24, fontWeight: '800', color: '#000', flex: 1, textAlign: 'center' },
  homeBtn: { 
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
    borderColor: '#E1F0FF'
  },
  editBtn: { 
    width: 42, 
    height: 42, 
    borderRadius: 21, 
    backgroundColor: '#F0F0F0', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  
  searchBarArea: { paddingHorizontal: 16, marginBottom: 16 },
  searchInner: { 
    flexDirection: 'row', 
    backgroundColor: '#F0F0F0', 
    borderRadius: 12, 
    paddingHorizontal: 12, 
    height: 40, 
    alignItems: 'center' 
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: '#000' },

  conversationList: { paddingHorizontal: 16 },
  conversationItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  itemAvatarContainer: { position: 'relative' },
  itemAvatar: { width: 64, height: 64, borderRadius: 32 },
  activeStatusRing: { 
    position: 'absolute', 
    bottom: 0, 
    right: 2, 
    width: 16, 
    height: 16, 
    borderRadius: 8, 
    backgroundColor: '#31A24C', 
    borderWidth: 3, 
    borderColor: '#FFF' 
  },
  itemContent: { flex: 1, marginLeft: 14 },
  itemName: { fontSize: 17, fontWeight: '500', color: '#050505', marginBottom: 2 },
  unreadName: { fontWeight: '700' },
  itemLastRow: { flexDirection: 'row', alignItems: 'center' },
  itemLastMsg: { fontSize: 14, color: '#65676B', maxWidth: '75%' },
  unreadMsg: { color: '#000', fontWeight: '700' },
  itemDot: { color: '#65676B', fontSize: 12 },
  itemTime: { color: '#65676B', fontSize: 14 },
  unreadBlueDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#0084FF' },

  // CHAT SCREEN
  chatSafeArea: { flex: 1, backgroundColor: '#FFF' },
  messengerHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 8, 
    paddingVertical: 8, 
    borderBottomWidth: 0.5, 
    borderBottomColor: '#E5E5E5' 
  },
  headerActionBtn: { padding: 6 },
  headerPartnerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  headerAvatarContainer: { position: 'relative', marginRight: 10 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerStatusDot: { 
    position: 'absolute', 
    bottom: 0, 
    right: 0, 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    backgroundColor: '#31A24C', 
    borderWidth: 2, 
    borderColor: '#FFF' 
  },
  headerName: { fontSize: 16, fontWeight: '700', color: '#000' },
  headerSubtext: { fontSize: 12, color: '#65676B' },
  headerRightActions: { flexDirection: 'row', gap: 4 },

  chatKeyboardArea: { flex: 1 },
  messageListContent: { paddingHorizontal: 12, paddingBottom: 20, paddingTop: 10 },
  msgContainer: { marginBottom: 3 },
  myMsgContainer: { alignItems: 'flex-end' },
  theirMsgContainer: { alignItems: 'flex-start' },
  msgBubbleRow: { flexDirection: 'row', alignItems: 'flex-end' },
  smallAvatar: { width: 24, height: 24, borderRadius: 12, marginRight: 8, marginBottom: 2 },
  smallAvatarPlaceholder: { width: 24, height: 24, marginRight: 8 },
  
  msgBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, maxWidth: width * 0.72 },
  myBubble: { borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: '#E4E6EB', borderBottomLeftRadius: 4 },
  
  msgText: { fontSize: 16, lineHeight: 22 },
  myText: { color: '#FFF' },
  theirText: { color: '#050505' },
  
  readIndicator: { marginTop: 2 },
  readAvatar: { width: 14, height: 14, borderRadius: 7 },

  messengerInputBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 8, 
    paddingVertical: 10,
    backgroundColor: '#FFF'
  },
  inputActionBtn: { padding: 5 },
  inputWrapper: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F0F2F5', 
    borderRadius: 20, 
    paddingHorizontal: 12, 
    marginHorizontal: 4,
    minHeight: 36
  },
  textInputArea: { flex: 1, color: '#000', fontSize: 16, paddingVertical: 8, maxHeight: 100 },
  emojiBtn: { padding: 4 },
  sendIconBtn: { padding: 6, marginLeft: 2 }
});

export default MessageScreen;
