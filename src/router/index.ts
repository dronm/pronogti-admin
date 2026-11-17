import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { applicationRouteRecords } from "./routeManifest";
import Login from "@/views/Login.vue";

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{ path: "/login", name: "login", component: Login },
		...applicationRouteRecords,
		{ path: "/:pathMatch(.*)*", redirect: { name: "main" } },
	],
});

router.beforeEach(async (to) => {
	const auth = useAuthStore();
	try {
		await auth.restore();
	} catch {
		// A connection failure does not establish an administrator identity.
		if (to.name !== "login") {
			return { name: "login" };
		}
	}
	if (!auth.isAuthenticated()) {
		return to.name === "login"
			? true
			: { name: "login", query: { next: to.fullPath } };
	}
	if (to.name === "login") {
		return { name: "main" };
	}
	if (to.meta.roleId && to.meta.roleId !== auth.user?.role_id) {
		return { name: "main" };
	}
	return true;
});

export default router;
