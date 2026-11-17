import type { BusinessAppApi } from "@katren/vue-business-app/core";
import api from "@/api/http";
import { MAIN_MENU_CHANGED_EVENT } from "@/config/navigation";

// Shared modules retain the same API as Meatshop while using Pronogti's
// separately authenticated administrator namespace.
export const businessEndpoint = (endpoint: string): string => {
	if (endpoint === "/main-menus/for-user") {
		return "/admin/main-menu";
	}
	if (endpoint === "/prog-about/info") {
		return "/admin/prog-about";
	}
	return endpoint.startsWith("/admin/") ? endpoint : `/admin${endpoint}`;
};

const endpointMethods = new Set(["get", "post", "patch", "delete"]);

export const businessAppApi: BusinessAppApi = new Proxy(api, {
	get: (target, property, receiver) => {
		const value: unknown = Reflect.get(target, property, receiver);
		if (typeof value !== "function") {
			return value;
		}
		if (
			typeof property === "string" &&
			endpointMethods.has(property)
		) {
			return (
				endpoint: string,
				...args: unknown[]
			): unknown => {
				const adminEndpoint =
					businessEndpoint(endpoint);
				const response: unknown = Reflect.apply(
					value,
					target,
					[adminEndpoint, ...args],
				);
				if (
					property === "post" &&
					adminEndpoint ===
						"/admin/application-routes/sync"
				) {
					return Promise.resolve(response).then(
						(result) => {
							// Synchronization may deactivate routes already shown in
							// the menu. Refresh only after the mutation succeeds.
							if (
								typeof window !==
								"undefined"
							) {
								window.dispatchEvent(
									new Event(
										MAIN_MENU_CHANGED_EVENT,
									),
								);
							}
							return result;
						},
					);
				}
				return response;
			};
		}
		return value.bind(target);
	},
});
