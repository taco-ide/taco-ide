"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth";
import {
  useGetV1UsersMe,
  getV1UsersMeQueryKey,
} from "@/kubb/hooks/usersHooks/useGetV1UsersMe";

// User interface
export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
  isActive: boolean;
  activeOrganizationId: string | null;
  activeOrganizationName: string | null;
  role: string | null;
}

// Context interface
interface UserContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  fetchUser: () => Promise<void>;
  clearUser: () => void;
  getFirstName: () => string;
  logout: () => Promise<void>;
}

// Function to extract first name
const extractFirstName = (fullName?: string): string => {
  if (!fullName) return "Usuário";
  return fullName.split(" ")[0];
};

// Create context with default value
const UserContext = createContext<UserContextType>({
  user: null,
  isLoading: false,
  error: null,
  fetchUser: async () => {},
  clearUser: () => {},
  getFirstName: () => "Usuário",
  logout: async () => {},
});

// Custom hook to use context
export const useUser = () => useContext(UserContext);

// Context provider
export const UserProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Session check to enable the query only when authenticated
  const [hasSession, setHasSession] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    authClient.getSession().then((s) => {
      setHasSession(!!s.data?.user);
      setSessionChecked(true);
    });
  }, []);

  const {
    data,
    isPending,
    error: queryError,
    refetch,
  } = useGetV1UsersMe({
    query: {
      enabled: sessionChecked && hasSession,
    },
  });

  // Map React Query state to the existing interface
  const user: User | null = data?.data ?? null;
  const isLoading = !sessionChecked || (hasSession && isPending);
  const error = queryError ? queryError.message ?? "Erro desconhecido" : null;

  const fetchUser = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const clearUser = useCallback(() => {
    queryClient.removeQueries({ queryKey: getV1UsersMeQueryKey() });
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await authClient.signOut();
      clearUser();
      router.push("/auth/login");
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    }
  }, [clearUser, router]);

  const getFirstName = useCallback((): string => {
    if (!user || !user.name) return "Usuário";
    return extractFirstName(user.name);
  }, [user]);

  return (
    <UserContext.Provider
      value={{
        user,
        isLoading,
        error,
        fetchUser,
        clearUser,
        getFirstName,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
