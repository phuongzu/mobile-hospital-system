
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
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

  useEffect(() => {
    selectedConvRef.current = selectedConversation;
  }, [selectedConversation]);

  const safeFormatTime = useCallback((dateStr?: string | number | Date): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    try {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
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
      const userData = await AsyncStorage.getItem('userData');
      if (userData) setCurrentUserId(JSON.parse(userData)._id);
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
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setSelectedConversation(null)} style={styles.backButton}>
            <Icon name="arrow-back-ios" size={20} color="#1E293B" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.chatPartnerName}>{selectedConversation.participant.name}</Text>
            <Text style={[styles.chatPartnerStatus, { color: isSocketConnected ? '#10B981' : '#94A3B8' }]}>
              {isSocketConnected ? 'LIVE CONNECTION' : 'SYNCING...'}
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView 
          style={styles.chatContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {messageLoading ? (
            <ActivityIndicator style={{ flex: 1 }} color="#2563EB" />
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item, index) => item._id || index.toString()}
              /* FIX: Tăng paddingBottom lên 180 để tin nhắn cuối không bị che bởi thanh input nổi */
              contentContainerStyle={{ padding: 16, paddingBottom: 180 }}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              renderItem={({ item }) => {
                const isMe = getSenderId(item.sender_id) === currentUserId;
                return (
                  <View style={[styles.messageWrapper, isMe ? styles.myMsgWrapper : styles.theirMsgWrapper]}>
                    <View style={[styles.msgBubble, isMe ? styles.myMsgBubble : styles.theirMsgBubble]}>
                      <Text style={[styles.msgText, isMe ? styles.myMsgText : styles.theirMsgText]}>{extractMessageText(item)}</Text>
                    </View>
                    <View style={styles.msgFooter}>
                      <Text style={styles.msgTime}>{safeFormatTime(item.timestamp)}</Text>
                      {isMe && <Icon name="done-all" size={12} color={item.read ? '#3B82F6' : '#CBD5E1'} />}
                    </View>
                  </View>
                );
              }}
            />
          )}

          <View style={styles.floatingInputBar}>
            <TextInput 
              style={styles.textInput} 
              value={newMessage} 
              onChangeText={setNewMessage} 
              placeholder="Type a message..." 
              multiline 
              placeholderTextColor="#94A3B8" 
              onFocus={() => setTimeout(scrollToBottom, 400)}
            />
            <TouchableOpacity onPress={sendMessage} disabled={!newMessage.trim() || sending} style={[styles.sendBtn, !newMessage.trim() && { backgroundColor: '#F1F5F9' }]}>
              {sending ? <ActivityIndicator size="small" color="#FFF" /> : <Icon name="send" size={20} color={newMessage.trim() ? "#FFF" : "#94A3B8"} />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <View style={[styles.statusDot, { backgroundColor: isSocketConnected ? '#10B981' : '#F43F5E' }]} />
      </View>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadConversations(); }} />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => { setSelectedConversation(item); loadMessages(item._id); }} style={styles.convCard}>
            <Image source={{ uri: getAvatar(item.participant.avatar) }} style={styles.convAvatar} />
            <View style={styles.convContent}>
              <View style={styles.convHeader}>
                <Text style={styles.convName}>{item.participant.name}</Text>
                <Text style={styles.convTime}>{safeFormatTime(item.last_message_at)}</Text>
              </View>
              <Text style={[styles.convLastMsg, item.unread_count > 0 && styles.convLastMsgUnread]} numberOfLines={1}>
                {extractMessageText(item.last_message) || 'Start session...'}
              </Text>
            </View>
            {item.unread_count > 0 && <View style={styles.unreadBadge}><Text style={styles.unreadText}>{item.unread_count}</Text></View>}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#0F172A' },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  convCard: { flexDirection: 'row', padding: 16, alignItems: 'center', backgroundColor: '#FFF', borderRadius: 24, marginBottom: 12, elevation: 1 },
  convAvatar: { width: 60, height: 60, borderRadius: 20 },
  convContent: { flex: 1, marginLeft: 16 },
  convHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  convName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  convTime: { fontSize: 11, color: '#94A3B8' },
  convLastMsg: { fontSize: 14, color: '#64748B' },
  convLastMsgUnread: { color: '#0F172A', fontWeight: '800' },
  unreadBadge: { backgroundColor: '#F43F5E', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  unreadText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backButton: { padding: 8 },
  headerInfo: { marginLeft: 8 },
  chatPartnerName: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  chatPartnerStatus: { fontSize: 10, fontWeight: '800' },
  chatContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  messageWrapper: { marginBottom: 16, maxWidth: '80%' },
  myMsgWrapper: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirMsgWrapper: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  msgBubble: { padding: 14, borderRadius: 24 },
  myMsgBubble: { backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
  theirMsgBubble: { backgroundColor: '#FFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#F1F5F9' },
  msgText: { fontSize: 15, lineHeight: 20 },
  myMsgText: { color: '#FFF' },
  theirMsgText: { color: '#1E293B' },
  msgFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  msgTime: { fontSize: 10, color: '#94A3B8' },
  floatingInputBar: { position: 'absolute', bottom: 24, left: 16, right: 16, flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 32, padding: 8, alignItems: 'center', elevation: 10, zIndex: 100 },
  textInput: { flex: 1, paddingHorizontal: 16, maxHeight: 100, color: '#1E293B' },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' }
});

export default MessageScreen;
