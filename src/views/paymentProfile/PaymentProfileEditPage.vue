<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import Textarea from "primevue/textarea";
import { CollectionEditPage, errorText, useCollectionEditPage } from "@katren/vue-collection-lib";

import { paymentProfileApi } from "@/api/paymentProfile.gen";
import {
	getPaymentProfileCredential,
	setPaymentProfileCredential,
	type PaymentProfileCredentialStatus,
} from "@/api/paymentProfileCredential";
import PaymentProfileForm from "@/components/paymentProfile/PaymentProfileForm.vue";
import { usePaymentProfileSchemas } from "@/composables/schemas/usePaymentProfileSchemas.gen";
import {
	createPaymentProfileFormModel,
	paymentProfileFormMutationFields,
	type PaymentProfileFormModel,
} from "@/forms/paymentProfile.gen";
import type {
	PaymentProfile,
	PaymentProfileKey,
	PaymentProfileNew,
	PaymentProfileUpd,
} from "@/types/paymentProfile.gen";

const { t } = useI18n();
const schemas = usePaymentProfileSchemas();
const edit = useCollectionEditPage<
	PaymentProfileFormModel,
	PaymentProfileKey,
	PaymentProfileNew,
	PaymentProfileUpd,
	PaymentProfile
>({
	api: paymentProfileApi,
	createRouteName: "paymentProfileCreate",
	listRoute: { name: "paymentProfiles" },
	keyFromRoute: (route) => ({ id: Number(route.params.id ?? 0) }),
	createModel: createPaymentProfileFormModel,
	fields: paymentProfileFormMutationFields,
	createSchema: schemas.PaymentProfileNewSchema,
	updateSchema: schemas.PaymentProfileUpdSchema,
	success: { mode: "stay", editRoute: ({ id }) => ({ name: "paymentProfileEdit", params: { id } }) },
});

const profileId = computed(() => {
	const id = edit.key.value.id;
	return edit.mode.value === "edit" && edit.model.value.id === id && id > 0 ? id : null;
});
const status = shallowRef<PaymentProfileCredentialStatus | null>(null);
const statusError = ref("");
const statusRevision = ref(0);
const credentialSaving = ref(false);
const credentialError = ref("");
const credentialSaved = ref(false);
const settingsChanged = ref(false);
const jwt = ref("");

watch([profileId, () => edit.model.value.environment], () => {
	jwt.value = "";
	credentialError.value = "";
	credentialSaved.value = false;
});

watch(
	[profileId, statusRevision],
	async ([id], _, onCleanup) => {
		status.value = null;
		statusError.value = "";
		if (id === null) {
			return;
		}
		const controller = new AbortController();
		onCleanup(() => controller.abort());
		try {
			const result = await getPaymentProfileCredential(id, controller.signal);
			if (!controller.signal.aborted) {
				status.value = result;
			}
		} catch (cause: unknown) {
			if (!controller.signal.aborted) {
				statusError.value = errorText(cause);
			}
		}
	},
	{ immediate: true },
);

const canEditCredential = computed(
	() =>
		profileId.value !== null &&
		status.value !== null &&
		!settingsChanged.value &&
		!edit.submitting.value &&
		!credentialSaving.value,
);

const saveCredential = async (): Promise<void> => {
	const id = profileId.value;
	const value = jwt.value.trim();
	if (id === null || !value || !canEditCredential.value) {
		return;
	}
	credentialSaving.value = true;
	credentialError.value = "";
	credentialSaved.value = false;
	jwt.value = "";
	try {
		const result = await setPaymentProfileCredential(id, value);
		if (profileId.value === id) {
			status.value = result;
			credentialSaved.value = true;
			await edit.load();
		}
	} catch (cause: unknown) {
		if (profileId.value === id) {
			credentialError.value = errorText(cause);
		}
	} finally {
		credentialSaving.value = false;
	}
};
</script>

<template>
	<CollectionEditPage
		:title="t(`PaymentProfile.form.${edit.mode.value}`)"
		:loading="edit.loading.value"
		@back="edit.goBack"
	>
		<PaymentProfileForm
			v-if="edit.mode.value !== 'edit' || profileId !== null"
			:model="edit.model.value"
			:mode="edit.mode.value"
			:errors="edit.errors"
			:submitting="edit.submitting.value || credentialSaving"
			:credentialConfigured="status?.configured ?? false"
			:hasPayments="status?.has_payments ?? edit.mode.value === 'edit'"
			:hasCardPayments="status?.has_card_payments ?? edit.mode.value === 'edit'"
			@submit="edit.submit"
			@cancel="edit.goBack"
			@changed="settingsChanged = $event"
		/>
		<p v-else role="alert" class="text-red-700">
			{{ edit.errors.formErrors[0] ?? "Не удалось загрузить платёжный профиль." }}
		</p>

		<section v-if="profileId !== null" class="mt-5 space-y-3 rounded-md border border-slate-200 p-4">
			<h3 class="font-semibold">Доступ к API Точки</h3>
			<template v-if="statusError">
				<p role="alert" class="text-red-700">{{ statusError }}</p>
				<Button
					type="button"
					label="Обновить состояние JWT"
					severity="secondary"
					@click="statusRevision += 1"
				/>
			</template>
			<p v-else-if="!status" role="status" class="text-sm text-slate-600">Загрузка состояния JWT…</p>
			<template v-else>
				<p class="text-sm text-slate-700">
					{{ status.configured ? "JWT настроен." : "Добавьте JWT, чтобы активировать профиль." }}
				</p>
				<form class="space-y-2" @submit.prevent="saveCredential">
					<label for="payment-profile-jwt" class="block text-sm font-medium">JWT Точки</label>
					<Textarea
						id="payment-profile-jwt"
						v-model="jwt"
						rows="4"
						class="w-full font-mono"
						aria-describedby="payment-profile-jwt-hint"
						autocomplete="off"
						spellcheck="false"
						maxlength="8192"
						:disabled="!canEditCredential"
						required
					/>
					<p id="payment-profile-jwt-hint" class="text-sm text-slate-600">
						Вставьте JWT для выбранной среды. Сохранённый токен скрыт.
					</p>
					<p v-if="settingsChanged" class="text-sm text-slate-600">
						Сохраните изменения профиля перед настройкой JWT.
					</p>
					<p v-if="credentialError" role="alert" class="text-sm text-red-700">
						{{ credentialError }}
					</p>
					<p v-if="credentialSaved" role="status" class="text-sm text-green-800">JWT сохранён.</p>
					<Button
						type="submit"
						:label="status.configured ? 'Заменить JWT' : 'Сохранить JWT'"
						icon="pi pi-key"
						severity="secondary"
						:loading="credentialSaving"
						:disabled="!jwt.trim() || !canEditCredential"
					/>
				</form>
			</template>
		</section>
	</CollectionEditPage>
</template>
