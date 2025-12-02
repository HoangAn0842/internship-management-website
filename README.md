# Internship Management System

A comprehensive internship management system built with modern web technologies. This application provides role-based access control for students, lecturers, and administrators to manage the entire internship lifecycle.

## Features

### For Students
- Register for internship periods
- Submit weekly progress reports
- Real-time chat with assigned lecturers
- Request internship retakes
- View profile and internship status

### For Lecturers
- View and manage assigned students
- Review weekly reports and provide feedback
- Real-time chat with students
- Track student progress

### For Administrators
- Manage internship periods
- Assign lecturers to students (manual or auto-assignment)
- Manage student and lecturer accounts
- Review retake requests
- Monitor all weekly reports
- Export data to Excel

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **UI Components**: Shadcn UI, Radix UI
- **Backend**: Supabase (PostgreSQL, Authentication, Realtime)
- **Form Management**: React Hook Form, Zod
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 20+ installed
- npm, yarn, pnpm, or bun package manager
- Supabase account (for backend services)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/HoangAn0842/internship-management-website.git
cd internship-management-website
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Authentication pages
│   ├── dashboard/           # Role-based dashboards
│   │   ├── admin/          # Admin dashboard
│   │   ├── lecturer/       # Lecturer dashboard
│   │   └── student/        # Student dashboard
│   └── api/                # API routes
├── components/
│   └── ui/                 # Reusable UI components
├── hooks/                  # Custom React hooks
└── lib/                    # Utility functions and configs
```

## Database Schema

The application uses Supabase with the following main tables:
- `profiles` - User profiles with role-based information
- `periods` - Internship periods
- `registrations` - Student registrations
- `weekly_reports` - Student progress reports
- `conversations` - Chat conversations
- `messages` - Chat messages
- `retake_requests` - Internship retake requests

## Authentication

The system supports email-based authentication with three user roles:
- **Student**: Can register, submit reports, and chat with lecturers
- **Lecturer**: Can review students and provide guidance
- **Admin**: Full system access and management capabilities

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Code Quality

The project uses:
- TypeScript for type safety
- ESLint for code linting
- Tailwind CSS for styling
- Shadcn UI for consistent component design

## Contributing

This is a personal project for learning and portfolio purposes. Feel free to fork and modify for your own use.

## License

MIT License - feel free to use this project for your own learning purposes.
