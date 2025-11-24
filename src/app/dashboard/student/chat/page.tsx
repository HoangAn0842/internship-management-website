"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Conversation {
  id: string;
  lecturer_id: string;
  lecturer_name: string;
  lecturer_email: string;
  lecturer_department: string;
  unread_student_count: number;
  last_message_content: string | null;
  last_message_sender_id: string | null;
  last_message_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
}

export default function StudentChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    getCurrentUser();
  }, []);

  useEffect(() => {
    // Subscribe to new messages in real-time
    const messagesChannel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // Reload conversations để cập nhật last_message
          loadConversations();
          
          // Nếu message thuộc conversation đang mở, reload messages
          if (selectedConversation && payload.new.conversation_id === selectedConversation.id) {
            // Reload messages để lấy đầy đủ thông tin sender
            loadMessages(selectedConversation.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [selectedConversation]);

  useEffect(() => {
    if (selectedConversation) {
      setMessages([]); // Clear old messages first
      loadMessages(selectedConversation.id);
      markAsRead(selectedConversation.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    });
  };

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch("/api/conversations", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch {
      toast.error("Lỗi tải danh sách cuộc trò chuyện");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/conversations/${conversationId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch {
      toast.error("Lỗi tải tin nhắn");
    }
  };

  const markAsRead = async (conversationId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      // Reload conversations to update unread count
      loadConversations();
    } catch {
      console.error("Error marking as read");
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || isSending) return;

    try {
      setIsSending(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/conversations/${selectedConversation.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content: newMessage.trim() }),
      });

      const data = await response.json();
      if (data.message) {
        setMessages([...messages, data.message]);
        setNewMessage("");
        loadConversations(); // Update last message
      } else {
        toast.error("Lỗi gửi tin nhắn");
      }
    } catch {
      toast.error("Lỗi gửi tin nhắn");
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    
    // Tính diff theo milliseconds
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Vừa xong (dưới 1 phút)
    if (diffMins < 1) {
      return "Vừa xong";
    }
    // X phút trước (dưới 1 giờ)
    if (diffHours < 1) {
      return `${diffMins} phút trước`;
    }
    // X giờ trước (trong ngày hôm nay)
    if (diffHours < 24 && date.getDate() === now.getDate()) {
      return `${diffHours} giờ trước`;
    }
    // Hôm qua
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.getDate() === yesterday.getDate() && 
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear()) {
      return "Hôm qua";
    }
    // X ngày trước (dưới 7 ngày)
    if (diffDays < 7) {
      return `${diffDays} ngày trước`;
    }
    // Hiển thị ngày tháng
    return date.toLocaleDateString("vi-VN", { 
      day: "2-digit", 
      month: "2-digit",
      year: "numeric"
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Chưa có cuộc trò chuyện</h3>
        <p className="text-gray-500">
          Bạn chưa được phân giảng viên hướng dẫn hoặc chưa có cuộc trò chuyện nào.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      {/* Danh sách conversations - Sidebar */}
      <Card className="w-80 flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="text-lg">Tin nhắn</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-y-auto">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedConversation?.id === conv.id ? "bg-blue-50" : ""
              }`}
              onClick={() => setSelectedConversation(conv)}
            >
              <div className="flex items-start gap-3">
                <Avatar className="w-10 h-10 bg-blue-100 text-blue-700 flex items-center justify-center">
                  {conv.lecturer_name.charAt(0).toUpperCase()}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm truncate">{conv.lecturer_name}</p>
                    {conv.unread_student_count > 0 && (
                      <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
                        {conv.unread_student_count}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{conv.lecturer_department}</p>
                  {conv.last_message_content && (
                    <p className="text-xs text-gray-600 truncate">
                      {conv.last_message_sender_id === userId ? "Bạn: " : ""}
                      {conv.last_message_content}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {formatTime(conv.last_message_at)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Khung chat */}
      <Card className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 bg-blue-100 text-blue-700 flex items-center justify-center">
                  {selectedConversation.lecturer_name.charAt(0).toUpperCase()}
                </Avatar>
                <div>
                  <CardTitle className="text-lg">{selectedConversation.lecturer_name}</CardTitle>
                  <p className="text-sm text-gray-500">{selectedConversation.lecturer_department}</p>
                </div>
              </div>
            </CardHeader>

            {/* Messages */}
            <CardContent ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_id === userId ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      msg.sender_id === userId
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        msg.sender_id === userId ? "text-blue-100" : "text-gray-500"
                      }`}
                    >
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>

            {/* Input */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nhập tin nhắn..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  disabled={isSending}
                />
                <Button onClick={sendMessage} disabled={isSending || !newMessage.trim()}>
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>Chọn một cuộc trò chuyện để bắt đầu</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
