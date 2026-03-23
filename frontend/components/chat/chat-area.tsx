"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Hash, Users, SendHorizontal, Paperclip, Trash2, Pencil, Reply, X, SmilePlus, Check, Menu } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

interface ChatAreaProps {
  roomName: string;
  roomDescription?: string;
  messages: Message[];
  onSendMessage: (content: string) => void;
  onDeleteMessage?: (messageId: string, sortKey?: string) => void;
  onEditMessage?: (messageId: string, sortKey: string, newContent: string) => void;
  onToggleReaction?: (messageId: string, sortKey: string, emoji: string) => void;
  onToggleMembers: () => void;
  showMembers: boolean;
  typingUsers?: string[];
  onTyping?: () => void;
  currentUserId?: string;
  replyingTo?: Message | null;
  onReply?: (msg: Message) => void;
  onCancelReply?: () => void;
  onOpenSidebar?: () => void;
}

const QUICK_EMOJIS = ["\u{1F44D}", "\u{2764}\u{FE0F}", "\u{1F602}", "\u{1F389}", "\u{1F440}", "\u{1F525}", "\u{1F64F}", "\u{2705}"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatFullTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" }) +
    " at " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

const mdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <pre className="my-1 rounded-md bg-neutral-100 border border-neutral-200 px-3 py-2 overflow-x-auto">
          <code className="text-[13px] font-mono text-neutral-800">{children}</code>
        </pre>
      );
    }
    return <code className="rounded bg-neutral-100 border border-neutral-200 px-1 py-0.5 text-[13px] font-mono text-rose-600">{children}</code>;
  },
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{children}</a>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc list-inside my-1">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal list-inside my-1">{children}</ol>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-neutral-300 pl-3 my-1 text-neutral-600 italic">{children}</blockquote>
  ),
};

function FileCard({ name, size, url }: { name: string; size?: string; url?: string }) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const colors: Record<string, string> = {
    pdf: "bg-red-50 text-red-500 border-red-100",
    doc: "bg-blue-50 text-blue-500 border-blue-100",
    docx: "bg-blue-50 text-blue-500 border-blue-100",
    xls: "bg-green-50 text-green-600 border-green-100",
    xlsx: "bg-green-50 text-green-600 border-green-100",
    png: "bg-purple-50 text-purple-500 border-purple-100",
    jpg: "bg-purple-50 text-purple-500 border-purple-100",
    jpeg: "bg-purple-50 text-purple-500 border-purple-100",
    zip: "bg-amber-50 text-amber-600 border-amber-100",
    csv: "bg-emerald-50 text-emerald-600 border-emerald-100",
  };
  const c = colors[ext] || "bg-neutral-50 text-neutral-500 border-neutral-200";
  return (
    <div
      className="inline-flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 mt-1 mb-0.5 hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer max-w-sm"
      onClick={() => url ? window.open(url, "_blank") : null}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg border shrink-0 ${c}`}>
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-neutral-900 truncate">{name}</p>
        <p className="text-[11px] text-neutral-400">
          {size || ext.toUpperCase() + " file"}
          {url ? " · Click to open" : " · Attachment"}
        </p>
      </div>
      {url && (
        <svg className="h-4 w-4 text-neutral-300 shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      )}
    </div>
  );
}

function parseAttachment(content: string) {
  // 📎 Shared: **name** (size)
  let m = content.match(/^📎\s*Shared(?:\s*file)?:\s*\*\*(.+?)\*\*\s*\((.+?)\)\s*$/);
  if (m) return { fileName: m[1], fileSize: m[2] };
  // 📎 [name](url) — file with S3 link (greedy URL to handle query params)
  m = content.match(/^📎\s*\[(.+?)\]\((.+)\)\s*$/);
  if (m) return { fileName: m[1], fileUrl: m[2] };
  // ![name](url) — image with S3 link
  m = content.match(/^!\[(.+?)\]\((.+)\)\s*$/);
  if (m) return { fileName: m[1], fileUrl: m[2], isImage: true };
  // **📎 name**\n\ncontent (text file paste)
  m = content.match(/^\*\*📎\s*(.+?)\*\*\n\n([\s\S]*)$/);
  if (m) return { fileName: m[1], textContent: m[2] };
  return null;
}

function MessageContent({ content }: { content: string }) {
  const attach = parseAttachment(content);
  if (attach) {
    if (attach.isImage && attach.fileUrl) {
      return (
        <div className="mt-1">
          <img src={attach.fileUrl} alt={attach.fileName} className="max-w-sm max-h-[300px] rounded-lg border border-neutral-200" />
          <p className="text-[11px] text-neutral-400 mt-1">{attach.fileName}</p>
        </div>
      );
    }
    if (attach.textContent) {
      return (
        <div>
          <FileCard name={attach.fileName!} size={`${(attach.textContent.length / 1024).toFixed(1)} KB`} />
          <pre className="mt-2 text-[12px] text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 max-h-[200px] overflow-auto font-mono leading-relaxed whitespace-pre-wrap">
            {attach.textContent.slice(0, 2000)}{attach.textContent.length > 2000 ? "\n…" : ""}
          </pre>
        </div>
      );
    }
    return <FileCard name={attach.fileName!} size={attach.fileSize} url={attach.fileUrl} />;
  }

  const hasMarkdown = /[*_`#\[\]>~-]/.test(content);
  if (!hasMarkdown) return <span className="whitespace-pre-wrap">{content}</span>;
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as Record<string, React.ComponentType>}>
      {content}
    </ReactMarkdown>
  );
}

