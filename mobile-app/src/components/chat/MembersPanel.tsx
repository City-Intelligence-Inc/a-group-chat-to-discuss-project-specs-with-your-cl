import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../constants/theme';
import { Member } from '../../constants/types';

interface MembersPanelProps {
  members: Member[];
  onClose: () => void;
}

export function MembersPanel({ members, onClose }: MembersPanelProps) {
  const online = members.filter((m) => m.is_online);
  const offline = members.filter((m) => !m.is_online);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Members</Text>
          <Text style={styles.headerCount}>{members.length}</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={18} color={Colors.textLight} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {/* Online */}
        {online.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              ONLINE — {online.length}
            </Text>
            {online.map((m) => (
              <View key={m.user_id} style={styles.memberRow}>
                <View style={styles.avatarWrap}>
                  {m.avatar_url ? (
                    <Image source={{ uri: m.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarText}>
                        {m.username?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.onlineDot} />
                </View>
                <Text style={styles.memberName} numberOfLines={1}>
                  {m.username}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Separator */}
        {online.length > 0 && offline.length > 0 && (
          <View style={styles.separator} />
        )}

        {/* Offline */}
        {offline.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              OFFLINE — {offline.length}
            </Text>
            {offline.map((m) => (
              <View key={m.user_id} style={[styles.memberRow, styles.offlineRow]}>
                <View style={styles.avatarWrap}>
                  {m.avatar_url ? (
                    <Image
                      source={{ uri: m.avatar_url }}
                      style={[styles.avatar, { opacity: 0.5 }]}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallbackOffline]}>
                      <Text style={styles.avatarTextOffline}>
                        {m.username?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.offlineDot} />
                </View>
                <Text style={styles.memberNameOffline} numberOfLines={1}>
                  {m.username}
                </Text>
              </View>
            ))}
          </View>
        )}

        {members.length === 0 && (
          <Text style={styles.emptyText}>No members</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: Fonts.caption,
    fontWeight: '600',
    color: Colors.text,
  },
  headerCount: {
    fontSize: Fonts.tiny,
    color: Colors.textMuted,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
    padding: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: Fonts.tiny,
    fontWeight: '500',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
  },
  offlineRow: {
    opacity: 0.5,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarFallback: {
    backgroundColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackOffline: {
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textLight,
  },
  avatarTextOffline: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.green,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  offlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#d4d4d4',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  memberName: {
    fontSize: Fonts.caption,
    color: Colors.textSecondary,
    flex: 1,
  },
  memberNameOffline: {
    fontSize: Fonts.caption,
    color: Colors.textLight,
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: Fonts.small,
    color: Colors.textMuted,
    paddingVertical: 32,
  },
});
