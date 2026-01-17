# Shake App - Comprehensive Documentation

> **Last Updated:** January 17, 2026

---

## Table of Contents

1. [App Overview](#1-app-overview)
2. [Architecture Guide](#2-architecture-guide)
3. [Database Schema](#3-database-schema)
4. [Component Reference](#4-component-reference)
5. [API & Edge Functions](#5-api--edge-functions)

---

## 1. App Overview

### Purpose

**Shake** is a social networking and activity-matching platform designed to connect people in cities through shared real-life experiences. Users can join group activities, create their own plans, and chat with other participants.

### Core Features

| Feature | Description |
|---------|-------------|
| **Activity Matching** | Browse and join activities (Lunch, Dinner, Drinks, Brunch, Hike) based on current city |
| **Plan Creation** | Create custom activities (Surf, Run, Co-working, Basketball, etc.) |
| **Group Chat** | Real-time text and voice messaging within activity groups |
| **User Profiles** | Customizable profiles with avatars and social links |
| **World Map** | Explore activities globally across 100+ cities |
| **Premium Membership** | "Super-Human" subscription ($5/month) for enhanced features |

### Premium Features

- ✨ Unlimited activity creation (free users: 3/month)
- 🌍 Access to 100+ cities worldwide
- 📍 Join activities in any city
- 👤 Unlimited profile views
- 🎙️ Unlimited voice messages
- 💬 Unlimited text messages

### Supported Cities

The app supports over 100 cities worldwide including major metropolitan areas across:
- North America (NYC, LA, SF, Miami, etc.)
- Europe (London, Paris, Barcelona, Berlin, etc.)
- Asia (Tokyo, Singapore, Bangkok, etc.)
- South America (São Paulo, Buenos Aires, etc.)
- Australia (Sydney, Melbourne, etc.)

---

## 2. Architecture Guide

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS, shadcn/ui components |
| **State Management** | React Context, TanStack Query |
| **Backend** | Lovable Cloud (Supabase) |
| **Authentication** | Phone OTP, Google OAuth |
| **Payments** | Stripe (subscriptions) |
| **SMS** | Twilio |
| **Maps** | Mapbox GL |
| **Mobile** | Capacitor (iOS/Android) |

### Project Structure

```
src/
├── assets/              # Images, icons, avatars
├── components/          # React components
│   ├── ios/            # iOS-specific tab components
│   └── ui/             # shadcn/ui base components
├── contexts/           # React contexts (Auth, City, Theme)
├── data/               # Static data (activities, cities, venues)
├── hooks/              # Custom React hooks
├── integrations/       # Supabase client
├── lib/                # Utility functions
├── pages/              # Route pages
└── main.tsx           # App entry point

supabase/
├── config.toml        # Supabase configuration
└── functions/         # Edge functions
    ├── check-subscription/
    ├── create-checkout/
    ├── customer-portal/
    ├── delete-account/
    ├── elevenlabs-welcome/
    ├── send-plan-sms/
    └── send-sms-notification/
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │  Home   │  │  Plans  │  │  Chat   │  │    Profile      │ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────────┬────────┘ │
└───────┼────────────┼────────────┼────────────────┼──────────┘
        │            │            │                │
        ▼            ▼            ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Context Providers                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ AuthContext  │  │ CityContext  │  │   ThemeContext    │  │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬─────────┘  │
└─────────┼─────────────────┼────────────────────┼────────────┘
          │                 │                    │
          ▼                 ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Custom Hooks                              │
│  useActivityJoins, useUserActivities, usePrivateMessages,   │
│  useGreetings, useOnlinePresence, usePushNotifications      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Client                           │
│              (Real-time subscriptions)                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Lovable Cloud                             │
│  ┌────────────┐  ┌─────────────┐  ┌───────────────────────┐ │
│  │  Database  │  │   Storage   │  │    Edge Functions     │ │
│  └────────────┘  └─────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    Authentication Options                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │    Phone + OTP      │    │      Google OAuth           │  │
│  │                     │    │                             │  │
│  │  1. Enter phone     │    │  1. Click "Sign in"         │  │
│  │  2. Receive SMS OTP │    │  2. Google consent screen   │  │
│  │  3. Verify code     │    │  3. Redirect back to app    │  │
│  │  4. Create profile  │    │  4. Auto-create profile     │  │
│  └─────────────────────┘    └─────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

### Tables Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         DATABASE TABLES                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐       ┌─────────────────────────────────┐  │
│  │    profiles     │       │        profiles_private         │  │
│  ├─────────────────┤       ├─────────────────────────────────┤  │
│  │ id              │       │ id                              │  │
│  │ user_id (FK)    │◄─────►│ user_id                         │  │
│  │ name            │       │ phone_number                    │  │
│  │ avatar_url      │       │ date_of_birth                   │  │
│  │ instagram_url   │       │ billing_email                   │  │
│  │ linkedin_url    │       │ premium_override                │  │
│  │ twitter_url     │       │ push_notifications_enabled      │  │
│  │ created_at      │       │ sms_notifications_enabled       │  │
│  │ updated_at      │       │ created_at, updated_at          │  │
│  └─────────────────┘       └─────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────┐       ┌─────────────────────────────────┐  │
│  │ user_activities │       │        activity_joins           │  │
│  ├─────────────────┤       ├─────────────────────────────────┤  │
│  │ id (PK)         │◄─────►│ activity_id (FK)                │  │
│  │ user_id         │       │ user_id                         │  │
│  │ activity_type   │       │ activity_type                   │  │
│  │ city            │       │ city                            │  │
│  │ scheduled_for   │       │ joined_at                       │  │
│  │ note            │       │ expires_at                      │  │
│  │ is_active       │       └─────────────────────────────────┘  │
│  │ created_at      │                                            │
│  │ updated_at      │       ┌─────────────────────────────────┐  │
│  └─────────────────┘       │      activity_messages          │  │
│                            ├─────────────────────────────────┤  │
│  ┌─────────────────┐       │ id                              │  │
│  │  plan_messages  │       │ activity_type                   │  │
│  ├─────────────────┤       │ city                            │  │
│  │ id              │       │ user_id                         │  │
│  │ activity_id(FK) │       │ message                         │  │
│  │ user_id         │       │ audio_url                       │  │
│  │ message         │       │ created_at                      │  │
│  │ audio_url       │       └─────────────────────────────────┘  │
│  │ created_at      │                                            │
│  └─────────────────┘       ┌─────────────────────────────────┐  │
│                            │       private_messages          │  │
│  ┌─────────────────┐       ├─────────────────────────────────┤  │
│  │    greetings    │       │ id                              │  │
│  ├─────────────────┤       │ sender_id                       │  │
│  │ id              │       │ receiver_id                     │  │
│  │ from_user_id    │       │ message                         │  │
│  │ to_user_id      │       │ audio_url                       │  │
│  │ created_at      │       │ read_at                         │  │
│  └─────────────────┘       │ created_at                      │  │
│                            └─────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               activity_read_status                       │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │ id, user_id, activity_type, city, muted, last_read_at   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Table Details

#### `profiles` (Public User Data)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | References auth.users |
| name | TEXT | Display name |
| avatar_url | TEXT | Profile picture URL |
| instagram_url | TEXT | Instagram profile link |
| linkedin_url | TEXT | LinkedIn profile link |
| twitter_url | TEXT | Twitter/X profile link |
| created_at | TIMESTAMPTZ | Record creation time |
| updated_at | TIMESTAMPTZ | Last update time |

#### `profiles_private` (Private User Data)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | References auth.users |
| phone_number | TEXT | User's phone number |
| date_of_birth | DATE | For age verification |
| billing_email | TEXT | Email for Stripe billing |
| premium_override | BOOLEAN | Manual premium flag |
| push_notifications_enabled | BOOLEAN | Push notification preference |
| sms_notifications_enabled | BOOLEAN | SMS notification preference |

#### `user_activities` (Created Plans)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Creator's user ID |
| activity_type | TEXT | Type (lunch, dinner, surf, etc.) |
| city | TEXT | City where activity takes place |
| scheduled_for | TIMESTAMPTZ | When the activity is planned |
| note | TEXT | Optional description |
| is_active | BOOLEAN | Whether activity is still active |

#### `activity_joins` (Activity Participation)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| activity_id | UUID | References user_activities (nullable) |
| user_id | UUID | Participant's user ID |
| activity_type | TEXT | Type of activity joined |
| city | TEXT | City of the activity |
| joined_at | TIMESTAMPTZ | When user joined |
| expires_at | TIMESTAMPTZ | When participation expires |

#### `activity_messages` (Group Chat Messages)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| activity_type | TEXT | Which activity chat |
| city | TEXT | City context |
| user_id | UUID | Message sender |
| message | TEXT | Message content |
| audio_url | TEXT | Voice note URL (optional) |
| created_at | TIMESTAMPTZ | Message timestamp |

#### `plan_messages` (Plan-Specific Chat)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| activity_id | UUID | References user_activities |
| user_id | UUID | Message sender |
| message | TEXT | Message content |
| audio_url | TEXT | Voice note URL (optional) |
| created_at | TIMESTAMPTZ | Message timestamp |

#### `private_messages` (Direct Messages)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| sender_id | UUID | Sender's user ID |
| receiver_id | UUID | Receiver's user ID |
| message | TEXT | Message content |
| audio_url | TEXT | Voice note URL (optional) |
| read_at | TIMESTAMPTZ | When message was read |
| created_at | TIMESTAMPTZ | Message timestamp |

#### `greetings` (User Connections)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| from_user_id | UUID | User sending greeting |
| to_user_id | UUID | User receiving greeting |
| created_at | TIMESTAMPTZ | When greeting was sent |

> **Note:** Two-way greetings = "matched" users (can DM each other)

### Database Functions

| Function | Description |
|----------|-------------|
| `users_matched(user1, user2)` | Returns true if both users have greeted each other |
| `get_user_age(target_user_id)` | Calculates age from date_of_birth |
| `handle_new_user()` | Trigger: Creates profile records on signup |
| `handle_user_updated()` | Trigger: Syncs phone number changes |
| `update_updated_at_column()` | Trigger: Auto-updates updated_at field |

### Storage Buckets

| Bucket | Public | Purpose |
|--------|--------|---------|
| `avatars` | Yes | User profile pictures |
| `voice-notes` | Yes | Voice message audio files |

---

## 4. Component Reference

### Layout Components

| Component | File | Description |
|-----------|------|-------------|
| `IOSAppLayout` | `src/components/IOSAppLayout.tsx` | Main app shell with tab navigation |
| `IOSHeader` | `src/components/IOSHeader.tsx` | Top navigation bar |
| `IOSTabBar` | `src/components/IOSTabBar.tsx` | Bottom tab navigation |
| `Header` | `src/components/Header.tsx` | Desktop header (web version) |
| `Footer` | `src/components/Footer.tsx` | Desktop footer |

### Tab Components

| Component | File | Description |
|-----------|------|-------------|
| `HomeTab` | `src/components/ios/HomeTab.tsx` | Activity selection and joining |
| `PlansTab` | `src/components/ios/PlansTab.tsx` | View/create plans |
| `ChatTab` | `src/components/ios/ChatTab.tsx` | Message threads |
| `ProfileTab` | `src/components/ios/ProfileTab.tsx` | User profile settings |

### Dialog Components

| Component | File | Description |
|-----------|------|-------------|
| `ActivitySelectionDialog` | `src/components/ActivitySelectionDialog.tsx` | Choose activity to join |
| `CreateActivityDialog` | `src/components/CreateActivityDialog.tsx` | Create new plan |
| `GroupChatDialog` | `src/components/GroupChatDialog.tsx` | Activity group chat |
| `PlanGroupChatDialog` | `src/components/PlanGroupChatDialog.tsx` | Plan-specific chat |
| `PrivateChatDialog` | `src/components/PrivateChatDialog.tsx` | Direct messages |
| `UserProfileDialog` | `src/components/UserProfileDialog.tsx` | View user profiles |
| `ParticipantsListDialog` | `src/components/ParticipantsListDialog.tsx` | List activity participants |
| `PlansMapDialog` | `src/components/PlansMapDialog.tsx` | World map with activities |
| `PremiumDialog` | `src/components/PremiumDialog.tsx` | Premium subscription modal |
| `MyActivitiesDialog` | `src/components/MyActivitiesDialog.tsx` | User's joined activities |

### Feature Components

| Component | File | Description |
|-----------|------|-------------|
| `ActivityCard` | `src/components/ActivityCard.tsx` | Activity display card |
| `AvatarPicker` | `src/components/AvatarPicker.tsx` | Avatar selection grid |
| `BirthdayPicker` | `src/components/BirthdayPicker.tsx` | Date of birth input |
| `CitySelector` | `src/components/CitySelector.tsx` | City selection dropdown |
| `VoiceRecorder` | `src/components/VoiceRecorder.tsx` | Record voice messages |
| `AudioWaveform` | `src/components/AudioWaveform.tsx` | Audio playback visualization |
| `WorldMap` | `src/components/WorldMap.tsx` | Mapbox world map |
| `SayHiButton` | `src/components/SayHiButton.tsx` | Send greeting to user |
| `GreetingsIndicator` | `src/components/GreetingsIndicator.tsx` | Show greeting status |

### Animation Components

| Component | File | Description |
|-----------|------|-------------|
| `ShakingClockAnimation` | `src/components/ShakingClockAnimation.tsx` | Clock animation on activity join |
| `FlagsCarousel` | `src/components/FlagsCarousel.tsx` | Animated country flags |
| `PolaroidGallery` | `src/components/PolaroidGallery.tsx` | Landing page polaroid images |

---

## 5. API & Edge Functions

### Overview

All edge functions are deployed to Lovable Cloud and handle server-side logic that requires elevated permissions or external API calls.

### Function Reference

---

#### `check-subscription`

**Purpose:** Verify user's premium subscription status via Stripe.

**Endpoint:** `POST /functions/v1/check-subscription`

**Authentication:** Required (Bearer token)

**Request:** No body required

**Response:**
```json
{
  "subscribed": true,
  "subscription_end": "2026-02-17T00:00:00.000Z",
  "is_override": false
}
```

**Logic:**
1. Check `profiles_private.premium_override` flag first
2. If not overridden, query Stripe for active subscription
3. Sync subscription status back to database

---

#### `create-checkout`

**Purpose:** Create Stripe Checkout session for subscription purchase.

**Endpoint:** `POST /functions/v1/create-checkout`

**Authentication:** Required

**Request:**
```json
{
  "email": "user@example.com"  // Optional, if not on auth user
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/c/pay/..."
}
```

**Subscription:** $5/month for "Super-Human" premium

---

#### `customer-portal`

**Purpose:** Create Stripe Customer Portal session for subscription management.

**Endpoint:** `POST /functions/v1/customer-portal`

**Authentication:** Required

**Response:**
```json
{
  "url": "https://billing.stripe.com/session/..."
}
```

---

#### `delete-account`

**Purpose:** Permanently delete user account and all associated data.

**Endpoint:** `POST /functions/v1/delete-account`

**Authentication:** Required

**Process:**
1. Delete avatar files from storage
2. Delete voice notes from storage
3. Delete user from auth (cascades to profile tables)

**Response:**
```json
{
  "success": true
}
```

---

#### `send-sms-notification`

**Purpose:** Notify users via SMS when someone joins an activity in their city.

**Endpoint:** `POST /functions/v1/send-sms-notification`

**Authentication:** Required

**Request:**
```json
{
  "activityType": "lunch",
  "city": "New York",
  "joinerName": "Alex",
  "joinerUserId": "uuid-here"
}
```

**Logic:**
1. Find all users who have joined ANY activity in the same city
2. Filter by those with phone numbers and SMS enabled
3. Send SMS via Twilio

**Response:**
```json
{
  "success": true,
  "notified": 5,
  "failed": 0
}
```

---

#### `send-plan-sms`

**Purpose:** Send SMS notifications for plan-specific events.

**Endpoint:** `POST /functions/v1/send-plan-sms`

**Authentication:** Required

---

#### `elevenlabs-welcome`

**Purpose:** Generate AI voice welcome message using ElevenLabs.

**Endpoint:** `POST /functions/v1/elevenlabs-welcome`

**Requirements:** `ELEVENLABS_API_KEY` secret configured

---

### Custom Hooks Reference

| Hook | File | Purpose |
|------|------|---------|
| `useAuth` | `src/contexts/AuthContext.tsx` | Authentication state & methods |
| `useCity` | `src/contexts/CityContext.tsx` | Current city selection |
| `useActivityJoins` | `src/hooks/useActivityJoins.ts` | Join/leave activities |
| `useUserActivities` | `src/hooks/useUserActivities.ts` | CRUD for user plans |
| `useAllActivities` | `src/hooks/useAllActivities.ts` | Fetch all city activities |
| `useGreetings` | `src/hooks/useGreetings.ts` | Greeting/matching logic |
| `usePrivateMessages` | `src/hooks/usePrivateMessages.ts` | DM functionality |
| `useOnlinePresence` | `src/hooks/useOnlinePresence.ts` | User online status |
| `usePushNotifications` | `src/hooks/usePushNotifications.ts` | Push notification setup |
| `useAudioMessageLimit` | `src/hooks/useAudioMessageLimit.ts` | Voice message rate limiting |
| `useTextMessageLimit` | `src/hooks/useTextMessageLimit.ts` | Text message rate limiting |
| `useActivityMute` | `src/hooks/useActivityMute.ts` | Mute activity notifications |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_MAPBOX_PUBLIC_TOKEN` | Mapbox public token for maps |

### Backend Secrets (Edge Functions)

| Secret | Service |
|--------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Admin database access |
| `STRIPE_SECRET_KEY` | Stripe payments |
| `TWILIO_ACCOUNT_SID` | SMS notifications |
| `TWILIO_AUTH_TOKEN` | SMS authentication |
| `TWILIO_PHONE_NUMBER` | SMS sender number |
| `ELEVENLABS_API_KEY` | AI voice generation |

---

## Mobile Support (Capacitor)

The app supports iOS and Android via Capacitor:

- **Deep linking:** `shake://auth/callback` for OAuth
- **Native features:** Push notifications, browser integration
- **Build directories:** `android/`, `ios/`

---

## URLs

| Environment | URL |
|-------------|-----|
| Preview | https://id-preview--622356a6-809e-4fe3-9869-b09a7aff9eea.lovable.app |
| Production | https://shake-web-buddy.lovable.app |

---

*Generated by Lovable AI - January 17, 2026*
