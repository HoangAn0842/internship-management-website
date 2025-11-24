# CONTEXT.md – Internship Management System (IMS)

## Project Overview
- **Name**: `internship-management-website`
- **Tech Stack**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn UI, Supabase
- **GitHub**: https://github.com/HoangAn0842/internship-management-website
- **Deploy**: Vercel (sau này)

## Project Structure
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx        ← Sắp tạo
│   │   └── register/page.tsx     ← Sắp tạo
│   ├── dashboard/
│   │   ├── student/page.tsx      ← Sắp tạo
│   │   ├── lecturer/page.tsx     ← Sắp tạo
│   │   └── admin/page.tsx        ← Sắp tạo
│   ├── test-register/page.tsx    ← Đã có (test trigger)
│   ├── test-supabase/page.tsx    ← Đã có (test kết nối)
│   ├── layout.tsx
│   ├── globals.css
│   └── page.tsx
├── components/
│   └── ui/                       ← 11 components từ Shadcn
├── lib/
│   ├── supabase.ts               ← Client Supabase
│   └── utils.ts                  ← cn() helper từ Shadcn
└── hooks/                        ← (sẽ thêm useAuth, useProfile)

## Supabase Setup
- **Project URL**: `https://bhawksjouhlqmaowgugs.supabase.co`
- **Table**: `profiles`
  - `id` → `uuid` → `references auth.users`
  - `role` → `student` | `lecturer` | `admin`
  - `full_name`, `student_id`, `department`, `avatar_url`
- **RLS**: Enabled
  - Public read
  - Own update (`auth.uid() = id`)
- **Trigger**: `on_auth_user_created` → Tự động tạo `profile` khi `signUp`
  ```ts
  options: { data: { full_name: '...', role: '...' } }

## Shadcn UI Components (Installed)
button input label card table dialog dropdown-menu form sonner badge avatar select

## Current Progress
 - Next.js + src/ + TypeScript + Tailwind
 - Shadcn UI initialized + 11 components
 - Supabase connected
 - profiles table + RLS + trigger
 - Email Auth: Enabled
 - Test user: test123@gmail.com (role: student)

## Notes for Copilot
 - Dùng @/lib/supabase để import client
 - Dùng @/components/ui/* cho UI
 - Luôn dùng use client cho trang tương tác
 - Dùng sonner thay toast
 - Code phải TypeScript strict, accessible, responsive
 - Ưu tiên Shadcn UI và Tailwind