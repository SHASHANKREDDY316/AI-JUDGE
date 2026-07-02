# AI Judge - Gmail OAuth Setup Guide

## Overview
Your AI Judge application now has **real Gmail OAuth login** functionality integrated using Google OAuth 2.0. This replaces the demo login with secure Google authentication.

## Setup Instructions

### 1. Environment Configuration

The Google Client ID is already configured in your `.env` file:

```bash
# frontend/.env
VITE_GOOGLE_CLIENT_ID=682562373075-5j5i008hogc0bqooh596a4ebspshbenc.apps.googleusercontent.com
```

### 2. Install Dependencies

Make sure you have the required OAuth package installed:

```bash
cd frontend
npm install
```

The `@react-oauth/google` package is already listed in `package.json`.

### 3. Backend Configuration

No changes needed to the backend. The authentication is handled on the frontend, and the backend will receive requests from authenticated users.

### 4. Running the Application

#### Start Frontend (with hot reload):
```bash
cd frontend
npm run dev
```

#### Start Backend:
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Visit: `http://localhost:5173` (or the URL shown in terminal)

## Features

### Login Flow
1. User clicks "Sign in with Google"
2. Google authentication popup appears
3. User authenticates with their Gmail account
4. User information is decoded from JWT token:
   - Email
   - Full Name
   - Profile Picture (optional)
5. User is redirected to the case management dashboard

### User Info Display
- Email is shown in the top navigation bar
- User name is used in Jitsi Meet meeting rooms
- Logout button available in the header

### Security
- Uses Google's secure OAuth 2.0 authentication
- JWT tokens are decoded client-side
- No passwords are stored in your application
- User session persists until logout

## Key Files Modified

1. **frontend/src/App.jsx**
   - Added `handleGoogleLoginSuccess()` - JWT decoding and user state management
   - Added `handleGoogleLoginError()` - Error handling
   - Added `handleLogout()` - Session termination
   - Replaced demo form with `<GoogleLogin />` component
   - Updated meeting room to use actual user name

2. **frontend/src/main.jsx**
   - Already configured with `GoogleOAuthProvider`
   - Reads Client ID from environment variable

3. **frontend/src/styles.css**
   - Added `.google-login-container` styling
   - Added `.user-info` display styling
   - Responsive design for mobile

4. **frontend/.env**
   - Google Client ID configured

## Testing

### Test Login:
1. Navigate to http://localhost:5173
2. Click "Sign in with Google"
3. Use any Gmail account to authenticate
4. Verify you're redirected to case management dashboard
5. Check that your email appears in the header

### Test Logout:
1. Click "Logout" button in header
2. Verify you're redirected back to login page

### Test Case Management:
1. After login, you can create, view, and manage cases
2. Start an online meeting - your Gmail name will appear as the user
3. Upload evidence and add hearing transcripts

## Troubleshooting

### "Google is not defined" error
- Make sure the `<script src="https://meet.jit.si/external_api.js"></script>` in `index.html` is present
- The Google OAuth library is loaded by the `GoogleOAuthProvider` wrapper

### Login button not appearing
- Verify `VITE_GOOGLE_CLIENT_ID` is set in `.env`
- Restart the frontend dev server after changing `.env`

### "credentialResponse is null"
- Check that the Client ID is valid
- Ensure you're accessing from `localhost:5173` (or configured domain)

### Backend connection errors
- Ensure backend is running: `uvicorn app.main:app --reload`
- Backend should be on `http://127.0.0.1:8000`
- Check CORS is enabled in backend

## Security Notes

⚠️ **Important:**
- Never commit `.env` files with real credentials to public repositories
- Add `.env` to `.gitignore` (already in place)
- The Client ID shown is safe to commit to public repos (it's meant to be public)
- For production, set up proper environment variables in your deployment platform

## Next Steps

### Optional Enhancements:
1. Store user sessions in backend database
2. Associate cases with user accounts
3. Add user profile management
4. Implement email notifications using Gmail API
5. Add role-based access control (admin, judge, clerk)

### Production Deployment:
1. Update authorized redirect URIs in Google Cloud Console
2. Switch from `localhost:5173` to your production domain
3. Set environment variables securely in deployment platform
4. Enable HTTPS/SSL certificate
5. Configure CORS for production domain

## Support

For issues with Google OAuth:
- Check [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- Review [@react-oauth/google docs](https://www.npmjs.com/package/@react-oauth/google)

For AI Judge specific questions:
- Review the case management features in the sidebar
- Check backend API documentation at `http://localhost:8000/docs`
