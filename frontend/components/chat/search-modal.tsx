"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Hash } from "lucide-react";
import * as api from "@/lib/api";

interface Room {
  room_id: string;
  name: string;
}

interface SearchResult {
  id: string;
  room_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (roomId: string) => void;
  rooms: Room[];
}

export function SearchModal({ open, onClose, onNavigate, rooms }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await api.searchMessages(q.trim());
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const getRoomName = (roomId: string) => {
    return rooms.find((r) => r.room_id === roomId)?.name || roomId;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg rounded-xl border border-neutral-200 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200">
          <Search className="h-4 w-4 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
            placeholder="Search messages..."
            className="flex-1 bg-transparent text-[14px] text-neutral-900 placeholder:text-neutral-400 outline-none"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline-flex items-center rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-400 font-mono">ESC</kbd>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-600" />
            </div>
          )}
          {!loading && query && results.length === 0 && (
            <div className="py-8 text-center text-sm text-neutral-400">No messages found</div>
          )}
          {!loading && results.map((r) => (
            <button
              key={r.id}
              onClick={() => onNavigate(r.room_id)}
              className="w-full px-4 py-3 text-left hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-0"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Hash className="h-3 w-3 text-neutral-400" />
                <span className="text-[12px] text-neutral-500 font-medium">{getRoomName(r.room_id)}</span>
                <span className="text-[11px] text-neutral-400 ml-auto">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="text-[13px] text-neutral-700 truncate">
                <span className="font-medium">{r.sender_name}</span>: {r.content}
              </div>
            </button>
          ))}
          {!loading && !query && (
            <div className="py-8 text-center">
              <p className="text-sm text-neutral-400">Search across all messages</p>
              <p className="text-xs text-neutral-300 mt-1">Use <kbd className="font-mono bg-neutral-100 rounded px-1">Cmd+K</kbd> anytime</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
