import type { BusinessAppConfig } from "@katren/vue-business-app/core";
import { businessAppApi } from "@/api/businessApp";
import { i18n } from "@/i18n";
import { applicationRouteManifest } from "@/router/routeManifest";
import { RoleIdSchema } from "@/schemas/enums/roleId";
import type { RoleId } from "@/types/enums/roleId";
import { MAIN_MENU_CHANGED_EVENT } from "./navigation";

const translate = (
	key: string,
	params: Record<string, unknown> = {},
): string => {
	return String(
		i18n.global.t(
			key,
			params as Record<string, string | number | boolean>,
		),
	);
};

export const businessAppConfig: BusinessAppConfig<RoleId> = {
	api: businessAppApi,
	branding: {
		title: "Pronogti",
		subtitle: "Администрирование",
		fallbackMark: "Pronogti",
	},
	applicationRouteManifest,
	mainMenuChangedEventName: MAIN_MENU_CHANGED_EVENT,
	roles: {
		options: [{ value: "admin", label: "Администратор" }],
		defaultRoleId: "admin",
		schema: RoleIdSchema,
	},
	translate,
};
