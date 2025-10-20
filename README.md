# The Woman's Circle - Complete PWA

A modern Progressive Web App (PWA) with full-stack authentication, built with React + Vite frontend and Express.js + MongoDB backend.

## Features

### Frontend (PWA)
- 🚀 **PWA Support**: Installable with service worker and offline capabilities
- 🎨 **Modern UI**: Clean design with Tailwind CSS
- 📱 **Mobile-First**: Responsive design optimized for all devices
- ⚡ **Fast**: Built with Vite for optimal performance
- 🎭 **Animations**: Smooth splash screen transitions
- ♿ **Accessible**: WCAG compliant with proper ARIA labels
- 🔄 **Remember Me**: Persistent login with localStorage
- 🎯 **Dev Login**: Built-in dev credentials (dev/password)

### Backend (API)
- 🔐 **JWT Authentication**: Secure token-based authentication
- 👥 **User Management**: Registration, profiles, password changes
- 🎫 **Invitation System**: Invitation code required for registration
- 🛡️ **Security**: Rate limiting, CORS, input validation
- 📊 **MongoDB**: Scalable user data storage
- 🚀 **Railway Ready**: Configured for easy deployment

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- MongoDB database (local or cloud)

### Frontend Setup

1. **Install frontend dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Test the app:**
   - Navigate to `http://localhost:5173`
   - Use dev credentials: `dev` / `password`
   - Or create an account with invitation code: `INVITE2024`

### Backend Setup

1. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp env.example .env
   # Edit .env with your database URL and JWT secret
   ```

3. **Start backend server:**
   ```bash
   npm run dev
   ```

Backend will run on `http://localhost:3000` with full API endpoints.

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## PWA Features

### Installation
- The app is installable on desktop and mobile devices
- Look for the "Install W App" button on the login screen
- Or use your browser's install prompt

### Service Worker
- Automatically updates when new versions are available
- Provides offline functionality
- Caches essential app resources

### Lighthouse PWA Audit
The app passes all Lighthouse PWA audits except HTTPS (which requires deployment):
- ✅ Web App Manifest
- ✅ Service Worker
- ✅ Installable
- ✅ Splash Screen
- ✅ Themed Address Bar
- ⚠️ HTTPS (only on deployed sites)

## Deployment

### Frontend Deployment

#### Netlify
1. **Build and deploy:**
   ```bash
   npm run build
   # Upload the 'dist' folder to Netlify
   ```

2. **Or connect your Git repository:**
   - Build command: `npm run build`
   - Publish directory: `dist`

#### Vercel
1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   npm run build
   vercel --prod
   ```

#### Cloudflare Pages
- Build command: `npm run build`
- Build output directory: `dist`

### Backend Deployment (Railway)

#### Required Railway Services
1. **MongoDB Database**: Add from Railway marketplace
2. **Backend API**: Connect GitHub repository

#### Environment Variables (Railway)
Set these in your Railway backend service:

```bash
# Required
JWT_SECRET=your-32-character-secret-key
VALID_INVITATION_CODES=INVITE2024,SPECIAL_ACCESS
NODE_ENV=production

# Auto-provided by Railway MongoDB
MONGODB_URI=mongodb+srv://...
```

#### Railway Setup
1. Create account at [railway.app](https://railway.app)
2. New Project → Deploy from GitHub → Select backend folder
3. Add MongoDB service from marketplace
4. Configure environment variables
5. Auto-deploys on GitHub pushes

**Backend URL**: `https://thewomenscirclebackend-production.up.railway.app`

See `backend/README.md` for detailed Railway deployment guide.

## Project Structure

```
src/
├── components/
│   ├── Splash.tsx      # Animated splash screen
│   └── Login.tsx       # Login form with validation
├── App.tsx             # Main app component with routing
├── main.tsx            # App entry point + SW registration
└── index.css           # Tailwind CSS + custom animations

public/
├── icons/              # PWA icons (192, 512, maskable)
│   ├── pwa-192.png
│   ├── pwa-512.png
│   └── maskable-512.png
└── ...

Configuration:
├── vite.config.ts      # Vite + PWA plugin config
├── tailwind.config.js  # Tailwind CSS config
├── tsconfig.json       # TypeScript config
└── package.json        # Dependencies and scripts
```

## Development

### Key Components

- **Splash.tsx**: Displays animated W logo for 1.4s then transitions to login
- **Login.tsx**: Form with email/password validation and PWA install prompt
- **App.tsx**: Simple state-based routing between splash and login

### Customization

- **Colors**: Update `#ebdfdf` throughout the app for different branding
- **Logo**: Modify the SVG W logo in both components
- **Animations**: Adjust timing in `src/index.css` and component logic

### PWA Configuration

The PWA is configured in `vite.config.ts`:
- Auto-update service worker
- Custom icons and manifest
- Offline support for essential resources

## Browser Support

- ✅ Chrome 88+
- ✅ Firefox 85+
- ✅ Safari 14+
- ✅ Edge 88+

## License

MIT License - feel free to use this project as a starting point for your own PWA!

## Next Steps

- Add authentication backend integration
- Implement actual user registration
- Add more pages and features
- Enhance offline functionality
- Add push notifications
