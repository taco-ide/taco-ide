"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authClient, useSession } from "@/lib/auth";
import { ApiError } from "@/lib/apiClient";
import { authPageHref } from "@/lib/safe-redirect";
import { useGetV1InvitationsId } from "@/kubb/hooks";

const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;

const KNOWN_ROLES = ["student", "teacher", "coordinator", "admin"] as const;
type KnownRole = (typeof KNOWN_ROLES)[number];

function isKnownRole(role: string): role is KnownRole {
  return (KNOWN_ROLES as readonly string[]).includes(role);
}

function StateMessage({
  title,
  description,
  children,
}: {
  title: string;
  description: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6" data-testid="accept-invitation-state">
      <div className="flex flex-col items-center text-center gap-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-balance text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function AcceptInvitation() {
  const t = useTranslations("acceptInvitation");
  const format = useFormatter();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const invitationId = searchParams.get("id") ?? "";

  const session = useSession();
  const invitationQuery = useGetV1InvitationsId(
    encodeURIComponent(invitationId),
    { query: { enabled: !!invitationId, retry: false } }
  );

  const [pendingAction, setPendingAction] = useState<
    "accept" | "decline" | "switch" | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!invitationId) {
    return (
      <StateMessage
        title={t("states.invalidLink.title")}
        description={t("states.invalidLink.description")}
      />
    );
  }

  if (invitationQuery.isPending || session.isPending) {
    return (
      <p className="text-center text-muted-foreground" role="status">
        {t("loading")}
      </p>
    );
  }

  if (invitationQuery.isError) {
    const error = invitationQuery.error as unknown;
    if (error instanceof ApiError && error.status === 404) {
      return (
        <StateMessage
          title={t("states.notFound.title")}
          description={t("states.notFound.description")}
        />
      );
    }
    return (
      <StateMessage title={t("errors.load")} description="">
        <Button onClick={() => invitationQuery.refetch()}>{t("retry")}</Button>
      </StateMessage>
    );
  }

  const invitation = invitationQuery.data.data;
  const currentUser = session.data?.user ?? null;
  const organization = invitation.organizationName;
  const roleLabel = isKnownRole(invitation.role)
    ? t(`roles.${invitation.role}`)
    : invitation.role;
  const expiresAt = new Date(invitation.expiresAt);
  const selfHref = `/auth/accept-invitation?id=${encodeURIComponent(invitation.id)}`;
  const dashboardButton = currentUser ? (
    <Button asChild className="w-full">
      <Link href="/dashboard">{t("goToDashboard")}</Link>
    </Button>
  ) : null;

  if (invitation.status === "accepted") {
    return (
      <StateMessage
        title={t("states.accepted.title")}
        description={t("states.accepted.description", { organization })}
      >
        {dashboardButton}
      </StateMessage>
    );
  }

  if (invitation.status === "rejected") {
    return (
      <StateMessage
        title={t("states.rejected.title")}
        description={t("states.rejected.description", { organization })}
      >
        {dashboardButton}
      </StateMessage>
    );
  }

  if (invitation.status === "canceled") {
    return (
      <StateMessage
        title={t("states.canceled.title")}
        description={t("states.canceled.description", { organization })}
      >
        {dashboardButton}
      </StateMessage>
    );
  }

  if (invitation.status === "expired") {
    return (
      <StateMessage
        title={t("states.expired.title")}
        description={t("states.expired.description", {
          organization,
          date: format.dateTime(expiresAt, { dateStyle: "long" }),
        })}
      >
        {dashboardButton}
      </StateMessage>
    );
  }

  const isWrongAccount =
    !!currentUser &&
    currentUser.email.toLowerCase() !== invitation.email.toLowerCase();

  if (isWrongAccount) {
    const switchAccount = async () => {
      setPendingAction("switch");
      try {
        await authClient.signOut();
      } finally {
        queryClient.clear();
        router.push(
          authPageHref("login", { redirect: selfHref, email: invitation.email })
        );
        router.refresh();
      }
    };
    return (
      <StateMessage
        title={t("states.wrongAccount.title")}
        description={t.rich("states.wrongAccount.description", {
          invited: invitation.email,
          current: currentUser.email,
          strong,
        })}
      >
        <Button
          className="w-full"
          onClick={switchAccount}
          disabled={pendingAction !== null}
        >
          {pendingAction === "switch"
            ? t("states.wrongAccount.switching")
            : t("states.wrongAccount.switchAccount")}
        </Button>
      </StateMessage>
    );
  }

  const accept = async () => {
    setPendingAction("accept");
    setActionError(null);
    try {
      const result = await authClient.organization.acceptInvitation({
        invitationId: invitation.id,
      });
      if (result.error) {
        setActionError(result.error.message || t("errors.action"));
        setPendingAction(null);
        await invitationQuery.refetch();
        return;
      }
      const organizationId = result.data?.member.organizationId;
      if (organizationId) {
        // acceptInvitation already stores the active org on the session;
        // setActive also refreshes the cached session cookie.
        await authClient.organization.setActive({ organizationId });
      }
      // Drop cached /me, organization, etc. reads that predate the new
      // membership. The invitation query is kept so this page doesn't flash
      // the "already accepted" state while navigating away.
      queryClient.removeQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as { url?: string } | undefined;
          return !key?.url?.startsWith("/v1/invitations");
        },
      });
      router.push("/dashboard");
      router.refresh();
    } catch {
      setActionError(t("errors.action"));
      setPendingAction(null);
    }
  };

  const decline = async () => {
    setPendingAction("decline");
    setActionError(null);
    try {
      const result = await authClient.organization.rejectInvitation({
        invitationId: invitation.id,
      });
      if (result.error) {
        setActionError(result.error.message || t("errors.action"));
      }
      await invitationQuery.refetch();
    } catch {
      setActionError(t("errors.action"));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center text-center gap-2">
        <h1 className="text-2xl font-bold">{t("pending.title")}</h1>
        <p className="text-balance text-muted-foreground">
          {t.rich("pending.subtitle", {
            organization,
            role: roleLabel,
            strong,
          })}
        </p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t("details.organization")}</dt>
        <dd>{organization}</dd>
        <dt className="text-muted-foreground">{t("details.role")}</dt>
        <dd>{roleLabel}</dd>
        <dt className="text-muted-foreground">{t("details.email")}</dt>
        <dd className="break-all">{invitation.email}</dd>
        {invitation.inviterName && (
          <>
            <dt className="text-muted-foreground">{t("details.invitedBy")}</dt>
            <dd>{invitation.inviterName}</dd>
          </>
        )}
        <dt className="text-muted-foreground">{t("details.expires")}</dt>
        <dd>
          {format.dateTime(expiresAt, { dateStyle: "long", timeStyle: "short" })}
        </dd>
      </dl>

      {actionError && (
        <Alert variant="destructive">
          <AlertTitle>{t("errors.action")}</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {currentUser ? (
        <div className="flex flex-col gap-3">
          <p className="text-center text-sm text-muted-foreground">
            {t.rich("pending.signedInAs", { email: currentUser.email, strong })}
          </p>
          <Button
            className="w-full"
            onClick={accept}
            disabled={pendingAction !== null}
          >
            {pendingAction === "accept" ? t("accepting") : t("accept")}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={decline}
            disabled={pendingAction !== null}
          >
            {pendingAction === "decline" ? t("declining") : t("decline")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-center text-sm text-muted-foreground">
            {t.rich("signedOut.hint", { email: invitation.email, strong })}
          </p>
          <Button asChild className="w-full">
            <Link
              href={authPageHref("login", {
                redirect: selfHref,
                email: invitation.email,
              })}
            >
              {t("signedOut.signIn")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link
              href={authPageHref("signup", {
                redirect: selfHref,
                email: invitation.email,
              })}
            >
              {t("signedOut.createAccount")}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
