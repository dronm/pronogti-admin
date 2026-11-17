// A return target is a local application path, never a host or URL scheme.
export const safeNextPath = (value: unknown): string | null => {
	if (
		typeof value !== "string" ||
		!value.startsWith("/") ||
		value.startsWith("//") ||
		/[\\\u0000-\u0020]/.test(value)
	) {
		return null;
	}
	const path = value.split(/[?#]/, 1)[0];
	if (path === "/login" || /^\/(?:%2f|%5c)/i.test(value)) {
		return null;
	}
	return value;
};
