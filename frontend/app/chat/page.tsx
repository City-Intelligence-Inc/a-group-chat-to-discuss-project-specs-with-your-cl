"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { Sidebar } from "@/components/chat/sidebar";
import { ChatArea } from "@/components/chat/chat-area";
import { MembersPanel } from "@/components/chat/members-panel";
import { Onboarding } from "@/components/chat/onboarding";
import * as api from "@/lib/api";

interface Room {
  room_id: string;
  name: string;
  description?: string;
}

interface Message {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  content: string;
  created_at: string;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const sseRef = useRef<EventSource | null>(null);
  // Map of userId -> { username, avatar_url } for enriching messages
  const userMapRef = useRef<Map<string, { username: string; avatar_url?: string }>>(new Map());

  // Set up auth token provider for API calls
  useEffect(() => {
    api.setTokenProvider(getToken);
  }, [getToken]);

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

        setRooms(mapped);
        if (mapped.length > 0 && !activeRoomId) {
          setActiveRoomId(mapped[0].room_id);
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

        // Build set of online user IDs from connections
        const onlineSet = new Set<string>();
        for (const c of activeConns) {
          onlineSet.add(c.userId || c.user_id);
        }
        // Current user is always online
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
        const msgs: Message[] = msgData.messages.map((m: { id: string; sender_id: string; sender_name: string; content: string; created_at: string }) => {
          const cached = umap.get(m.sender_id);
          return {
            id: m.id,
            user_id: m.sender_id,
            username: cached?.username || m.sender_name || m.sender_id,
            avatar_url: cached?.avatar_url,
            content: m.content,
            created_at: m.created_at,
          };
        });
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

    // Poll presence every 10s so we see other users come online
    const presenceInterval = setInterval(async () => {
      try {
        const [memberList, activeConns] = await Promise.all([
          api.listMembers(activeRoomId!),
          api.getActiveUsers(activeRoomId!),
        ]);
        const onlineSet = new Set<string>();
        for (const c of activeConns) {
          onlineSet.add(c.userId || c.user_id);
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

    // Clean up connection on room change
    return () => {
      clearInterval(presenceInterval);
      const connId = `${user.id}-${activeRoomId}`;
      api.removeConnection(connId).catch(() => {});
    };
  }, [activeRoomId, user]);

  // SSE for real-time messages from OTHER users only
  // (our own messages are already shown optimistically — no need to add them again)
  useEffect(() => {
    if (!activeRoomId || !user) return;

    if (sseRef.current) {
      sseRef.current.close();
    }

    const sse = api.connectSSE(activeRoomId);
    sseRef.current = sse;

    const handleSSE = (event: MessageEvent) => {
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
        };

        setMessages((prev) => {
          // Dedup by ID
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      } catch {}
    };

    // Listen to both named and unnamed events
    sse.addEventListener("new_message", handleSSE);
    sse.onmessage = handleSSE;

    return () => {
      sse.close();
    };
  }, [activeRoomId, user]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!user || !activeRoomId) return;

      // Optimistic
      const tempId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          user_id: user.id,
          username: user.fullName || user.username || "User",
          avatar_url: user.imageUrl,
          content,
          created_at: new Date().toISOString(),
        },
      ]);

      try {
        await api.sendMessage(activeRoomId, {
          sender_id: user.id,
          content,
        });
      } catch (e) {
        console.error("Failed to send:", e);
      }
    },
    [user, activeRoomId],
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
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-neutral-400">Loading workspace...</p>
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
      <Sidebar
        rooms={rooms}
        activeRoomId={activeRoomId}
        onSelectRoom={setActiveRoomId}
        onCreateRoom={handleCreateRoom}
      />
      <ChatArea
        roomName={activeRoom?.name || "general"}
        roomDescription={activeRoom?.description}
        messages={messages}
        onSendMessage={handleSend}
        onToggleMembers={() => setShowMembers((s) => !s)}
        showMembers={showMembers}
      />
      {showMembers && <MembersPanel members={members} />}
    </div>
  );
}
