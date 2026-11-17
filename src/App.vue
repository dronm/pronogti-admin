<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ProgAboutDialog } from "@katren/vue-business-app/prog-about";
import { useReferenceSelectionMode } from "@katren/vue-collection-lib";
import CollectionDirtyGuard from "@katren/vue-collection-lib/components/form/CollectionDirtyGuard.vue";
import { errorText } from "@katren/vue-collection-lib/utils/errorText";

import { useAuthStore } from "@/stores/useAuthStore";
import AdministratorMenu from "@/components/AdministratorMenu.vue";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const aboutVisible = ref(false);
const logoutError = ref("");
const referenceSelectionMode = useReferenceSelectionMode();
const authenticated = computed(() => auth.isAuthenticated());
const userName = computed(() => auth.user?.name ?? null);
const menuSession = computed(() => `${auth.user?.id}:${auth.auth?.token}`);
const dirtyGuardEnabled = computed(
	() =>
		typeof route.name === "string" &&
		/(Create|Edit)$/.test(route.name),
);

const openProfile = async (): Promise<void> => {
	await router.push({ name: "userProfile" });
};

const openMainMenuConstructor = async (): Promise<void> => {
	await router.push({ name: "mainMenuConstructor" });
};

const openApplicationRoutes = async (): Promise<void> => {
	await router.push({ name: "applicationRoutes" });
};

const showAbout = (): void => {
	aboutVisible.value = true;
};

const logout = async (): Promise<void> => {
	logoutError.value = "";
	try {
		await auth.logout();
	} catch (error: unknown) {
		logoutError.value = errorText(error);
	} finally {
		await router.replace({ name: "login" });
	}
};

watch(
	() => authenticated.value,
	async (loggedIn) => {
		if (loggedIn) {
			return;
		}
		aboutVisible.value = false;
		if (route.name !== "login") {
			await router.replace({ name: "login" });
		}
	},
	{ immediate: true },
);
</script>

<template>
	<div v-if="!authenticated">
		<p
			v-if="logoutError"
			role="alert"
			class="fixed inset-x-4 top-3 z-50 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
		>
			{{ logoutError }}
		</p>
		<router-view />
	</div>
	<div
		v-else
		class="pronogti-shell relative min-h-screen overflow-x-clip bg-slate-100 text-slate-900"
	>
		<div
			v-if="!referenceSelectionMode"
			class="pointer-events-none fixed inset-0 overflow-hidden"
			aria-hidden="true"
		>
			<div
				class="absolute -right-32 top-12 h-96 w-96 rounded-full bg-cyan-300/15 blur-3xl"
			/>
			<div
				class="absolute -left-40 top-1/3 h-[30rem] w-[30rem] rounded-full bg-blue-300/10 blur-3xl"
			/>
			<div
				class="absolute inset-x-0 top-16 h-44 bg-gradient-to-b from-slate-200/55 to-transparent"
			/>
		</div>
		<AdministratorMenu
			v-if="!referenceSelectionMode"
			:key="menuSession"
			:user-name="userName"
			@profile="openProfile"
			@constructor="openMainMenuConstructor"
			@all-routes="openApplicationRoutes"
			@about="showAbout"
			@logout="logout"
		/>
		<ProgAboutDialog v-model:visible="aboutVisible" />
		<main
			class="relative"
			:class="
				referenceSelectionMode
					? 'min-h-screen'
					: 'min-h-[calc(100vh-4rem)] pb-8'
			"
		>
			<div
				class="relative mx-auto w-full max-w-[1700px]"
				:class="
					referenceSelectionMode
						? 'p-0'
						: 'px-2 py-2 sm:px-4 sm:py-3 lg:px-5 lg:py-4'
				"
			>
				<CollectionDirtyGuard
					:enabled="dirtyGuardEnabled"
				>
					<router-view />
				</CollectionDirtyGuard>
			</div>
		</main>
	</div>
</template>
