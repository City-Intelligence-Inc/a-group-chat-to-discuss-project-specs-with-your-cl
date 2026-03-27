"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { Sidebar } from "@/components/chat/sidebar";
import { ChatArea } from "@/components/chat/chat-area";
import { MembersPanel } from "@/components/chat/members-panel";
import { Onboarding } from "@/components/chat/onboarding";
import { SearchModal } from "@/components/chat/search-modal";
import { SettingsModal, useFont } from "@/components/chat/settings-modal";
import * as api from "@/lib/api";

interface Room {
  room_id: string;
  name: string;
  description?: string;
  unread_count?: number;
}

interface Message {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  content: string;
  created_at: string;
  sort_key?: string;
  reactions?: Record<string, string[]>;
  edited_at?: string | null;
  reply_to?: string | null;
  reply_preview?: string | null;
  reply_username?: string | null;
}

interface Member {
  user_id: string;
  username: string;
  avatar_url?: string;
  is_online: boolean;
}

export default function ChatPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  // Map of userId -> { username, avatar_url } for enriching messages
  const userMapRef = useRef<Map<string, { username: string; avatar_url?: string }>>(new Map());
  // Track lastReadAt per room for unread badges
  const lastReadRef = useRef<Map<string, string>>(new Map());

  // Load saved font preference
  useFont();

  // Set up auth token provider for API calls
  useEffect(() => {
    api.setTokenProvider(getToken);
  }, [getToken]);

  // Cmd+K search shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Sync user to backend + populate user map + check onboarding
  useEffect(() => {
    if (!user) return;
    const name = user.fullName || user.username || "User";
    const avatar = user.imageUrl;
    // Cache current user
    userMapRef.current.set(user.id, { username: name, avatar_url: avatar });
    // Sync to backend
    api.syncUser({
      id: user.id,
      username: name,
      email: user.primaryEmailAddress?.emailAddress || "",
      avatar_url: avatar,
    }).catch(() => {});
    // Show onboarding for first-time users
    if (!localStorage.getItem("townhall_onboarded")) {
      setShowOnboarding(true);
    }
  }, [user]);

  // Load rooms
  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        // listRooms already normalizes: returns [{ id, name, description }]
        const allRooms = await api.listRooms();
        let mapped: Room[] = allRooms.map((r: { id: string; name: string; description?: string }) => ({
          room_id: r.id,
          name: r.name,
          description: r.description,
        }));

        // Seed "general" if no rooms
        if (mapped.length === 0) {
          try {
            const room = await api.createRoom({
              name: "general",
              description: "Company-wide announcements and chat",
              created_by: user!.id,
            });
            await api.joinRoom(room.id, { user_id: user!.id });
            mapped = [{ room_id: room.id, name: room.name, description: room.description }];
          } catch {}
        }

        // Compute unread counts per room
        const roomsWithUnread = await Promise.all(
          mapped.map(async (r) => {
            try {
              const readData = await api.getReadStatus(r.room_id, user!.id);
              const lastRead = readData.lastReadAt;
              if (lastRead) lastReadRef.current.set(r.room_id, lastRead);
              if (!lastRead) return { ...r, unread_count: 0 };
              // Count messages newer than lastReadAt
              const msgData = await api.listMessages(r.room_id, 50);
              const unread = msgData.messages.filter(
                (m: { created_at: string; sender_id: string }) =>
                  m.created_at > lastRead && m.sender_id !== user!.id
              ).length;
              return { ...r, unread_count: unread };
            } catch {
              return { ...r, unread_count: 0 };
            }
          })
        );

        setRooms(roomsWithUnread);
        if (roomsWithUnread.length > 0 && !activeRoomId) {
          setActiveRoomId(roomsWithUnread[0].room_id);
        }
      } catch (e) {
        console.error("Failed to load rooms:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  // Auto-join room + load messages + members + presence when room changes
  useEffect(() => {
    if (!activeRoomId || !user) return;

    async function loadRoom() {
      try {
        // Auto-join the room if not already a member
        await api.joinRoom(activeRoomId!, { user_id: user!.id }).catch(() => {});

        // Register presence (connection)
        const connId = `${user!.id}-${activeRoomId}`;
        await api.registerConnection({
          id: connId,
          user_id: user!.id,
          room_id: activeRoomId!,
        }).catch(() => {});

        const [msgData, memberList, activeConns] = await Promise.all([
          api.listMessages(activeRoomId!),
          api.listMembers(activeRoomId!),
          api.getActiveUsers(activeRoomId!),
        ]);

        // Build set of online user IDs — only count connections from last 60s as alive
        const onlineSet = new Set<string>();
        const now = Date.now();
        for (const c of activeConns) {
          const connTime = new Date(c.connectedAt || c.connected_at).getTime();
          if (now - connTime < 60000) { // 60s staleness threshold
            onlineSet.add(c.userId || c.user_id);
          }
        }
        onlineSet.add(user!.id);

        // Build user map from members
        const umap = userMapRef.current;
        umap.set(user!.id, {
          username: user!.fullName || user!.username || "User",
          avatar_url: user!.imageUrl,
        });
        for (const m of memberList) {
          if (m.user_id && m.username) {
            umap.set(m.user_id, { username: m.username, avatar_url: m.avatar_url });
          }
        }

        // Enrich messages
        const msgs: Message[] = msgData.messages.map((m: Record<string, unknown>) => {
          const sid = (m.sender_id || "") as string;
          const cached = umap.get(sid);
          return {
            id: m.id as string,
            user_id: sid,
            username: cached?.username || (m.sender_name as string) || sid,
            avatar_url: cached?.avatar_url,
            content: m.content as string,
            created_at: m.created_at as string,
            sort_key: m.sort_key as string | undefined,
            reactions: (m.reactions as Record<string, string[]>) || {},
            edited_at: (m.edited_at as string) || null,
            reply_to: (m.reply_to as string) || null,
            reply_preview: (m.reply_preview as string) || null,
          };
        });
        // Sort chronologically (API returns newest-first)
        msgs.sort((a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setMessages(msgs);

        // Set members with real online status
        const enrichedMembers: Member[] = memberList.map((m: Member) => ({
          ...m,
          is_online: onlineSet.has(m.user_id),
        }));
        setMembers(enrichedMembers);
      } catch (e) {
        console.error("Failed to load room data:", e);
        setMessages([]);
        setMembers([]);
      }
    }
    loadRoom();

    // Poll presence + send heartbeat every 10s
    const presenceInterval = setInterval(async () => {
      try {
        // Send heartbeat to keep our connection alive
        api.heartbeat({ user_id: user!.id, room_id: activeRoomId! }).catch(() => {});

        const [memberList, activeConns] = await Promise.all([
          api.listMembers(activeRoomId!),
          api.getActiveUsers(activeRoomId!),
        ]);
        const onlineSet = new Set<string>();
        const now = Date.now();
        for (const c of activeConns) {
          const connTime = new Date(c.connectedAt || c.connected_at).getTime();
          if (now - connTime < 60000) {
            onlineSet.add(c.userId || c.user_id);
          }
        }
        onlineSet.add(user!.id);

        // Update user map with any new members
        for (const m of memberList) {
          if (m.user_id && m.username) {
            userMapRef.current.set(m.user_id, { username: m.username, avatar_url: m.avatar_url });
          }
        }

        setMembers(memberList.map((m: Member) => ({
          ...m,
          is_online: onlineSet.has(m.user_id),
        })));
      } catch {}
    }, 10000);

    // Clean up connection on room change (using user+room, not UUID)
    return () => {
      clearInterval(presenceInterval);
      api.removeUserRoomConnection(user!.id, activeRoomId!).catch(() => {});
    };
  }, [activeRoomId, user]);

  // Mark room as read when switching rooms
  useEffect(() => {
    if (!activeRoomId || !user) return;
    api.markRead(activeRoomId, user.id).catch(() => {});
    // Clear unread count for this room
    setRooms((prev) => prev.map((r) =>
      r.room_id === activeRoomId ? { ...r, unread_count: 0 } : r
    ));
  }, [activeRoomId, user]);

  // SSE for real-time messages, typing, and deletions
  useEffect(() => {
    if (!activeRoomId || !user) return;

    if (sseRef.current) {
      sseRef.current.close();
    }

    const sse = api.connectSSE(activeRoomId);
    sseRef.current = sse;

    const handleNewMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (!data.content) return;

        const sid = data.senderId || data.sender_id || "";

        // Skip messages from ourselves — we already added them optimistically
        if (sid === user.id) return;

        const cached = userMapRef.current.get(sid);
        const msg: Message = {
          id: data.messageId || data.id || crypto.randomUUID(),
          user_id: sid,
          username: data.senderName || data.sender_name || cached?.username || sid,
          avatar_url: cached?.avatar_url,
          content: data.content,
          created_at: data.createdAt || data.created_at || new Date().toISOString(),
          sort_key: data.sortKey || data.sort_key,
        };

        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          const next = [...prev, msg];
          next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return next;
        });

        // Increment unread for other rooms
        setRooms((prev) => prev.map((r) => {
          if (r.room_id === activeRoomId) return r;
          const msgRoom = data.roomId || data.room_id;
          if (r.room_id === msgRoom) {
            return { ...r, unread_count: (r.unread_count || 0) + 1 };
          }
          return r;
        }));
      } catch {}
    };

    const handleTyping = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const typerId = data.user_id || data.userId;
        if (typerId === user.id) return;
        const typerName = data.username || userMapRef.current.get(typerId)?.username || typerId;
        setTypingUsers((prev) => {
          if (prev.includes(typerName)) return prev;
          return [...prev, typerName];
        });
        // Auto-remove after 5s
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((n) => n !== typerName));
        }, 5000);
      } catch {}
    };

    const handleStopTyping = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const typerId = data.user_id || data.userId;
        const typerName = data.username || userMapRef.current.get(typerId)?.username || typerId;
        setTypingUsers((prev) => prev.filter((n) => n !== typerName));
      } catch {}
    };

    const handleDeleteMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const sortKey = data.sortKey || data.sort_key;
        if (sortKey) {
          setMessages((prev) => prev.filter((m) => m.sort_key !== sortKey));
        }
      } catch {}
    };

    const handleEdited = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const key = data.sortKey || data.sort_key;
        if (key) {
          setMessages((prev) =>
            prev.map((m) =>
              m.sort_key === key
                ? { ...m, content: data.content, edited_at: data.editedAt || data.edited_at }
                : m
            )
          );
        }
      } catch {}
    };

    const handleReaction = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const key = data.sortKey || data.sort_key;
        if (key) {
          setMessages((prev) =>
            prev.map((m) =>
              m.sort_key === key ? { ...m, reactions: data.reactions || {} } : m
            )
          );
        }
      } catch {}
    };

    const handleUserJoined = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const joinedId = data.userId || data.user_id;
        if (joinedId) {
          setMembers((prev) =>
            prev.map((m) => m.user_id === joinedId ? { ...m, is_online: true } : m)
          );
        }
      } catch {}
    };

    const handleUserLeft = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const leftId = data.userId || data.user_id;
        if (leftId) {
          setMembers((prev) =>
            prev.map((m) => m.user_id === leftId ? { ...m, is_online: false } : m)
          );
        }
      } catch {}
    };

    sse.addEventListener("new_message", handleNewMessage);
    sse.addEventListener("typing", handleTyping);
    sse.addEventListener("stop_typing", handleStopTyping);
    sse.addEventListener("message_deleted", handleDeleteMessage);
    sse.addEventListener("message_edited", handleEdited);
    sse.addEventListener("reaction_update", handleReaction);
    sse.addEventListener("user_joined", handleUserJoined);
    sse.addEventListener("user_left", handleUserLeft);
    sse.onmessage = handleNewMessage;

    return () => {
      sse.close();
      setTypingUsers([]);
    };
  }, [activeRoomId, user]);

  // Typing indicator: debounced — sends typing on keypress, stop after 3s idle
  const handleTypingStart = useCallback(() => {
    if (!user || !activeRoomId) return;
    const name = user.fullName || user.username || "User";
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      api.sendTyping(activeRoomId, { user_id: user.id, username: name }).catch(() => {});
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      api.sendStopTyping(activeRoomId, { user_id: user.id, username: name }).catch(() => {});
    }, 3000);
  }, [user, activeRoomId]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!user || !activeRoomId) return;

      // Stop typing indicator on send
      if (isTypingRef.current) {
        isTypingRef.current = false;
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        api.sendStopTyping(activeRoomId, {
          user_id: user.id,
          username: user.fullName || user.username || "User",
        }).catch(() => {});
      }

      const tempId = crypto.randomUUID();
      const replyData = replyingTo
        ? { reply_to: replyingTo.sort_key || null, reply_preview: replyingTo.content.slice(0, 100), reply_username: replyingTo.username }
        : {};
      setMessages((prev) => {
        const next = [
          ...prev,
          {
            id: tempId,
            user_id: user.id,
            username: user.fullName || user.username || "User",
            avatar_url: user.imageUrl,
            content,
            created_at: new Date().toISOString(),
            reactions: {},
            ...replyData,
          },
        ];
        next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return next;
      });
      setReplyingTo(null);

      try {
        await api.sendMessage(activeRoomId, {
          sender_id: user.id,
          content,
          ...(replyData.reply_to ? { reply_to: replyData.reply_to, reply_preview: replyData.reply_preview } : {}),
        } as { sender_id: string; content: string; reply_to?: string; reply_preview?: string });
        api.markRead(activeRoomId, user.id).catch(() => {});
      } catch (e) {
        console.error("Failed to send:", e);
      }
    },
    [user, activeRoomId, replyingTo],
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string, sortKey?: string) => {
      if (!activeRoomId || !sortKey) return;
      // Optimistic remove
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      try {
        await api.deleteMessage(activeRoomId, sortKey);
      } catch (e) {
        console.error("Failed to delete:", e);
      }
    },
    [activeRoomId],
  );

  const handleEditMessage = useCallback(
    async (messageId: string, sortKey: string, newContent: string) => {
      if (!activeRoomId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content: newContent, edited_at: new Date().toISOString() } : m
        )
      );
      try {
        await api.editMessage(activeRoomId, sortKey, newContent);
      } catch (e) {
        console.error("Failed to edit:", e);
      }
    },
    [activeRoomId],
  );

  const handleToggleReaction = useCallback(
    async (messageId: string, sortKey: string, emoji: string) => {
      if (!activeRoomId || !user) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const reactions = { ...(m.reactions || {}) };
          const users = [...(reactions[emoji] || [])];
          const idx = users.indexOf(user.id);
          if (idx >= 0) users.splice(idx, 1);
          else users.push(user.id);
          if (users.length > 0) reactions[emoji] = users;
          else delete reactions[emoji];
          return { ...m, reactions };
        })
      );
      try {
        await api.toggleReaction(activeRoomId, sortKey, { user_id: user.id, emoji });
      } catch (e) {
        console.error("Failed to toggle reaction:", e);
      }
    },
    [activeRoomId, user],
  );

  const handleCreateRoom = useCallback(
    async (name: string, description: string) => {
      if (!user) return;
      try {
        const room = await api.createRoom({
          name,
          description,
          created_by: user.id,
        });
        const newRoom: Room = { room_id: room.id, name: room.name, description: room.description };
        setRooms((prev) => [...prev, newRoom]);
        setActiveRoomId(newRoom.room_id);
        await api.joinRoom(newRoom.room_id, { user_id: user.id });
      } catch (e) {
        console.error("Failed to create room:", e);
      }
    },
    [user],
  );

  const activeRoom = rooms.find((r) => r.room_id === activeRoomId);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-flex h-10 w-10 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
          <p className="mt-3 text-sm text-neutral-400">Loading workspace...</p>
        </div>
      </div>
    );
  }

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    localStorage.setItem("townhall_onboarded", "true");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {showOnboarding && (
        <Onboarding
          onComplete={handleOnboardingComplete}
          userName={user?.fullName || user?.username || undefined}
        />
      )}
      {searchOpen && (
        <SearchModal
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onNavigate={(roomId: string) => { setActiveRoomId(roomId); setSearchOpen(false); }}
          rooms={rooms}
        />
      )}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {/* Mobile sidebar overlay */}
      {showSidebar && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowSidebar(false)} />
          <div className="relative z-50 h-full w-[280px]">
            <Sidebar
              rooms={rooms}
              activeRoomId={activeRoomId}
              onSelectRoom={(id) => { setActiveRoomId(id); setShowSidebar(false); }}
              onCreateRoom={handleCreateRoom}
              onOpenSearch={() => { setSearchOpen(true); setShowSidebar(false); }}
              onOpenSettings={() => { setSettingsOpen(true); setShowSidebar(false); }}
            />
          </div>
        </div>
      )}
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={setActiveRoomId}
          onCreateRoom={handleCreateRoom}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>
      <ChatArea
        roomName={activeRoom?.name || "general"}
        roomDescription={activeRoom?.description}
        messages={messages}
        onSendMessage={handleSend}
        onDeleteMessage={handleDeleteMessage}
        onEditMessage={handleEditMessage}
        onToggleReaction={handleToggleReaction}
        onToggleMembers={() => setShowMembers((s) => !s)}
        showMembers={showMembers}
        typingUsers={typingUsers}
        onTyping={handleTypingStart}
        currentUserId={user?.id}
        replyingTo={replyingTo}
        onReply={setReplyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onOpenSidebar={() => setShowSidebar(true)}
      />
      <div className="hidden lg:block">
        {showMembers && <MembersPanel members={members} />}
      </div>
    </div>
  );
}
