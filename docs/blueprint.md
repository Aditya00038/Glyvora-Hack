# **App Name**: Glyvora

## Core Features:

- Meal Image Input: Enables users to upload meal images or capture them via camera, initiating the analysis process (with Tesseract.js as a fallback for OCR).
- AI Food Recognition & Glucose Prediction: Utilizes Gemini AI to detect food items from images and generate a predicted glucose spike *before* the meal, providing risk assessment.
- AI Spike Explanation & Swap Suggestion: Offers an AI-powered explanation of *why* a predicted glucose spike occurs and suggests an optimized alternative meal (swap) with a revised, improved prediction.
- AI Immediate Action Guidance: Provides context-aware immediate action recommendations (e.g., walking, hydration) to help mitigate predicted glucose spikes.
- Personalized User Profile & Settings: Manages basic user information and allows configuration of personal glucose sensitivity (low/medium/high) to tailor predictions.
- Historical Meal Tracking & Feedback: Stores a history of analyzed meals, including images, predictions, and risk badges, allowing users to review past decisions and provide feedback, powered by Firestore.
- Minimal Dashboard & Alerts: Presents a clean, high-level overview including current status (Stable/Risk), average spike, and immediate alerts to inform the user quickly.

## Style Guidelines:

- Primary color: Emerald Green (#10B981) for a fresh, health-focused, and premium brand identity.
- Background color: Dark Slate Blue (#0F172A), providing a sophisticated, minimalist backdrop suitable for a focused decision engine.
- Card background color: Slightly lighter Dark Grey Blue (#1E293B) to differentiate content blocks while maintaining a cohesive dark theme.
- Danger color: Red (#EF4444) to clearly and immediately highlight high-risk glucose predictions or critical information.
- Warning color: Amber (#F59E0B) for moderate risk indicators or actions requiring user attention without immediate alarm.
- Text colors: White and muted gray for optimal contrast and readability against dark backgrounds, promoting a clean user interface.
- Font: 'Inter' (sans-serif) for all text elements, ensuring excellent legibility across all screen sizes with a modern and objective feel. The font hierarchy aligns with the specified H1, H2, H3, Body, and Small guidelines for clarity and order.
- Icons: 'Lucide' icons are used for their clean, outline-based style, contributing to the premium aesthetic and facilitating quick visual comprehension of actions and information.
- Mobile-First Design: Layouts are designed vertically stacked for mobile, transitioning to a two-column grid on desktop, ensuring responsiveness across all devices. Consistent spacing (`xs: 4px` to `2xl: 48px`) and section spacing (`py-12 md:py-16`) are strictly adhered to for an organized, elderly-friendly interface.
- Cards: Feature 'rounded-2xl' corners, 'shadow-lg' for subtle depth, 'border border-slate-700' for clear delineation, and adaptive padding ('p-4' mobile, 'p-6' desktop).
- Subtle UI Transitions: Animations incorporating 'fade + scale' are used to create smooth, non-disruptive interactions, enhancing the premium feel without causing cognitive overload. Loading states will feature step-progress indicators like 'Analyzing meal...' to manage user expectations.