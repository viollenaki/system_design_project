"use client";

import { useState, useEffect, useRef, useMemo } from "react";

interface Message {
  from: number;
  message: string;
  timestamp: number;
}

interface ChatState {
  [key: number]: Message[];
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
  const [activeUsers, setActiveUsers] = useState<number[]>([]);
  const [selectedChat, setSelectedChat] = useState<number | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const clientId = user?.id;

  // Authentication Handlers
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
        // Get me
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

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "users_update") {
          setActiveUsers(data.users.filter((id: number) => id !== clientId));
        } else if (data.type === "message") {
          const fromId = data.from;

          // Fix: If fromId is me, the target bucket is the one we sent to (selectedChat)
          // This ensures sent messages appear in the correct chat window
          const targetChatId = fromId === clientId ? selectedChat : fromId;

          if (targetChatId === null) return;

          const newMessage: Message = {
            from: fromId,
            message: data.message,
            timestamp: Date.now(),
          };

          setChats((prev) => ({
            ...prev,
            [targetChatId]: [...(prev[targetChatId] || []), newMessage],
          }));

          if (fromId !== clientId && targetChatId !== selectedChat) {
            setUnreadCounts((prev) => ({
              ...prev,
              [fromId]: (prev[fromId] || 0) + 1,
            }));
          }
        }
      } catch (err) {
        console.error("Failed to parse message", err);
      }
    };

    return () => {
      socket.close();
    };
  }, [clientId, selectedChat]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chats, selectedChat]);

  const filteredUsers = useMemo(() => {
    return activeUsers.filter((id) => id.toString().includes(searchQuery));
  }, [activeUsers, searchQuery]);

  const handleSelectChat = (id: number) => {
    setSelectedChat(id);
    setUnreadCounts((prev) => ({
      ...prev,
      [id]: 0,
    }));
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (socketRef.current && inputValue && selectedChat !== null && clientId) {
      const payload = {
        to: selectedChat,
        message: inputValue,
      };

      // Send via WS
      socketRef.current.send(JSON.stringify(payload));

      // Locally add the message for the sender to avoid waiting for broadcast
      // This combined with backend fix prevents duplication
      const newMessage: Message = {
        from: clientId,
        message: inputValue,
        timestamp: Date.now(),
      };

      setChats((prev) => ({
        ...prev,
        [selectedChat]: [...(prev[selectedChat] || []), newMessage],
      }));

      setInputValue("");
    }
  };

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl shadow-gray-200">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg mb-4">
              <svg
                className="w-8 h-8"
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
            <h1 className="text-2xl font-bold">
              {isRegistering ? "Create Account" : "Welcome Back"}
            </h1>
            <p className="text-gray-500 text-sm mt-2">
              Enter your details to continue
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="+1 234 567 890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 mt-2"
            >
              {isRegistering ? "Register" : "Login"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError("");
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {isRegistering
                ? "Already have an account? Login"
                : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="flex h-screen bg-white text-gray-900 overflow-hidden font-[family-name:var(--font-geist-sans)]">
      {/* Sidebar */}
      <div
        className={`${selectedChat !== null ? "hidden md:flex" : "flex"} w-full md:w-80 border-r bg-gray-50 flex-col shrink-0`}
      >
        <div className="p-6 border-b bg-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <svg
                className="w-6 h-6"
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
            <div className="flex-1">
              <h1 className="font-bold text-xl tracking-tight">Messages</h1>
              <p className="text-xs text-gray-500 font-medium truncate">
                {user.phone}
              </p>
            </div>
            <button
              onClick={() => {
                setUser(null);
                setToken(null);
              }}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <svg
                className="w-5 h-5"
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

          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm transition-all outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <p className="text-gray-400 text-sm">No other users online yet</p>
            </div>
          ) : (
            filteredUsers.map((userId) => (
              <button
                key={userId}
                onClick={() => handleSelectChat(userId)}
                className={`w-full p-3 flex items-center gap-4 rounded-xl transition-all ${
                  selectedChat === userId
                    ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                    : "hover:bg-white text-gray-700"
                }`}
              >
                <div
                  className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-bold text-lg ${
                    selectedChat === userId
                      ? "bg-white/20 text-white"
                      : "bg-blue-100 text-blue-600"
                  }`}
                >
                  {userId.toString().slice(-2)}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <span
                      className={`font-semibold text-sm truncate ${selectedChat === userId ? "text-white" : "text-gray-900"}`}
                    >
                      User #{userId}
                    </span>
                    {unreadCounts[userId] > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {unreadCounts[userId]}
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-xs truncate ${selectedChat === userId ? "text-blue-100" : "text-gray-500"}`}
                  >
                    {chats[userId]?.slice(-1)[0]?.message ||
                      "Start chatting..."}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div
        className={`${selectedChat === null ? "hidden md:flex" : "flex"} flex-1 flex flex-col bg-white relative`}
      >
        {selectedChat ? (
          <>
            <div className="h-[72px] px-6 border-b flex items-center gap-4 shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <button
                onClick={() => setSelectedChat(null)}
                className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full"
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
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                {selectedChat.toString().slice(-2)}
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-gray-900 leading-tight">
                  User #{selectedChat}
                </h2>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Online
                  </span>
                </div>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth bg-white"
            >
              {(chats[selectedChat] || []).map((msg, idx) => {
                const isMe = msg.from === clientId;
                return (
                  <div
                    key={idx}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`flex flex-col max-w-[80%] md:max-w-[70%] ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isMe
                            ? "bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-100"
                            : "bg-gray-100 text-gray-800 rounded-tl-none"
                        }`}
                      >
                        {msg.message}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1 px-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={sendMessage}
              className="p-4 md:p-6 bg-white border-t border-gray-100"
            >
              <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-500/5 transition-all">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 bg-transparent border-none focus:ring-0 text-sm outline-none"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-40 shadow-md shadow-blue-200"
                >
                  <svg
                    className="w-5 h-5 transform rotate-90"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 p-12 text-center">
            <div className="w-24 h-24 bg-white rounded-3xl shadow-xl shadow-gray-200/50 flex items-center justify-center mb-8">
              <svg
                className="w-12 h-12 text-blue-500 opacity-20"
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
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              No Chat Selected
            </h3>
            <p className="text-gray-500 max-w-xs mx-auto text-sm leading-relaxed">
              Select a user from the sidebar to start a conversation.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
