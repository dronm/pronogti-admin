import { onMounted, onScopeDispose, ref, shallowRef } from "vue";
import { errorText } from "@katren/vue-collection-lib";
import { APIError } from "@katren/vue-collection-lib/api/Conn";
import { createRefund, getRefundQuote, type RefundQuote, type RefundSelection } from "@/api/paymentRefund";

interface RefundSubmission {
	key: string;
	items: RefundSelection[];
}

const readSubmission = (storageKey: string): RefundSubmission | null => {
	try {
		const raw = sessionStorage.getItem(storageKey);
		if (raw) {
			const value = JSON.parse(raw) as RefundSubmission;
			if (
				typeof value.key === "string" &&
				/^[0-9a-f]{32}$/.test(value.key) &&
				Array.isArray(value.items) &&
				value.items.length > 0 &&
				value.items.every(
					(item) => item && Number.isInteger(item.line_index) && typeof item.quantity === "string",
				)
			) {
				return value;
			}
		}
	} catch {
		// The mounted panel can still retry if tab storage is unavailable.
	}
	return null;
};

const needsPolling = (quote: RefundQuote): boolean =>
	quote.refunds.some((refund) => {
		if (refund.bank_state === "confirmed") {
			return ["queued", "submitting", "unknown"].includes(refund.fiscal_state);
		}
		if (refund.bank_state === "unknown") {
			return quote.method === "sbp" && Boolean(refund.bank_reference);
		}
		return ["queued", "prepared", "submitting", "pending"].includes(refund.bank_state);
	});

export const usePaymentRefunds = (paymentId: string) => {
	const storageKey = `pronogti.refund.${paymentId}`;
	const quote = shallowRef<RefundQuote | null>(null);
	const pending = shallowRef(readSubmission(storageKey));
	const loading = ref(false);
	const submitting = ref(false);
	const loadError = ref("");
	const submitError = ref("");
	const submittedId = ref("");
	let request: AbortController | undefined;
	let disposed = false;
	let pollTimer: ReturnType<typeof setInterval> | undefined;

	const reload = async (): Promise<void> => {
		if (request || submitting.value || disposed) {
			return;
		}
		const controller = new AbortController();
		request = controller;
		loading.value = true;
		try {
			const result = await getRefundQuote(paymentId, controller.signal);
			if (!controller.signal.aborted) {
				quote.value = result;
				loadError.value = "";
			}
		} catch (cause: unknown) {
			if (!controller.signal.aborted) {
				loadError.value =
					cause instanceof APIError && cause.status === 404
						? "Возвраты для этого платежа недоступны."
						: errorText(cause);
			}
		} finally {
			request = undefined;
			loading.value = false;
		}
	};

	const send = async (submission: RefundSubmission): Promise<boolean> => {
		if (request || submitting.value || disposed) {
			return false;
		}
		submitting.value = true;
		const retrying = pending.value !== null;
		submitError.value = "";
		submittedId.value = "";
		pending.value = submission;
		try {
			sessionStorage.setItem(storageKey, JSON.stringify(submission));
		} catch {
			// Keep the current submission in memory for the same-key retry.
		}
		let accepted = false;
		let settled = false;
		try {
			const refund = await createRefund(paymentId, submission.key, submission.items);
			accepted = true;
			settled = true;
			if (quote.value) {
				quote.value = {
					...quote.value,
					eligible: false,
					reason: "refund_already_open",
					refunds: [refund, ...quote.value.refunds.filter(({ id }) => id !== refund.id)],
				};
			}
			submittedId.value = refund.id;
		} catch (cause: unknown) {
			settled =
				!retrying &&
				cause instanceof APIError &&
				cause.status !== undefined &&
				[400, 403, 404, 409, 413, 415, 422].includes(cause.status);
			submitError.value = errorText(cause);
		} finally {
			if (settled) {
				pending.value = null;
				try {
					if (readSubmission(storageKey)?.key === submission.key) {
						sessionStorage.removeItem(storageKey);
					}
				} catch {
					// The resolved request remains cleared in memory.
				}
			}
			submitting.value = false;
		}
		if (settled) {
			await reload();
		}
		return accepted;
	};

	const submit = (items: RefundSelection[]): Promise<boolean> => {
		if (pending.value || !quote.value?.eligible || loadError.value || items.length === 0) {
			return Promise.resolve(false);
		}
		// randomUUID is only available on secure origins in browsers.
		const key = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
			byte.toString(16).padStart(2, "0"),
		).join("");
		return send({ key, items });
	};

	const retry = (): Promise<boolean> => (pending.value ? send(pending.value) : Promise.resolve(false));

	onMounted(() => {
		void reload();
		pollTimer = setInterval(() => {
			if (pending.value || (quote.value && needsPolling(quote.value))) {
				void reload();
			}
		}, 5000);
	});
	onScopeDispose(() => {
		disposed = true;
		request?.abort();
		clearInterval(pollTimer);
	});

	return {
		quote,
		pending,
		loading,
		submitting,
		loadError,
		submitError,
		submittedId,
		reload,
		submit,
		retry,
	};
};
