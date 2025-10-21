# Performance Issues & Freezing - Root Cause Analysis

## Executive Summary
The app is experiencing severe freezing issues on mobile devices due to **lack of list virtualization**, **memory leaks from uncleaned timers**, and **excessive animations**. These issues compound over time as users interact with the chat features.

## Critical Issues Identified

### 1. ⚠️ NO LIST VIRTUALIZATION (MOST CRITICAL)
**Location:** `src/components/Chat.tsx` (line 1746) and `src/components/Gala.tsx` (line 975)

**Problem:**
```typescript
{messages.map((message, index) => (
  // Renders EVERY message in the DOM
))}
```

**Impact:**
- Initial load: 20 messages rendered
- After "Load More" clicks: Can have 100s of messages ALL rendered simultaneously
- Each message has:
  - Complex DOM structure
  - Image carousels with AnimatePresence
  - Reaction buttons
  - Context menus
  - Touch handlers
- Mobile browsers struggle to render 100+ complex DOM nodes
- **EVERY state update re-renders ALL messages**

**Solution Required:**
- Implement `react-window` or `react-virtual` for message virtualization
- Only render messages visible in viewport + buffer
- Drastically reduces DOM nodes from 100s to ~10-15

---

### 2. ⚠️ MEMORY LEAKS FROM TIMEOUTS
**Location:** Chat.tsx has 12 uncleaned setTimeout calls

**Problem Examples:**
```typescript
// Line 222 - No cleanup
setTimeout(() => {
  requestAnimationFrame(() => scrollToBottom())
}, 50)

// Line 353 - No cleanup
setTimeout(() => {
  requestAnimationFrame(() => scrollToBottom())
}, 100)

// Line 1798 - No cleanup in event handler
setTimeout(() => setShowImageHint(null), 3000)
```

**Impact:**
- Timeouts continue running after component unmounts
- Attempts to update state on unmounted components
- Memory accumulates with each interaction
- Console warnings → performance degradation → freezing

**Solution Required:**
- Store timeout IDs in refs
- Clear all timeouts in useEffect cleanup
- Use cleanup pattern:
```typescript
useEffect(() => {
  const timers: NodeJS.Timeout[] = []
  
  const safeSetTimeout = (fn: () => void, delay: number) => {
    const timer = setTimeout(fn, delay)
    timers.push(timer)
    return timer
  }
  
  return () => timers.forEach(clearTimeout)
}, [])
```

---

### 3. ⚠️ INCOMPLETE SOCKET EVENT CLEANUP
**Location:** `src/components/Chat.tsx` lines 250-259

**Problem:**
```typescript
return () => {
  newSocket.off('connect')
  newSocket.off('disconnect')
  newSocket.off('new-message')
  newSocket.off('message-reaction')
  newSocket.off('message-deleted')
  // ❌ MISSING: newSocket.off('message-edited')
  newSocket.disconnect()
}
```

**Impact:**
- 'message-edited' listener remains active after unmount
- Duplicate listeners accumulate on remount
- Memory leak + potential duplicate message updates

**Solution:** Add `newSocket.off('message-edited')` to cleanup

---

### 4. ⚠️ EXCESSIVE FRAMER-MOTION ANIMATIONS
**Locations:** 419 instances across 17 components

**Problem:**
- Every message has AnimatePresence for carousels
- Every button has hover/tap animations
- Every modal has enter/exit animations
- All running simultaneously on low-end mobile devices

**Impact:**
- Layout thrashing from constant animation calculations
- GPU overload on mobile
- Janky scrolling and interactions

**Solution:**
- Remove AnimatePresence from message lists
- Use CSS transitions for simple animations
- Disable animations on low-end devices:
```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
```

---

### 5. SERVICE WORKER CONFLICTS
**Location:** `vite.config.ts` + `public/sw.js`

