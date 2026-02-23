"use client";

import {
  createContext,
  useContext,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth";
import { useGetV1UsersMe } from "@/kubb/hooks";

// User interface
export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  isActive: boolean;
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

  const {
    data,
    isLoading,
    error: queryError,
    refetch,
    isError,
  } = useGetV1UsersMe({
    query: {
      retry: (failureCount, error) => {
        const err = error as { status?: number } | undefined;
        if (err && typeof err === "object" && typeof err.status === "number") {
          return err.status !== 401;
        }
        return failureCount < 3;
      },
    },
  });

  const is401 =
    isError &&
    queryError &&
    typeof queryError === "object" &&
    "status" in queryError &&
    (queryError as { status?: number }).status === 401;
  const user = is401 ? null : (data?.data ?? null);
  const error = queryError
    ? (queryError instanceof Error ? queryError.message : "Erro desconhecido")
    : null;

  const fetchUser = async () => {
    await refetch();
  };

  const clearUser = () => {
    // No-op: user state comes from the query
  };

  const logout = async () => {
    try {
      await authClient.signOut();
      await refetch();
      router.push("/auth/login");
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    }
  };

  const getFirstName = (): string => {
    if (!user || !user.name) return "Usuário";
    return extractFirstName(user.name);
  };

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
