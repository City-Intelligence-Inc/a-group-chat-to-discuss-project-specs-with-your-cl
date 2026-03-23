import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../constants/theme';
import { Message } from '../../constants/types';

interface ChatAreaProps {
  roomName: string;
  roomDescription?: string;
  messages: Message[];
  onSendMessage: (content: string) => void;
  onToggleMembers: () => void;
  onOpenSidebar: () => void;
  showMembers: boolean;
  typingUsers?: string[];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// Build flat list items with date separators
type ListItem =
  | { type: 'date'; label: string; key: string }
  | { type: 'message'; msg: Message; compact: boolean; key: string }
  | { type: 'welcome'; key: string };

function buildListItems(messages: Message[]): ListItem[] {
  if (messages.length === 0) {
    return [{ type: 'welcome', key: 'welcome' }];
  }

  const items: ListItem[] = [];
  let curDate = '';

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const d = new Date(msg.created_at).toDateString();

    if (d !== curDate) {
      curDate = d;
      items.push({ type: 'date', label: formatDateLabel(msg.created_at), key: `date-${d}` });
    }

    const prev = i > 0 ? messages[i - 1] : null;
    const compact =
      !!prev &&
      prev.user_id === msg.user_id &&
      new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 300000 &&
      new Date(prev.created_at).toDateString() === d;

    items.push({ type: 'message', msg, compact, key: msg.id });
  }

  return items;
}

export function ChatArea({
  roomName,
  roomDescription,
  messages,
  onSendMessage,
  onToggleMembers,
  onOpenSidebar,
  showMembers,
  typingUsers = [],
}: ChatAreaProps) {
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const listItems = buildListItems(messages);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'welcome') {
      return (
        <View style={styles.welcomeBanner}>
          <View style={styles.welcomeIcon}>
            <Text style={styles.welcomeHash}>#</Text>
          </View>
          <Text style={styles.welcomeTitle}>Welcome to #{roomName}</Text>
          <Text style={styles.welcomeDesc}>
            This is the start of the{' '}
            <Text style={styles.welcomeBold}>#{roomName}</Text> channel.
            {roomDescription
              ? ` ${roomDescription}`
              : ' Send a message to get the conversation going.'}
          </Text>
        </View>
      );
    }

    if (item.type === 'date') {
      return (
        <View style={styles.dateDivider}>
          <View style={styles.dateLine} />
          <Text style={styles.dateLabel}>{item.label}</Text>
          <View style={styles.dateLine} />
        </View>
      );
    }

    const { msg, compact } = item;

    if (compact) {
      return (
        <View style={styles.compactRow}>
          <Text style={styles.compactTime}>{formatTime(msg.created_at)}</Text>
          <Text style={styles.messageText}>{msg.content}</Text>
        </View>
      );
    }

    return (
      <View style={styles.messageRow}>
        {msg.avatar_url ? (
          <Image source={{ uri: msg.avatar_url }} style={styles.msgAvatar} />
        ) : (
          <View style={[styles.msgAvatar, styles.msgAvatarFallback]}>
            <Text style={styles.msgAvatarText}>
              {msg.username?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <View style={styles.msgContent}>
          <View style={styles.msgHeader}>
            <Text style={styles.msgUsername}>{msg.username}</Text>
            <Text style={styles.msgTime}>{formatTime(msg.created_at)}</Text>
          </View>
          <Text style={styles.messageText}>{msg.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={onOpenSidebar}>
          <Ionicons name="menu" size={22} color={Colors.textLight} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerHash}>#</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {roomName}
          </Text>
          {roomDescription ? (
            <>
              <View style={styles.headerDivider} />
              <Text style={styles.headerDesc} numberOfLines={1}>
                {roomDescription}
              </Text>
            </>
          ) : null}
        </View>
        <TouchableOpacity
          style={[
            styles.membersButton,
            showMembers && styles.membersButtonActive,
          ]}
          onPress={onToggleMembers}
        >
          <Ionicons
            name="people"
            size={18}
            color={showMembers ? Colors.text : Colors.textLight}
          />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={listItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
      />

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <View style={styles.typingRow}>
          <Text style={styles.typingText}>
            <Text style={styles.typingNames}>{typingUsers.join(', ')}</Text>
            {typingUsers.length === 1 ? ' is' : ' are'} typing...
          </Text>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputArea}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder={`Message #${roomName}`}
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={4000}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!input.trim()}
          >
            <Ionicons name="send" size={16} color={Colors.textOnDark} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerHash: {
    fontSize: 16,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: Fonts.heading,
    fontWeight: '600',
    color: Colors.text,
    flexShrink: 1,
  },
  headerDivider: {
    width: 1,
    height: 14,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
  },
  headerDesc: {
    fontSize: Fonts.caption,
    color: Colors.textMuted,
    flexShrink: 2,
  },
  membersButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membersButtonActive: {
    backgroundColor: '#f5f5f5',
  },

  // Messages
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  // Welcome
  welcomeBanner: {
    paddingVertical: 32,
  },
  welcomeIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  welcomeHash: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textLight,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  welcomeDesc: {
    fontSize: Fonts.regular,
    color: Colors.textLight,
    lineHeight: 20,
    maxWidth: 320,
  },
  welcomeBold: {
    fontWeight: '500',
    color: Colors.textSecondary,
  },

  // Date divider
  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dateLabel: {
    marginHorizontal: 12,
    fontSize: Fonts.tiny,
    fontWeight: '500',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Message rows
  messageRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 6,
  },
  msgAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginTop: 2,
  },
  msgAvatarFallback: {
    backgroundColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgAvatarText: {
    fontSize: Fonts.small,
    fontWeight: '600',
    color: Colors.textLight,
  },
  msgContent: {
    flex: 1,
  },
  msgHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 2,
  },
  msgUsername: {
    fontSize: Fonts.regular,
    fontWeight: '600',
    color: Colors.text,
  },
  msgTime: {
    fontSize: Fonts.tiny,
    color: Colors.textMuted,
  },
  messageText: {
    fontSize: Fonts.regular,
    color: '#404040',
    lineHeight: 21,
  },

  // Compact message
  compactRow: {
    flexDirection: 'row',
    paddingLeft: 48,
    paddingVertical: 1,
    gap: 12,
  },
  compactTime: {
    fontSize: Fonts.tiny,
    color: '#d4d4d4',
    width: 40,
    textAlign: 'right',
    paddingTop: 2,
  },

  // Typing
  typingRow: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  typingText: {
    fontSize: Fonts.small,
    color: Colors.textMuted,
  },
  typingNames: {
    fontWeight: '500',
    color: Colors.textLight,
  },

  // Input
  inputArea: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    paddingTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  textInput: {
    flex: 1,
    fontSize: Fonts.regular,
    color: Colors.text,
    maxHeight: 120,
    lineHeight: 20,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.15,
  },
});
