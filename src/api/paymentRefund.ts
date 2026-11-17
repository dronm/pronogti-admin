import api from "@/api/http";

export interface RefundSelection {
	line_index: number;
	quantity: string;
}

interface RefundLineItem extends RefundSelection {
	item_id: number;
	kind: string;
	title: string;
	unit_price_kopecks: number;
	amount_kopecks: number;
}

export interface RefundQuoteLine extends RefundLineItem {
	remaining_quantity_milli: number;
	remaining_amount_kopecks: number;
}

export interface RefundLine extends RefundLineItem {
	quantity_milli: number;
}

export interface Refund {
	id: string;
	payment_id: string;
	order_id: string;
	company_id: number;
	operator_id: number;
	amount_kopecks: number;
	lines: RefundLine[];
	bank_state: string;
	fiscal_state: string;
	bank_reference?: string;
	error_code?: string;
	receipt_number?: number;
	created_at: string;
	updated_at: string;
}

export interface RefundQuote {
	payment_id: string;
	order_id: string;
	environment: string;
	method: string;
	paid_kopecks: number;
	available_kopecks: number;
	eligible: boolean;
	reason?: string;
	items: RefundQuoteLine[];
	refunds: Refund[];
}

const refundsPath = (paymentID: string): string => {
	return `/admin/payments/${encodeURIComponent(paymentID)}/refunds`;
};

export const getRefundQuote = (
	paymentID: string,
	signal?: AbortSignal,
): Promise<RefundQuote> => {
	return api.get<RefundQuote>(
		refundsPath(paymentID),
		undefined,
		signal ? { signal } : undefined,
	);
};

export const createRefund = (
	paymentID: string,
	key: string,
	items: RefundSelection[],
): Promise<Refund> => {
	return api.postIdempotent<Refund>(
		refundsPath(paymentID),
		{ items },
		key,
	);
};

export const getRefund = (
	paymentID: string,
	refundID: string,
	signal?: AbortSignal,
): Promise<Refund> => {
	return api.get<Refund>(
		`${refundsPath(paymentID)}/${encodeURIComponent(refundID)}`,
		undefined,
		signal ? { signal } : undefined,
	);
};
