# Google OAuth Setup Guide

This guide will help you set up Google OAuth authentication for your Mermaid Editor application.

## Prerequisites

- Google Cloud Console account
- Access to your application's domain (for production)

## Step 1: Create Google OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **+ CREATE CREDENTIALS** > **OAuth 2.0 Client IDs**
5. Configure the consent screen if prompted:
   - Choose **External** for user type
   - Fill in required app information
   - Add your email as test user during development
6. Create the OAuth 2.0 Client ID:
   - Select **Web application**
   - Name: `Mermaid Editor` (or your preferred name)
   - Authorized JavaScript origins:
     - Development: `http://localhost:4025`
     - Production: `https://yourdomain.com`
   - Authorized redirect URIs:
     - Development: `http://localhost:4025/api/auth/callback/google`
     - Production: `https://yourdomain.com/api/auth/callback/google`

## Step 2: Update Environment Variables

1. Copy the **Client ID** and **Client Secret** from Google Cloud Console
2. Update your `.env` file:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_actual_google_client_id_here
GOOGLE_CLIENT_SECRET=your_actual_google_client_secret_here
```

## Step 3: Restart Your Application

After updating the environment variables, restart your development server:

```bash
npm run dev
```

## Step 4: Test the Integration

1. Navigate to `http://localhost:4025/login`
2. Click "Continue with Google" button
3. Complete the Google sign-in flow
4. You should be redirected to the editor page

## Features Implemented

### ✅ Database Schema Updates
- Added `googleId`, `name`, and `image` fields to users table
- Made `password` field optional to support OAuth-only users

### ✅ Authentication Configuration
- Google OAuth provider configured in NextAuth
- Automatic user creation for new Google users
- Account linking for existing email users

### ✅ User Interface Updates
- Google sign-in buttons added to login and signup pages
- Styled to match Material-UI design system
- Proper error handling and loading states

### ✅ User Management
- Automatic profile picture and name import from Google
- Seamless integration with existing authentication flow
- Support for both email/password and Google OAuth

## Account Linking Behavior

- **New users**: Create a new account with Google profile data
- **Existing email users**: Link Google account to existing profile
- **Existing Google users**: Sign in directly without creating duplicate accounts

## Security Considerations

- Google OAuth tokens are validated by NextAuth
- User data is stored securely in your database
- No sensitive information is exposed to the client

## Troubleshooting

### Common Issues

1. **"redirect_uri_mismatch" error**
   - Ensure the redirect URI in Google Console matches exactly
   - Check for trailing slashes or protocol differences

2. **"invalid_client" error**
   - Verify your Client ID and Client Secret are correct
   - Ensure environment variables are properly loaded

3. **Database constraint errors**
   - Run `npm run db:push` to update schema
   - Check for existing users with duplicate emails

### Debug Mode

To enable debug logging, add to your `.env`:

```env
NEXTAUTH_DEBUG=true
```

## Production Deployment

For production deployment:

1. Update authorized origins and redirect URIs in Google Console
2. Set `NEXTAUTH_URL` to your production domain
3. Ensure HTTPS is enabled (required for OAuth)
4. Test the complete flow in production environment

## Support

If you encounter any issues:

1. Check the browser console for error messages
2. Verify environment variables are correctly set
3. Ensure Google OAuth configuration matches your application URLs
4. Review NextAuth.js documentation for advanced configurations
