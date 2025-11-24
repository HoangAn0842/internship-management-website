"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export function useUnreadMessages(userRole: "student" | "lecturer") {
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  // Load unread count when userId changes
  useEffect(() => {
    if (!userId) return;

    const loadCount = async () => {
      try {
        // Dùng view v_conversations_with_users vì các cột unread_* là computed fields trong view
        const { data, error } = await supabase
          .from("v_conversations_with_users")
          .select("id, student_id, lecturer_id, unread_student_count, unread_lecturer_count")
          .eq(userRole === "student" ? "student_id" : "lecturer_id", userId);

        if (error) {
          console.error("Error loading unread count:", { message: error.message, details: error.details, hint: error.hint });
          return;
        }

        const total = data?.reduce((sum, conv) => {
          const count = userRole === "student"
            ? (conv as { unread_student_count: number }).unread_student_count
            : (conv as { unread_lecturer_count: number }).unread_lecturer_count;
          return sum + (count || 0);
        }, 0) || 0;

        setUnreadCount(total);
      } catch (e) {
        console.error("Exception loading unread count:", e);
      }
    };

    loadCount();
  }, [userId, userRole]);

  // Callback function for manual refresh
  const loadUnreadCount = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("v_conversations_with_users")
        .select("id, student_id, lecturer_id, unread_student_count, unread_lecturer_count")
        .eq(userRole === "student" ? "student_id" : "lecturer_id", userId);

      if (error) {
        console.error("Error loading unread count:", { message: error.message, details: error.details, hint: error.hint });
        return;
      }

      const total = data?.reduce((sum, conv) => {
        const count = userRole === "student"
          ? (conv as { unread_student_count: number }).unread_student_count
          : (conv as { unread_lecturer_count: number }).unread_lecturer_count;
        return sum + (count || 0);
      }, 0) || 0;

      setUnreadCount(total);
    } catch (e) {
      console.error("Exception loading unread count:", e);
    }
  }, [userId, userRole]);

  // Subscribe to new messages
  useEffect(() => {
    if (!userId) return;

    // Subscribe to messages table for real-time updates
    const messagesChannel = supabase
      .channel("unread-messages-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const newMessage = payload.new as {
            id: string;
            sender_id: string;
            conversation_id: string;
            content: string;
            created_at: string;
          };

          // If message is not from current user, show notification
          if (newMessage.sender_id !== userId) {
            // Lấy thông tin từ view để có sẵn tên và unread counts
            const { data: conversation } = await supabase
              .from("v_conversations_with_users")
              .select("id, student_id, lecturer_id, student_name, lecturer_name")
              .eq("id", newMessage.conversation_id)
              .single();

            if (conversation) {
              const isMyConversation = 
                (userRole === "student" && conversation.student_id === userId) ||
                (userRole === "lecturer" && conversation.lecturer_id === userId);

              if (isMyConversation) {
                const senderName = userRole === "student"
                  ? (conversation as { lecturer_name?: string }).lecturer_name || "Giảng viên"
                  : (conversation as { student_name?: string }).student_name || "Sinh viên";

                // Show toast notification
                toast.info(`Tin nhắn mới từ ${senderName}`, {
                  description: newMessage.content.substring(0, 50) + (newMessage.content.length > 50 ? "..." : ""),
                  duration: 5000,
                });

                // Reload unread count
                loadUnreadCount();
              }
            }
          }
        }
      )
      .subscribe();

    // Subscribe thêm UPDATE trên messages để cập nhật unread count khi đánh dấu đọc
    const messagesReadChannel = supabase
      .channel("messages-read-updates-channel")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(messagesReadChannel);
    };
  }, [userId, userRole, loadUnreadCount]);

  return { unreadCount, refreshUnreadCount: loadUnreadCount };
}
