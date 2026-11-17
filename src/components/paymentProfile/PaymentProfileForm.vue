<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import {
	CollectionForm,
	errorText,
	FormField,
	useCollectionFormModel,
	type FormErrorsView,
} from "@katren/vue-collection-lib";

import {
	discoverPaymentProfile,
	type PaymentProfileDiscovery,
	type PaymentProfileDiscoveryCandidate,
} from "@/api/paymentProfileDiscovery";
import CatalogueReferenceSelect from "@/components/references/CatalogueReferenceSelect.vue";
import { createPaymentProfileFormModel, type PaymentProfileFormModel } from "@/forms/paymentProfile.gen";
import { salonCompanySelectReference } from "@/references/salonSelectReferences";
import {
	PAYMENT_PROFILE_ENVIRONMENT_VALUES,
	type PaymentProfileEnvironment,
} from "@/types/enums/paymentProfileEnvironment.gen";
import type { PaymentProfileNew } from "@/types/paymentProfile.gen";

const props = withDefaults(
	defineProps<{
		model?: Partial<PaymentProfileFormModel>;
		mode?: "create" | "edit" | "copy";
		errors?: FormErrorsView;
		submitting?: boolean;
		credentialConfigured?: boolean;
		hasPayments?: boolean;
		hasCardPayments?: boolean;
	}>(),
	{
		model: () => ({}),
		mode: "create",
		submitting: false,
		credentialConfigured: false,
		hasPayments: false,
		hasCardPayments: false,
	},
);

const emit = defineEmits<{
	submit: [model: PaymentProfileNew];
	cancel: [];
	changed: [dirty: boolean];
}>();

const { t } = useI18n();
const bankURLs: Record<PaymentProfileEnvironment, string> = {
	mock: "http://127.0.0.1:8099",
	sandbox: "https://enter.tochka.com/sandbox/v2",
	production: "https://enter.tochka.com/uapi",
};
const bankURLPresets = [
	{ environment: "sandbox", value: bankURLs.sandbox, label: "Точка Банк · песочница" },
	{ environment: "production", value: bankURLs.production, label: "Точка Банк · рабочий API" },
] satisfies { environment: PaymentProfileEnvironment; value: string; label: string }[];
const bankURLHints: Record<PaymentProfileEnvironment, string> = {
	mock: "Укажите адрес локального имитатора платежей, если он запущен отдельно.",
	sandbox: "Используйте тестовый API Точки или введите адрес локального имитатора.",
	production: "Адрес рабочего API Точка Банка для реальных платежей.",
};
const optionalText = (value: string | null | undefined): string | null => value?.trim() || null;
const accountNumber = (value: string | null | undefined): string | null =>
	optionalText(value)?.split("/", 1)[0] || null;
const { form } = useCollectionFormModel<PaymentProfileFormModel>({
	model: () => props.model,
	defaults: createPaymentProfileFormModel,
	fromModel: (model, defaults) => {
		const environment = model.environment ?? defaults.environment ?? "mock";
		return {
			...defaults,
			...model,
			environment,
			api_base_url: model.api_base_url || bankURLs[environment],
			account_id: accountNumber(model.account_id),
		};
	},
});

const editing = computed(() => props.mode === "edit");
const environmentOptions = computed(() =>
	PAYMENT_PROFILE_ENVIRONMENT_VALUES.map((value) => ({
		value,
		label: t(`PaymentProfileEnvironment.${value}`),
	})),
);
const setEnvironment = (environment: PaymentProfileEnvironment): void => {
	form.value.environment = environment;
	form.value.api_base_url = bankURLs[environment];
};
const apiBaseURLLocked = computed(
	() => editing.value && (props.hasPayments || props.credentialConfigured),
);
const bankURLPresetDisabled = (preset: (typeof bankURLPresets)[number]): boolean =>
	editing.value && preset.environment !== form.value.environment;
const setAPIBaseURL = (value: string): void => {
	if (!editing.value) {
		const preset = bankURLPresets.find((option) => option.value === value.trim());
		if (preset) {
			form.value.environment = preset.environment;
		} else if (form.value.environment === "production") {
			form.value.environment = "mock";
		}
	}
	form.value.api_base_url = value;
};

const fieldLabel = (field: keyof PaymentProfileFormModel): string => t(`PaymentProfile.fields.${field}`);
const controlID = (field: keyof PaymentProfileFormModel): string => `paymentProfile-${field}`;

