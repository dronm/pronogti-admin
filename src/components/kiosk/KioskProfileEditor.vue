<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { GridColumn } from "@katren/vue-collection-lib";

import CatalogueReferenceSelect from "@/components/references/CatalogueReferenceSelect.vue";
import { createSalonProfileSelectReferences } from "@/references/salonSelectReferences";
import type { KioskList } from "@/types/kioskList.gen";

const props = defineProps<{
	row: KioskList;
	column: GridColumn<KioskList>;
	profileKind: "payment" | "fiscal" | "yclients";
	modelValue?: number | null;
	id?: string;
	disabled?: boolean;
	invalid?: boolean;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: number | null];
}>();

const { t } = useI18n();
const references = computed(() => createSalonProfileSelectReferences(props.row.company_id));
</script>

<template>
	<CatalogueReferenceSelect
		:id="props.id ?? `kiosk-${props.row.id}-${props.profileKind}-profile`"
		:reference="references[props.profileKind]"
		:modelValue="props.modelValue"
		:projectedValue="props.row[`${props.profileKind}_profile`]"
		:label="t(props.column.headerKey)"
		:defaultOptionLabel="t('Kiosk.reference.salonDefault', 'По умолчанию салона')"
		:disabled="props.disabled"
		:invalid="props.invalid"
		:showActions="false"
		@update:modelValue="emit('update:modelValue', $event)"
	/>
</template>
