import assert from "node:assert/strict";
import test from "node:test";
import type {
	CorrectionReceipt,
	CorrectionRequest,
} from "../src/api/paymentCorrection";
import {
	correctionLineAmount,
	correctionMoneyInput,
	correctionPaymentTotal,
	correctionTotal,
	copyCorrectionReceipt,
	parseCorrectionMoney,
	readPendingCorrection,
} from "../src/utils/correctionReceipt";

const receipt = (): CorrectionReceipt => ({
	cashierName: "Кассир",
	items: [
		{
			name: "Услуга",
			priceKopecks: 999,
			quantity: "1.5",
			vatRate: 6,
			paymentMethod: 4,
			paymentObject: 4,
		},
	],
	additionalData: {
		cashierName: "Кассир",
		internetPayment: 0,
		correctedCalculationDate: 1000,
		prescriptionNumber: "ABC",
		additionalReceiptProperty: "123456",
	},
	payment: {
		taxSystem: 1,
		cashKopecks: 0,
		cashlessKopecks: 1499,
		prepaymentKopecks: 0,
		creditKopecks: 0,
		counterProvisionKopecks: 0,
	},
	calculationSign: 1,
	totalKopecks: 1499,
});

test("correction currency parser preserves exact kopecks and rejects ambiguous input", () => {
	assert.equal(parseCorrectionMoney("0,01"), 1);
	assert.equal(parseCorrectionMoney(" 12.30 "), 1230);
	assert.equal(parseCorrectionMoney("10995116277.75"), 1099511627775);
	for (const input of [
		"-1",
		"1e3",
		"1.005",
		"1,2.3",
		"NaN",
		"",
		"10995116277.76",
	]) {
		assert.equal(parseCorrectionMoney(input), null, input);
	}
	assert.equal(correctionMoneyInput(1230), "12.30");
});

test("correction preview uses exact quantity arithmetic and validates all payment allocations", () => {
	const value = receipt();
	assert.equal(correctionLineAmount(value.items[0]!), 1499);
	assert.equal(correctionTotal(value), 1499);
	assert.equal(correctionPaymentTotal(value), 1499);
	value.items[0]!.quantity = "1e3";
	assert.equal(correctionTotal(value), null);
	value.payment.cashlessKopecks = -1;
	assert.equal(correctionPaymentTotal(value), null);
});

test("editing a corrected receipt removes backend-owned reference fields without mutating source", () => {
	const source = receipt();
	const copy = copyCorrectionReceipt(source);
	assert.equal(copy.additionalData.correctedCalculationDate, undefined);
	assert.equal(copy.additionalData.prescriptionNumber, undefined);
	assert.equal(copy.additionalData.additionalReceiptProperty, undefined);
	copy.items[0]!.name = "Исправлено";
	assert.equal(source.items[0]!.name, "Услуга");
	assert.equal(source.additionalData.additionalReceiptProperty, "123456");
});

test("uncertain correction submission restores the same key and frozen request", () => {
	const request: CorrectionRequest = {
		source_version: "sale",
		reason: "Неверный НДС",
		basis: "voluntary",
		prescription_number: "",
		calculation_date: "2026-11-17",
		receipt: receipt(),
	};
	const stored = { key: "ab".repeat(16), kind: "create", request };
	assert.deepEqual(readPendingCorrection(JSON.stringify(stored)), stored);
	assert.deepEqual(
		readPendingCorrection(
			JSON.stringify({
				key: "cd".repeat(16),
				kind: "resume",
				correction_id: "operation-1",
			}),
		),
		{
			key: "cd".repeat(16),
			kind: "resume",
			correction_id: "operation-1",
		},
	);
	for (const value of [
		null,
		"not-json",
		"null",
		"{}",
		JSON.stringify({ ...stored, key: "bad" }),
		JSON.stringify({ ...stored, request: {} }),
	]) {
		assert.equal(readPendingCorrection(value), null);
	}
});
