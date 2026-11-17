import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer, type ViteDevServer } from "vite";

let server: ViteDevServer;

before(async () => {
	server = await createServer({
		ssr: { noExternal: ["@katren/vue-business-app", "@katren/vue-collection-lib"] },
		server: { middlewareMode: true, watch: null },
		appType: "custom",
	});
});
after(async () => {
	await server?.close();
});

test("payment order detail parsing preserves full fiscal diagnostics", async () => {
	const { paymentOrderDetailFromDTO } = await server.ssrLoadModule("/src/schemas/paymentOrderDetail.gen.ts") as typeof import("../src/schemas/paymentOrderDetail.gen");
	const message = `Ошибка ККТ: ${"полное сообщение ".repeat(100)}`;
	const response = { error: { code: "device_error", message }, data: { failure: { deviceCode: 123, message: "Подробная причина" } } };
	const order = paymentOrderDetailFromDTO({
		id: "order-1", company_id: 1, salon_name: "Салон", kiosk_id: null, kiosk_name: null,
		entry_mode: "public", payable_kopecks: 100, currency: "RUB", state: "paid",
		created_at: "2026-11-13T00:00:00Z", payment_id: "payment-1", payment_method: "sbp",
		payment_state: "paid", environment: "production", paid_at: "2026-11-13T00:00:00Z",
		bank_reference: null, yclients_sync_status: "succeeded", fiscal_status: "failed",
		client_id: null, visit_id: null, record_id: null, items_snapshot: [], subtotal_kopecks: 100,
		bonus_kopecks: 0, expires_at: "2026-11-13T00:15:00Z", updated_at: "2026-11-13T00:00:00Z",
		yclients_error_code: null, fiscal_error_code: "device_error", fiscal_error_message: message,
		fiscal_response_payload: response, yclients_completed_at: null, fiscal_completed_at: null,
		yclients_document_ids: null, fiscal_document_number: null,
	});
	assert.equal(order.fiscal_error_message, message.trim());
	assert.deepEqual(order.fiscal_response_payload, response);
	assert.equal(order.fiscal_error_code, "device_error");
});
