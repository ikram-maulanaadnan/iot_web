import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { storage } from './storage';
import type { User } from '@shared/schema';

// Configure passport local strategy
passport.use(new LocalStrategy(
  async (username: string, password: string, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      // Don't include password in session
      const { password: _, ...userWithoutPassword } = user;
      return done(null, userWithoutPassword);
    } catch (error) {
      return done(error);
    }
  }
));

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await storage.getUserById(id);
    if (!user) {
      return done(null, false);
    }
    
    // Don't include password
    const { password: _, ...userWithoutPassword } = user;
    done(null, userWithoutPassword);
  } catch (error) {
    done(error);
  }
});

// Middleware to check if user is authenticated
export function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  
  // For API routes, return JSON error
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // For other routes, redirect to login
  res.redirect('/login');
}

// Middleware to check if user is already authenticated (for login page)
export function redirectIfAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  next();
}

export default passport;
