'use client';

import React, { useEffect, useState, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import axios from "axios";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { debounce } from "lodash";

interface User {
  _id: string;
  email: string;
}

interface Message {
  _id: string;
  sender: string;
  receiver: string;
  content: string;
  timestamp: string;
}

export default function ChatPage() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();
  const socket = useRef<Socket | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auth check and get user info
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUserId(payload.userId);
      setUserEmail(payload.email || null);
    } catch {
      setUserId(null);
      setUserEmail(null);
    }
  }, [router]);

  // Setup socket connection
  useEffect(() => {
    if (!userId) return;
    socket.current = io("http://localhost:3001");
    socket.current.emit("setup", userId);
    socket.current.on("receiveMessage", (msg: Message) => {
      if (selectedUser && msg.sender === selectedUser._id) {
        setMessages((prev) => [...prev, msg]);
      }
    });
    return () => {
      socket.current?.disconnect();
    };
  }, [userId, selectedUser]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Search users (query-based)
  const handleSearch = useMemo(() => debounce(async (search: string) => {
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`http://localhost:3001/api/users?search=${search}`,
        { headers: { Authorization: `Bearer ${token}` } });
      setUsers(res.data);
    } catch (err: any) {
      setError("Failed to search users");
    }
  }, 500), []);

  // Load messages when user selected
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedUser) return;
      setError("");
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`http://localhost:3001/api/chats/${selectedUser._id}`,
          { headers: { Authorization: `Bearer ${token}` } });
        setMessages(res.data);
      } catch (err: any) {
        setError("Failed to load messages");
      }
    };
    fetchMessages();
  }, [selectedUser]);

  // Send message (real-time)
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !selectedUser || !userId) return;
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post("http://localhost:3001/api/chats", {
        receiver: selectedUser._id,
        content: message,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setMessages((prev) => [...prev, res.data]);
      socket.current?.emit("sendMessage", {
        sender: userId,
        receiver: selectedUser._id,
        content: message,
      });
      setMessage("");
    } catch (err: any) {
      setError("Failed to send message");
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-100 to-blue-50">
      {/* Sidebar */}
      <div className="w-1/3 max-w-xs bg-white p-4 border-r flex flex-col">
        <div className="mb-6 flex items-center justify-between">
          <span className="font-bold text-lg">{userEmail || "User"}</span>
          <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
        </div>
        <h2 className="text-xl font-bold mb-4">Users</h2>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              handleSearch(e.target.value)
            }}
            onKeyDown={e => e.key === 'Enter' && handleSearch(search)}
          />
          <Button onClick={() => handleSearch(search)}>Search</Button>
        </div>
        <div className="space-y-2 overflow-y-auto flex-1">
          {users.length === 0 && <div className="text-gray-400 text-sm">No users found. Try searching.</div>}
          {users.map(user => (
            <Card
              key={user._id}
              className={`cursor-pointer transition-colors ${selectedUser?._id === user._id ? 'bg-blue-100 border-blue-400' : 'hover:bg-blue-50'}`}
              onClick={() => setSelectedUser(user)}
            >
              <CardContent className="py-2 px-4">{user.email}</CardContent>
            </Card>
          ))}
        </div>
      </div>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {selectedUser ? (
          <div className="w-full max-w-xl flex flex-col h-[80vh] bg-white rounded shadow-lg border">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-blue-50 rounded-t">
              <h3 className="font-semibold">Chat with {selectedUser.email}</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map(msg => {
                const isMe = msg.sender === userId;
                return (
                  <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <span className={`inline-block px-4 py-2 rounded-2xl max-w-xs break-words shadow-sm text-sm ${isMe ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 text-gray-900 rounded-bl-none'}`}>
                      {msg.content}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSend} className="flex gap-2 p-4 border-t bg-white rounded-b">
              <Input
                placeholder="Type a message..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">Send</Button>
            </form>
          </div>
        ) : (
          <div className="text-gray-500">Select a user to start chatting</div>
        )}
        {error && <div className="text-red-500 mt-2">{error}</div>}
      </div>
    </div>
  );
}
