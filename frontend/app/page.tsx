"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id?: string;
  from: number;
  message: string;
  timestamp: number;
}

interface ChatState {
  [key: string | number]: Message[];
}

interface User {
  id: number;
  phone: string;
}

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [chats, setChats] = useState<ChatState>({});
  const [readStatus, setReadStatus] = useState<Record<string, boolean>>({});
  const [groups, setGroups] = useState<any[]>([]);
  const [activeUsers, setActiveUsers] = useState<number[]>([]);
  const [selectedChat, setSelectedChat] = useState<number | string | null>(
    null,
  );
  const [unreadCounts, setUnreadCounts] = useState<
    Record<number | string, number>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Client-side hydration safety
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const clientId = user?.id;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const endpoint = isRegistering ? "/register" : "/login";
    try {
      const response = await fetch(`http://localhost:80${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Authentication failed");

      if (isRegistering) {
        setIsRegistering(false);
        setError("Account created! Please login.");
      } else {
        setToken(data.access_token);
        const meRes = await fetch("http://localhost:80/me", {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        const meData = await meRes.json();
        setUser(meData);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (!clientId) return;

    const host = window.location.hostname;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${host}:80/ws/${clientId}`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    const heartbeatInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "users_update") {
          setActiveUsers(data.users.filter((id: number) => id !== clientId));
        } else if (data.type === "read_receipt") {
          if (data.message_id) {
            setReadStatus((prev) => ({ ...prev, [data.message_id]: true }));
          }
        } else if (data.type === "message" || data.type === "group_message") {
          const fromId = data.from;
          const isGroup = data.type === "group_message";
          const targetChatId = isGroup
            ? `group_${data.group_id}`
            : fromId === clientId
              ? data.to
              : fromId;

          if (targetChatId === null || targetChatId === undefined) return;

          const newMessage: Message = {
            id: data.id,
            from: fromId,
            message: data.message,
            timestamp: data.timestamp || Date.now(),
          };

          setChats((prev) => ({
            ...prev,
            [targetChatId]: [...(prev[targetChatId] || []), newMessage],
          }));

          if (fromId !== clientId && targetChatId !== selectedChat) {
            setUnreadCounts((prev) => ({
              ...prev,
              [targetChatId]: (prev[targetChatId] || 0) + 1,
            }));
          }

          // Send read receipt
          if (
            data.type === "message" &&
            fromId !== clientId &&
            targetChatId === selectedChat &&
            data.id
          ) {
            socket.send(
              JSON.stringify({
                type: "read_receipt",
                to: fromId,
                message_id: data.id,
              }),
            );
          }
        }
      } catch (err) {
        console.error("Failed to parse message", err);
      }
    };

    return () => {
      clearInterval(heartbeatInterval);
      socket.close();
    };
  }, [clientId, selectedChat]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chats, selectedChat]);

  const filteredUsers = useMemo(() => {
    return activeUsers.filter((id) => id.toString().includes(searchQuery));
  }, [activeUsers, searchQuery]);

  const handleSelectChat = async (id: number | string) => {
    setSelectedChat(id);
    setUnreadCounts((prev) => ({ ...prev, [id]: 0 }));

    try {
      const isGroup = typeof id === "string" && id.startsWith("group_");
      const url = isGroup
        ? `http://localhost:80/groups/${id.replace("group_", "")}/history`
        : `http://localhost:80/history/${id}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const history = await response.json();
        setChats((prev) => ({
          ...prev,
          [id]: history,
        }));
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      socketRef.current &&
      inputValue.trim() &&
      selectedChat !== null &&
      clientId
    ) {
      const isGroup =
        typeof selectedChat === "string" && selectedChat.startsWith("group_");
      const payload = isGroup
        ? {
            type: "group_message",
            group_id: parseInt(selectedChat.replace("group_", "")),
            message: inputValue,
          }
        : { to: selectedChat, message: inputValue };

      socketRef.current.send(JSON.stringify(payload));
      setInputValue("");
    }
  };

  if (!mounted) return null;

  if (!user) {
    return (
      <div className="relative flex h-screen items-center justify-center p-4 overflow-hidden">
        <div className="mesh-gradient" />
        <div className="bg-blob bg-blob-1" />
        <div className="bg-blob bg-blob-2" />
        <div className="bg-blob bg-blob-3" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md glass-panel p-10 rounded-[2.5rem] relative z-10"
        >
          <div className="flex flex-col items-center mb-10">
            <motion.div
              whileHover={{ rotate: 12, scale: 1.1 }}
              className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-blue-500/20 mb-6"
            >
              <svg
                className="w-10 h-10"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </motion.div>
            <h1 className="text-4xl font-black text-white tracking-tight mb-2">
              {isRegistering ? "Join Chat" : "Welcome"}
            </h1>
            <p className="text-blue-200/60 text-sm font-medium">
              Real-time Glassmorphism Chat
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-blue-200/40 uppercase tracking-[0.2em] ml-1">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="+1 234 567 890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-6 py-4 glass-input rounded-2xl outline-none text-white font-medium placeholder:text-white/20"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-blue-200/40 uppercase tracking-[0.2em] ml-1">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-6 py-4 glass-input rounded-2xl outline-none text-white font-medium placeholder:text-white/20"
                required
              />
            </div>
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/20 text-red-200 px-4 py-3 rounded-xl text-xs font-bold border border-red-500/30 flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-blue-900/40 text-lg"
            >
              {isRegistering ? "Create Account" : "Sign In"}
            </motion.button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError("");
              }}
              className="text-sm font-bold text-blue-300 hover:text-white transition-colors"
            >
              {isRegistering
                ? "Already have an account? Login"
                : "New here? Create account"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <main className="flex h-screen bg-[#0f172a] text-white overflow-hidden relative font-sans">
      <div className="mesh-gradient" />
      <div className="bg-blob bg-blob-1 opacity-20" />
      <div className="bg-blob bg-blob-2 opacity-20" />

      {/* Sidebar */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className={`${selectedChat !== null ? "hidden md:flex" : "flex"} w-full md:w-[380px] glass-panel m-4 rounded-[2.5rem] flex-col shrink-0 overflow-hidden relative z-10`}
      >
        <div className="p-8 border-b border-white/10">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-xl">
              <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-black text-2xl tracking-tight text-white">
                Chats
              </h1>
              <p className="text-[10px] text-blue-300/50 font-black uppercase tracking-[0.2em] truncate">
                {user.phone}
              </p>
            </div>
            <button
              onClick={() => {
                setUser(null);
                setToken(null);
                setSelectedChat(null);
              }}
              className="p-3 bg-white/5 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-2xl transition-all group"
            >
              <svg
                className="w-6 h-6 group-hover:scale-110 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>

          <div className="relative group">
            <span className="absolute inset-y-0 left-0 pl-5 flex items-center text-white/20">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-6 py-4 glass-input rounded-[1.5rem] text-sm font-medium outline-none placeholder:text-white/10"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2 scrollbar-none">
          {filteredUsers.map((userId) => (
            <motion.button
              key={userId}
              whileHover={{ scale: 1.02, x: 5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelectChat(userId)}
              className={`w-full p-4 flex items-center gap-4 rounded-3xl transition-all relative group ${
                selectedChat === userId
                  ? "bg-blue-600/40 shadow-lg border border-blue-400/30"
                  : "hover:bg-white/5 border border-transparent"
              }`}
            >
              <div
                className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${
                  selectedChat === userId
                    ? "bg-white text-blue-600"
                    : "bg-white/5 text-blue-400"
                }`}
              >
                {userId.toString().slice(-2)}
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-bold text-base truncate text-white">
                    User {userId}
                  </span>
                  {unreadCounts[userId] > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="bg-blue-500 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg"
                    >
                      {unreadCounts[userId]}
                    </motion.span>
                  )}
                </div>
                <div className="text-xs font-medium truncate text-blue-200/40">
                  {chats[userId]?.slice(-1)[0]?.message || "Tap to chat"}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Main Chat Area */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`${selectedChat === null ? "hidden md:flex" : "flex"} flex-1 flex flex-col glass-panel m-4 md:ml-0 rounded-[2.5rem] relative overflow-hidden z-10`}
      >
        <AnimatePresence mode="wait">
          {selectedChat ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col h-full"
            >
              <div className="h-24 px-8 border-b border-white/10 flex items-center gap-5 shrink-0 bg-white/5 backdrop-blur-xl">
                <button
                  onClick={() => setSelectedChat(null)}
                  className="md:hidden p-3 bg-white/5 text-white/40 rounded-2xl"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-blue-400 font-black text-xl border border-white/10">
                  {selectedChat.toString().slice(-2)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-black text-white text-xl tracking-tight">
                    User #{selectedChat}
                  </h2>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                    <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">
                      Active Now
                    </span>
                  </div>
                </div>
              </div>

              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-none"
              >
                <AnimatePresence initial={false}>
                  {(chats[selectedChat] || []).map((msg, idx) => {
                    const isMe = msg.from === clientId;
                    return (
                      <motion.div
                        key={msg.id || idx}
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`flex flex-col max-w-[80%] sm:max-w-[65%] ${isMe ? "items-end" : "items-start"}`}
                        >
                          <div
                            className={`px-6 py-4 rounded-[2rem] text-sm font-medium leading-relaxed shadow-xl ${
                              isMe
                                ? "bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-none"
                                : "glass-card text-white rounded-tl-none"
                            }`}
                          >
                            {msg.message}
                          </div>
                          <span className="text-[10px] font-black text-white/20 mt-3 px-2 uppercase tracking-widest flex items-center gap-2">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {isMe && msg.id && readStatus[msg.id] && (
                              <span className="text-blue-400">✓ Read</span>
                            )}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              <form onSubmit={sendMessage} className="p-8">
                <div className="max-w-4xl mx-auto flex items-end gap-4 glass-card p-3 rounded-[2.5rem] border border-white/20">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(e);
                      }
                    }}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 px-5 py-4 bg-transparent border-none focus:ring-0 text-sm font-medium resize-none max-h-32 outline-none text-white placeholder:text-white/20"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="bg-blue-600 text-white p-4 rounded-[1.5rem] disabled:opacity-20 shadow-lg shadow-blue-900/40"
                  >
                    <svg
                      className="w-6 h-6 transform rotate-90"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  </motion.button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center p-12 text-center"
            >
              <motion.div
                animate={{
                  y: [0, -20, 0],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="w-32 h-32 glass-card rounded-[2.5rem] flex items-center justify-center mb-10"
              >
                <svg
                  className="w-16 h-16 text-blue-400/30"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </motion.div>
              <h3 className="text-4xl font-black text-white mb-4 tracking-tight">
                Select a Chat
              </h3>
              <p className="text-blue-200/40 max-w-sm mx-auto text-lg font-medium">
                Start a secure, real-time conversation now.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
