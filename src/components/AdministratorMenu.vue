<script setup lang="ts">
import { HorizontalMainMenu, useMainMenu } from "@katren/vue-business-app/menu";

defineProps<{
	userName: string | null;
}>();

const emit = defineEmits<{
	profile: [];
	constructor: [];
	allRoutes: [];
	about: [];
	logout: [];
}>();

// App mounts a separate instance for each authenticated session. Discarding it
// also removes the shared menu-change listener and isolates pending responses.
const { menu, error: menuError } = useMainMenu();
</script>

<template>
	<HorizontalMainMenu
		:menu="menu"
		:user-name="userName"
		:menu-error="menuError"
		:brand-route="{ name: 'main' }"
		:can-view-profile="true"
		:can-manage-menu="true"
		:can-view-application-routes="true"
		@profile="emit('profile')"
		@constructor="emit('constructor')"
		@all-routes="emit('allRoutes')"
		@about="emit('about')"
		@logout="emit('logout')"
	/>
</template>
