# GLYVORA - Feature Requirements (Web Platform)
**AI-powered glucose management and lifestyle guidance**

Last Updated: April 11, 2026

---

## 1. Product Scope

GLYVORA is a web-first Type-2 diabetes support platform focused on:
- personalized meal planning
- glucose and lifestyle logging
- AI-assisted coaching and food analysis
- caregiver-ready settings, notifications, and household context

This document tracks current scope and delivery status for the live Next.js codebase.

Legend:
- [x] Implemented and available in app
- [~] Partially implemented / in active iteration
- [ ] Planned

---

## 2. Core User Journey Requirements

### 2.1 Authentication & Account Bootstrap
- [x] Email/password registration and login
- [x] Google sign-in option on login
- [x] User profile initialization in Firestore during registration
- [x] Consent text for wellness guidance (non-medical disclaimer)

### 2.2 Onboarding & Personalization Inputs
- [x] Capture age, gender, height, weight
- [x] Capture activity level and meal timing
- [x] Capture dietary preference, allergies, medical conditions
- [x] Persist onboarding data to Firestore user profile
- [~] Expand onboarding to condition-specific risk scoring

### 2.3 Dashboard & Navigation
- [x] Personalized dashboard greeting
- [x] Quick access cards to My Menu, Logbook, Health Patterns, Barcode
- [x] Coach entry point and app-level navigation shell
- [x] Responsive sidebar/mobile adaptation

---

## 3. Clinical Logging & Monitoring Requirements

### 3.1 Logbook (Primary Tracking Module)
- [x] Multi-type health entries:
  - glucose
  - food
  - insulin
  - medications
  - vitals
  - exercise
- [x] Date-time aware entries with notes
- [x] Firestore persistence at `users/{uid}/logbookEntries`
- [x] Time-window filtering (7/30/90 day patterns)
- [x] Trend visualization and summary metric cards
- [x] Context-aware UI feedback/toasts on save and error

### 3.2 Health Patterns & Insights
- [x] Derive average glucose from user entries
- [x] Time-in-range and above-range indicators
- [x] Recommendations module with route to meal plan regeneration
- [~] Deeper statistical correlation (meal/exercise vs spikes)

---

## 4. Nutrition Intelligence Requirements

### 4.1 Meal Plan Generation (My Menu)
- [x] Generate 7-day AI-informed meal plan
- [x] Meal plan structure includes meals, macros, and day totals
- [x] Save generated plans to Firestore (`users/{uid}/mealPlans/current`)
- [x] Plan regeneration flow for optimization
- [~] Better explainability for why each meal was selected

### 4.2 Grocery List System
- [x] Generate grocery list from meal plan
- [x] Categorized grocery sections and flattened unique items view
- [x] Day-level filtering and selection
- [x] Print-friendly grocery output
- [x] Local checked-state persistence in browser storage

### 4.3 Food Analysis & Barcode Intelligence
- [x] Barcode lookup endpoint with external nutrition fetch
- [x] Offline/local fallback against bundled Indian food database
- [x] Health score and spike estimate response model
- [x] Barcode result caching in Firestore (`barcode_cache`)
- [x] Food photo analysis endpoint (Gemini vision)
- [~] Improve confidence scoring and serving-size normalization

---

## 5. AI Coach Requirements

### 5.1 Conversational Guidance
- [x] Chat API endpoint for user questions
- [x] Context-aware responses using user profile + recent logs
- [x] Specialized short-form structured response for food spike questions
- [x] Fallback response mode when AI flow fails
- [x] Optional response translation path (Google translate endpoint usage)

### 5.2 GenAI Orchestration
- [x] Server action wrapper to call metabolic coach flow
- [x] Conversation history support
- [x] User context synthesis (trend, top foods, profile)
- [x] Flow integration via Genkit

### 5.3 Prompt Flow Inventory (AI Module)
- [x] AI metabolic coach
- [x] Metabolic meal plan generation
- [x] Grocery list generation from plan
- [x] Spike explanation and safer swap flow (module exists)
- [x] Metabolic insights generation flow (module exists)
- [~] Ensure every flow has clear UI invocation and telemetry

