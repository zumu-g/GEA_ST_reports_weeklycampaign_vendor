"use client";

import { useState } from "react";
import { ChatMessage } from "@/lib/types";

interface ChatProps {
  messages: ChatMessage[];
  vendorName: string;
}

export default function Chat({ messages: initialMessages, vendorName }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleSend = () => {
    if (!newMessage.trim()) return;

    const msg: ChatMessage = {
      id: `m${Date.now()}`,
      sender: "Stuart Grant",
      senderRole: "agent",
      message: newMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages([...messages, msg]);
    setNewMessage("");
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Initial letter for agent avatar — derived from the agent name in messages, or fallback
  const agentInitial =
    messages.find((m) => m.senderRole === "agent")?.sender?.[0]?.toUpperCase() ?? "A";

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* ── Chat panel ── */}
      {isOpen && (
        <div className="w-96 max-h-[500px] bg-card-bg rounded-lg border border-border flex flex-col overflow-hidden mb-4">

          {/* Header */}
          <div className="bg-primary px-5 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                <span className="font-display text-primary font-medium text-sm leading-none">
                  {agentInitial}
                </span>
              </div>
              <div>
                <p className="font-body text-sm font-medium text-white leading-tight">Chat with Agent</p>
                <p className="font-body text-xs text-white/50 leading-tight">{vendorName}</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/50 hover:text-white transition-colors"
              aria-label="Close chat"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-background min-h-0">
            {messages.length === 0 && (
              <p className="font-body text-sm text-muted text-center mt-8">
                No messages yet. Start the conversation.
              </p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.senderRole === "agent" ? "items-end" : "items-start"}`}
              >
                {msg.senderRole === "vendor" ? (
                  <div className="bg-card-bg border border-border rounded-lg rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                    <p className="font-body text-sm text-foreground">{msg.message}</p>
                  </div>
                ) : (
                  <div className="bg-accent rounded-lg rounded-tr-sm px-4 py-2.5 max-w-[85%]">
                    <p className="font-body text-sm text-primary">{msg.message}</p>
                  </div>
                )}
                <span className="font-mono text-[10px] text-muted mt-1">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            ))}
          </div>

          {/* Input area */}
          <div className="px-4 py-3 border-t border-border bg-card-bg flex gap-2 flex-shrink-0">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a message..."
              className="flex-1 h-9 rounded-md border border-border bg-surface px-4 text-sm font-body text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all"
            />
            <button
              onClick={handleSend}
              className="w-9 h-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0 hover:bg-accent-light transition-all"
              aria-label="Send message"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-primary">
                <path
                  d="M7 12V2M2.5 6.5L7 2l4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Trigger button ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-primary border border-border flex items-center justify-center hover:opacity-90 active:scale-[0.97] transition duration-150"
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M14 4L4 14M4 4l10 10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
              d="M3 5a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H7.5L3 19V5z"
              stroke="white"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
