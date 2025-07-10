'use client';

import React, { useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import axios from "axios";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";

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
  const router = useRouter();
  const socket = useRef<Socket | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    // Decode userId from token (simple base64 decode, not secure, but works for demo)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUserId(payload.userId);
    } catch {
      setUserId(null);
    }
  }, [router]);

  // Setup socket connection
  useEffect(() => {
    if (!userId) return;
    socket.current = io("http://localhost:3001");
    socket.current.emit("setup", userId);
    socket.current.on("receiveMessage", (msg: Message) => {
      // Only add message if it's for the currently selected user
      if (selectedUser && msg.sender === selectedUser._id) {
        setMessages((prev) => [...prev, msg]);
      }
    });
    return () => {
      socket.current?.disconnect();
    };
  }, [userId, selectedUser]);

  // Search users
  const handleSearch = async () => {
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`http://localhost:3001/api/users?search=${search}`,
        { headers: { Authorization: `Bearer ${token}` } });
      setUsers(res.data);
    } catch (err: any) {
      setError("Failed to search users");
    }
  };

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
      // Send via REST for persistence
      const token = localStorage.getItem("token");
      const res = await axios.post("http://localhost:3001/api/chats", {
        receiver: selectedUser._id,
        content: message,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setMessages((prev) => [...prev, res.data]);
      // Send via socket for real-time
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

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="w-1/3 max-w-xs bg-gray-100 p-4 border-r">
        <h2 className="text-xl font-bold mb-4">Users</h2>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch}>Search</Button>
        </div>
        <div className="space-y-2">
          {users.map(user => (
            <Card
              key={user._id}
              className={`cursor-pointer ${selectedUser?._id === user._id ? 'bg-blue-100' : ''}`}
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
          <div className="w-full max-w-xl flex flex-col h-[80vh]">
            <div className="flex-1 overflow-y-auto bg-white p-4 border rounded-t">
              <h3 className="font-semibold mb-2">Chat with {selectedUser.email}</h3>
              <div className="space-y-2">
                {messages.map(msg => (
                  <div key={msg._id} className={`text-sm ${msg.sender === selectedUser._id ? 'text-left' : 'text-right'}`}>
                    <span className={`inline-block px-3 py-1 rounded ${msg.sender === selectedUser._id ? 'bg-gray-200' : 'bg-blue-200'}`}>{msg.content}</span>
                  </div>
                ))}
              </div>
            </div>
            <form onSubmit={handleSend} className="flex gap-2 p-4 border-t bg-white rounded-b">
              <Input
                placeholder="Type a message..."
                value={message}
                onChange={e => setMessage(e.target.value)}
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
