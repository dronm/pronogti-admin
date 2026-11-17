import assert from "node:assert/strict";
import test from "node:test";

import api from "../src/api/http";
import {
	createRefund,
	getRefund,
	getRefundQuote,
} from "../src/api/paymentRefund";

test("refund API sends a per-request idempotency key and accepts an asynchronous refund", async () => {
	const original = globalThis.fetch;
	const requests: Array<{ path: string; options: RequestInit }> = [];
	globalThis.fetch = async (url, options = {}) => {
		const path = new URL(String(url)).pathname;
		requests.push({ path, options });
		return Response.json(
			options.method === "POST"
				? { id: "refund-1" }
				: { refunds: [] },
			{ status: options.method === "POST" ? 202 : 200 },
		);
	};
	try {
		api.setSessionToken("current-nonce");
		const items = [{ line_index: 0, quantity: "0.5" }];
		const [refund] = await Promise.all([
			createRefund("payment", "first-key", items),
			createRefund("payment", "second-key", items),
			getRefundQuote("payment"),
			getRefund("payment", "refund-1"),
		]);
		assert.equal(refund.id, "refund-1");
		assert.deepEqual(
			requests.map(({ path }) => path),
			[
				"/admin/payments/payment/refunds",
				"/admin/payments/payment/refunds",
				"/admin/payments/payment/refunds",
				"/admin/payments/payment/refunds/refund-1",
			],
		);
		assert.deepEqual(
			requests.map(({ options }) =>
				new Headers(options.headers).get(
					"Idempotency-Key",
				),
			),
			["first-key", "second-key", null, null],
		);
		assert.deepEqual(
			requests.map(({ options }) =>
				new Headers(options.headers).get(
					"X-Admin-Session",
				),
			),
			["current-nonce", "current-nonce", null, null],
		);
		assert.ok(
			requests.every(
				({ options }) =>
					options.credentials === "include",
			),
		);
		assert.deepEqual(
			JSON.parse(String(requests[0]?.options.body)),
			{ items },
		);
	} finally {
		api.setSessionToken(null);
		globalThis.fetch = original;
	}
});