---

## 6. Communication, Settings, and Household Requirements

### 6.1 Settings & Integrations
- [x] Integrations tab with Telegram handle capture
- [x] WhatsApp placeholder UX marked coming soon
- [x] Notifications controls and thresholds
- [x] Household context capture and persistence

### 6.2 Notifications
- [x] Dedicated notifications page with phone and glucose thresholds
- [x] Twilio-backed welcome SMS API endpoint
- [~] Event-driven alerts for low/high glucose on new log entries

### 6.3 Household Support
- [x] Freeform household context input for care-aware recommendations
- [ ] Shared caregiver portal and role-based permissions

---

## 7. Platform, Reliability, and Security Requirements

### 7.1 PWA / Offline Behavior
- [x] Web app manifest for installable experience
- [x] Service worker with offline fallback page
- [x] Caching strategy for local food database and core assets
- [~] Full offline queue/replay for writes (currently limited)

### 7.2 Data & Security
- [x] Firebase Authentication for identity
- [x] Firestore for user-scoped data collections
- [x] Environment variable based API secrets usage
- [x] Firestore rules present in repo for backend access control
- [ ] End-to-end audit trail for all AI-generated suggestions

### 7.3 Payments / Upgrade
- [x] Razorpay order creation API endpoint
- [~] Complete paid plan lifecycle (verify payment, entitlements, renewal)

---

## 8. Technical Stack (Current)

| Layer | Stack |
|---|---|
| Frontend Framework | Next.js 15.5.9 (App Router, Turbopack dev) |
| UI Runtime | React 19 + TypeScript 5 |
| Styling | Tailwind CSS + tailwindcss-animate + custom design tokens |
| Component System | Radix UI primitives + custom component library |
| Forms & Validation | react-hook-form, @hookform/resolvers, zod |
| Data Visualization | recharts |
| Motion & UX | framer-motion, embla-carousel-react |
| Authentication | Firebase Authentication |
| Database | Firebase Firestore |
| Server Actions / APIs | Next.js Route Handlers + Server Actions |
| AI Orchestration | Genkit + @genkit-ai/google-genai |
| LLM / Vision Provider | Google Gemini (text + image analysis routes) |
| On-device/Local ML Utilities | @tensorflow/tfjs (project dependency) |
| Barcode/Scan Utilities | @zxing/browser + OpenFoodFacts lookup + local fallback DB |
| Messaging | Twilio SMS API integration |
| Payments | Razorpay order API |
| PWA | Manifest + service worker (`public/sw.js`) |
| Build & Tooling | npm scripts, TypeScript, PostCSS |

---

## 9. Data Collections (Firestore)

Primary collections currently used by app flows:
- `users/{uid}`
- `users/{uid}/logbookEntries`
- `users/{uid}/mealPlans`
- `users/{uid}/barcode_cache`

Legacy or parallel collection usage may still exist in specific actions/routes and should be consolidated in a schema cleanup milestone.

---

## 10. Delivery Backlog (High Priority)

### P0
- [ ] Unified data schema cleanup (`logbook` vs `logbookEntries` consistency)
- [ ] Payment verification and subscription entitlement enforcement
- [ ] Robust AI guardrails and clinical safety response policy

### P1
- [ ] End-to-end offline write queue and sync conflict handling
- [ ] Improve AI explainability for spike estimates and meal recommendations
- [ ] Automated alerts from thresholds and pattern triggers

### P2
- [ ] Caregiver-specific household permissions UI
- [ ] Export/shareable health summary reports
- [ ] Enhanced multilingual support across all assistant and dashboard surfaces

---

## 11. Acceptance Criteria Snapshot

The platform is considered release-ready for current milestone when:
- [x] users can register/login and complete onboarding
- [x] users can log glucose and related health events
- [x] users can generate meal plans and grocery lists
- [x] users can query coach and receive contextual responses
- [x] users can scan/lookup food via barcode and image routes
- [~] production-grade reliability and subscription workflow are completed

---

GLYVORA | Team Parivartan | 2026
