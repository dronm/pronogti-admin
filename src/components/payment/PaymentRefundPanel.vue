<script setup lang="ts">
import { computed, ref } from "vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import type { RefundQuoteLine } from "@/api/paymentRefund";
import { usePaymentRefunds } from "@/composables/usePaymentRefunds";
import { paymentAmount, paymentEnvironment } from "@/utils/paymentDisplay";
import { defaultRefundQuantity, formatRefundQuantity, previewRefundLine } from "@/utils/refundQuantity";
import RefundCataloguePicker from "./RefundCataloguePicker.vue";
import RefundHistoryGrid from "./RefundHistoryGrid.vue";

const props = defineProps<{ paymentId: string; salonName?: string | null }>();
const { quote, pending, loading, submitting, loadError, submitError, submittedId, reload, submit, retry } =
	usePaymentRefunds(props.paymentId);
const quantities = ref<Record<number, string>>(
	Object.fromEntries(pending.value?.items.map(({ line_index, quantity }) => [line_index, quantity]) ?? []),
);
const confirming = ref(false);

const selected = computed(() => Object.keys(quantities.value).map(Number));
const lines = computed(() =>
	(quote.value?.items ?? []).filter((line) => selected.value.includes(line.line_index)),
);
const previews = computed(() =>
	lines.value.map((line) => ({
		line,
		value: previewRefundLine(line, quantities.value[line.line_index] ?? ""),
	})),
);
const canSubmit = computed(
	() =>
		Boolean(quote.value?.eligible) &&
		!loading.value &&
		!loadError.value &&
		!submitting.value &&
		!pending.value &&
		previews.value.length > 0 &&
		previews.value.length === selected.value.length &&
		previews.value.every(({ value }) => value !== null),
);
const total = computed(() => previews.value.reduce((sum, { value }) => sum + (value?.amountKopecks ?? 0), 0));
const available = computed(() =>
	(quote.value?.items ?? []).filter(
		(line) => line.remaining_quantity_milli > 0 && line.remaining_amount_kopecks > 0,
	),
);
const disabled = computed(
	() => loading.value || submitting.value || Boolean(pending.value || loadError.value),
);

const addLine = (line: RefundQuoteLine): void => {
	quantities.value[line.line_index] = defaultRefundQuantity(line);
};

const selectAll = (): void => {
	quantities.value = Object.fromEntries(
		available.value.map((line) => [line.line_index, formatRefundQuantity(line.remaining_quantity_milli)]),
	);
};

const send = async (): Promise<void> => {
	if (!canSubmit.value) {
		return;
	}
	const items = previews.value.flatMap(({ line, value }) =>
		value ? [{ line_index: line.line_index, quantity: value.quantity }] : [],
	);
	confirming.value = false;
	if (await submit(items)) {
		quantities.value = {};
	}
};

const retrySubmission = async (): Promise<void> => {
	if (await retry()) {
		quantities.value = {};
	}
};

const reasons: Record<string, string> = {
	receipt_correction_incomplete: "Сначала завершите коррекцию чека или проверьте её результат.",
	corrected_receipt_refund_unsupported: "Исправленный чек содержит сумму, способ оплаты или позиции, которые не поддерживаются автоматическим возвратом.",
	corrected_receipt_invalid: "Не удалось подготовить возврат по исправленному чеку. Проверьте данные коррекции.",
	payment_not_paid: "Платёж ещё не подтверждён.",
	refund_already_open: "Сначала дождитесь завершения текущего возврата или проверьте его статус в истории.",
	card_refund_already_completed: "По этому платежу картой уже выполнен возврат.",
	live_refunds_disabled: "Рабочие возвраты отключены в настройках.",
	original_receipt_not_issued: "Чек продажи ещё не выдан.",
	original_demo_receipt_missing: "Демо-чек продажи отсутствует.",
	original_receipt_payload_missing: "Сохранённые данные чека продажи отсутствуют.",
	refund_bank_identity_unavailable: "Для возврата не хватает банковских данных исходного платежа.",
	payment_fully_refunded: "Вся сумма платежа уже возвращена.",
};
</script>

