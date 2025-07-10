'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { debounce } from "lodash";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";

interface User {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface Message {
  _id: string;
  sender: string;
  receiver: string;
  content: string;
  timestamp: string;
}

function getInitials(firstName?: string, lastName?: string, email?: string) {
  if (firstName && lastName) return (firstName[0] + lastName[0]).toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  if (email) return email[0]?.toUpperCase() || '?';
  return '?';
}

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPage() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userFirstName, setUserFirstName] = useState<string | null>(null);
  const [userLastName, setUserLastName] = useState<string | null>(null);
  const router = useRouter();
  const socket = useRef<Socket | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [unread, setUnread] = useState<{ [userId: string]: number }>({});

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
      setUserFirstName(payload.firstName || null);
      setUserLastName(payload.lastName || null);
    } catch {
      setUserId(null);
      setUserEmail(null);
      setUserFirstName(null);
      setUserLastName(null);
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
      } else {
        setUnread(prev => ({ ...prev, [msg.sender]: (prev[msg.sender] || 0) + 1 }));
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

  // Search users (debounced)
  const handleSearch = useMemo(() => debounce(async (search: string) => {
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`http://localhost:3001/api/users?search=${search}`,
        { headers: { Authorization: `Bearer ${token}` } });
      setUsers(res.data);
    } catch (_: any) {
      setError("Failed to search users");
    }
  }, 300), []);

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
        setUnread(prev => ({ ...prev, [selectedUser._id]: 0 }));
      } catch (_: any) {
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
    } catch (_: any) {
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
      {/* Top bar with user info and logout */}
      <div className="fixed top-0 right-0 left-0 h-16 bg-white border-b flex items-center justify-end px-8 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center font-bold text-blue-700 text-lg">
            {getInitials(userFirstName || undefined, userLastName || undefined, userEmail || undefined)}
          </div>
          <div className="font-semibold text-gray-700 text-base">
            {userFirstName} {userLastName}
          </div>
          <Button variant="outline" size="sm" className="ml-4" onClick={handleLogout}>Logout</Button>
        </div>
      </div>
      {/* Sidebar */}
      <div className="w-1/3 max-w-xs bg-white p-4 border-r flex flex-col pt-20">
        <h2 className="text-xl font-bold mb-4">Users</h2>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              handleSearch(e.target.value);
            }}
          />
        </div>
        <div className="space-y-2 overflow-y-auto flex-1">
          {users.length === 0 && <div className="text-gray-400 text-sm flex flex-col items-center mt-8">
            <span className="text-5xl mb-2">🔍</span>
            No users found. Try searching.
          </div>}
          {users.map(user => (
            <Card
              key={user._id}
              className={`flex items-center gap-3 cursor-pointer transition-colors px-2 py-1 ${selectedUser?._id === user._id ? 'bg-blue-100 border-blue-400' : 'hover:bg-blue-50'}`}
              onClick={() => setSelectedUser(user)}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="w-9 h-9 rounded-full bg-blue-200 flex items-center justify-center font-bold text-blue-700 text-lg">
                  {getInitials(user.firstName, user.lastName, user.email)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{user.firstName} {user.lastName}</div>
                  <div className="text-xs text-gray-400">{user.email}</div>
                  {messages.length > 0 && selectedUser?._id === user._id && (
                    <div className="text-xs text-gray-400">Last: {formatTime(messages[messages.length-1].timestamp)}</div>
                  )}
                </div>
                {unread[user._id] > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 ml-2">{unread[user._id]}</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col items-center justify-center pt-20">
        {selectedUser ? (
          <div className="w-full max-w-xl flex flex-col h-[80vh] bg-white rounded shadow-lg border">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-blue-50 rounded-t">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-200 flex items-center justify-center font-bold text-blue-700 text-lg">
                  {getInitials(selectedUser.firstName, selectedUser.lastName, selectedUser.email)}
                </div>
                <h3 className="font-semibold">Chat with {selectedUser.firstName} {selectedUser.lastName}</h3>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map(msg => {
                const isMe = msg.sender === userId;
                return (
                  <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <span className={`inline-block px-4 py-2 rounded-2xl max-w-xs break-words shadow-sm text-sm ${isMe ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 text-gray-900 rounded-bl-none'} border ${isMe ? 'border-blue-400' : 'border-gray-300'}`}>
                      {msg.content}
                      <span className="block text-[10px] text-right text-gray-300 mt-1">{formatTime(msg.timestamp)}</span>
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
