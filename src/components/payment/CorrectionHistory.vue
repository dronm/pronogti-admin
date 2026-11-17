<script setup lang="ts">
import Button from "primevue/button";
import type { FiscalCorrection } from "@/api/paymentCorrection";
import CorrectionReceiptSummary from "./CorrectionReceiptSummary.vue";

const props = defineProps<{
	corrections: FiscalCorrection[];
	busy?: boolean;
	showOrder?: boolean;
}>();
const emit = defineEmits<{ resume: [id: string] }>();
const stateLabel = (state: string): string =>
	({
		queued: "В очереди",
		pending: "Ожидает выполнения",
		processing: "Выполняется",
		completed: "Завершена",
		issued: "Чек выдан",
		demo: "Демо: без выдачи чека",
		failed: "Ошибка",
		unknown: "Результат требует проверки",
	})[state] ?? state;
const dateLabel = (value: string): string => {
	const date = new Date(value);
	return Number.isFinite(date.getTime())
		? date.toLocaleString("ru-RU")
		: value;
};
const errorMessage = (response: unknown): string => {
	if (!response || typeof response !== "object") {
		return "";
	}
	const envelope = response as {
		error?: { message?: string };
		data?: { failure?: { message?: string } };
	};
	return envelope.data?.failure?.message ?? envelope.error?.message ?? "";
};
</script>

<template>
	<div class="space-y-3">
		<p
			v-if="props.corrections.length === 0"
			class="text-sm text-slate-500"
		>
			Чеки коррекции ещё не создавались.
		</p>
		<details
			v-for="correction in props.corrections"
			:key="correction.id"
			class="rounded border border-slate-200 p-3"
			:open="correction.state !== 'completed'"
		>
			<summary class="cursor-pointer font-medium">
				{{ dateLabel(correction.created_at) }} ·
				{{ stateLabel(correction.state) }}
				<span
					v-if="
						correction.environment !==
						'production'
					"
					class="ml-2 text-amber-700"
					>Демо</span
				>
			</summary>
			<div class="mt-3 space-y-3">
				<RouterLink
					v-if="props.showOrder"
					:to="{
						name: 'paymentOrderDetail',
						params: {
							id: correction.order_id,
						},
					}"
					class="text-primary underline"
					>Открыть заказ
					{{
						correction.order_id.slice(0, 8)
					}}</RouterLink
				>
				<p class="text-sm">
					<strong>Причина:</strong>
					{{ correction.reason }}
				</p>
				<p class="text-sm">
					Дата расчёта:
					{{ correction.calculation_date }} ·
					{{
						correction.basis ===
						"prescription"
							? `По предписанию ФНС ${correction.prescription_number ?? ""}`
							: "Самостоятельная коррекция"
					}}
					· Оператор №
					{{ correction.operator_id }}
				</p>
				<p
					v-if="correction.state === 'unknown'"
					role="status"
					class="rounded bg-amber-50 p-2 text-sm text-amber-900"
				>
					ККТ могла выдать чек. Выполняется
					проверка исходного запроса; новый чек до
					выяснения результата не создаётся.
				</p>
				<p
					v-if="correction.state === 'failed'"
					class="text-sm text-amber-900"
				>
					Продолжение повторит только этап с
					подтверждённой ошибкой. Уже выданный чек
					повторно создаваться не будет.
				</p>
				<div class="grid gap-3 md:grid-cols-2">
					<CorrectionReceiptSummary
						:receipt="correction.reversal"
						title="1. Возврат прихода: исходные данные"
					/>
					<CorrectionReceiptSummary
						:receipt="
							correction.replacement
						"
						title="2. Приход: исправленные данные"
					/>
				</div>
				<div
					v-for="document in correction.documents"
					:key="document.id"
					class="rounded bg-slate-50 p-3 text-sm"
				>
					<p class="font-medium">
						{{
							document.role ===
							"reversal"
								? "Возврат прихода"
								: "Приход"
						}}
						· попытка
						{{ document.attempt }} ·
						{{ stateLabel(document.state) }}
					</p>
					<p v-if="document.identity">
						ФД
						{{
							document.identity
								.document_number
						}}
						· ФП
						{{
							document.identity
								.fiscal_sign
						}}
						·
						{{
							document.identity.date_time.replace(
								"T",
								" ",
							)
						}}
						· смена
						{{
							document.identity
								.shift_number
						}}
					</p>
					<p
						v-if="
							document.error_code ||
							errorMessage(
								document.initial_response,
							) ||
							errorMessage(
								document.response,
							)
						"
						role="alert"
						class="mt-1 whitespace-pre-wrap break-words text-red-700"
					>
						{{
							errorMessage(
								document.initial_response,
							) ||
							errorMessage(
								document.response,
							) ||
							document.error_code
						}}
					</p>
					<details class="mt-2">
						<summary class="cursor-pointer">
							Запрос и полный ответ
							ККТ
						</summary>
						<p class="mt-2 break-all">
							ID запроса:
							{{
								document.request_id
							}}
						</p>
						<pre
							class="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs"
							>{{
								JSON.stringify(
									document.response ??
										{},
									null,
									2,
								)
							}}</pre
						>
						<template
							v-if="
								document.initial_response &&
								JSON.stringify(
									document.initial_response,
								) !==
									JSON.stringify(
										document.response,
									)
							"
						>
							<p
								class="mt-3 font-medium"
							>
								Первоначальный
								ответ при
								отправке
							</p>
							<pre
								class="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs"
								>{{
									JSON.stringify(
										document.initial_response,
										null,
										2,
									)
								}}</pre
							>
						</template>
					</details>
				</div>
				<Button
					v-if="
						correction.state === 'failed' &&
						!props.showOrder
					"
					type="button"
					label="Продолжить коррекцию"
					severity="secondary"
					:disabled="props.busy"
					@click="emit('resume', correction.id)"
				/>
			</div>
		</details>
	</div>
</template>
