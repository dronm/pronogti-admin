import assert from "node:assert/strict";
import test from "node:test";
import { createPinia, disposePinia, setActivePinia } from "pinia";
import { computed } from "vue";

import { useAuthStore } from "../src/stores/useAuthStore";

const session = (id: number, expiresAt: number) => ({
	auth: {
		token: "a".repeat(64) + id,
		expires_at: new Date(expiresAt).toISOString(),
	},
	user: { id, name: "Administrator", role_id: "admin", locale_id: "ru" },
});

test("the administrator view expires at the server-reported session deadline", async (context) => {
	const initial = Date.parse("2026-11-04T00:00:00Z");
	context.mock.timers.enable({
		apis: ["setTimeout", "Date"],
		now: initial,
	});
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () =>
		new Response(JSON.stringify(session(1, initial + 1000)), {
			headers: { "Content-Type": "application/json" },
		});
	const pinia = createPinia();
	setActivePinia(pinia);
	try {
		const auth = useAuthStore();
		await auth.restore();
		assert.equal(auth.isAuthenticated(), true);
		context.mock.timers.tick(1000);
		assert.equal(auth.isAuthenticated(), false);
		assert.equal(auth.auth, null);
		assert.equal(auth.user, null);
	} finally {
		disposePinia(pinia);
		globalThis.fetch = originalFetch;
		context.mock.timers.reset();
	}
});

test("an old expiry timer cannot log out a replacement administrator session", async (context) => {
	const initial = Date.parse("2026-11-04T00:00:00Z");
	context.mock.timers.enable({
		apis: ["setTimeout", "Date"],
		now: initial,
	});
	const originalFetch = globalThis.fetch;
	let calls = 0;
	globalThis.fetch = async () => {
		calls++;
		return new Response(
			JSON.stringify(
				session(
					calls,
					initial + (calls === 1 ? 1000 : 60000),
				),
			),
			{ headers: { "Content-Type": "application/json" } },
		);
	};
	const pinia = createPinia();
	setActivePinia(pinia);
	try {
		const auth = useAuthStore();
		await auth.restore();
		await auth.login({ name: "admin", pwd: "secret" });
		context.mock.timers.tick(1000);
		assert.equal(auth.isAuthenticated(), true);
		assert.equal(auth.user?.id, 2);
		context.mock.timers.tick(59000);
		assert.equal(auth.isAuthenticated(), false);
	} finally {
		disposePinia(pinia);
		globalThis.fetch = originalFetch;
		context.mock.timers.reset();
	}
});

test("changing the password sends the current nonce and clears the session without a logout request", async () => {
	const originalFetch = globalThis.fetch;
	const current = session(1, Date.now() + 60000);
	const password = { new_password: "secret", confirm_password: "secret" };
	const requests: Array<{ path: string; options: RequestInit }> = [];
	globalThis.fetch = async (url, options = {}) => {
		const path = new URL(String(url)).pathname;
		requests.push({ path, options });
		const body = path.endsWith("/admin/session")
			? current
			: { auth: null, user: null };
		return new Response(JSON.stringify(body), {
			headers: { "Content-Type": "application/json" },
		});
	};
	const pinia = createPinia();
	setActivePinia(pinia);
	try {
		const auth = useAuthStore();
		await auth.restore();
		const authenticated = computed(() => auth.isAuthenticated());
		assert.equal(authenticated.value, true);
		await auth.changePassword(password);
		assert.equal(requests.length, 2);
		const request = requests[1]!;
		assert.match(request.path, /\/admin\/profile\/password$/);
		assert.equal(request.options.method, "POST");
		assert.equal(request.options.credentials, "include");
		assert.equal(
			new Headers(request.options.headers).get("X-Admin-Session"),
			current.auth.token,
		);
		assert.deepEqual(JSON.parse(String(request.options.body)), password);
		assert.equal(authenticated.value, false);
		assert.equal(auth.auth, null);
		assert.equal(auth.user, null);
	} finally {
		disposePinia(pinia);
		globalThis.fetch = originalFetch;
	}
});

test("a late password change response cannot clear a newer administrator session", async () => {
	const originalFetch = globalThis.fetch;
	let finishChange!: (response: Response) => void;
	const change = new Promise<Response>((resolve) => {
		finishChange = resolve;
	});
	const json = (body: unknown): Response =>
		new Response(JSON.stringify(body), {
			headers: { "Content-Type": "application/json" },
		});
	globalThis.fetch = async (url) => {
		const path = new URL(String(url)).pathname;
		if (path.endsWith("/admin/profile/password")) {
			return change;
		}
		return json(session(path.endsWith("/admin/login") ? 2 : 1, Date.now() + 60000));
	};
	const pinia = createPinia();
	setActivePinia(pinia);
	try {
		const auth = useAuthStore();
		await auth.restore();
		const pending = auth.changePassword({ new_password: "secret", confirm_password: "secret" });
		await auth.login({ name: "another-admin", pwd: "secret" });
		finishChange(json({ auth: null, user: null }));
		await pending;
		assert.equal(auth.isAuthenticated(), true);
		assert.equal(auth.user?.id, 2);
	} finally {
		disposePinia(pinia);
		globalThis.fetch = originalFetch;
	}
});