**Problem:**
```typescript
// vite.config.ts - VitePWA with Workbox
VitePWA({
  registerType: 'autoUpdate',
  workbox: { ... }
})

// Also manually registering /sw.js for push notifications
navigator.serviceWorker.register('/sw.js')
```

**Impact:**
- Two service workers competing for control
- Unpredictable caching behavior
- App may reload unexpectedly
- skipWaiting: false conflicts with autoUpdate

**Solution:**
- Use single service worker
- Extend VitePWA's workbox to handle push notifications
- OR disable VitePWA's service worker and use only custom one

---

### 6. COMPONENT MOUNTING STRATEGY
**Location:** `src/App.tsx` lines 256-307

**Problem:**
```typescript
{!showSplash && currentScreen === 'admin-dashboard' && <AdminDashboard />}
{!showSplash && currentScreen === 'meet-the-circle' && <MeetTheCircle />}
{!showSplash && currentScreen === 'profile-settings' && <ProfileSettings />}
{!showSplash && currentScreen === 'photo-gallery' && <PhotoGallery />}
{!showSplash && currentScreen === 'gala' && <Gala />}
{!showSplash && currentScreen === 'app-settings' && <AppSettings />}
{!showSplash && currentScreen === 'announcements' && <Announcements />}
{!showSplash && currentScreen === 'events' && <Events />}
{!showSplash && currentScreen === 'chat' && <Chat />}
```

**Impact:**
- Components stay mounted but hidden (React keeps them in VDOM)
- Only Login/Home use AnimatePresence for proper unmounting
- All other screens remain in memory when switching
- Accumulates memory especially with Chat/Gala socket connections

**Solution:**
- Wrap all screens in AnimatePresence OR
- Use proper routing library (React Router)

---

### 7. REACT.STRICTMODE IN PRODUCTION
**Location:** `src/main.tsx` line 7

**Problem:**
```typescript
<React.StrictMode>
  <App />
</React.StrictMode>
```

**Impact:**
- StrictMode intentionally double-mounts components in development
- Should NOT be in production builds
- Can mask cleanup issues during development
- Extra renders reduce performance

**Solution:**
- Only use StrictMode in development
- Remove for production or conditionally apply

---

### 8. LONGPRESSTIMER STATE CLEANUP
**Location:** `src/components/Chat.tsx` line 116

**Problem:**
```typescript
const [longPressTimer, setLongPressTimer] = useState<number | null>(null)
```

**Impact:**
- Timer stored in state but no cleanup on unmount
- If component unmounts while timer is active, it keeps running
- Attempts to call state updates on unmounted component

**Solution:**
- Store in ref instead of state
- Cleanup in useEffect unmount

---

## Recommended Fix Priority

### Immediate (Today):
1. ✅ Add message list virtualization (Chat + Gala)
2. ✅ Fix all setTimeout cleanup issues
3. ✅ Add missing socket event cleanup

### High Priority (This Week):
4. ✅ Remove AnimatePresence from message lists
5. ✅ Fix service worker conflicts
6. ✅ Fix longPressTimer cleanup

### Medium Priority:
7. ✅ Refactor App.tsx component mounting
8. ✅ Remove React.StrictMode from production

### Additional Recommendations:
- Add error boundaries to prevent cascading failures
- Implement performance monitoring (Web Vitals)
- Add loading states to prevent user interaction during heavy operations
- Consider implementing message pagination that REMOVES old messages from state

---

## Testing Checklist After Fixes

- [ ] Open app and let it sit for 5 minutes - no freezing
- [ ] Navigate between screens multiple times - smooth transitions
- [ ] Load 100+ messages in chat - smooth scrolling
- [ ] Background → Foreground app 10 times - no issues
- [ ] Monitor Chrome DevTools Memory tab - no memory growth
- [ ] Check Console - no "Can't perform state update on unmounted component" warnings
- [ ] Test on actual low-end Android device (not just emulator)
- [ ] Leave app open overnight - still responsive next day

---

Generated: October 21, 2025

