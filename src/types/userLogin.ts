import type { Auth } from "./auth";
import type { User } from "./user";

export type UserLogin = User;

export interface UserLoginResponse {
	auth: Auth;
	user: UserLogin;
}

export interface AnonymousSession {
	auth: null;
	user: null;
}

export type UserSessionResponse = UserLoginResponse | AnonymousSession;