function ReactionBar({ reactions, currentUserId, onToggle }: { reactions: Record<string, string[]>; currentUserId?: string; onToggle: (emoji: string) => void }) {
  const entries = Object.entries(reactions).filter(([, users]) => users.length > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {entries.map(([emoji, users]) => {
        const active = currentUserId && users.includes(currentUserId);
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className={`inline-flex items-center gap-1 h-6 px-1.5 rounded-full text-[11px] border transition-all duration-150 ${
              active
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:border-neutral-300"
            }`}
          >
            <span className="text-[13px] leading-none">{emoji}</span>
            <span className="tabular-nums font-medium">{users.length}</span>
          </button>
        );
      })}
    </div>
  );
}

function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return (
    <div ref={ref} className="absolute bottom-full mb-2 right-0 bg-white rounded-xl border border-neutral-200 shadow-xl shadow-neutral-200/50 p-2 z-50">
      <div className="flex items-center gap-1">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="h-8 w-8 rounded-md flex items-center justify-center text-[18px] leading-none hover:bg-neutral-100 hover:scale-110 active:scale-95 transition-all duration-100"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChatArea({ roomName, roomDescription, messages, onSendMessage, onDeleteMessage, onEditMessage, onToggleReaction, onToggleMembers, showMembers, typingUsers = [], onTyping, currentUserId, replyingTo, onReply, onCancelReply, onOpenSidebar }: ChatAreaProps) {
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ name: string; size: number; type: string; content?: string; isText: boolean; previewUrl?: string; rawFile?: File } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (replyingTo) textareaRef.current?.focus(); }, [replyingTo]);

  const [uploading, setUploading] = useState(false);

  const handleSend = async () => {
    if (pendingFile) {
      setUploading(true);
      await sendPendingFile();
      setUploading(false);
      if (input.trim()) {
        onSendMessage(input.trim());
        setInput("");
      }
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      return;
    }
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === "Escape" && replyingTo && onCancelReply) onCancelReply();
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
    if (e.target.value.trim()) onTyping?.();
  };

  const startEdit = (msg: Message) => { setEditingId(msg.id); setEditContent(msg.content); };
  const confirmEdit = (msg: Message) => {
    if (!editContent.trim() || !msg.sort_key || !onEditMessage) return;
    onEditMessage(msg.id, msg.sort_key, editContent.trim());
    setEditingId(null); setEditContent("");
  };
  const cancelEdit = () => { setEditingId(null); setEditContent(""); };

  const wrapSelection = (before: string, after: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const selected = input.substring(start, end);
    setInput(input.substring(0, start) + before + selected + after + input.substring(end));
    setTimeout(() => { ta.focus(); ta.selectionStart = start + before.length; ta.selectionEnd = end + before.length; }, 0);
  };

  const isTextFile = (file: File) =>
    file.type.startsWith("text/") ||
    !!file.name.match(/\.(md|txt|markdown|json|csv|log|xml|yaml|yml|toml|sh|py|js|ts|jsx|tsx|html|css|sql)$/i);

  const stageFile = useCallback((file: File) => {
    if (isTextFile(file)) {
      const reader = new FileReader();
      reader.onload = () => {
        setPendingFile({
          name: file.name, size: file.size, type: file.type,
          content: reader.result as string, isText: true, rawFile: file,
        });
      };
      reader.readAsText(file);
    } else {
      // For images, create a preview URL
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      setPendingFile({
        name: file.name, size: file.size, type: file.type,
        isText: false, previewUrl, rawFile: file,
      });
    }
  }, []);

  const sendPendingFile = useCallback(async () => {
    if (!pendingFile) return;

    if (pendingFile.isText && pendingFile.content) {
      onSendMessage(`**📎 ${pendingFile.name}**\n\n${pendingFile.content}`);
      setPendingFile(null);
      return;
    }

    // Binary file — upload to S3
    if (pendingFile.rawFile) {
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const formData = new FormData();
        formData.append("file", pendingFile.rawFile);
        const res = await fetch(`${API}/api/uploads`, { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          const isImage = pendingFile.type.startsWith("image/");
          onSendMessage(isImage ? `![${pendingFile.name}](${data.url})` : `📎 [${pendingFile.name}](${data.url})`);
          setPendingFile(null);
          return;
        }
      } catch {}
    }

    // Fallback if upload fails
    onSendMessage(`📎 Shared: **${pendingFile.name}** (${(pendingFile.size / 1024).toFixed(1)} KB)`);
    setPendingFile(null);
  }, [pendingFile, onSendMessage]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) stageFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [stageFile]);

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) stageFile(file);
  }, [stageFile]);

  const groups: { label: string; msgs: Message[] }[] = [];
  let curDate = "";
  for (const msg of messages) {
    const d = new Date(msg.created_at).toDateString();
    if (d !== curDate) { curDate = d; groups.push({ label: formatDateLabel(msg.created_at), msgs: [msg] }); }
    else { groups[groups.length - 1].msgs.push(msg); }
  }

  const actionBtn = "h-7 w-7 rounded-md flex items-center justify-center transition-all duration-100";
  const actionIcon = "h-[14px] w-[14px] stroke-[1.75]";

  const renderActions = (msg: Message, isOwn: boolean) => (
    <div className="absolute -top-3 right-5 hidden group-hover:flex items-center rounded-lg bg-white border border-neutral-200 shadow-sm px-0.5 py-0.5 z-10">
      {onToggleReaction && msg.sort_key && (
        <div className="relative">
          <button
            onClick={() => setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id)}
            className={`${actionBtn} text-neutral-400 hover:text-amber-600 hover:bg-amber-50`}
            title="Add reaction"
          >
            <SmilePlus className={actionIcon} />
          </button>
          {emojiPickerMsgId === msg.id && (
            <EmojiPicker
              onSelect={(emoji) => onToggleReaction(msg.id, msg.sort_key!, emoji)}
              onClose={() => setEmojiPickerMsgId(null)}
            />
          )}
        </div>
      )}
      {onReply && (
        <button
          onClick={() => onReply(msg)}
          className={`${actionBtn} text-neutral-400 hover:text-blue-600 hover:bg-blue-50`}
          title="Reply"
        >
          <Reply className={actionIcon} />
        </button>
      )}
      {isOwn && onEditMessage && msg.sort_key && (
        <>
          <div className="w-px h-4 bg-neutral-200 mx-0.5" />
          <button
            onClick={() => startEdit(msg)}
            className={`${actionBtn} text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100`}
            title="Edit"
          >
            <Pencil className={actionIcon} />
          </button>
        </>
      )}
      {isOwn && onDeleteMessage && (
        <button
          onClick={() => onDeleteMessage(msg.id, msg.sort_key)}
          className={`${actionBtn} text-neutral-400 hover:text-red-500 hover:bg-red-50`}
          title="Delete"
        >
          <Trash2 className={actionIcon} />
        </button>
      )}
    </div>
  );

  const renderReplyBadge = (msg: Message) => {
    if (!msg.reply_preview) return null;
    return (
      <div className="flex items-center gap-2 mb-1.5 pl-1">
        <div className="w-0.5 h-4 rounded-full bg-blue-300 shrink-0" />
        <span className="text-[12px] text-neutral-500 truncate max-w-md leading-normal"><span className="font-semibold text-neutral-600">{msg.reply_username || "someone"}</span> {msg.reply_preview}</span>
      </div>
    );
  };

  const renderContent = (msg: Message, isOwn: boolean) => {
    if (editingId === msg.id) {
      return (
        <div className="mt-1">
          <input type="text" value={editContent} onChange={(e) => setEditContent(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmEdit(msg); if (e.key === "Escape") cancelEdit(); }} className="w-full text-[15px] bg-white border border-neutral-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" autoFocus />
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-[11px] text-neutral-400">Enter to save, Esc to cancel</span>
            <div className="flex-1" />
            <button onClick={cancelEdit} className="h-6 px-2 rounded text-[11px] text-neutral-500 hover:bg-neutral-100">Cancel</button>
            <button onClick={() => confirmEdit(msg)} className="h-6 px-2 rounded text-[11px] font-medium text-blue-600 hover:bg-blue-50">Save</button>
          </div>
        </div>
      );
    }
    return (
      <>
        <div className="text-[15px] text-neutral-800 leading-[1.7] mt-0.5">
          <MessageContent content={msg.content} />
          {msg.edited_at && <span className="text-[11px] text-neutral-300 ml-1.5 select-none">(edited)</span>}
        </div>
        {msg.reactions && onToggleReaction && msg.sort_key && <ReactionBar reactions={msg.reactions} currentUserId={currentUserId} onToggle={(emoji) => onToggleReaction(msg.id, msg.sort_key!, emoji)} />}
      </>
    );
  };

  return (
    <div
      className="flex flex-col flex-1 min-w-0 bg-white relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop zone overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm border-2 border-dashed border-neutral-300 rounded-lg m-2 pointer-events-none">
          <div className="text-center">
            <Paperclip className="h-8 w-8 text-neutral-400 mx-auto mb-2" />
            <p className="text-[15px] font-semibold text-neutral-700">Drop file to share</p>
            <p className="text-[13px] text-neutral-400 mt-0.5">.md, .txt, images, and more</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between px-5 h-12 border-b border-neutral-200 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {onOpenSidebar && (
            <button onClick={onOpenSidebar} className="md:hidden inline-flex items-center justify-center h-8 w-8 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors -ml-1">
              <Menu className="h-4 w-4" />
            </button>
          )}
          <Hash className="h-4 w-4 text-neutral-400 shrink-0" />
          <h1 className="text-[15px] font-semibold text-neutral-900 truncate">{roomName}</h1>
          {roomDescription && (<><span className="mx-1 h-3.5 w-px bg-neutral-200" /><span className="text-[13px] text-neutral-400 truncate">{roomDescription}</span></>)}
        </div>
        <button title={showMembers ? "Hide members" : "Show members"} onClick={onToggleMembers} className={`inline-flex items-center justify-center h-8 w-8 rounded-md transition-colors ${showMembers ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"}`}><Users className="h-4 w-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 py-4">
          {messages.length === 0 && (
            <div className="py-8">
              <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center mb-3"><Hash className="h-5 w-5 text-neutral-600" /></div>
              <h2 className="text-xl font-semibold text-neutral-900 font-serif">Welcome to #{roomName}</h2>
              <p className="mt-1 text-sm text-neutral-500 max-w-md">This is the start of the <span className="font-medium text-neutral-700">#{roomName}</span> channel.{roomDescription ? ` ${roomDescription}` : " Send a message to get the conversation going."}</p>
            </div>
          )}
          {groups.map((group, gi) => (
            <div key={gi}>
              <div className="flex items-center my-5"><div className="flex-1 h-px bg-neutral-200" /><span className="mx-3 text-[11px] font-medium text-neutral-400 uppercase tracking-wider whitespace-nowrap">{group.label}</span><div className="flex-1 h-px bg-neutral-200" /></div>
              {group.msgs.map((msg, mi) => {
                const prev = mi > 0 ? group.msgs[mi - 1] : null;
                const compact = prev && prev.user_id === msg.user_id && !msg.reply_preview && new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 300000;
                const isOwn = msg.user_id === currentUserId;
                if (compact) {
                  return (
                    <div key={msg.id} className="group relative -mx-5 px-5 py-[5px] hover:bg-neutral-50/80 transition-colors">
                      {renderActions(msg, isOwn)}
                      <span title={formatFullTimestamp(msg.created_at)} className="absolute left-5 top-1/2 -translate-y-1/2 hidden group-hover:inline text-[11px] text-neutral-400 tabular-nums cursor-default">{formatTime(msg.created_at)}</span>
                      <div className="pl-[56px]">{renderContent(msg, isOwn)}</div>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className="group relative -mx-5 px-5 pt-2 pb-1 mt-4 first:mt-0 hover:bg-neutral-50/80 transition-colors">
                    {renderActions(msg, isOwn)}
                    <div className="pl-[56px]">{renderReplyBadge(msg)}</div>
                    <div className="flex items-start gap-4">
                      <Avatar className="h-10 w-10 mt-0.5 shrink-0"><AvatarImage src={msg.avatar_url} /><AvatarFallback className="bg-neutral-200 text-neutral-600 text-sm font-medium">{msg.username?.[0]?.toUpperCase() || "?"}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2"><span className="text-[15px] font-bold text-neutral-900 hover:underline cursor-pointer">{msg.username}</span><span title={formatFullTimestamp(msg.created_at)} className="text-[12px] text-neutral-400 tabular-nums font-normal cursor-default hover:underline hover:text-neutral-500">{formatTime(msg.created_at)}</span></div>
                        {renderContent(msg, isOwn)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {typingUsers.length > 0 && (
        <div className="px-5 py-1.5">
          <div className="flex items-center gap-2 max-w-3xl mx-auto">
            <div className="flex gap-[3px]">
              <span className="w-[5px] h-[5px] rounded-full bg-neutral-400 animate-pulse" />
              <span className="w-[5px] h-[5px] rounded-full bg-neutral-400 animate-pulse [animation-delay:200ms]" />
              <span className="w-[5px] h-[5px] rounded-full bg-neutral-400 animate-pulse [animation-delay:400ms]" />
            </div>
            <p className="text-[12px] text-neutral-400"><span className="font-medium text-neutral-500">{typingUsers.join(", ")}</span> {typingUsers.length === 1 ? "is" : "are"} typing...</p>
          </div>
        </div>
      )}

      {replyingTo && (
        <div className="px-4 pt-2 pb-0 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-2.5 rounded-t-lg bg-neutral-50 border border-b-0 border-neutral-200">
            <div className="w-0.5 h-5 rounded-full bg-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-blue-600">Replying to {replyingTo.username}</p>
              <p className="text-[12px] text-neutral-500 truncate">{replyingTo.content.slice(0, 100)}</p>
            </div>
            <button onClick={onCancelReply} className="h-6 w-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200/60 transition-colors shrink-0"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}

      <div className={`px-4 pb-4 ${replyingTo ? "pt-0" : "pt-1"} shrink-0`}>
        {/* File attachment preview */}
        {pendingFile && (
          <div className="max-w-3xl mx-auto mb-2">
            <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
              {/* Image preview */}
              {pendingFile.previewUrl && (
                <div className="bg-neutral-50 border-b border-neutral-200 p-3 flex justify-center">
                  <img src={pendingFile.previewUrl} alt={pendingFile.name} className="max-h-[160px] rounded-md object-contain" />
                </div>
              )}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 shrink-0">
                  {pendingFile.type.startsWith("image/") ? (
                    <ImageIcon className="h-5 w-5 text-purple-500" />
                  ) : pendingFile.name.endsWith(".pdf") ? (
                    <FileText className="h-5 w-5 text-red-500" />
                  ) : (
                    <FileText className="h-5 w-5 text-neutral-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-neutral-900 truncate">{pendingFile.name}</p>
                  <p className="text-[11px] text-neutral-400">
                    {(pendingFile.size / 1024).toFixed(1)} KB
                    {pendingFile.isText && pendingFile.content && (
                      <> &middot; {pendingFile.content.split("\n").length} lines</>
                    )}
                    {!pendingFile.isText && (uploading ? " — uploading…" : " — will upload to cloud")}
                    {pendingFile.isText && " — content will be shared"}
                  </p>
                  {pendingFile.isText && pendingFile.content && (
                    <pre className="mt-1.5 text-[11px] text-neutral-500 bg-neutral-50 border border-neutral-200 rounded px-2 py-1.5 max-h-[60px] overflow-hidden font-mono leading-tight">
                      {pendingFile.content.slice(0, 200)}{pendingFile.content.length > 200 ? "..." : ""}
                    </pre>
                  )}
              </div>
              <button
                onClick={() => setPendingFile(null)}
                className="h-7 w-7 rounded-md flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                title="Remove attachment"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          </div>
        )}
        <div className={`max-w-3xl mx-auto ${replyingTo ? "rounded-b-xl rounded-t-none" : "rounded-xl"} border border-neutral-200 bg-neutral-50/80 shadow-sm focus-within:border-neutral-300 focus-within:bg-white focus-within:shadow-md transition-all duration-200`}>
          <div className="flex items-center gap-0.5 px-3 pt-2.5 pb-1">
            <button type="button" title="Bold" onClick={() => wrapSelection("**", "**")} className="h-7 w-7 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors text-xs font-bold">B</button>
            <button type="button" title="Italic" onClick={() => wrapSelection("_", "_")} className="h-7 w-7 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors text-xs italic">I</button>
            <button type="button" title="Code" onClick={() => wrapSelection("`", "`")} className="h-7 w-7 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors font-mono text-[11px]">&lt;/&gt;</button>
            <div className="h-4 w-px bg-neutral-200 mx-1" />
            <button type="button" title="Link" onClick={() => wrapSelection("[", "](url)")} className="h-7 w-7 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg></button>
            <button type="button" title="Blockquote" onClick={() => wrapSelection("> ", "")} className="h-7 w-7 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors text-sm">&ldquo;</button>
          </div>
          <div className="px-3 pb-1">
            <textarea ref={textareaRef} value={input} onChange={handleInput} onKeyDown={handleKeyDown} placeholder={`Message #${roomName}`} rows={1} className="w-full bg-transparent text-[14px] text-neutral-900 placeholder:text-neutral-400 resize-none outline-none leading-relaxed min-h-[28px] max-h-[150px]" />
          </div>
          <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
            <div className="flex items-center gap-0.5">
              <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
              <button type="button" title="Attach file" onClick={() => fileInputRef.current?.click()} className="h-7 w-7 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors"><Paperclip className="h-3.5 w-3.5" /></button>
              <button type="button" title="Mention someone" className="h-7 w-7 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors text-sm font-medium">@</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-neutral-300">{input.trim() ? "Enter to send" : ""}</span>
              <button onClick={handleSend} disabled={uploading || (!input.trim() && !pendingFile)} className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-150 ${uploading ? "bg-neutral-900 text-white animate-pulse" : (input.trim() || pendingFile) ? "bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm" : "bg-neutral-200 text-neutral-400 cursor-not-allowed"}`}>{uploading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <SendHorizontal className="h-4 w-4" />}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
