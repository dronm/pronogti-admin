import { onMounted, onScopeDispose, ref, shallowRef } from "vue";
import { errorText } from "@katren/vue-collection-lib";
import { APIError } from "@katren/vue-collection-lib/api/Conn";
import {
	createCorrection,
	getCorrectionQuote,
	resumeCorrection,
	type CorrectionQuote,
	type CorrectionRequest,
	type FiscalCorrection,
} from "@/api/paymentCorrection";
import {
	readPendingCorrection,
	type PendingCorrection,
} from "@/utils/correctionReceipt";

const requestKey = (): string =>
	Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");

const needsPolling = (quote: CorrectionQuote): boolean =>
	quote.corrections.some(({ state }) =>
		["queued", "processing", "unknown"].includes(state),
	);

export const usePaymentCorrections = (orderID: string) => {
	const storageKey = `pronogti.correction.${orderID}`;
	const readStored = (): PendingCorrection | null => {
		try {
			return readPendingCorrection(
				sessionStorage.getItem(storageKey),
			);
		} catch {
			return null;
		}
	};
	const quote = shallowRef<CorrectionQuote | null>(null);
	const pending = shallowRef<PendingCorrection | null>(readStored());
	const loading = ref(false);
	const submitting = ref(false);
	const loadError = ref("");
	const submitError = ref("");
	const submittedID = ref("");
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
			const result = await getCorrectionQuote(
				orderID,
				controller.signal,
			);
			if (!controller.signal.aborted && !disposed) {
				quote.value = result;
				loadError.value = "";
			}
		} catch (cause: unknown) {
			if (!controller.signal.aborted && !disposed) {
				loadError.value =
					cause instanceof APIError &&
					cause.status === 404
						? "Сохранённый фискальный чек для этого заказа отсутствует."
						: errorText(cause);
			}
		} finally {
			request = undefined;
			loading.value = false;
		}
	};

	const clearPending = (key: string): void => {
		pending.value = null;
		try {
			if (readStored()?.key === key) {
				sessionStorage.removeItem(storageKey);
			}
		} catch {
			// The resolved submission remains cleared in this component.
		}
	};

	const send = async (
		submission: PendingCorrection,
	): Promise<boolean> => {
		if (request || submitting.value || disposed) {
			return false;
		}
		submitting.value = true;
		submitError.value = "";
		pending.value = submission;
		try {
			sessionStorage.setItem(
				storageKey,
				JSON.stringify(submission),
			);
		} catch {
			// Retain the frozen request and key in memory if tab storage is unavailable.
		}
		let accepted = false;
		let settled = false;
		try {
			let result: FiscalCorrection;
			if (
				submission.kind === "create" &&
				submission.request
			) {
				result = await createCorrection(
					orderID,
					submission.key,
					submission.request,
				);
			} else if (
				submission.kind === "resume" &&
				submission.correction_id
			) {
				result = await resumeCorrection(
					orderID,
					submission.correction_id,
					submission.key,
				);
			} else {
				throw new Error(
					"Сохранённый запрос коррекции повреждён.",
				);
			}
			accepted = true;
			settled = true;
			submittedID.value = result.id;
		} catch (cause: unknown) {
			// These are definitive application rejections, including a stale source version.
			settled =
				cause instanceof APIError &&
				cause.status !== undefined &&
				[400, 403, 404, 409, 413, 415, 422].includes(
					cause.status,
				);
			submitError.value = errorText(cause);
		} finally {
			if (settled) {
				clearPending(submission.key);
			}
			submitting.value = false;
		}
		if (settled && !disposed) {
			await reload();
		}
		return accepted;
	};

	const submit = (body: CorrectionRequest): Promise<boolean> => {
		if (
			pending.value ||
			!quote.value?.eligible ||
			loadError.value
		) {
			return Promise.resolve(false);
		}
		// The retry uses an immutable copy of exactly the body approved in the preview.
		const request = JSON.parse(
			JSON.stringify(body),
		) as CorrectionRequest;
		return send({ key: requestKey(), kind: "create", request });
	};
	const resume = (id: string): Promise<boolean> => {
		if (
			pending.value ||
			!quote.value?.corrections.some(
				(item) =>
					item.id === id &&
					item.state === "failed",
			)
		) {
			return Promise.resolve(false);
		}
		return send({
			key: requestKey(),
			kind: "resume",
			correction_id: id,
		});
	};
	const retry = (): Promise<boolean> =>
		pending.value ? send(pending.value) : Promise.resolve(false);

	onMounted(() => {
		void reload();
		pollTimer = setInterval(() => {
			if (
				pending.value ||
				(quote.value && needsPolling(quote.value))
			) {
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
		submittedID,
		reload,
		submit,
		resume,
		retry,
	};
};
