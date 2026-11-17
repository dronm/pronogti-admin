<script setup lang="ts">
import { useI18n } from "vue-i18n";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";

import {
	CollectionForm,
	FormField,
	useCollectionFormModel,
	type FormErrorsView,
} from "@katren/vue-collection-lib";
import {
	createCompanyFormModel,
	type CompanyFormModel,
} from "@/forms/company.gen";
import type { CompanyNew } from "@/types/company.gen";

type FormMode = "create" | "edit" | "copy";

const props = withDefaults(defineProps<{
	model?: Partial<CompanyFormModel>;
	mode?: FormMode;
	errors?: FormErrorsView;
	submitting?: boolean;
}>(), {
	model: () => ({}),
	mode: "create",
	errors: undefined,
	submitting: false,
});

const emit = defineEmits<{
	submit: [model: CompanyNew];
	cancel: [];
}>();

const { t } = useI18n();
const { form } = useCollectionFormModel<CompanyFormModel>({
	model: () => props.model,
	defaults: createCompanyFormModel,
});

const submit = (): void => {
	const model: CompanyNew = {
		id: form.value.id ?? 0,
		name: form.value.name?.trim() ?? "",
	};
	emit("submit", model);
};
</script>

<template>
	<CollectionForm
		:errors="props.errors"
		:submitting="props.submitting"
		@submit="submit"
		@cancel="emit('cancel')"
	>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<FormField
				field="id"
				forId="companyID"
				:label="t('Company.fields.id')"
				:errors="props.errors"
				containerClass=""
				v-slot="{ invalid }"
			>
				<InputNumber
					id="companyID"
					v-model="form.id"
					:invalid="invalid"
					:disabled="props.mode !== 'create'"
					:useGrouping="false"
					autofocus
					required
				/>
			</FormField>
			<FormField
				field="name"
				forId="companyName"
				:label="t('Company.fields.name')"
				:errors="props.errors"
				containerClass=""
				v-slot="{ invalid }"
			>
				<InputText
					id="companyName"
					v-model="form.name"
					:invalid="invalid"
					:disabled="false"
					required
				/>
			</FormField>
		</div>
	</CollectionForm>
</template>
