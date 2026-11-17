import type { RoleId } from "./enums/roleId";

export interface User {
	id: number;
	name: string;
	role_id: RoleId;
	locale_id: "ru";
}

export type UserDTO = User;
export type UserKey = Pick<User, "id">;

export interface UserLoginRequest {
	name: string;
	pwd: string;
}

export interface UserPasswordChangeRequest {
	new_password: string;
	confirm_password: string;
}
