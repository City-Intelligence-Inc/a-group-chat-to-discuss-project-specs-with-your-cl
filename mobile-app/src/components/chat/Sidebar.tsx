import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../constants/theme';
import { Room } from '../../constants/types';

interface SidebarProps {
  rooms: Room[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onCreateRoom: (name: string, description: string) => void;
  userName?: string;
  userAvatar?: string;
  onClose?: () => void;
}

export function Sidebar({
  rooms,
  activeRoomId,
  onSelectRoom,
  onCreateRoom,
  userName = 'User',
  userAvatar,
  onClose,
}: SidebarProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    onCreateRoom(slug, desc.trim());
    setName('');
    setDesc('');
    setCreateOpen(false);
  };

  const handleSelectRoom = (roomId: string) => {
    onSelectRoom(roomId);
    onClose?.();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Townhall</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => onClose?.()}
        >
          <Ionicons name="close" size={18} color={Colors.textLight} />
        </TouchableOpacity>
      </View>

      {/* Channels */}
      <ScrollView style={styles.channelList} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionLabel}>
            <Ionicons name="chevron-down" size={12} color={Colors.textLight} />
            <Text style={styles.sectionTitle}>CHANNELS</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setCreateOpen(true)}
          >
            <Ionicons name="add" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {rooms.map((room) => (
          <TouchableOpacity
            key={room.room_id}
            style={[
              styles.channelItem,
              activeRoomId === room.room_id && styles.channelItemActive,
            ]}
            onPress={() => handleSelectRoom(room.room_id)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.channelHash,
                activeRoomId === room.room_id && styles.channelHashActive,
              ]}
            >
              #
            </Text>
            <Text
              style={[
                styles.channelName,
                activeRoomId === room.room_id && styles.channelNameActive,
              ]}
              numberOfLines={1}
            >
              {room.name}
            </Text>
          </TouchableOpacity>
        ))}

        {rooms.length === 0 && (
          <Text style={styles.emptyText}>
            No channels yet.{'\n'}Create one to get started.
          </Text>
        )}
      </ScrollView>

      {/* User footer */}
      <View style={styles.userFooter}>
        <View style={styles.avatarContainer}>
          {userAvatar ? (
            <Image source={{ uri: userAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>
                {userName?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles.onlineDot} />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {userName}
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Active</Text>
          </View>
        </View>
      </View>

      {/* Create channel modal */}
      <Modal
        visible={createOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create a channel</Text>
            <Text style={styles.modalDesc}>
              Channels are where your team communicates. They're best organized
              around a topic.
            </Text>

            <Text style={styles.inputLabel}>Name</Text>
            <View style={styles.nameInputRow}>
              <Text style={styles.hashPrefix}>#</Text>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g. plan-budget"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleCreate}
              />
            </View>

            <Text style={styles.inputLabel}>
              Description{' '}
              <Text style={styles.inputLabelOptional}>(optional)</Text>
            </Text>
            <TextInput
              style={styles.descInput}
              value={desc}
              onChangeText={setDesc}
              placeholder="What's this channel about?"
              placeholderTextColor={Colors.textMuted}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setCreateOpen(false);
                  setName('');
                  setDesc('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, !name.trim() && styles.createBtnDisabled]}
                onPress={handleCreate}
                disabled={!name.trim()}
              >
                <Text style={styles.createBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.sidebar,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Fonts.heading,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  headerButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelList: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionTitle: {
    fontSize: Fonts.tiny,
    fontWeight: '500',
    color: Colors.textLight,
    letterSpacing: 1,
  },
  addButton: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginVertical: 1,
  },
  channelItemActive: {
    backgroundColor: Colors.sidebarActive,
  },
  channelHash: {
    fontSize: Fonts.caption,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  channelHashActive: {
    color: 'rgba(255,255,255,0.5)',
  },
  channelName: {
    fontSize: Fonts.caption,
    color: Colors.textLight,
    flex: 1,
  },
  channelNameActive: {
    color: Colors.textOnDark,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: Fonts.small,
    color: Colors.textMuted,
    paddingVertical: 24,
    lineHeight: 18,
  },
  userFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarFallback: {
    backgroundColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: Fonts.small,
    fontWeight: '600',
    color: Colors.textLight,
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.green,
    borderWidth: 2,
    borderColor: Colors.sidebar,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: Fonts.caption,
    fontWeight: '500',
    color: Colors.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.green,
  },
  statusText: {
    fontSize: Fonts.tiny,
    color: Colors.textMuted,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  modalDesc: {
    fontSize: Fonts.regular,
    color: Colors.textLight,
    marginBottom: 20,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: Fonts.regular,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  inputLabelOptional: {
    fontWeight: '400',
    color: Colors.textMuted,
  },
  nameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  hashPrefix: {
    fontSize: Fonts.regular,
    color: Colors.textMuted,
    marginRight: 4,
  },
  nameInput: {
    flex: 1,
    fontSize: Fonts.regular,
    color: Colors.text,
    paddingVertical: 12,
  },
  descInput: {
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: Fonts.regular,
    color: Colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 24,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontSize: Fonts.regular,
    fontWeight: '500',
    color: Colors.text,
  },
  createBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  createBtnDisabled: {
    opacity: 0.3,
  },
  createBtnText: {
    fontSize: Fonts.regular,
    fontWeight: '500',
    color: Colors.textOnDark,
  },
});
