# AttendMark – Setup Guide

## What's changed
This is the **single-teacher version**. Only you can log in and use the app.
No sign-up screen for others — just your email & password.

---

## Step 1 – Create a free Supabase project

1. Go to **https://supabase.com** → Sign up (free)
2. Click **New Project**, name it `attendmark`
3. Wait ~2 min for setup
4. Go to **Project Settings → API** and copy:
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **anon / public** key

---

## Step 2 – Create your teacher account in Supabase

Go to **Authentication → Users → Add user → Create new user**
- Enter your email and a password
- This is the only account — only you can log in

> **Tip:** Also go to **Authentication → Settings** and **turn OFF "Enable email sign-ups"** so no one else can create accounts.

---

## Step 3 – Create the database tables

Go to **SQL Editor** and run:

```sql
-- Students
create table students (
  number integer primary key
);

-- Attendance records
create table attendance (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  period text not null,
  student_number integer not null references students(number) on delete cascade,
  created_at timestamptz default now()
);

-- Only authenticated users (you) can read/write
alter table students enable row level security;
alter table attendance enable row level security;

create policy "teacher only" on students
  for all using (auth.role() = 'authenticated');

create policy "teacher only" on attendance
  for all using (auth.role() = 'authenticated');
```

Click **Run**.

---

## Step 4 – Set up the React project

Make sure **Node.js** is installed (https://nodejs.org).

```bash
npm create vite@latest attendmark -- --template react
cd attendmark
npm install @supabase/supabase-js
```

Copy the provided `App.jsx` and `App.css` into the `src/` folder (replace the defaults).

In `src/main.jsx`, make sure you have:
```js
import './App.css'
```

---

## Step 5 – Add your Supabase credentials

Open `src/App.jsx`, lines 5–6:

```js
const SUPABASE_URL = "YOUR_SUPABASE_URL";      // ← paste here
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";  // ← paste here
```

---

## Step 6 – Test locally

```bash
npm run dev
```

Open `http://localhost:5173`, sign in with your email/password.

---

## Step 7 – Deploy (free, access from any phone)

**Vercel** is the easiest:

1. Push your project to **GitHub**
2. Go to **https://vercel.com** → Sign in with GitHub
3. **New Project** → import your repo → **Deploy**
4. Done — you get a URL like `https://attendmark.vercel.app`
5. Bookmark it on your phone

---

## How to use

| Tab | What it does |
|---|---|
| **✏️ Mark** | Pick date + period → tick absent students → Save |
| **🗂 History** | Filter by date/period → view & copy past records |
| **👥 Students** | Add/remove student numbers from the database |

**Output format after saving:**
```
28/02/26    P-3
12, 34, 45
```
Tap **Copy** to paste it anywhere (WhatsApp, notes, etc.)
