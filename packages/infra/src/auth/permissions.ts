import { createAccessControl } from "better-auth/plugins/access";

// Access control statement - defines resources and their allowed actions
const statement = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  classroom: ["create", "update", "delete"],
  challenge: ["create", "update", "delete"],
  teachingAssistant: ["create", "update", "delete"],
  knowledgeBase: ["create", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const studentRole = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  classroom: [],
  challenge: [],
  teachingAssistant: [],
  knowledgeBase: [],
});

export const teacherRole = ac.newRole({
  classroom: ["create", "update"],
  challenge: ["create", "update", "delete"],
  teachingAssistant: ["create", "update"],
  member: ["create"],
  invitation: ["create"],
  knowledgeBase: ["create", "update", "delete"],
});

export const coordinatorRole = ac.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  classroom: ["create", "update", "delete"],
  challenge: ["create", "update", "delete"],
  teachingAssistant: ["create", "update", "delete"],
  knowledgeBase: ["create", "update", "delete"],
});

export const adminRole = ac.newRole({
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  classroom: ["create", "update", "delete"],
  challenge: ["create", "update", "delete"],
  teachingAssistant: ["create", "update", "delete"],
  knowledgeBase: ["create", "update", "delete"],
});

// ==================== RBAC Types ====================

export type RoleName = "student" | "teacher" | "coordinator" | "admin";

export type Resource = keyof typeof statement;

export type ActionFor<R extends Resource> = (typeof statement)[R][number];

export type Action = (typeof statement)[Resource][number];

export type Permission<R extends Resource = Resource> = {
  resource: R;
  action: ActionFor<R>;
};

// ==================== Role Hierarchy ====================

const ROLE_HIERARCHY: Record<RoleName, number> = {
  student: 0,
  teacher: 1,
  coordinator: 2,
  admin: 3,
} as const;

const ROLE_MAP: Record<RoleName, { statements: Record<string, readonly string[]> }> = {
  student: studentRole,
  teacher: teacherRole,
  coordinator: coordinatorRole,
  admin: adminRole,
};

// ==================== RBAC Helper Functions ====================

/** Check if a user's role meets a minimum hierarchy level */
export function hasMinimumRole(
  userRole: RoleName,
  minimumRole: RoleName
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

/** Check if a role has a specific permission on a resource */
export function roleHasPermission<R extends Resource>(
  roleName: RoleName,
  resource: R,
  action: ActionFor<R>
): boolean {
  const role = ROLE_MAP[roleName];
  if (!role) return false;

  const allowed = role.statements[resource];
  if (!allowed) return false;

  return allowed.includes(action);
}

/** Type guard to validate a string is a valid RoleName */
export function isValidRole(role: string): role is RoleName {
  return role in ROLE_HIERARCHY;
}

/** Get all available role names */
export function getAllRoles(): RoleName[] {
  return Object.keys(ROLE_HIERARCHY) as RoleName[];
}
