# 🔄 Quick Database Migration & Backup Guide

This guide details how to quickly migrate the Support Hub database to another Supabase project in case of emergency or downtime.

---

## 🔑 Required Environment Variables

### 1. Web Portal (`su-web/.env.local`)
These keys connect the Next.js web application and dashboard:
```ini
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 2. Mobile App (`su/src/lib/supabase.ts`)
This file connects the React Native application:
```typescript
const supabaseUrl = 'https://your-project-id.supabase.co';
const supabaseAnonKey = 'your-supabase-anon-key';
```

---

## 🚀 Step-by-Step Rapid Migration Flow

Follow these steps to migrate the backend to a fresh Supabase database in under 5 minutes:

### Step 1: Create a New Supabase Project
1. Log in to [supabase.com](https://supabase.com/).
2. Create a new project and note down your new **Project URL** and **API Anon Key**.

### Step 2: Deploy Database Schema
1. Open the **SQL Editor** in the new Supabase Project Dashboard.
2. Create a new query, paste the content of [schema.sql](./schema.sql) from this backup folder, and click **Run**.
3. *Done!* All tables, indexes, triggers, and live update configurations are setup.

### Step 3: Update Web Portal (Vercel)
1. Edit the `/Users/iamrps/Desktop/su-web/.env.local` file with the new URL and Anon Key.
2. Redeploy to Vercel instantly by running this terminal command inside `su-web`:
   ```bash
   npx vercel --prod --yes
   ```

### Step 4: Update Mobile App (Over-The-Air)
1. Open `/Users/iamrps/Desktop/su/src/lib/supabase.ts`.
2. Replace `supabaseUrl` and `supabaseAnonKey` variables with your new keys.
3. Publish a new over-the-air update instantly by running this terminal command inside `su`:
   ```bash
   npx eas-cli update --branch preview --message "Migrate database to backup server" --non-interactive
   ```
4. *Done!* Active user devices will automatically load the new database connection values upon their next app launch!

---

## 🗄️ Database Backup Retrieval
To download a snapshot backup:
1. Go to **Supabase Dashboard** -> **Database** -> **Backups**.
2. Click **Download Backup** for the latest database state.
