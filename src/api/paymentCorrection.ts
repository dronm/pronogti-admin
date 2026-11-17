import api from "@/api/http";

export interface CorrectionItem {
	name: string;
	priceKopecks: number;
	quantity: string;
	vatRate: number;
	paymentMethod: number;
	paymentObject: number;
	measure?: number;
}

export interface CorrectionAdditionalData {
	cashierName: string;
	cashierINN?: string;
	customerContact?: string;
	settlementAddress?: string;
	settlementPlace?: string;
	internetPayment: number;
	correctedCalculationDate?: number;
	prescriptionNumber?: string;
	additionalReceiptProperty?: string;
}

export interface CorrectionPayment {
	taxSystem: number;
	cashKopecks: number;
	cashlessKopecks: number;
	prepaymentKopecks: number;
	creditKopecks: number;
	counterProvisionKopecks: number;
}

export interface CorrectionReceipt {
	cashierName: string;
	cashierInn?: string;
	suppressShiftPrint?: number;
	printSuppressionCode?: number;
	items: CorrectionItem[];
	additionalData: CorrectionAdditionalData;
	payment: CorrectionPayment;
	calculationSign: number;
	totalKopecks: number;
}

export interface FiscalIdentity {
	document_number: number;
	fiscal_sign: number;
	date_time: string;
	receipt_number: number;
	shift_number: number;
}

export interface CorrectionRequest {
	source_version: string;
	reason: string;
	basis: "voluntary" | "prescription";
	prescription_number: string;
	calculation_date: string;
	receipt: CorrectionReceipt;
}

export interface CorrectionPreview {
	source_version: string;
	original: FiscalIdentity;
	reversal: CorrectionReceipt;
	replacement: CorrectionReceipt;
}

export interface CorrectionDocument {
	id: string;
	role: string;
	state: string;
	request_id: string;
	attempt: number;
	error_code?: string;
	error_message?: string;
	response?: unknown;
	initial_response?: unknown;
	identity?: FiscalIdentity;
}

export interface FiscalCorrection {
	id: string;
	order_id: string;
	payment_id: string;
	environment: string;
	state: string;
	reason: string;
	basis: string;
	calculation_date: string;
	prescription_number?: string;
	operator_id: number;
	created_at: string;
	updated_at: string;
	original: FiscalIdentity;
	reversal: CorrectionReceipt;
	replacement: CorrectionReceipt;
	documents: CorrectionDocument[];
}

export interface CorrectionSource {
	order_id: string;
	payment_id: string;
	company_id: number;
	environment: string;
	state: string;
	source_version: string;
	calculation_date: string;
	receipt: CorrectionReceipt;
	identity: FiscalIdentity;
}

export interface CorrectionQuote {
	order_id: string;
	eligible: boolean;
	reason?: string;
	source: CorrectionSource;
	corrections: FiscalCorrection[];
}

const correctionsPath = (orderID: string): string =>
	`/admin/payment-orders/${encodeURIComponent(orderID)}/corrections`;

export const getCorrectionQuote = (
	orderID: string,
	signal?: AbortSignal,
): Promise<CorrectionQuote> =>
	api.get<CorrectionQuote>(
		correctionsPath(orderID),
		undefined,
		signal ? { signal } : undefined,
	);

export const previewCorrection = (
	orderID: string,
	request: CorrectionRequest,
): Promise<CorrectionPreview> =>
	api.post<CorrectionPreview>(
		`${correctionsPath(orderID)}/preview`,
		request,
	);

export const createCorrection = (
	orderID: string,
	key: string,
	request: CorrectionRequest,
): Promise<FiscalCorrection> =>
	api.postIdempotent<FiscalCorrection>(
		correctionsPath(orderID),
		request,
		key,
	);

export const getCorrection = (
	orderID: string,
	correctionID: string,
	signal?: AbortSignal,
): Promise<FiscalCorrection> =>
	api.get<FiscalCorrection>(
		`${correctionsPath(orderID)}/${encodeURIComponent(correctionID)}`,
		undefined,
		signal ? { signal } : undefined,
	);

export const resumeCorrection = (
	orderID: string,
	correctionID: string,
	key: string,
): Promise<FiscalCorrection> =>
	api.postIdempotent<FiscalCorrection>(
		`${correctionsPath(orderID)}/${encodeURIComponent(correctionID)}/resume`,
		{},
		key,
	);

export const listCorrections = (
	signal?: AbortSignal,
): Promise<FiscalCorrection[]> =>
	api.get<FiscalCorrection[]>(
		"/admin/fiscal-corrections",
		undefined,
		signal ? { signal } : undefined,
	);
