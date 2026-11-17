import assert from "node:assert/strict";
import { test } from "node:test";
import type { RefundQuoteLine } from "../src/api/paymentRefund";
import {
	defaultRefundQuantity,
	formatRefundQuantity,
	parseRefundQuantity,
	previewRefundLine,
} from "../src/utils/refundQuantity";

const good: RefundQuoteLine = {
	line_index: 0,
	item_id: 5,
	kind: "good",
	title: "Подарочное масло",
	quantity: "2",
	unit_price_kopecks: 12345,
	amount_kopecks: 24690,
	remaining_quantity_milli: 2000,
	remaining_amount_kopecks: 24690,
};

test("refund quantities use exact thousandths and accept the local decimal separator", () => {
	assert.equal(parseRefundQuantity(" 01,25 "), 1250);
	assert.equal(parseRefundQuantity("1000000.000"), 1_000_000_000);
	assert.equal(formatRefundQuantity(1250), "1.25");
	assert.equal(formatRefundQuantity(5), "0.005");
	assert.equal(formatRefundQuantity(0), "0");
	for (const value of [
		"",
		"0",
		"-1",
		".5",
		"1e2",
		"1.0011",
		"1000000.001",
		"1,234.5",
	]) {
		assert.equal(parseRefundQuantity(value), null, value);
	}
});

test("refund preview uses original kopecks and respects remaining quantity and service units", () => {
	assert.deepEqual(previewRefundLine(good, "1,2"), {
		quantity: "1.2",
		amountKopecks: 14814,
	});
	assert.equal(previewRefundLine(good, "2.001"), null);
	assert.equal(
		previewRefundLine({ ...good, kind: "service" }, "0.5"),
		null,
	);
	assert.equal(defaultRefundQuantity(good), "1");
});

test("refund preview prevents an unprintable fractional remainder", () => {
	const lowPrice = {
		...good,
		quantity: "1.4",
		unit_price_kopecks: 1,
		amount_kopecks: 1,
		remaining_quantity_milli: 1400,
		remaining_amount_kopecks: 1,
	};
	assert.equal(previewRefundLine(lowPrice, "0.5"), null);
	assert.equal(previewRefundLine(lowPrice, "1"), null);
	assert.equal(defaultRefundQuantity(lowPrice), "1.4");
	assert.deepEqual(previewRefundLine(lowPrice, "1.4"), {
		quantity: "1.4",
		amountKopecks: 1,
	});
});

test("refund preview rounds large exact amounts without overflowing JS number intermediates", () => {
	const large = {
		...good,
		quantity: "1",
		unit_price_kopecks: Number.MAX_SAFE_INTEGER,
		amount_kopecks: Number.MAX_SAFE_INTEGER,
		remaining_quantity_milli: 1000,
		remaining_amount_kopecks: Number.MAX_SAFE_INTEGER,
	};
	assert.equal(previewRefundLine(large, "0.5"), null);
	assert.deepEqual(previewRefundLine(large, "0.999"), {
		quantity: "0.999",
		amountKopecks: 8998192055486250,
	});
});
