import { createAccessControl } from "better-auth/plugins/access";

// Access control statement - defines resources and their allowed actions
const statement = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  classroom: ["create", "update", "delete"],
  challenge: ["create", "update", "delete"],
  teachingAssistant: ["create", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const studentRole = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  classroom: [],
  challenge: [],
  teachingAssistant: [],
});

export const teacherRole = ac.newRole({
  classroom: ["create", "update"],
  challenge: ["create", "update", "delete"],
  teachingAssistant: ["create", "update"],
  member: ["create"],
  invitation: ["create"],
});

export const coordinatorRole = ac.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  classroom: ["create", "update", "delete"],
  challenge: ["create", "update", "delete"],
  teachingAssistant: ["create", "update", "delete"],
});

export const adminRole = ac.newRole({
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  classroom: ["create", "update", "delete"],
  challenge: ["create", "update", "delete"],
  teachingAssistant: ["create", "update", "delete"],
});
