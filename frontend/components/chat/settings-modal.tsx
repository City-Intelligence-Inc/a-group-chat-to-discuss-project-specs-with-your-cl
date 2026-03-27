"use client";

import { useState, useEffect } from "react";
import { X, Check, Type } from "lucide-react";

const FONT_OPTIONS = [
  { id: "inter", name: "Inter", desc: "Clean & neutral", family: "var(--font-inter), Inter, sans-serif" },
  { id: "dm-sans", name: "DM Sans", desc: "Friendly & round", family: "var(--font-dm-sans), DM Sans, sans-serif" },
  { id: "plus-jakarta", name: "Plus Jakarta Sans", desc: "Modern & geometric", family: "var(--font-plus-jakarta), Plus Jakarta Sans, sans-serif" },
  { id: "space-grotesk", name: "Space Grotesk", desc: "Technical & sharp", family: "var(--font-space-grotesk), Space Grotesk, sans-serif" },
  { id: "jetbrains", name: "JetBrains Mono", desc: "Monospace for coders", family: "var(--font-jetbrains), JetBrains Mono, monospace" },
  { id: "outfit", name: "Outfit", desc: "Geometric & clean", family: "var(--font-outfit), Outfit, sans-serif" },
  { id: "lora", name: "Lora", desc: "Classic serif", family: "var(--font-lora), Lora, serif" },
] as const;

const STORAGE_KEY = "townhall_font";

export function useFont() {
  const [font, setFont] = useState("inter");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || "inter";
    setFont(saved);
    document.documentElement.setAttribute("data-font", saved);
  }, []);

  const changeFont = (id: string) => {
    setFont(id);
    localStorage.setItem(STORAGE_KEY, id);
    document.documentElement.setAttribute("data-font", id);
  };

  return { font, changeFont };
}

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { font, changeFont } = useFont();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h3 className="text-[15px] font-semibold text-neutral-900">Settings</h3>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Font section */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <Type className="h-4 w-4 text-neutral-500" />
            <h4 className="text-[13px] font-semibold text-neutral-700 uppercase tracking-wider">Font</h4>
          </div>

          <div className="space-y-1.5">
            {FONT_OPTIONS.map((f) => {
              const isActive = font === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => changeFont(f.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                    isActive
                      ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900"
                      : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  <div className="text-left">
                    <p
                      className="text-[15px] font-medium text-neutral-900"
                      style={{ fontFamily: f.family }}
                    >
                      {f.name}
                    </p>
                    <p className="text-[12px] text-neutral-500 mt-0.5">{f.desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[13px] text-neutral-400"
                      style={{ fontFamily: f.family }}
                    >
                      The quick brown fox
                    </span>
                    {isActive && (
                      <div className="h-5 w-5 rounded-full bg-neutral-900 flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Preview */}
          <div className="mt-5 p-4 rounded-lg border border-neutral-200 bg-neutral-50">
            <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-2">Preview</p>
            <p className="text-[15px] text-neutral-900 leading-relaxed">
              Hey team! Just pushed the new feature to staging. Let me know if you spot any issues.
            </p>
            <p className="text-[13px] text-neutral-500 mt-1">
              Sounds good, I&apos;ll take a look after lunch.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
