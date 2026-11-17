import * as v from "valibot";

import api from "@/api/http";

const candidateSchema = v.object({
	id: v.pipe(v.string(), v.nonEmpty()),
	name: v.string(),
	detail: v.optional(v.string()),
});

const issueSchema = v.optional(
	v.picklist([
		"selection_required",
		"no_eligible_results",
		"not_registered",
		"permission_denied",
		"lookup_failed",
	]),
);

const discoverySchema = v.object({
	companies: v.array(candidateSchema),
	customer_code: v.optional(v.string()),
	sbp_merchants: v.array(candidateSchema),
	acquiring_merchants: v.array(candidateSchema),
	issues: v.object({
		customer_code: issueSchema,
		sbp_merchant_id: issueSchema,
		acquiring_merchant_id: issueSchema,
	}),
});

export type PaymentProfileDiscovery = v.InferOutput<typeof discoverySchema>;
export type PaymentProfileDiscoveryCandidate = v.InferOutput<typeof candidateSchema>;

export const discoverPaymentProfile = async (
	id: number,
	customerCode: string | undefined,
	signal: AbortSignal,
): Promise<PaymentProfileDiscovery> =>
	v.parse(
		discoverySchema,
		await api.post<unknown>(
			`/admin/payment-profiles/${id}/discover`,
			customerCode === undefined ? {} : { customer_code: customerCode },
			{ signal },
		),
	);
