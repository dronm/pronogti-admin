import assert from "node:assert/strict";
import test from "node:test";
import api from "../src/api/http";
import {
	createCorrection,
	getCorrection,
	getCorrectionQuote,
	listCorrections,
	previewCorrection,
	resumeCorrection,
	type CorrectionRequest,
} from "../src/api/paymentCorrection";

test("correction endpoints preserve original body and isolate creation and resume idempotency keys", async () => {
	const original = globalThis.fetch;
	const requests: Array<{ path: string; options: RequestInit }> = [];
	globalThis.fetch = async (url, options = {}) => {
		requests.push({ path: new URL(String(url)).pathname, options });
		return Response.json(
			{ id: "correction-1" },
			{ status: options.method === "POST" ? 202 : 200 },
		);
	};
	try {
		api.setSessionToken("current-nonce");
		const body = {
			source_version: "sale",
			reason: "Неверная ставка НДС",
		} as CorrectionRequest;
		await getCorrectionQuote("order");
		await previewCorrection("order", body);
		await createCorrection("order", "create-key", body);
		await getCorrection("order", "correction-1");
		await resumeCorrection("order", "correction-1", "resume-key");
		await listCorrections();
		assert.deepEqual(
			requests.map(({ path }) => path),
			[
				"/admin/payment-orders/order/corrections",
				"/admin/payment-orders/order/corrections/preview",
				"/admin/payment-orders/order/corrections",
				"/admin/payment-orders/order/corrections/correction-1",
				"/admin/payment-orders/order/corrections/correction-1/resume",
				"/admin/fiscal-corrections",
			],
		);
		assert.deepEqual(
			requests.map(({ options }) =>
				new Headers(options.headers).get(
					"Idempotency-Key",
				),
			),
			[null, null, "create-key", null, "resume-key", null],
		);
		assert.deepEqual(
			requests.map(({ options }) =>
				new Headers(options.headers).get(
					"X-Admin-Session",
				),
			),
			[
				null,
				"current-nonce",
				"current-nonce",
				null,
				"current-nonce",
				null,
			],
		);
		assert.deepEqual(
			JSON.parse(String(requests[2]!.options.body)),
			body,
		);
		assert.deepEqual(
			JSON.parse(String(requests[4]!.options.body)),
			{},
		);
		assert.ok(
			requests.every(
				({ options }) =>
					options.credentials === "include",
			),
		);
	} finally {
		api.setSessionToken(null);
		globalThis.fetch = original;
	}
});
