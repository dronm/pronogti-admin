import { computed, onScopeDispose, shallowRef } from "vue";
import { defineStore } from "pinia";

import api from "@/api/http";
import { userApi } from "@/api/user";
import { createAuthController, initialAuthState } from "@/auth/controller";
import { parsePasswordChangeRequest } from "@/schemas/user";
import type { UserLoginRequest, UserPasswordChangeRequest } from "@/types/user";

export const useAuthStore = defineStore("auth", () => {
	const state = shallowRef(initialAuthState());
	let expiryTimer: ReturnType<typeof setTimeout> | undefined;
	const clearExpiryTimer = (): void => {
		if (expiryTimer !== undefined) {
			clearTimeout(expiryTimer);
			expiryTimer = undefined;
		}
	};
	const scheduleExpiry = (): void => {
		clearExpiryTimer();
		const expiresAt = state.value.auth?.expires_at;
		if (expiresAt === undefined) {
			return;
		}
		const remaining = Date.parse(expiresAt) - Date.now();
		expiryTimer = setTimeout(
			() => {
				if (remaining > 2147483647) {
					scheduleExpiry();
					return;
				}
				controller.clear();
			},
			Math.max(0, Math.min(remaining, 2147483647)),
		);
	};
	const controller = createAuthController({
		api: userApi,
		onChange: (next) => {
			state.value = { ...next };
			api.setSessionToken(next.auth?.token ?? null);
			scheduleExpiry();
		},
	});

	const setUserUnlogged = (): void => {
		controller.clear();
	};

	api.unlogUser = setUserUnlogged;
	onScopeDispose(clearExpiryTimer);

	const login = async (credentials: UserLoginRequest): Promise<void> => {
		api.invalidatePendingResponses();
		await controller.login(credentials);
	};
	const changePassword = async (input: UserPasswordChangeRequest): Promise<void> => {
		const token = state.value.auth?.token;
		if (token === undefined) {
			throw new Error("Требуется вход в систему.");
		}
		await userApi.changePassword(parsePasswordChangeRequest(input));
		if (state.value.auth?.token === token) {
			controller.clear();
		}
	};

	return {
		auth: computed(() => state.value.auth),
		user: computed(() => state.value.user),
		restored: computed(() => state.value.restored),
		busy: computed(() => state.value.busy),
		isAuthenticated: (): boolean => state.value.auth !== null && state.value.user?.role_id === "admin",
		login,
		logout: controller.logout,
		changePassword,
		restore: controller.restore,
		setUserUnlogged,
	};
});