type BankField = "customer_code" | "sbp_merchant_id" | "acquiring_merchant_id";
const discovery = shallowRef<PaymentProfileDiscovery | null>(null);
const discoveryError = ref("");
const pendingCompany = ref<string | null>(null);
const discoveryRequest = shallowRef<AbortController | null>(null);
const discoveryDisabled = computed(
	() =>
		!editing.value ||
		!props.model.id ||
		!props.credentialConfigured ||
		props.submitting ||
		props.model.environment === "mock" ||
		(props.hasPayments && props.hasCardPayments),
);
const currentCustomer = computed(() => optionalText(form.value.customer_code));
const matchedDiscovery = computed(() =>
	discovery.value?.customer_code === currentCustomer.value ? discovery.value : null,
);
const bankFieldLocked = (field: BankField): boolean =>
	field === "acquiring_merchant_id" ? props.hasCardPayments : props.hasPayments;
const candidateOptions = (items: PaymentProfileDiscoveryCandidate[] = []) =>
	items.map((item) => ({
		value: item.id,
		label: [...new Set([item.name, item.detail, item.id].filter(Boolean))].join(" · "),
	}));
const bankOptions = computed(() => ({
	customer_code: candidateOptions(discovery.value?.companies),
	sbp_merchant_id: candidateOptions(matchedDiscovery.value?.sbp_merchants),
	acquiring_merchant_id: candidateOptions(matchedDiscovery.value?.acquiring_merchants),
}));
const bankSelection = (field: BankField): string | null => {
	const value = optionalText(form.value[field]);
	return bankOptions.value[field].some((option) => option.value === value) ? value : null;
};
const showBankPicker = (field: BankField): boolean => {
	const options = bankOptions.value[field];
	return !bankFieldLocked(field) && (options.length > 1 || (options.length === 1 && !bankSelection(field)));
};
const issueMessages = {
	selection_required: "Найдено несколько вариантов. Выберите нужный.",
	no_eligible_results: "Подходящие реквизиты в Точка Банке не найдены.",
	not_registered: "Компания не зарегистрирована в СБП.",
	permission_denied: "У сохранённого JWT нет доступа к этим реквизитам.",
	lookup_failed: "Не удалось получить эти реквизиты из Точка Банка.",
};
const bankFieldMessage = (field: BankField): string | undefined => {
	const result = field === "customer_code" ? discovery.value : matchedDiscovery.value;
	const issue = result?.issues[field];
	if (issue) {
		return issueMessages[issue];
	}
	if (
		field === "customer_code" &&
		result?.customer_code &&
		result.customer_code !== currentCustomer.value
	) {
		return "Код найденной компании отличается от текущего. Проверьте его перед выбором.";
	}
	if (bankOptions.value[field].length > 0 && optionalText(form.value[field]) && !bankSelection(field)) {
		return "Получены другие реквизиты. Текущее значение сохранено для проверки.";
	}
};

const stopDiscovery = (): void => {
	discoveryRequest.value?.abort();
	discoveryRequest.value = null;
};
const resetDiscovery = (): void => {
	stopDiscovery();
	discovery.value = null;
	discoveryError.value = "";
	pendingCompany.value = null;
};
watch([() => props.model, discoveryDisabled], resetDiscovery, { flush: "sync" });
watch(
	currentCustomer,
	() => {
		stopDiscovery();
		discoveryError.value = "";
		pendingCompany.value = null;
	},
	{ flush: "sync" },
);
onBeforeUnmount(stopDiscovery);

