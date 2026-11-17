export const ROLE_ID_VALUES = ["admin"] as const;

export type RoleId = (typeof ROLE_ID_VALUES)[number];

export interface RoleIdOption {
	value: RoleId;
	label: string;
}
