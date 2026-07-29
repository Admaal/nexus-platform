import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const ensureAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      return session.user;
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    if (data.user) setUser(data.user);
    return data.user;
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await ensureAuth();
      } catch (error) {
        console.error("Error al iniciar sesión anónima:", error);
      } finally {
        if (!cancelled) setLoadingAuth(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [ensureAuth]);

  return (
    <AuthContext.Provider value={{ user, loadingAuth, ensureAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
