import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Dimensions,
  TouchableWithoutFeedback,
  SafeAreaView,
} from 'react-native';
import { Sidebar } from '../components/chat/Sidebar';
import { ChatArea } from '../components/chat/ChatArea';
import { MembersPanel } from '../components/chat/MembersPanel';
import { Colors } from '../constants/theme';
import { Room, Message, Member } from '../constants/types';

const DEFAULT_ROOMS: Room[] = [
  { room_id: '1', name: 'general', description: 'Company-wide announcements and chat' },
  { room_id: '2', name: 'random', description: 'Water cooler conversation' },
  { room_id: '3', name: 'engineering', description: 'Dev discussions and code reviews' },
];

// Generate a simple unique ID (no crypto.randomUUID on RN)
let _counter = 0;
function uid() {
  return `${Date.now()}-${++_counter}`;
}

export default function ChatScreen() {
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [activeRoomId, setActiveRoomId] = useState('1');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, Message[]>>({});

  const activeRoom = rooms.find((r) => r.room_id === activeRoomId);
  const messages = messagesByRoom[activeRoomId] || [];

  // Mock user — will be replaced with Clerk user
  const mockUser = {
    id: 'me',
    username: 'You',
    avatar_url: undefined as string | undefined,
  };

  const members: Member[] = [
    { user_id: mockUser.id, username: mockUser.username, is_online: true },
  ];

  const handleSend = useCallback(
    (content: string) => {
      const msg: Message = {
        id: uid(),
        user_id: mockUser.id,
        username: mockUser.username,
        avatar_url: mockUser.avatar_url,
        content,
        created_at: new Date().toISOString(),
      };
      setMessagesByRoom((prev) => ({
        ...prev,
        [activeRoomId]: [...(prev[activeRoomId] || []), msg],
      }));
    },
    [activeRoomId],
  );

  const handleCreateRoom = useCallback((name: string, description: string) => {
    const room: Room = { room_id: uid(), name, description };
    setRooms((prev) => [...prev, room]);
    setActiveRoomId(room.room_id);
  }, []);

  const screenWidth = Dimensions.get('window').width;

  return (
    <SafeAreaView style={styles.container}>
      {/* Chat area — always visible */}
      <ChatArea
        roomName={activeRoom?.name || 'general'}
        roomDescription={activeRoom?.description}
        messages={messages}
        onSendMessage={handleSend}
        onToggleMembers={() => setShowMembers((s) => !s)}
        onOpenSidebar={() => setShowSidebar(true)}
        showMembers={showMembers}
      />

      {/* Sidebar drawer — slides from left */}
      <Modal
        visible={showSidebar}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSidebar(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowSidebar(false)}>
          <View style={styles.drawerOverlay} />
        </TouchableWithoutFeedback>
        <View style={[styles.drawerContent, { width: Math.min(screenWidth * 0.82, 320) }]}>
          <SafeAreaView style={{ flex: 1 }}>
            <Sidebar
              rooms={rooms}
              activeRoomId={activeRoomId}
              onSelectRoom={(id) => {
                setActiveRoomId(id);
                setShowSidebar(false);
              }}
              onCreateRoom={handleCreateRoom}
              userName={mockUser.username}
              userAvatar={mockUser.avatar_url}
              onClose={() => setShowSidebar(false)}
            />
          </SafeAreaView>
        </View>
      </Modal>

      {/* Members panel — slides from right */}
      <Modal
        visible={showMembers}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMembers(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowMembers(false)}>
          <View style={styles.drawerOverlay} />
        </TouchableWithoutFeedback>
        <View style={[styles.membersDrawer, { width: Math.min(screenWidth * 0.75, 280) }]}>
          <SafeAreaView style={{ flex: 1 }}>
            <MembersPanel members={members} onClose={() => setShowMembers(false)} />
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  drawerContent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.sidebar,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  membersDrawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
});
