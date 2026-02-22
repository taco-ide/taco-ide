"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth";

// User interface
export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
  isActive: boolean;
  activeOrganizationId: string | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch user data from API
  const fetchUser = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Use Better Auth session
      const session = await authClient.getSession();

      if (!session.data?.user) {
        setUser(null);
        return;
      }

      // Get additional user data from our API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
      const response = await fetch(`${apiUrl}/v1/users/me`, {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          setUser(null);
          return;
        }

        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao buscar dados do usuário");
      }

      const data = await response.json();
      setUser(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      console.error("Erro ao buscar usuário:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to clear user data (logout)
  const clearUser = () => {
    setUser(null);
  };

  // Function to logout
  const logout = async () => {
    try {
      setIsLoading(true);

      // Use Better Auth signOut
      await authClient.signOut();

      // Clear user data in state
      clearUser();

      // Redirect to login page
      router.push("/auth/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      console.error("Erro ao fazer logout:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to get user's first name
  const getFirstName = (): string => {
    if (!user || !user.name) return "Usuário";
    return extractFirstName(user.name);
  };

  // Fetch user on component mount
  useEffect(() => {
    fetchUser();
  }, []);

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
