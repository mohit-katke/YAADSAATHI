# YaadSaathi (यादसाथी)

YaadSaathi is an **offline-first Progressive Web Application (PWA)** prototype designed to provide elderly-friendly cognitive assistance and monitoring for dementia care in the North Eastern Region of India.

This is a **Smart India Hackathon presentation prototype** using local/demo data. It is **not a medical product** and does not provide diagnosis or replace healthcare professionals.

## Key Features

- Elderly-friendly cognitive assistance UI
- Patient, Caregiver, and Doctor dashboards
- Email/Mobile + password authentication
- 8-character minimum password validation
- Multi-step user registration
- Role-based navigation
- Memory Match cognitive game
- Session score and accuracy tracking
- Reaction-time tracking
- Adaptive difficulty demonstration
- Caregiver activity and reminder dashboard
- Doctor session history and latency visualization
- Text and voice language selection
- English, Hindi, and Assamese language support
- Persistent language preferences
- Browser-based voice assistance
- Offline-first PWA architecture
- IndexedDB local persistence
- Offline session and telemetry queue
- Service Worker caching
- Future-ready Firebase/Firestore synchronization architecture

## Offline-First Architecture

YaadSaathi is **not described as a "100% offline website."**

The technically correct description is:

> **Offline-first PWA with 100% offline core functionality.**

Initial access or installation may require an internet connection so that the application and required assets can be loaded and cached.

After the PWA has been successfully cached/installed, the core patient experience can continue without an internet connection.

### Architecture

```text
FIRST-TIME ACCESS

Internet Available
        ↓
YaadSaathi PWA Loads
        ↓
Service Worker Registers
        ↓
Core Assets Cached
        ↓
PWA Ready for Offline Use


OFFLINE SESSION

Internet Lost
        ↓
Cached PWA Loads
        ↓
React Application Runs Locally
        ↓
IndexedDB
        ↓
Game / Session / Progress Data
        ↓
Offline Experience Continues


WHEN INTERNET RETURNS

Internet Available
        ↓
IndexedDB Sync Queue
        ↓
Synchronization Layer
        ↓
Firebase / Firestore
        ↓
Cloud Data Updated