const fillBankMerchants = (result: PaymentProfileDiscovery): void => {
	if (!result.customer_code || result.customer_code !== currentCustomer.value) {
		return;
	}
	const fields = [
		{ field: "sbp_merchant_id", candidates: result.sbp_merchants },
		{ field: "acquiring_merchant_id", candidates: result.acquiring_merchants },
	] as const;
	for (const { field, candidates } of fields) {
		if (!bankFieldLocked(field) && !optionalText(form.value[field]) && candidates.length === 1) {
			form.value[field] = candidates[0]!.id;
		}
	}
};
const lookupBank = async (customerCode?: string): Promise<void> => {
	const id = props.model.id;
	if (!id || discoveryDisabled.value || (customerCode !== undefined && bankFieldLocked("customer_code"))) {
		return;
	}
	stopDiscovery();
	pendingCompany.value = null;
	discoveryError.value = "";
	const controller = new AbortController();
	discoveryRequest.value = controller;
	const draftCode = currentCustomer.value;
	const requestedCode = customerCode ?? (
		draftCode === optionalText(props.model.customer_code) ? undefined : draftCode ?? undefined
	);
	try {
		const result = await discoverPaymentProfile(id, requestedCode, controller.signal);
		if (
			controller.signal.aborted ||
			discoveryDisabled.value ||
			(customerCode !== undefined && bankFieldLocked("customer_code"))
		) {
			return;
		}
		discoveryRequest.value = null;
		if (customerCode !== undefined && result.customer_code !== customerCode) {
			discoveryError.value = "Точка Банк не подтвердила выбранную компанию.";
			return;
		}
		if (customerCode !== undefined && customerCode !== currentCustomer.value) {
			// Explicit selection confirms the company change. Merchant IDs from the
			// previous company cannot be reused for the new company.
			if (!bankFieldLocked("sbp_merchant_id")) {
				form.value.sbp_merchant_id = null;
			}
			if (!bankFieldLocked("acquiring_merchant_id")) {
				form.value.acquiring_merchant_id = null;
			}
			form.value.customer_code = customerCode;
		} else if (result.customer_code && !currentCustomer.value && !bankFieldLocked("customer_code")) {
			form.value.customer_code = result.customer_code;
		}
		discovery.value = result;
		fillBankMerchants(result);
	} catch (cause: unknown) {
		if (!controller.signal.aborted) {
			discoveryError.value = errorText(cause);
		}
	} finally {
		if (discoveryRequest.value === controller) {
			discoveryRequest.value = null;
		}
	}
};

const selectBankValue = (field: BankField, value: unknown): void => {
	if (
		discoveryDisabled.value ||
		discoveryRequest.value ||
		bankFieldLocked(field) ||
		typeof value !== "string" ||
		!bankOptions.value[field].some((option) => option.value === value)
	) {
		return;
	}
	if (field !== "customer_code") {
		form.value[field] = value;
		return;
	}
	if (value === currentCustomer.value) {
		return;
	}
	if (optionalText(form.value.sbp_merchant_id) || optionalText(form.value.acquiring_merchant_id)) {
		pendingCompany.value = value;
		return;
	}
	void lookupBank(value);
};

const accountForSave = (value: string | null | undefined): string | null => {
	const number = accountNumber(value);
	const savedAccount = optionalText(props.model.account_id);
	return number === accountNumber(savedAccount) ? savedAccount : number;
};
const formatDate = (value: Date | null | undefined): string => value?.toLocaleString("ru-RU") ?? "";
const identityFields = [
	{
		field: "client_id",
		frozenAfterPayment: false,
		help: "Интернет-банк Точки показывает этот идентификатор рядом с JWT. Он нужен для вебхуков. Для запросов оплаты его можно оставить пустым.",
	},
	{
		field: "customer_code",
		frozenAfterPayment: true,
		help: "Код вашей компании или ИП в Точка Банке. Его можно получить методом Get Customers List.",
	},
	{
		field: "sbp_merchant_id",
		frozenAfterPayment: true,
		help: "Идентификатор торговой точки в СБП. Его можно получить методом Get Merchants List.",
	},
	{
		field: "account_id",
		frozenAfterPayment: true,
		help: "Укажите 20 цифр расчётного счёта. Для нового счёта сервер добавит БИК Точка Банка.",
	},
] as const;
const bankDurationFields = [
	{ field: "qr_ttl_minutes", max: 129600 },
	{ field: "http_timeout_seconds", max: 300 },
] as const;
const redirectFields = [
	{ field: "card_redirect_url", help: "Сюда Точка возвращает покупателя после успешной оплаты." },
	{
		field: "card_fail_redirect_url",
		help: "Сюда Точка возвращает покупателя при неуспешной оплате.",
	},
] as const;
const timestampFields = ["created_at", "updated_at"] as const;

const mutation = (data: PaymentProfileFormModel): PaymentProfileNew => ({
	company_id: data.company_id ?? 0,
	name: data.name?.trim() ?? "",
	environment: data.environment ?? "mock",
	api_base_url: data.api_base_url?.trim() ?? "",
	client_id: optionalText(data.client_id),
	customer_code: optionalText(data.customer_code),
	sbp_merchant_id: optionalText(data.sbp_merchant_id),
	account_id: accountForSave(data.account_id),
	qr_ttl_minutes: data.qr_ttl_minutes ?? 0,
	http_timeout_seconds: data.http_timeout_seconds ?? 0,
	enabled: editing.value && (data.enabled ?? false),
	cards_enabled: data.cards_enabled ?? false,
	acquiring_merchant_id: optionalText(data.acquiring_merchant_id),
	card_ttl_minutes: data.card_ttl_minutes ?? 0,
	card_redirect_url: optionalText(data.card_redirect_url),
	card_fail_redirect_url: optionalText(data.card_fail_redirect_url),
});

