import * as v from "valibot";

export const RoleIdSchema = v.literal("admin");

export const createRoleIdSchemas = (_translate?: unknown) => ({ RoleIdSchema });
