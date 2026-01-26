import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase, isAdmin, getSession } from '@/services/supabase';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Users } from '@/pages/Users';
import { UserDetail } from '@/pages/UserDetail';
import { Layout } from '@/components/Layout';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    const checkSession = async () => {
      const { user: sessionUser } = await getSession();
      if (sessionUser) {
        const adminStatus = await isAdmin(sessionUser);
        setUser(sessionUser);
        setIsAdminUser(adminStatus);
      }
      setLoading(false);
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const adminStatus = await isAdmin(session.user);
        setUser(session.user);
        setIsAdminUser(adminStatus);
      } else {
        setUser(null);
        setIsAdminUser(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user && isAdminUser ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/"
          element={
            user && isAdminUser ? (
              <Layout user={user}>
                <Dashboard />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/users"
          element={
            user && isAdminUser ? (
              <Layout user={user}>
                <Users />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/users/:userId"
          element={
            user && isAdminUser ? (
              <Layout user={user}>
                <UserDetail />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