const dirty = computed(() => {
	if (!editing.value) {
		return false;
	}
	const current = mutation(form.value);
	const saved = mutation(props.model);
	return (Object.keys(current) as (keyof PaymentProfileNew)[]).some(
		(field) => current[field] !== saved[field],
	);
});
watch(dirty, (value) => emit("changed", value), { immediate: true });
</script>

<template>
	<CollectionForm
		:errors="props.errors"
		:submitting="props.submitting"
		@submit="emit('submit', mutation(form))"
		@cancel="emit('cancel')"
	>
		<fieldset
			class="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-2"
			:disabled="props.submitting"
		>
			<legend class="px-2 text-sm font-semibold">Основные настройки</legend>
			<FormField
				field="company_id"
				:forId="controlID('company_id')"
				:label="fieldLabel('company_id')"
				:errors="props.errors"
				v-slot="{ invalid }"
			>
				<CatalogueReferenceSelect
					:id="controlID('company_id')"
					v-model="form.company_id"
					:reference="salonCompanySelectReference"
					:label="fieldLabel('company_id')"
					:invalid="invalid"
					:disabled="editing || props.submitting"
					:showClear="false"
					required
				/>
			</FormField>
			<FormField
				field="name"
				:forId="controlID('name')"
				:label="fieldLabel('name')"
				:errors="props.errors"
				v-slot="{ invalid }"
			>
				<InputText
					:id="controlID('name')"
					v-model="form.name"
					:invalid="invalid"
					maxlength="200"
					required
				/>
			</FormField>
			<FormField field="provider" :forId="controlID('provider')" :label="fieldLabel('provider')">
				<InputText
					:id="controlID('provider')"
					:modelValue="form.provider === 'tochka' ? 'Точка Банк' : form.provider"
					readonly
				/>
			</FormField>
			<FormField
				field="environment"
				:forId="controlID('environment')"
				:label="fieldLabel('environment')"
				:errors="props.errors"
				v-slot="{ invalid }"
			>
				<Select
					:labelId="controlID('environment')"
					:ariaLabel="fieldLabel('environment')"
					:modelValue="form.environment"
					:options="environmentOptions"
					:invalid="invalid"
					:disabled="editing || props.submitting"
					optionLabel="label"
					optionValue="value"
					@update:modelValue="setEnvironment"
				/>
			</FormField>
			<FormField
				field="enabled"
				:forId="controlID('enabled')"
				:label="fieldLabel('enabled')"
				:errors="props.errors"
				v-slot="{ invalid }"
			>
				<Checkbox
					:inputId="controlID('enabled')"
					v-model="form.enabled"
					:invalid="invalid"
					:disabled="
						!editing ||
						props.submitting ||
						(!props.credentialConfigured && !form.enabled)
					"
					binary
				/>
				<small v-if="!editing" class="text-slate-600"
					>Профиль создаётся выключенным. Сохраните его, добавьте JWT и включите
					профиль.</small
				>
				<small
					v-else-if="!props.credentialConfigured && !form.enabled"
					class="text-slate-600"
					>Для включения профиля настройте JWT.</small
				>
			</FormField>
			<FormField v-if="editing" field="id" :forId="controlID('id')" :label="fieldLabel('id')">
				<InputText :id="controlID('id')" :modelValue="form.id?.toString()" readonly />
			</FormField>
		</fieldset>

		<fieldset
			class="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-2"
			:disabled="props.submitting"
		>
			<legend class="px-2 text-sm font-semibold">Подключение к Точка Банку и СБП</legend>
			<div v-if="editing" class="space-y-2 md:col-span-2">
				<Button
					type="button"
					label="Заполнить из Точка Банка"
					severity="secondary"
					:loading="discoveryRequest !== null"
					:disabled="discoveryDisabled || discoveryRequest !== null"
					@click="lookupBank()"
				/>
				<p v-if="discoveryError" class="text-sm text-red-700" role="alert">{{ discoveryError }}</p>
				<p v-else-if="discovery" class="text-sm text-slate-600" role="status">
					Проверьте найденные реквизиты и сохраните профиль.
				</p>
				<p v-else-if="form.environment === 'mock'" class="text-sm text-slate-600">
					Поиск реквизитов доступен в песочнице и рабочей среде Точка Банка.
				</p>
				<p v-else-if="!props.credentialConfigured" class="text-sm text-slate-600">
					Сохраните JWT, чтобы загрузить реквизиты из Точка Банка.
				</p>
			</div>
			<FormField
				field="api_base_url"
				:forId="controlID('api_base_url')"
				:label="fieldLabel('api_base_url')"
				:errors="props.errors"
				containerClass="md:col-span-2"
			>
				<InputText
					v-if="apiBaseURLLocked"
					:id="controlID('api_base_url')"
					:modelValue="form.api_base_url"
					:invalid="props.errors?.has('api_base_url') ?? false"
					:aria-describedby="`${controlID('api_base_url')}-help`"
					readonly
				/>
				<Select
					v-else
					:labelId="controlID('api_base_url')"
					:modelValue="form.api_base_url"
					:options="bankURLPresets"
					:optionDisabled="bankURLPresetDisabled"
					:invalid="props.errors?.has('api_base_url') ?? false"
					:pt="{
						label: {
							inputmode: 'url',
							spellcheck: false,
							required: true,
							'aria-describedby': `${controlID('api_base_url')}-help`,
						},
					}"
					optionLabel="value"
					optionValue="value"
					editable
					@update:modelValue="setAPIBaseURL"
				>
					<template #option="{ option }">
						<div>
							<div>{{ option.label }}</div>
							<small class="text-slate-600">{{ option.value }}</small>
						</div>
					</template>
				</Select>
				<small :id="`${controlID('api_base_url')}-help`" class="text-slate-600">
					{{ bankURLHints[form.environment ?? 'mock'] }}
				</small>
				<small
					v-if="editing && (props.hasPayments || props.credentialConfigured)"
					class="text-slate-600"
					>Адрес привязан к сохранённым данным подключения. Для нового адреса
					создайте другой профиль.</small
				>
			</FormField>
			<FormField
				v-for="{ field, frozenAfterPayment, help } in identityFields"
				:key="field"
				:field="field"
				:forId="controlID(field)"
				:label="fieldLabel(field)"
				:errors="props.errors"
				v-slot="{ invalid }"
			>
				<InputText
					:id="controlID(field)"
					v-model="form[field]"
					:invalid="invalid"
					:readonly="editing && props.hasPayments && frozenAfterPayment"
					:aria-describedby="`${controlID(field)}-help`"
					:inputmode="field === 'account_id' ? 'numeric' : undefined"
					spellcheck="false"
				/>
				<small :id="`${controlID(field)}-help`" class="text-slate-600">{{ help }}</small>
				<template v-if="field === 'customer_code' || field === 'sbp_merchant_id'">
					<Select
						v-if="showBankPicker(field)"
						:aria-label="`${fieldLabel(field)} из Точка Банка`"
						:modelValue="bankSelection(field)"
						:options="bankOptions[field]"
						:disabled="discoveryDisabled || discoveryRequest !== null"
						optionLabel="label"
						optionValue="value"
						placeholder="Выберите из Точка Банка"
						@update:modelValue="selectBankValue(field, $event)"
					/>
					<small v-if="bankFieldMessage(field)" class="text-amber-800" role="status">
						{{ bankFieldMessage(field) }}
					</small>
				</template>
			</FormField>
			<div v-if="pendingCompany" class="space-y-2 rounded-md border border-amber-300 p-3 md:col-span-2">
				<p class="text-sm" role="status">
					При смене компании прежние идентификаторы торговых точек будут заменены. Если для новой
					компании подходящие точки не найдены, эти поля останутся пустыми.
					Проверьте, что расчётный счёт принадлежит выбранной компании.
				</p>
				<div class="flex flex-wrap gap-2">
					<Button type="button" label="Сменить компанию" @click="lookupBank(pendingCompany)" />
					<Button
						type="button"
						label="Отмена"
						severity="secondary"
						@click="pendingCompany = null"
					/>
				</div>
			</div>
			<FormField
				v-for="{ field, max } in bankDurationFields"
				:key="field"
				:field="field"
				:forId="controlID(field)"
				:label="fieldLabel(field)"
				:errors="props.errors"
				v-slot="{ invalid }"
			>
				<InputNumber
					:inputId="controlID(field)"
					v-model="form[field]"
					:invalid="invalid"
					:min="1"
					:max="max"
					:useGrouping="false"
					required
				/>
			</FormField>
			<small v-if="editing && props.hasPayments" class="text-slate-600 md:col-span-2">
				Реквизиты, использованные в платежах, сохраняются для сверки и возвратов. Для
				новых реквизитов создайте другой профиль.
			</small>
		</fieldset>

		<fieldset
			class="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-2"
			:disabled="props.submitting"
		>
			<legend class="px-2 text-sm font-semibold">Оплата картой</legend>
			<FormField
				field="cards_enabled"
				:forId="controlID('cards_enabled')"
				:label="fieldLabel('cards_enabled')"
				:errors="props.errors"
				v-slot="{ invalid }"
			>
				<Checkbox
					:inputId="controlID('cards_enabled')"
					v-model="form.cards_enabled"
					:invalid="invalid"
					binary
				/>
			</FormField>
			<FormField
				field="acquiring_merchant_id"
				:forId="controlID('acquiring_merchant_id')"
				:label="fieldLabel('acquiring_merchant_id')"
				:errors="props.errors"
				v-slot="{ invalid }"
			>
				<InputText
					:id="controlID('acquiring_merchant_id')"
					v-model="form.acquiring_merchant_id"
					:invalid="invalid"
					:readonly="editing && props.hasCardPayments"
					:required="Boolean(form.cards_enabled)"
					aria-describedby="paymentProfile-acquiring_merchant_id-help"
					inputmode="numeric"
					pattern="[0-9]{15}"
					maxlength="15"
				/>
				<small id="paymentProfile-acquiring_merchant_id-help" class="text-slate-600">
					Идентификатор торговой точки для оплаты картой. Возьмите 15 цифр из поля
					merchantId в ответе Get Retailers.
				</small>
				<small v-if="editing && props.hasCardPayments" class="text-slate-600"
					>ТСП закреплена за платежами по этому профилю.</small
				>
				<Select
					v-if="showBankPicker('acquiring_merchant_id')"
					aria-label="ТСП эквайринга из Точка Банка"
					:modelValue="bankSelection('acquiring_merchant_id')"
					:options="bankOptions.acquiring_merchant_id"
					:disabled="discoveryDisabled || discoveryRequest !== null"
					optionLabel="label"
					optionValue="value"
					placeholder="Выберите из Точка Банка"
					@update:modelValue="selectBankValue('acquiring_merchant_id', $event)"
				/>
				<small v-if="bankFieldMessage('acquiring_merchant_id')" class="text-amber-800" role="status">
					{{ bankFieldMessage("acquiring_merchant_id") }}
				</small>
			</FormField>
			<FormField
				field="card_ttl_minutes"
				:forId="controlID('card_ttl_minutes')"
				:label="fieldLabel('card_ttl_minutes')"
				:errors="props.errors"
				v-slot="{ invalid }"
			>
				<InputNumber
					:inputId="controlID('card_ttl_minutes')"
					v-model="form.card_ttl_minutes"
					:invalid="invalid"
					:min="1"
					:max="44640"
					:useGrouping="false"
					required
				/>
			</FormField>
			<FormField
				v-for="{ field, help } in redirectFields"
				:key="field"
				:field="field"
				:forId="controlID(field)"
				:label="fieldLabel(field)"
				:errors="props.errors"
				v-slot="{ invalid }"
			>
				<InputText
					:id="controlID(field)"
					v-model="form[field]"
					:invalid="invalid"
					:aria-describedby="`${controlID(field)}-help`"
					inputmode="url"
					spellcheck="false"
					maxlength="1900"
				/>
				<small :id="`${controlID(field)}-help`" class="text-slate-600">{{ help }}</small>
			</FormField>
			<small class="text-slate-600 md:col-span-2">
				В обоих полях можно указать адрес страницы /pay-bank-card. Страница узнаёт статус оплаты
				на сервере.
			</small>
		</fieldset>

		<fieldset
			v-if="editing"
			class="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-3"
		>
			<legend class="px-2 text-sm font-semibold">Служебные данные</legend>
			<FormField
				field="config_version"
				:forId="controlID('config_version')"
				:label="fieldLabel('config_version')"
			>
				<InputText
					:id="controlID('config_version')"
					:modelValue="form.config_version?.toString()"
					readonly
				/>
			</FormField>
			<FormField
				v-for="field in timestampFields"
				:key="field"
				:field="field"
				:forId="controlID(field)"
				:label="fieldLabel(field)"
			>
				<InputText
					:id="controlID(field)"
					:modelValue="formatDate(form[field])"
					readonly
				/>
			</FormField>
		</fieldset>
	</CollectionForm>
</template>
