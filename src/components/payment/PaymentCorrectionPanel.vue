<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import { errorText } from "@katren/vue-collection-lib";
import {
	previewCorrection,
	type CorrectionPreview,
	type CorrectionRequest,
	type CorrectionPayment,
} from "@/api/paymentCorrection";
import { usePaymentCorrections } from "@/composables/usePaymentCorrections";
import {
	fiscalVatOptions,
	fiscalTaxSystemOptions,
	fiscalPaymentMethodOptions,
} from "@/forms/fiscalProfileOptions";
import {
	correctionExplanation,
	copyCorrectionReceipt,
	correctionLineAmount,
	correctionMoneyInput,
	correctionPaymentTotal,
	correctionTotal,
	parseCorrectionMoney,
} from "@/utils/correctionReceipt";
import { paymentAmount } from "@/utils/paymentDisplay";
import CorrectionHistory from "./CorrectionHistory.vue";
import CorrectionReceiptSummary from "./CorrectionReceiptSummary.vue";

const props = defineProps<{ orderId: string }>();
const {
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
} = usePaymentCorrections(props.orderId);
const editing = ref(false);
const draft = ref<CorrectionRequest | null>(null);
const prices = ref<string[]>([]);
const paymentInputs = ref<Record<string, string>>({});
const preview = ref<CorrectionPreview | null>(null);
const previewRequest = ref<CorrectionRequest | null>(null);
const previewing = ref(false);
const previewError = ref("");
const resumeID = ref("");

const paymentFields: {
	key: Exclude<keyof CorrectionPayment, "taxSystem">;
	label: string;
}[] = [
	{ key: "cashKopecks", label: "Наличными" },
	{ key: "cashlessKopecks", label: "Безналичными" },
	{ key: "prepaymentKopecks", label: "Зачёт аванса" },
	{ key: "creditKopecks", label: "В кредит" },
	{ key: "counterProvisionKopecks", label: "Встречное предоставление" },
];
const measures = [
	{ value: 0, label: "Штуки / единицы" },
	{ value: 10, label: "Граммы" },
	{ value: 11, label: "Килограммы" },
	{ value: 12, label: "Тонны" },
	{ value: 20, label: "Сантиметры" },
	{ value: 21, label: "Дециметры" },
	{ value: 22, label: "Метры" },
	{ value: 30, label: "Кв. сантиметры" },
	{ value: 31, label: "Кв. дециметры" },
	{ value: 32, label: "Кв. метры" },
	{ value: 40, label: "Миллилитры" },
	{ value: 41, label: "Литры" },
	{ value: 42, label: "Куб. метры" },
	{ value: 50, label: "КВт⋅ч" },
	{ value: 51, label: "Гкал" },
	{ value: 70, label: "Сутки" },
	{ value: 71, label: "Часы" },
	{ value: 72, label: "Минуты" },
	{ value: 73, label: "Секунды" },
	{ value: 80, label: "Кбайт" },
	{ value: 81, label: "Мбайт" },
	{ value: 82, label: "Гбайт" },
	{ value: 83, label: "Тбайт" },
	{ value: 255, label: "Иная мера" },
];
const total = computed(() =>
	draft.value ? correctionTotal(draft.value.receipt) : null,
);
const paymentTotal = computed(() =>
	draft.value ? correctionPaymentTotal(draft.value.receipt) : null,
);
const staleSource = computed(
	() =>
		draft.value &&
		quote.value &&
		draft.value.source_version !==
			quote.value.source.source_version,
);
const formError = computed(() => {
	if (staleSource.value) {
		return "Исходный чек изменился. Закройте форму и загрузите актуальные данные.";
	}
	if (total.value === null || total.value <= 0) {
		return "Проверьте наименования, цены и количества позиций. Количество допускает до трёх знаков после точки.";
	}
	if (paymentTotal.value !== total.value) {
		return "Сумма способов оплаты должна совпадать с итогом позиций.";
	}
	return "";
});
const canPreview = computed(() =>
	Boolean(
		draft.value &&
		draft.value.reason.trim() &&
		draft.value.calculation_date &&
		quote.value?.eligible &&
		(draft.value.basis !== "prescription" ||
			draft.value.prescription_number.trim()) &&
		!formError.value &&
		!pending.value &&
		!loading.value &&
		!loadError.value &&
		!submitting.value &&
		!previewing.value,
	),
);
const busy = computed(
	() => submitting.value || previewing.value || Boolean(pending.value),
);
const printSuppressed = computed({
	get: () => draft.value?.receipt.printSuppressionCode === 41029,
	set: (value: boolean) => {
		if (!draft.value) {
			return;
		}
		if (value) {
			draft.value.receipt.printSuppressionCode = 41029;
		} else {
			delete draft.value.receipt.printSuppressionCode;
		}
	},
});
const internetPayment = computed({
	get: () => draft.value?.receipt.additionalData.internetPayment === 1,
	set: (value: boolean) => {
		if (draft.value) {
			draft.value.receipt.additionalData.internetPayment =
				value ? 1 : 0;
		}
	},
});

