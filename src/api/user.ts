import api from "@/api/http";
import type { UserLoginRequest, UserPasswordChangeRequest } from "@/types/user";

export const userApi = {
	login: async (credentials: UserLoginRequest): Promise<unknown> => {
		return await api.post<unknown>("/admin/login", credentials);
	},
	session: async (): Promise<unknown> => {
		return await api.get<unknown>("/admin/session");
	},
	logout: async (): Promise<unknown> => {
		return await api.post<unknown>("/admin/logout", {});
	},
	changePassword: async (input: UserPasswordChangeRequest): Promise<void> => {
		await api.post<unknown>("/admin/profile/password", input);
	},
};
