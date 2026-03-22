"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth";
import {
  useGetV1UsersMe,
  getV1UsersMeQueryKey,
} from "@/kubb/hooks";

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
  const user: User | null = is401 ? null : (data?.data ?? null);
  const error = queryError && !is401
    ? (queryError instanceof Error ? queryError.message : "Erro desconhecido")
    : null;

  /** Better Auth deixa `activeOrganizationId` null até `organization.setActive`; o seed só cria `member`. */
  const autoActiveOrgAttempted = useRef(false);

  useEffect(() => {
    if (is401 || !user) {
      autoActiveOrgAttempted.current = false;
    }
  }, [is401, user]);

  useEffect(() => {
    if (isLoading || is401 || !user?.id || user.activeOrganizationId) return;
    if (autoActiveOrgAttempted.current) return;
    autoActiveOrgAttempted.current = true;

    void (async () => {
      try {
        const { data: orgs, error: listError } =
          await authClient.organization.list();
        if (listError || !orgs?.length) return;

        const first = orgs[0];
        if (!first?.id) return;

        const { error: setError } = await authClient.organization.setActive({
          organizationId: first.id,
        });
        if (!setError) {
          await refetch();
        }
      } catch (e) {
        console.warn("Não foi possível definir organização ativa:", e);
        autoActiveOrgAttempted.current = false;
      }
    })();
  }, [
    isLoading,
    is401,
    user?.id,
    user?.activeOrganizationId,
    refetch,
  ]);

  const fetchUser = async () => {
    await refetch();
  };

  const clearUser = () => {
    queryClient.removeQueries({ queryKey: getV1UsersMeQueryKey() });
  };

  const logout = async () => {
    try {
      await authClient.signOut();
      clearUser();
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