const openEditor = (): void => {
	if (!quote.value?.eligible || busy.value) {
		return;
	}
	const source = quote.value.source;
	draft.value = {
		source_version: source.source_version,
		reason: "",
		basis: "voluntary",
		prescription_number: "",
		calculation_date: source.calculation_date,
		receipt: copyCorrectionReceipt(source.receipt),
	};
	prices.value = draft.value.receipt.items.map((item) =>
		correctionMoneyInput(item.priceKopecks),
	);
	paymentInputs.value = Object.fromEntries(
		paymentFields.map(({ key }) => [
			key,
			correctionMoneyInput(draft.value!.receipt.payment[key]),
		]),
	);
	preview.value = null;
	previewError.value = "";
	editing.value = true;
};
const changePrice = (index: number, value: string | undefined): void => {
	const text = value ?? "";
	prices.value[index] = text;
	const item = draft.value?.receipt.items[index];
	if (item) {
		item.priceKopecks = parseCorrectionMoney(text) ?? -1;
	}
};
const changePayment = (
	key: Exclude<keyof CorrectionPayment, "taxSystem">,
	value: string | undefined,
): void => {
	const text = value ?? "";
	paymentInputs.value[key] = text;
	if (draft.value) {
		draft.value.receipt.payment[key] =
			parseCorrectionMoney(text) ?? -1;
	}
};
const addItem = (): void => {
	if (!draft.value || draft.value.receipt.items.length >= 200) {
		return;
	}
	draft.value.receipt.items.push({
		name: "",
		priceKopecks: 0,
		quantity: "1",
		vatRate: 6,
		paymentMethod: 4,
		paymentObject: 4,
		measure: 0,
	});
	prices.value.push("0.00");
};
const removeItem = (index: number): void => {
	draft.value?.receipt.items.splice(index, 1);
	prices.value.splice(index, 1);
};
const preparePreview = async (): Promise<void> => {
	if (!canPreview.value || !draft.value || total.value === null) {
		return;
	}
	previewing.value = true;
	previewError.value = "";
	const request = JSON.parse(
		JSON.stringify(draft.value),
	) as CorrectionRequest;
	request.receipt.totalKopecks = total.value;
	request.receipt.cashierName =
		request.receipt.additionalData.cashierName;
	if (request.receipt.additionalData.cashierINN) {
		request.receipt.cashierInn =
			request.receipt.additionalData.cashierINN;
	} else {
		delete request.receipt.cashierInn;
	}
	if (request.basis === "voluntary") {
		request.prescription_number = "";
	}
	try {
		preview.value = await previewCorrection(props.orderId, request);
		previewRequest.value = request;
	} catch (cause: unknown) {
		previewError.value = errorText(cause);
	} finally {
		previewing.value = false;
	}
};
const send = async (): Promise<void> => {
	if (!previewRequest.value || !preview.value) {
		return;
	}
	if (await submit(previewRequest.value)) {
		preview.value = null;
		editing.value = false;
	}
};
watch(submittedID, (id) => {
	if (id) {
		preview.value = null;
		editing.value = false;
	}
});
const continueCorrection = async (): Promise<void> => {
	const id = resumeID.value;
	resumeID.value = "";
	await resume(id);
};
</script>