<template>
	<section aria-label="Возврат оплаты" class="space-y-4">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h3 class="text-base font-semibold">Возврат оплаты</h3>
			<Button
				type="button"
				label="Обновить"
				icon="pi pi-refresh"
				severity="secondary"
				:loading="loading"
				:disabled="submitting"
				@click="reload"
			/>
		</div>
		<p v-if="loading && !quote" role="status">Загрузка позиций платежа…</p>
		<p v-if="loadError" role="alert" class="text-red-700">{{ loadError }}</p>
		<p v-if="submitError" role="alert" class="text-red-700">{{ submitError }}</p>
		<p v-if="submittedId" role="status" class="text-emerald-700">Запрос на возврат зарегистрирован.</p>
		<div v-if="pending && !submitting" class="rounded-md border border-amber-300 p-3">
			<p class="mb-2" role="status">
				Ответ на запрос возврата не получен. Повторная отправка использует тот же ключ запроса.
			</p>
			<Button
				type="button"
				label="Повторить отправку"
				severity="secondary"
				:disabled="loading"
				@click="retrySubmission"
			/>
		</div>
		<template v-if="quote">
			<dl class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
				<div v-if="props.salonName">
					<dt>Салон</dt>
					<dd>{{ props.salonName }}</dd>
				</div>
				<div>
					<dt>Оплачено</dt>
					<dd class="font-semibold">{{ paymentAmount(quote.paid_kopecks) }}</dd>
				</div>
				<div>
					<dt>Остаток по позициям</dt>
					<dd class="font-semibold">{{ paymentAmount(quote.available_kopecks) }}</dd>
				</div>
				<div>
					<dt>Режим</dt>
					<dd>{{ paymentEnvironment(quote.environment) }}</dd>
				</div>
			</dl>
			<form v-if="quote.eligible" class="space-y-4" @submit.prevent="canSubmit && (confirming = true)">
				<RefundCataloguePicker
					:lines="available"
					:disabled="disabled"
					:selected="selected"
					@select="addLine"
				/>
				<Button
					type="button"
					label="Выбрать весь остаток"
					icon="pi pi-list-check"
					text
					:disabled="disabled || available.length === 0"
					@click="selectAll"
				/>
				<div v-if="previews.length" class="space-y-2">
					<h4 class="font-semibold">Позиции возврата</h4>
					<div
						v-for="{ line, value } in previews"
						:key="line.line_index"
						class="rounded-md border border-slate-200 p-3"
					>
						<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
							<div class="min-w-48 flex-1">
								<p class="font-medium">{{ line.title }}</p>
								<p class="text-xs text-slate-600">
									Позиция {{ line.line_index + 1 }} ·
									{{ paymentAmount(line.unit_price_kopecks) }} за ед.
								</p>
							</div>
							<div>
								<label :for="`refund-quantity-${line.line_index}`" class="block text-xs"
									>Количество</label
								>
								<InputText
									:id="`refund-quantity-${line.line_index}`"
									v-model="quantities[line.line_index]"
									inputmode="decimal"
									maxlength="16"
									class="w-28"
									:invalid="!value"
									:disabled="disabled"
								/>
								<p class="text-xs text-slate-600">
									До
									{{
										formatRefundQuantity(line.remaining_quantity_milli).replace(".", ",")
									}}
								</p>
							</div>
							<span class="min-w-24 text-right tabular-nums">{{
								paymentAmount(value?.amountKopecks)
							}}</span>
							<Button
								type="button"
								icon="pi pi-times"
								severity="secondary"
								text
								:disabled="disabled"
								:aria-label="`Убрать позицию ${line.line_index + 1}`"
								@click="delete quantities[line.line_index]"
							/>
						</div>
						<p v-if="!value" class="mt-2 text-sm text-red-700">
							Укажите допустимое количество. Для услуг доступны целые единицы. Суммы возврата и
							остатка должны совпадать с исходной ценой с учётом округления.
						</p>
					</div>
					<div class="flex flex-wrap items-center justify-end gap-3">
						<strong v-if="previews.every(({ value }) => value !== null)"
							>К возврату {{ paymentAmount(total) }}</strong
						>
						<Button
							type="submit"
							label="Оформить возврат"
							icon="pi pi-replay"
							:disabled="!canSubmit"
						/>
					</div>
				</div>
			</form>
			<p v-else class="text-sm text-slate-700">
				{{ reasons[quote.reason ?? ""] ?? "Возврат для этого платежа недоступен." }}
			</p>
			<RefundHistoryGrid :refunds="quote.refunds" />
		</template>
		<Dialog v-model:visible="confirming" header="Подтверждение возврата" modal class="w-full max-w-md">
			<p>Отправить запрос на возврат {{ paymentAmount(total) }} по выбранным позициям?</p>
			<p v-if="quote?.environment === 'mock'" class="mt-2 text-sm text-slate-600">Режим имитации.</p>
			<p v-else-if="quote?.environment === 'sandbox'" class="mt-2 text-sm text-slate-600">
				Тестовая среда банка.
			</p>
			<template #footer>
				<Button type="button" label="Отмена" severity="secondary" @click="confirming = false" />
				<Button type="button" label="Подтвердить возврат" :disabled="!canSubmit" @click="send" />
			</template>
		</Dialog>
	</section>
</template>
