import assert from "node:assert/strict";
import test from "node:test";
import { businessAppApi, businessEndpoint } from "../src/api/businessApp";
import api from "../src/api/http";
import { MAIN_MENU_CHANGED_EVENT } from "../src/config/navigation";

test("shared business modules use the same administrator cookie transport", async () => {
	assert.equal(
		businessEndpoint("/main-menus/for-user"),
		"/admin/main-menu",
	);
	assert.equal(businessEndpoint("/prog-about/info"), "/admin/prog-about");
	assert.equal(businessEndpoint("/users"), "/admin/users");
	assert.equal(businessEndpoint("/admin/salons"), "/admin/salons");
	const originalFetch = globalThis.fetch;
	const requests: Array<{ url: string; options?: RequestInit }> = [];
	globalThis.fetch = async (input, options) => {
		requests.push({ url: String(input), options });
		return new Response("[]", {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	};
	try {
		api.setSessionToken("business-session-csrf-nonce-1234567890");
		await businessAppApi.get("/main-menus/for-user");
		await businessAppApi.post("/users", { name: "operator" });
		assert.equal(
			requests[0]?.url,
			"http://localhost/admin/main-menu",
		);
		assert.equal(requests[0]?.options?.credentials, "include");
		assert.equal(
			new Headers(requests[0]?.options?.headers).has(
				"X-Admin-Session",
			),
			false,
		);
		assert.equal(requests[1]?.url, "http://localhost/admin/users");
		assert.equal(
			new Headers(requests[1]?.options?.headers).get(
				"X-Admin-Session",
			),
			"business-session-csrf-nonce-1234567890",
		);
	} finally {
		api.setSessionToken(null);
		globalThis.fetch = originalFetch;
	}
});

test("successful route synchronization refreshes navigation without duplicating constructor events", async () => {
	const originalFetch = globalThis.fetch;
	const originalWindow = globalThis.window;
	const events = new EventTarget();
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: events,
	});
	let changes = 0;
	events.addEventListener(MAIN_MENU_CHANGED_EVENT, () => changes++);
	let status = 200;
	globalThis.fetch = async () =>
		new Response(
			JSON.stringify(
				status === 200
					? { registered: 4, deactivated: 1 }
					: { error: "Sync failed" },
			),
			{
				status,
				headers: { "Content-Type": "application/json" },
			},
		);
	try {
		const result = await businessAppApi.post(
			"/application-routes/sync",
			{ items: [] },
		);
		assert.deepEqual(result, { registered: 4, deactivated: 1 });
		assert.equal(changes, 1);
		status = 500;
		await assert.rejects(
			businessAppApi.post("/application-routes/sync", {
				items: [],
			}),
		);
		assert.equal(
			changes,
			1,
			"failed synchronization leaves navigation alone",
		);
		status = 200;
		await businessAppApi.post("/main-menus", {
			caption: "New menu entry",
		});
		assert.equal(
			changes,
			1,
			"the shared constructor owns its mutation events",
		);
	} finally {
		globalThis.fetch = originalFetch;
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: originalWindow,
		});
	}
});
