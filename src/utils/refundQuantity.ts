import type { RefundQuoteLine } from "@/api/paymentRefund";

const quantityScale = 1000;
const maxQuantityMilli = 1_000_000 * quantityScale;

export const formatRefundQuantity = (milli: number): string => {
	if (
		!Number.isSafeInteger(milli) ||
		milli < 0 ||
		milli > maxQuantityMilli
	) {
		return "";
	}
	const whole = Math.floor(milli / quantityScale);
	const fraction = String(milli % quantityScale)
		.padStart(3, "0")
		.replace(/0+$/, "");
	return fraction ? `${whole}.${fraction}` : String(whole);
};

export const parseRefundQuantity = (raw: string): number | null => {
	const text = raw.trim();
	const parts =
		text.length <= 64
			? /^(\d+)(?:[.,](\d{1,3}))?$/.exec(text)
			: null;
	if (!parts) {
		return null;
	}
	const whole = Number(parts[1]);
	const fraction = Number((parts[2] ?? "").padEnd(3, "0"));
	const milli = whole * quantityScale + fraction;
	return milli > 0 && milli <= maxQuantityMilli ? milli : null;
};

const roundedRefundAmount = (unitPrice: bigint, milli: number): bigint =>
	(unitPrice * BigInt(milli) + 500n) / 1000n;

export const previewRefundLine = (
	line: RefundQuoteLine,
	raw: string,
): { quantity: string; amountKopecks: number } | null => {
	const milli = parseRefundQuantity(raw);
	const available = line.remaining_quantity_milli;
	if (
		milli === null ||
		!Number.isSafeInteger(available) ||
		available > maxQuantityMilli ||
		milli > available ||
		(line.kind !== "good" && line.kind !== "service") ||
		(line.kind === "service" && milli % quantityScale !== 0) ||
		!Number.isSafeInteger(line.unit_price_kopecks) ||
		line.unit_price_kopecks <= 0 ||
		!Number.isSafeInteger(line.remaining_amount_kopecks) ||
		line.remaining_amount_kopecks <= 0
	) {
		return null;
	}

	const unitPrice = BigInt(line.unit_price_kopecks);
	const amount = roundedRefundAmount(unitPrice, milli);
	const leftQuantity = available - milli;
	const leftAmount = BigInt(line.remaining_amount_kopecks) - amount;
	// Both pieces must remain printable at the original receipt price.
	if (
		amount <= 0n ||
		leftAmount < 0n ||
		(leftQuantity === 0) !== (leftAmount === 0n) ||
		roundedRefundAmount(unitPrice, leftQuantity) !== leftAmount
	) {
		return null;
	}
	return {
		quantity: formatRefundQuantity(milli),
		amountKopecks: Number(amount),
	};
};

export const defaultRefundQuantity = (line: RefundQuoteLine): string =>
	previewRefundLine(line, "1")?.quantity ??
	formatRefundQuantity(line.remaining_quantity_milli);
