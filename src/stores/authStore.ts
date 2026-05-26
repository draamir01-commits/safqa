import { create } from "zustand";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/config";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  listenToAuthChanges: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  listenToAuthChanges: () => {
    set({ loading: true });
    // Connect listener to Firebase Auth triggers
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      set({ user, loading: false });
    }, (error) => {
      set({ error: error.message, loading: false });
    });
    return unsubscribe;
  }
}));
