<script setup lang="ts">
import { useI18n } from "vue-i18n";

import {
	CollectionEditPage,
	useCollectionEditPage,
} from "@katren/vue-collection-lib";
import { companyApi } from "@/api/company.gen";
import CompanyForm from "@/components/company/CompanyForm.vue";
import { useCompanySchemas } from "@/composables/schemas/useCompanySchemas.gen";
import {
	createCompanyFormModel,
	companyFormMutationFields,
	type CompanyFormModel,
} from "@/forms/company.gen";
import type {
	Company,
	CompanyKey,
	CompanyNew,
	CompanyUpd,
} from "@/types/company.gen";

const { t } = useI18n();
const schemas = useCompanySchemas();
const edit = useCollectionEditPage<
	CompanyFormModel,
	CompanyKey,
	CompanyNew,
	CompanyUpd,
	Company
>({
	api: companyApi,
	createRouteName: "companyCreate",
	listRoute: { name: "companies" },
	keyFromRoute: (route) => ({
		id: Number(route.params.id ?? 0),
	}),
	copyKeyFromRoute: (route) => route.query.copy_id
		? ({
			id: Number(route.query.copy_id ?? 0),
		})
		: null,
	createModel: createCompanyFormModel,
	copyModel: (detail) => ({
		...detail,
		id: undefined,
		name: `${detail.name} - ${t("Grid.copySuffix")}`,
	}),
	fields: companyFormMutationFields,
	createSchema: schemas.CompanyNewSchema,
	updateSchema: schemas.CompanyUpdSchema,
	success: { mode: "back" },
});

const submit = async (model: CompanyNew): Promise<void> => {
	await edit.submit(model);
};
</script>

<template>
	<CollectionEditPage
		:title="t(`Company.form.${edit.mode.value}`)"
		:loading="edit.loading.value"
		@back="edit.goBack"
	>
		<CompanyForm
			:model="edit.model.value"
			:mode="edit.mode.value"
			:errors="edit.errors"
			:submitting="edit.submitting.value"
			@submit="submit"
			@cancel="edit.goBack"
		/>
	</CollectionEditPage>
</template>
