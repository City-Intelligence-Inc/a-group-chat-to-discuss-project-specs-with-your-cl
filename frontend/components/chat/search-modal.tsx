"use client";

import { useState, useCallback, useRef } from "react";
import { Search, X, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as api from "@/lib/api";

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
  rooms: { room_id: string; name: string }[];
}

export function SearchModal({ open, onClose, onNavigate, rooms }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.searchMessages(q);
        setResults(data.results);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg rounded-xl border border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100">
          <Search className="h-4 w-4 text-neutral-400 shrink-0" />
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search messages..."
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-[15px]"
            autoFocus
          />
          <button onClick={onClose} className="shrink-0 text-neutral-400 hover:text-neutral-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ScrollArea className="max-h-80">
          {searching && (
            <p className="px-4 py-3 text-sm text-neutral-400">Searching...</p>
          )}
          {results.length > 0 && (
            <div className="py-2">
              {results.map((r) => {
                const roomName = rooms.find((rm) => rm.room_id === r.room_id)?.name || "unknown";
                return (
                  <button
                    key={r.id}
                    onClick={() => { onNavigate(r.room_id); onClose(); }}
                    className="w-full text-left px-4 py-2 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                      <Hash className="h-2.5 w-2.5" />
                      <span>{roomName}</span>
                      <span className="ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[13px] text-neutral-700 truncate mt-0.5">
                      <span className="font-medium">{r.sender_name}</span>: {r.content}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
          {query && !searching && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-neutral-400">No messages found</p>
          )}
          {!query && (
            <p className="px-4 py-6 text-center text-sm text-neutral-400">Type to search messages across all channels</p>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
