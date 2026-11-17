import api from "@/api/http";

export interface FiscalShiftResult {
	state: "closed" | "already_closed" | "demo" | "failed" | "unknown";
	message: string;
	shift_number?: number;
	request_id: string;
	driver_response?: Record<string, unknown>;
}

export const closeFiscalShift = (
	profileID: number,
	idempotencyKey: string,
): Promise<FiscalShiftResult> => {
	return api.postIdempotent<FiscalShiftResult>(
		`/admin/fiscal-profiles/${encodeURIComponent(profileID)}/close-shift`,
		{},
		idempotencyKey,
		{ timeout: 330000 },
	);
};
