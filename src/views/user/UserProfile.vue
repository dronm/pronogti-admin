<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "@/stores/useAuthStore";
import { errorText } from "@katren/vue-collection-lib/utils/errorText";

const { t } = useI18n();
const auth = useAuthStore();
const error = ref("");
const refreshing = ref(false);
const newPassword = ref("");
const confirmPassword = ref("");
const passwordError = ref("");
const changingPassword = ref(false);

const refresh = async (): Promise<void> => {
	if (refreshing.value || changingPassword.value) {
		return;
	}
	refreshing.value = true;
	error.value = "";
	try {
		await auth.restore(true);
	} catch (cause: unknown) {
		error.value = errorText(cause);
	} finally {
		refreshing.value = false;
	}
};

const changePassword = async (): Promise<void> => {
	if (changingPassword.value || auth.busy || !auth.isAuthenticated()) {
		return;
	}
	changingPassword.value = true;
	passwordError.value = "";
	try {
		await auth.changePassword({
			new_password: newPassword.value,
			confirm_password: confirmPassword.value,
		});
		newPassword.value = "";
		confirmPassword.value = "";
	} catch (cause: unknown) {
		passwordError.value = errorText(cause);
	} finally {
		changingPassword.value = false;
	}
};
</script>

<template>
	<section
		class="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
	>
		<div class="flex items-center justify-between gap-4">
			<h1 class="text-xl font-semibold">Мой профиль</h1>
			<button
				class="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
				:disabled="refreshing || changingPassword"
				@click="refresh"
			>
				Обновить
			</button>
		</div>
		<p v-if="error" role="alert" class="mt-4 text-sm text-red-700">
			{{ error }}
		</p>
		<dl
			v-if="auth.user"
			class="mt-6 grid grid-cols-[8rem_1fr] gap-3 text-sm"
		>
			<dt class="text-slate-500">Логин</dt>
			<dd>{{ auth.user.name }}</dd>
			<dt class="text-slate-500">Роль</dt>
			<dd>Администратор</dd>
			<dt class="text-slate-500">ID</dt>
			<dd>{{ auth.user.id }}</dd>
		</dl>
		<form
			v-if="auth.user"
			class="mt-6 border-t border-slate-200 pt-6"
			:aria-busy="changingPassword"
			@submit.prevent="changePassword"
		>
			<h2 class="text-base font-semibold">
				{{ t("Profile.password.title") }}
			</h2>
			<p id="profile-password-notice" class="mt-1 text-sm text-slate-600">
				{{ t("Profile.password.notice") }}
			</p>
			<fieldset
				class="mt-4 space-y-4"
				:disabled="changingPassword || auth.busy"
			>
				<div class="space-y-1">
					<label for="profile-new-password" class="block text-sm font-medium">
						{{ t("Profile.password.new") }}
					</label>
					<input
						id="profile-new-password"
						v-model="newPassword"
						type="password"
						autocomplete="new-password"
						aria-describedby="profile-password-notice"
						required
						class="block w-full rounded-lg border border-slate-300 px-3 py-2"
					/>
				</div>
				<div class="space-y-1">
					<label for="profile-confirm-password" class="block text-sm font-medium">
						{{ t("Profile.password.confirm") }}
					</label>
					<input
						id="profile-confirm-password"
						v-model="confirmPassword"
						type="password"
						autocomplete="new-password"
						required
						class="block w-full rounded-lg border border-slate-300 px-3 py-2"
					/>
				</div>
				<p v-if="passwordError" role="alert" class="text-sm text-red-700">
					{{ passwordError }}
				</p>
				<button
					type="submit"
					class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
				>
					{{ t(changingPassword ? "Profile.password.pending" : "Profile.password.submit") }}
				</button>
			</fieldset>
		</form>
	</section>
</template>
