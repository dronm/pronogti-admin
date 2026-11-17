<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter, useRoute } from "vue-router";

import { useAuthStore } from "@/stores/useAuthStore";
import { errorText } from "@katren/vue-collection-lib/utils/errorText";
import { type UserLoginRequest } from "@/types/user";
import { safeNextPath } from "@/utils/navigation";

const { t } = useI18n();

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const userLogin = ref<string>("");
const userPwd = ref("");
const errorMessage = ref("");

const loginInput = ref<HTMLInputElement | null>(null);

const handleLogin = async (): Promise<void> => {
	if (authStore.busy) {
		return;
	}
	errorMessage.value = "";
	try {
		const cred: UserLoginRequest = {
			name: userLogin.value,
			pwd: userPwd.value,
		};
		await authStore.login(cred);

		if (authStore.isAuthenticated()) {
			const next = safeNextPath(route.query.next);
			await router.replace(next ?? { name: "main" });
		}
	} catch (error: unknown) {
		errorMessage.value = errorText(error);
	} finally {
		userPwd.value = "";
	}
};

onMounted(() => {
	loginInput.value?.focus();
});
</script>

<template>
	<div
		class="min-h-screen bg-slate-100 px-4 py-10 flex items-center justify-center"
	>
		<div class="w-full max-w-md">
			<div class="mb-8 text-center">
				<h1
					class="text-3xl font-bold tracking-tight text-slate-900"
				>
					{{ t("Login.title") }}
				</h1>
				<p
					class="mt-3 text-base font-normal tracking-normal text-slate-500"
				>
					Pronogti
				</p>
			</div>

			<div
				class="rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/80 ring-1 ring-slate-200"
			>
				<form
					@submit.prevent="handleLogin"
					class="space-y-5"
				>
					<div class="space-y-2">
						<label
							for="userLogin"
							class="block text-sm font-medium text-slate-700"
						>
							{{
								$t(
									"Login.login.label",
								)
							}}
						</label>

						<input
							id="userLogin"
							ref="loginInput"
							v-model="userLogin"
							type="text"
							required
							autocomplete="username"
							maxlength="50"
							:disabled="
								authStore.busy
							"
							class="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
							:placeholder="
								$t(
									'Login.login.placeholder',
								)
							"
						/>
					</div>

					<div class="space-y-2">
						<label
							for="userPwd"
							class="block text-sm font-medium text-slate-700"
						>
							{{
								$t(
									"Login.pwd.label",
								)
							}}
						</label>

						<input
							id="userPwd"
							v-model="userPwd"
							type="password"
							required
							autocomplete="current-password"
							:disabled="
								authStore.busy
							"
							class="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
							:placeholder="
								$t(
									'Login.pwd.placeholder',
								)
							"
						/>
					</div>

					<div
						v-if="errorMessage"
						role="alert"
						class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
					>
						{{ errorMessage }}
					</div>

					<button
						type="submit"
						:disabled="authStore.busy"
						class="w-full rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/30 active:scale-[0.99]"
					>
						{{
							t(
								authStore.busy
									? "Login.pending"
									: "Login.submit",
							)
						}}
					</button>
				</form>
			</div>
		</div>
	</div>
</template>
