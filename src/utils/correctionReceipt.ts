import type {
	CorrectionItem,
	CorrectionReceipt,
	CorrectionRequest,
} from "@/api/paymentCorrection";

export const correctionExplanation =
	"Команда создаёт два чека коррекции: сначала «возврат прихода» с данными ошибочного чека, затем «приход» с исправленными данными. Исходный чек сохраняется. Деньги покупателю не возвращаются и повторно не списываются.";

const maximumKopecks = 1099511627775n;

// Parse decimal currency without binary floating-point rounding or accepting exponent notation.
export const parseCorrectionMoney = (text: string): number | null => {
	const match = /^(\d{1,13})(?:[.,](\d{1,2}))?$/.exec(text.trim());
	if (!match) {
		return null;
	}
	const amount =
		BigInt(match[1]!) * 100n +
		BigInt((match[2] ?? "").padEnd(2, "0"));
	return amount <= maximumKopecks ? Number(amount) : null;
};

export const correctionMoneyInput = (amount: number): string => {
	if (!Number.isSafeInteger(amount) || amount < 0) {
		return "";
	}
	return `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, "0")}`;
};

export const correctionLineAmount = (item: CorrectionItem): number | null => {
	const match = /^(\d{1,7})(?:\.(\d{1,3}))?$/.exec(item.quantity);
	if (
		!match ||
		!Number.isSafeInteger(item.priceKopecks) ||
		item.priceKopecks <= 0
	) {
		return null;
	}
	const quantity =
		BigInt(match[1]!) * 1000n +
		BigInt((match[2] ?? "").padEnd(3, "0"));
	if (quantity <= 0n || quantity > 1000000000n) {
		return null;
	}
	const amount = (BigInt(item.priceKopecks) * quantity + 500n) / 1000n;
	return amount > 0n && amount <= maximumKopecks ? Number(amount) : null;
};

export const correctionTotal = (receipt: CorrectionReceipt): number | null => {
	if (receipt.items.length < 1 || receipt.items.length > 200) {
		return null;
	}
	let total = 0;
	for (const item of receipt.items) {
		const amount = correctionLineAmount(item);
		if (amount === null || item.name.trim() === "") {
			return null;
		}
		total += amount;
	}
	return BigInt(total) <= maximumKopecks ? total : null;
};

export const correctionPaymentTotal = (
	receipt: CorrectionReceipt,
): number | null => {
	const amounts = [
		receipt.payment.cashKopecks,
		receipt.payment.cashlessKopecks,
		receipt.payment.prepaymentKopecks,
		receipt.payment.creditKopecks,
		receipt.payment.counterProvisionKopecks,
	];
	if (
		amounts.some(
			(value) => !Number.isSafeInteger(value) || value < 0,
		)
	) {
		return null;
	}
	const total = amounts.reduce((sum, value) => sum + value, 0);
	return BigInt(total) <= maximumKopecks ? total : null;
};

export const copyCorrectionReceipt = (
	receipt: CorrectionReceipt,
): CorrectionReceipt => {
	const copy = JSON.parse(JSON.stringify(receipt)) as CorrectionReceipt;
	// Correction date and links always come from the authoritative backend preview.
	delete copy.additionalData.correctedCalculationDate;
	delete copy.additionalData.prescriptionNumber;
	delete copy.additionalData.additionalReceiptProperty;
	copy.calculationSign = 1;
	return copy;
};

export interface PendingCorrection {
	key: string;
	kind: "create" | "resume";
	request?: CorrectionRequest;
	correction_id?: string;
}

export const readPendingCorrection = (
	raw: string | null,
): PendingCorrection | null => {
	if (!raw) {
		return null;
	}
	try {
		const value: unknown = JSON.parse(raw);
		if (!value || typeof value !== "object") {
			return null;
		}
		const candidate = value as Partial<PendingCorrection>;
		if (
			typeof candidate.key !== "string" ||
			!/^[0-9a-f]{32}$/.test(candidate.key)
		) {
			return null;
		}
		if (
			candidate.kind === "resume" &&
			typeof candidate.correction_id === "string"
		) {
			return candidate as PendingCorrection;
		}
		const request = candidate.request;
		if (
			candidate.kind === "create" &&
			request &&
			typeof request.source_version === "string" &&
			typeof request.reason === "string" &&
			(request.basis === "voluntary" ||
				request.basis === "prescription") &&
			typeof request.calculation_date === "string" &&
			request.receipt &&
			Array.isArray(request.receipt.items) &&
			request.receipt.payment &&
			request.receipt.additionalData
		) {
			return candidate as PendingCorrection;
		}
	} catch {
		// Invalid or incomplete tab state must not create an operation.
	}
	return null;
};
