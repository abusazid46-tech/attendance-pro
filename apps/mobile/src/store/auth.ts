import { create } from "zustand";

type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
};

type AuthState = {
  user?: AuthUser;
  accessToken?: string;
  setSession: (user: AuthUser, accessToken: string) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  setSession: (user, accessToken) => set({ user, accessToken }),
  clear: () => set({ user: undefined, accessToken: undefined })
}));