<template>
	<section
		aria-label="Коррекция фискального чека"
		class="mt-4 space-y-4 rounded-md border border-slate-200 p-4"
	>
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h3 class="text-base font-semibold">
				Коррекция фискального чека
			</h3>
			<div class="flex gap-2">
				<Button
					type="button"
					label="Обновить"
					icon="pi pi-refresh"
					severity="secondary"
					:loading="loading"
					:disabled="busy"
					@click="reload"
				/>
				<Button
					v-if="quote?.eligible"
					type="button"
					label="Исправить чек"
					icon="pi pi-pencil"
					:disabled="
						busy ||
						loading ||
						Boolean(loadError)
					"
					@click="openEditor"
				/>
			</div>
		</div>
		<p class="text-sm leading-relaxed text-slate-600">
			{{ correctionExplanation }}
		</p>
		<p v-if="loadError" role="alert" class="text-red-700">
			{{ loadError }}
		</p>
		<p
			v-if="submitError"
			role="alert"
			class="whitespace-pre-wrap text-red-700"
		>
			{{ submitError }}
		</p>
		<p v-if="submittedID" role="status" class="text-emerald-700">
			Запрос коррекции зарегистрирован. Результаты каждого
			чека показаны в истории.
		</p>
		<div
			v-if="pending"
			class="space-y-2 rounded border border-amber-300 bg-amber-50 p-3"
		>
			<p role="status">
				Ответ сервера не получен. Повторная отправка
				использует сохранённые данные и тот же ключ
				запроса.
			</p>
			<Button
				type="button"
				label="Проверить отправку"
				severity="secondary"
				:loading="submitting"
				:disabled="loading"
				@click="retry"
			/>
		</div>
		<template v-if="quote">
			<p
				v-if="!quote.eligible && quote.reason"
				role="status"
				class="text-sm text-slate-600"
			>
				{{ quote.reason }}
			</p>
			<p
				v-if="quote.source.identity?.document_number"
				class="text-sm"
			>
				Текущий чек: ФД
				{{ quote.source.identity.document_number }} · ФП
				{{ quote.source.identity.fiscal_sign }} ·
				{{
					quote.source.identity.date_time.replace(
						"T",
						" ",
					)
				}}
			</p>
			<p
				v-if="quote.source.state === 'demo'"
				class="rounded bg-amber-50 p-2 text-sm text-amber-900"
			>
				Демо-режим: фискальные документы на ККТ
				выдаваться не будут.
			</p>
			<CorrectionHistory
				:corrections="quote.corrections"
				:busy="busy || loading"
				@resume="resumeID = $event"
			/>
		</template>
		<Dialog
			v-model:visible="editing"
			modal
			header="Исправление фискального чека"
			:style="{ width: 'min(74rem, 96vw)' }"
			:closable="!busy"
			:close-on-escape="!busy"
		>
			<form
				v-if="draft"
				class="space-y-5"
				@submit.prevent="preparePreview"
			>
				<p
					class="rounded bg-blue-50 p-3 text-sm leading-relaxed text-blue-950"
				>
					{{ correctionExplanation }}
				</p>
				<div
					v-if="quote?.source.state === 'demo'"
					class="font-medium text-amber-800"
				>
					Демо-коррекция: без обращения к ККТ.
				</div>
				<fieldset
					:disabled="busy"
					class="grid gap-4 md:grid-cols-2"
				>
					<label
						class="flex flex-col gap-1 text-sm"
						>Причина исправления<Textarea
							v-model="draft.reason"
							required
							maxlength="1000"
							rows="2"
					/></label>
					<label
						class="flex flex-col gap-1 text-sm"
						>Дата исходного
						расчёта<InputText
							v-model="
								draft.calculation_date
							"
							type="date"
							required
					/></label>
					<label
						class="flex flex-col gap-1 text-sm"
						>Основание<select
							v-model="draft.basis"
							class="rounded border border-slate-300 p-2"
						>
							<option
								value="voluntary"
							>
								Самостоятельная
								коррекция
							</option>
							<option
								value="prescription"
							>
								По предписанию
								ФНС
							</option>
						</select></label
					>
					<label
						v-if="
							draft.basis ===
							'prescription'
						"
						class="flex flex-col gap-1 text-sm"
						>Номер предписания ФНС<InputText
							v-model="
								draft.prescription_number
							"
							required
							maxlength="32"
					/></label>
				</fieldset>
				<fieldset :disabled="busy" class="space-y-3">
					<legend class="mb-2 font-semibold">
						Исправленные позиции
					</legend>
					<div
						v-for="(item, index) in draft
							.receipt.items"
						:key="index"
						class="rounded border border-slate-200 p-3"
					>
						<div
							class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
						>
							<label
								class="flex flex-col gap-1 text-sm sm:col-span-2"
								>Наименование<InputText
									v-model="
										item.name
									"
									required
									maxlength="128"
							/></label>
							<label
								class="flex flex-col gap-1 text-sm"
								>Количество<InputText
									v-model="
										item.quantity
									"
									inputmode="decimal"
									required
							/></label>
							<label
								class="flex flex-col gap-1 text-sm"
								>Цена,
								₽<InputText
									:model-value="
										prices[
											index
										]
									"
									inputmode="decimal"
									required
									@update:model-value="
										changePrice(
											index,
											$event,
										)
									"
							/></label>
							<label
								class="flex flex-col gap-1 text-sm"
								>НДС<select
									v-model.number="
										item.vatRate
									"
									class="rounded border border-slate-300 p-2"
								>
									<option
										v-for="option in fiscalVatOptions"
										:key="
											option.value
										"
										:value="
											option.value
										"
									>
										{{
											option.label
										}}
									</option>
								</select></label
							>
							<label
								class="flex flex-col gap-1 text-sm"
								>Предмет
								расчёта<select
									v-model.number="
										item.paymentObject
									"
									class="rounded border border-slate-300 p-2"
								>
									<option
										:value="
											4
										"
									>
										Услуга
									</option>
									<option
										:value="
											1
										"
									>
										Товар
									</option>
								</select></label
							>
							<label
								class="flex flex-col gap-1 text-sm"
								>Способ
								расчёта<select
									v-model.number="
										item.paymentMethod
									"
									class="rounded border border-slate-300 p-2"
								>
									<option
										v-for="option in fiscalPaymentMethodOptions"
										:key="
											option.value
										"
										:value="
											option.value
										"
									>
										{{
											option.label
										}}
									</option>
								</select></label
							>
							<label
								class="flex flex-col gap-1 text-sm"
								>Мера
								количества<select
									v-model.number="
										item.measure
									"
									class="rounded border border-slate-300 p-2"
								>
									<option
										:value="
											undefined
										"
									>
										Штуки
										/
										единицы
										(по
										умолчанию)
									</option>
									<option
										v-for="option in measures"
										:key="
											option.value
										"
										:value="
											option.value
										"
									>
										{{
											option.label
										}}
									</option>
								</select></label
							>
						</div>
						<div
							class="mt-3 flex items-center justify-between"
						>
							<span
								class="text-sm font-medium"
								>Сумма:
								{{
									paymentAmount(
										correctionLineAmount(
											item,
										),
									)
								}}</span
							><Button
								type="button"
								label="Удалить позицию"
								icon="pi pi-trash"
								text
								severity="danger"
								:disabled="
									draft
										.receipt
										.items
										.length <=
									1
								"
								@click="
									removeItem(
										index,
									)
								"
							/>
						</div>
					</div>
					<Button
						type="button"
						label="Добавить позицию"
						icon="pi pi-plus"
						severity="secondary"
						:disabled="
							draft.receipt.items
								.length >= 200
						"
						@click="addItem"
					/>
				</fieldset>
				<fieldset
					:disabled="busy"
					class="grid gap-4 md:grid-cols-3"
				>
					<legend class="mb-2 font-semibold">
						Налогообложение и оплата
					</legend>
					<label
						class="flex flex-col gap-1 text-sm"
						>Система налогообложения<select
							v-model.number="
								draft.receipt
									.payment
									.taxSystem
							"
							class="rounded border border-slate-300 p-2"
						>
							<option
								v-for="option in fiscalTaxSystemOptions"
								:key="
									option.value
								"
								:value="
									option.value
								"
							>
								{{
									option.label
								}}
							</option>
						</select></label
					>
					<label
						v-for="field in paymentFields"
						:key="field.key"
						class="flex flex-col gap-1 text-sm"
						>{{ field.label }}, ₽<InputText
							:model-value="
								paymentInputs[
									field
										.key
								]
							"
							inputmode="decimal"
							required
							@update:model-value="
								changePayment(
									field.key,
									$event,
								)
							"
					/></label>
				</fieldset>
				<p class="font-semibold">
					Итого по позициям:
					{{ paymentAmount(total) }} · Оплата:
					{{ paymentAmount(paymentTotal) }}
				</p>
				<fieldset
					:disabled="busy"
					class="grid gap-4 md:grid-cols-2"
				>
					<legend class="mb-2 font-semibold">
						Реквизиты чека
					</legend>
					<label
						class="flex flex-col gap-1 text-sm"
						>Кассир<InputText
							v-model="
								draft.receipt
									.additionalData
									.cashierName
							"
							required
							maxlength="64"
					/></label>
					<label
						class="flex flex-col gap-1 text-sm"
						>ИНН кассира<InputText
							v-model="
								draft.receipt
									.additionalData
									.cashierINN
							"
							inputmode="numeric"
							maxlength="12"
					/></label>
					<label
						class="flex flex-col gap-1 text-sm"
						>Телефон или email
						покупателя<InputText
							v-model="
								draft.receipt
									.additionalData
									.customerContact
							"
							maxlength="64"
					/></label>
					<label
						class="flex flex-col gap-1 text-sm"
						>Адрес расчётов<InputText
							v-model="
								draft.receipt
									.additionalData
									.settlementAddress
							"
							maxlength="256"
					/></label>
					<label
						class="flex flex-col gap-1 text-sm"
						>Место расчётов / сайт<InputText
							v-model="
								draft.receipt
									.additionalData
									.settlementPlace
							"
							maxlength="256"
					/></label>
					<div
						class="flex flex-wrap items-center gap-5 text-sm"
					>
						<label
							class="flex items-center gap-2"
							><input
								v-model="
									internetPayment
								"
								type="checkbox"
							/>Расчёт в
							интернете</label
						><label
							class="flex items-center gap-2"
							><input
								v-model="
									printSuppressed
								"
								type="checkbox"
							/>Без печати чека</label
						>
					</div>
				</fieldset>
				<p
					v-if="formError"
					role="status"
					class="text-amber-800"
				>
					{{ formError }}
				</p>
				<p
					v-if="previewError"
					role="alert"
					class="whitespace-pre-wrap text-red-700"
				>
					{{ previewError }}
				</p>
				<div class="flex justify-end gap-2">
					<Button
						type="button"
						label="Закрыть"
						severity="secondary"
						:disabled="busy"
						@click="editing = false"
					/><Button
						type="submit"
						label="Проверить и посмотреть чеки"
						:loading="previewing"
						:disabled="!canPreview"
					/>
				</div>
			</form>
		</Dialog>
		<Dialog
			:visible="Boolean(preview)"
			modal
			header="Подтверждение коррекции"
			:style="{ width: 'min(74rem, 96vw)' }"
			:closable="!submitting && !pending"
			:close-on-escape="!submitting && !pending"
			@update:visible="!$event && (preview = null)"
		>
			<template v-if="preview && quote">
				<p
					class="mb-4 rounded bg-blue-50 p-3 text-sm leading-relaxed text-blue-950"
				>
					{{ correctionExplanation }}
				</p>
				<p class="mb-3 text-sm">
					Исходный чек: ФД
					{{ preview.original.document_number }} ·
					ФП {{ preview.original.fiscal_sign }}.
					Дата расчёта:
					{{ previewRequest?.calculation_date }}.
					Причина: {{ previewRequest?.reason }}
				</p>
				<div class="grid gap-4 lg:grid-cols-2">
					<CorrectionReceiptSummary
						:receipt="preview.reversal"
						title="1. Чек коррекции «возврат прихода»"
					/><CorrectionReceiptSummary
						:receipt="preview.replacement"
						title="2. Чек коррекции «приход»"
					/>
				</div>
				<p
					v-if="quote.source.state === 'demo'"
					class="mt-3 font-semibold text-amber-800"
				>
					Будет выполнена демо-коррекция без
					выдачи чеков.
				</p>
				<p
					v-if="submitError"
					role="alert"
					class="mt-3 whitespace-pre-wrap text-red-700"
				>
					{{ submitError }}
				</p>
				<div
					v-if="pending"
					class="mt-4 space-y-2 rounded bg-amber-50 p-3"
				>
					<p>
						Ответ сервера не получен.
						Проверьте отправку с тем же
						ключом.
					</p>
					<Button
						type="button"
						label="Проверить отправку"
						:loading="submitting"
						@click="retry"
					/>
				</div>
				<div v-else class="mt-4 flex justify-end gap-2">
					<Button
						type="button"
						label="Вернуться к редактированию"
						severity="secondary"
						:disabled="submitting"
						@click="preview = null"
					/><Button
						type="button"
						:label="
							quote.source.state ===
							'demo'
								? 'Создать демо-коррекцию'
								: 'Создать два чека коррекции'
						"
						:loading="submitting"
						:disabled="
							!quote.eligible ||
							loading ||
							Boolean(loadError) ||
							Boolean(staleSource)
						"
						@click="send"
					/>
				</div>
			</template>
		</Dialog>
		<Dialog
			:visible="Boolean(resumeID)"
			modal
			header="Продолжить коррекцию?"
			:style="{ width: 'min(32rem, 96vw)' }"
			@update:visible="!$event && (resumeID = '')"
		>
			<p>
				Будет повторён только этап с подтверждённой
				ошибкой. Уже выданные чеки повторно не
				создаются. Если первый чек выдан, будет создан
				только второй чек с исправленными данными.
			</p>
			<div class="mt-4 flex justify-end gap-2">
				<Button
					type="button"
					label="Отмена"
					severity="secondary"
					@click="resumeID = ''"
				/><Button
					type="button"
					label="Продолжить"
					:disabled="busy"
					@click="continueCorrection"
				/>
			</div>
		</Dialog>
	</section>
</template>
