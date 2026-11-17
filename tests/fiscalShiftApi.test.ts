import assert from "node:assert/strict";
import test from "node:test";
import api from "../src/api/http";
import { closeFiscalShift } from "../src/api/fiscalShift";

test("shift closing keeps the operation key and administrator nonce on retries", async () => {
	const original = globalThis.fetch;
	const requests: Array<{ path: string; options: RequestInit }> = [];
	globalThis.fetch = async (url, options = {}) => {
		requests.push({ path: new URL(String(url)).pathname, options });
		return Response.json({
			state: requests.length === 1 ? "unknown" : "closed",
			message: "Описание результата ККТ",
			request_id: "close-request",
		});
	};
	try {
		api.setSessionToken("admin-nonce");
		assert.equal((await closeFiscalShift(42, "same-operation")).state, "unknown");
		assert.equal((await closeFiscalShift(42, "same-operation")).state, "closed");
		assert.equal(requests.length, 2);
		for (const { path, options } of requests) {
			assert.equal(path, "/admin/fiscal-profiles/42/close-shift");
			assert.equal(options.method, "POST");
			assert.equal(new Headers(options.headers).get("Idempotency-Key"), "same-operation");
			assert.equal(new Headers(options.headers).get("X-Admin-Session"), "admin-nonce");
			assert.equal(options.credentials, "include");
			assert.deepEqual(JSON.parse(String(options.body)), {});
		}
	} finally {
		api.setSessionToken(null);
		globalThis.fetch = original;
	}
});
