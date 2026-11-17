import { createI18n } from "vue-i18n";
import { collectionLibMessages } from "@katren/vue-collection-lib/locales";
import ru from "@/locales/ru.json";
import ruGen from "@/locales/ru.gen.json";

type Messages = Record<string, unknown>;

const isRecord = (value: unknown): value is Messages => {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value)
	);
};

const deepMerge = (base: Messages, override: Messages): Messages => {
	const result = { ...base };
	for (const [key, value] of Object.entries(override)) {
		const previous = result[key];
		result[key] =
			isRecord(previous) && isRecord(value)
				? deepMerge(previous, value)
				: value;
	}
	return result;
};

export const i18n = createI18n({
	legacy: false,
	locale: "ru",
	fallbackLocale: "ru",
	messages: {
		ru: deepMerge(
			deepMerge(collectionLibMessages.ru as Messages, ruGen),
			ru,
		),
	},
} as Parameters<typeof createI18n>[0]);
