"use client";

import { useState, useEffect, useRef } from "react";

export default function ChatPage() {
  const [clientId] = useState(Math.floor(Math.random() * 1000));
  const [messages, setMessages] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Create WebSocket connection.
    const socket = new WebSocket(`ws://localhost:8000/ws/${clientId}`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      setMessages((prev) => [...prev, event.data]);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
    };

    return () => {
      socket.close();
    };
  }, [clientId]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (socketRef.current && inputValue) {
      socketRef.current.send(inputValue);
      setInputValue("");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-100">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-blue-600 p-4 text-white font-bold text-center">
          Simple Chat (ID: {clientId})
        </div>
        
        <div className="h-96 overflow-y-auto p-4 space-y-2 flex flex-col">
          {messages.length === 0 && (
            <p className="text-gray-400 text-center italic">No messages yet...</p>
          )}
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`p-2 rounded-lg max-w-[80%] ${
                msg.startsWith(`Client #${clientId}`) 
                  ? "bg-blue-100 self-end text-right" 
                  : "bg-gray-100 self-start"
              }`}
            >
              {msg}
            </div>
          ))}
        </div>

        <form onSubmit={sendMessage} className="p-4 border-t flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </main>
  );
}
