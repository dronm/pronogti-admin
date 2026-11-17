<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Button from "primevue/button";
import {
	CollectionGrid,
	FilterOperatorParam,
	type CollectionGridApi,
	type CollectionGridExpose,
	type CollectionParams,
	type GridColumn,
} from "@katren/vue-collection-lib";
import type { RefundQuoteLine } from "@/api/paymentRefund";
import { paymentAmount } from "@/utils/paymentDisplay";

const props = defineProps<{
	lines: RefundQuoteLine[];
	selected: number[];
	disabled?: boolean;
}>();

const emit = defineEmits<{
	select: [line: RefundQuoteLine];
}>();

const kinds = [
	{ value: "all", label: "Все" },
	{ value: "service", label: "Услуги" },
	{ value: "good", label: "Товары" },
] as const;

const kind = ref<(typeof kinds)[number]["value"]>("all");
const grid = ref<CollectionGridExpose>();
const quantityFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 });
const selectedIndexes = computed(() => new Set(props.selected));

const baseParams = computed<CollectionParams | undefined>(() =>
	kind.value === "all"
		? undefined
		: { filter: [{ f: { kind: { o: FilterOperatorParam.E, v: kind.value } } }] },
);

const api: CollectionGridApi<RefundQuoteLine, number, never, never> = {
	list: async (params) => {
		const rows = props.lines.filter((line) =>
			(params?.filter ?? []).every(({ f }) => {
				if (f.kind && line.kind !== f.kind.v) {
					return false;
				}
				if (typeof f.title?.v === "string") {
					// The grid adds one wildcard at each end for a contains search.
					const term = f.title.v.slice(1, -1).toLocaleLowerCase("ru-RU");
					return line.title.toLocaleLowerCase("ru-RU").includes(term);
				}
				return true;
			}),
		);
		const from = params?.from ?? 0;
		return {
			rows: rows.slice(from, from + (params?.count ?? rows.length)),
			agg: { tot_count: rows.length },
		};
	},
};

const columns: GridColumn<RefundQuoteLine>[] = [
	{
		field: "title",
		headerKey: "",
		header: "Позиция из продажи",
		dataType: "string",
		searchOperations: ["contains"],
	},
	{ field: "unit_price_kopecks", headerKey: "", header: "Цена продажи", searchable: false, align: "right" },
	{ field: "quantity", headerKey: "", header: "Куплено", searchable: false, align: "right" },
	{
		field: "remaining_quantity_milli",
		headerKey: "",
		header: "Доступно к возврату",
		searchable: false,
		align: "right",
	},
	{
		field: "remaining_amount_kopecks",
		headerKey: "",
		header: "Остаток суммы",
		searchable: false,
		align: "right",
	},
	{ field: "line_index", headerKey: "", header: "", searchable: false, align: "right", width: "8rem" },
];

const getKey = (line: RefundQuoteLine): number => line.line_index;
const kindLabel = (value: string): string =>
	value === "service" ? "Услуга" : value === "good" ? "Товар" : value;
const canSelect = (line: RefundQuoteLine): boolean =>
	!props.disabled &&
	!selectedIndexes.value.has(line.line_index) &&
	line.remaining_quantity_milli > 0 &&
	line.remaining_amount_kopecks > 0;

const selectLine = (line: RefundQuoteLine): void => {
	const current = props.lines.find(({ line_index }) => line_index === line.line_index);
	if (current && canSelect(current)) {
		emit("select", current);
	}
};

watch(
	() => props.lines,
	(lines, previous) => {
		if (lines.length === previous.length) {
			void grid.value?.load();
		}
	},
);
</script>

<template>
	<section>
		<h4 class="text-sm font-semibold">Товары и услуги из оплаченного заказа</h4>
		<div class="my-2 flex flex-wrap gap-1" role="group" aria-label="Виды позиций">
			<Button
				v-for="option in kinds"
				:key="option.value"
				type="button"
				size="small"
				:label="option.label"
				:outlined="kind !== option.value"
				:aria-pressed="kind === option.value"
				@click="kind = option.value"
			/>
		</div>

		<CollectionGrid
			:key="props.lines.length"
			ref="grid"
			:api="api"
			:columns="columns"
			:commands="[{ name: 'search' }]"
			commandsMode="replace"
			:showContextMenu="false"
			:baseParams="baseParams"
			dataKey="line_index"
			:getKey="getKey"
			:pageSize="10"
			:rowsPerPageOptions="[10, 20, 50]"
			rowSelection
			@edit="selectLine"
		>
			<template #body-title="{ data }">
				<div>{{ data.title }}</div>
				<div class="text-xs text-slate-600">
					{{ kindLabel(data.kind) }} · №{{ data.line_index + 1 }}
				</div>
			</template>
			<template #body-unit_price_kopecks="{ data }">{{
				paymentAmount(data.unit_price_kopecks)
			}}</template>
			<template #body-quantity="{ data }">{{ quantityFormat.format(Number(data.quantity)) }}</template>
			<template #body-remaining_quantity_milli="{ data }">
				{{ quantityFormat.format(data.remaining_quantity_milli / 1000) }}
			</template>
			<template #body-remaining_amount_kopecks="{ data }">{{
				paymentAmount(data.remaining_amount_kopecks)
			}}</template>
			<template #body-line_index="{ data }">
				<Button
					type="button"
					size="small"
					outlined
					:label="selectedIndexes.has(data.line_index) ? 'Добавлено' : 'Добавить'"
					:aria-label="`${selectedIndexes.has(data.line_index) ? 'Добавлено' : 'Добавить'}: ${data.title}, позиция ${data.line_index + 1}`"
					:disabled="!canSelect(data)"
					@click.stop="selectLine(data)"
				/>
			</template>
		</CollectionGrid>
	</section>
</template>
