import assert from "node:assert/strict";
import test from "node:test";

import { ProjectConn } from "../src/api/http";

const response = (body: unknown, status = 200): Response => {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
};

test("administrator requests carry cookies and mutations carry only the current nonce", async () => {
	const original = globalThis.fetch;
	const requests: Array<{ url: string; options: RequestInit }> = [];
	globalThis.fetch = async (url, options = {}) => {
		requests.push({ url: String(url), options });
		return response({ ok: true });
	};
	try {
		const api = new ProjectConn("https://api.example.test", 1000);
		api.setSessionToken("first-nonce");
		await api.get("/admin/session");
		await api.post("/admin/logout", {});
		api.setSessionToken("second-nonce");
		await api.patch("/admin/salons/1", { name: "Salon" });
		assert.equal(
			requests[0]?.url,
			"https://api.example.test/admin/session",
		);
		assert.equal(requests[0]?.options.credentials, "include");
		assert.equal(requests[0]?.options.redirect, "error");
		assert.equal(
			new Headers(requests[0]?.options.headers).get(
				"X-Admin-Session",
			),
			null,
		);
		assert.equal(
			new Headers(requests[1]?.options.headers).get(
				"X-Admin-Session",
			),
			"first-nonce",
		);
		assert.equal(
			new Headers(requests[2]?.options.headers).get(
				"X-Admin-Session",
			),
			"second-nonce",
		);
	} finally {
		globalThis.fetch = original;
	}
});

test("401 invalidates the current identity without a hard browser redirect", async () => {
	const original = globalThis.fetch;
	globalThis.fetch = async () =>
		response({ error: { message: "session required" } }, 401);
	try {
		const api = new ProjectConn("", 1000);
		let clears = 0;
		api.setSessionToken("nonce");
		api.unlogUser = () => {
			clears++;
		};
		await assert.rejects(api.get("/admin/session"));
		assert.equal(clears, 1);
	} finally {
		globalThis.fetch = original;
	}
});

test("a stale 401 cannot clear a newer successful login", async () => {
	const original = globalThis.fetch;
	let complete!: (value: Response) => void;
	globalThis.fetch = () =>
		new Promise<Response>((resolve) => {
			complete = resolve;
		});
	try {
		const api = new ProjectConn("", 1000);
		let clears = 0;
		api.setSessionToken("old");
		api.unlogUser = () => {
			clears++;
		};
		const pending = api.get("/admin/session");
		api.setSessionToken("new");
		complete(response({ error: "old request expired" }, 401));
		await assert.rejects(pending);
		assert.equal(clears, 0);
	} finally {
		globalThis.fetch = original;
	}
});

test("an anonymous request cannot invalidate a later login attempt", async () => {
	const original = globalThis.fetch;
	let complete!: (value: Response) => void;
	globalThis.fetch = () =>
		new Promise<Response>((resolve) => {
			complete = resolve;
		});
	try {
		const api = new ProjectConn("", 1000);
		let clears = 0;
		api.unlogUser = () => {
			clears++;
		};
		const pending = api.get("/admin/session");
		api.invalidatePendingResponses();
		complete(response({ error: "old anonymous request" }, 401));
		await assert.rejects(pending);
		assert.equal(clears, 0);
	} finally {
		globalThis.fetch = original;
	}
});

test("administrator connection refuses an external endpoint before sending a nonce", async () => {
	const original = globalThis.fetch;
	let calls = 0;
	globalThis.fetch = async () => {
		calls++;
		return response(null);
	};
	try {
		const api = new ProjectConn("", 1000);
		api.setSessionToken("nonce");
		await assert.rejects(
			api.post("https://attacker.test/admin/logout", {}),
		);
		await assert.rejects(
			api.post("//attacker.test/admin/logout", {}),
		);
		assert.equal(calls, 0);
	} finally {
		globalThis.fetch = original;
	}
});
