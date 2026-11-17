<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import Tag from "primevue/tag";
import {
	CollectionGrid,
	FilterOperatorParam,
	type CollectionGridExpose,
	type CollectionParams,
	type GridColumn,
} from "@katren/vue-collection-lib";
import type { Refund } from "@/api/paymentRefund";
import { paymentAmount, paymentDate, paymentStatus, shortPaymentId } from "@/utils/paymentDisplay";

const props = defineProps<{ refunds: Refund[] }>();
const grid = useTemplateRef<CollectionGridExpose>("history");
const selectedId = ref<string | null>(null);
const selected = computed(() => props.refunds.find(({ id }) => id === selectedId.value));

const columns: GridColumn<Refund>[] = [
	{
		field: "id",
		header: "ID возврата",
		headerKey: "refund.id",
		dataType: "string",
		searchOperations: ["contains"],
	},
	{
		field: "created_at",
		header: "Создан",
		headerKey: "refund.created_at",
		searchable: false,
	},
	{
		field: "amount_kopecks",
		header: "Сумма",
		headerKey: "refund.amount_kopecks",
		align: "right",
		searchable: false,
	},
	{
		field: "bank_state",
		header: "Банк",
		headerKey: "refund.bank_state",
		searchable: false,
	},
	{
		field: "fiscal_state",
		header: "Чек возврата",
		headerKey: "refund.fiscal_state",
		searchable: false,
	},
];

const getKey = (row: Refund): string => row.id;
const api = {
	list: async (params?: CollectionParams) => {
		const rows = [...props.refunds].sort(
			(a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id),
		);
		const filters =
			params?.filter?.flatMap(({ f }) =>
				f.id?.o === FilterOperatorParam.ILK
					? [String(f.id.v).replace(/^%|%$/g, "").toLowerCase()]
					: [],
			) ?? [];
		const filtered = rows.filter(({ id }) => filters.every((query) => id.toLowerCase().includes(query)));
		const from = params?.from ?? 0;
		return {
			rows: filtered.slice(from, from + (params?.count ?? filtered.length)),
			agg: { tot_count: filtered.length },
		};
	},
};

watch(
	() => props.refunds,
	async () => {
		await grid.value?.load();
	},
);

const dateText = (value: string): string => paymentDate(new Date(value));
const statusText = (value: string): string => {
	switch (value) {
		case "queued":
			return "В очереди";
		case "submitting":
			return "Отправляется";
		case "confirmed":
			return "Подтверждён";
		case "rejected":
			return "Отклонён";
		case "waiting":
			return "Ожидает подтверждения банка";
		default:
			return paymentStatus(value);
	}
};
const statusSeverity = (value: string) => {
	switch (value) {
		case "confirmed":
		case "issued":
			return "success";
		case "rejected":
		case "failed":
			return "danger";
		case "pending":
		case "unknown":
			return "warn";
		default:
			return "secondary";
	}
};
</script>

<template>
	<section class="mt-5">
		<h3 class="mb-3 text-base font-semibold">История возвратов</h3>
		<p v-if="props.refunds.length === 0" class="text-sm text-slate-600">Возвратов пока нет.</p>
		<CollectionGrid
			v-else
			ref="history"
			:api="api"
			:columns="columns"
			:commands="[{ name: 'search' }]"
			commandsMode="replace"
			:showContextMenu="false"
			dataKey="id"
			:getKey="getKey"
			rowSelection
			@selection-change="selectedId = $event?.id ?? null"
		>
			<template #body-id="{ data }"
				><code :title="data.id">{{ shortPaymentId(data.id) }}</code></template
			>
			<template #body-created_at="{ data }">{{ dateText(data.created_at) }}</template>
			<template #body-amount_kopecks="{ data }">{{ paymentAmount(data.amount_kopecks) }}</template>
			<template #body-bank_state="{ data }"
				><Tag :value="statusText(data.bank_state)" :severity="statusSeverity(data.bank_state)"
			/></template>
			<template #body-fiscal_state="{ data }"
				><Tag :value="statusText(data.fiscal_state)" :severity="statusSeverity(data.fiscal_state)"
			/></template>
		</CollectionGrid>

		<section v-if="selected" class="mt-4 rounded-md border border-slate-200 p-4">
			<h4 class="mb-2 font-semibold">Сведения о возврате</h4>
			<code class="break-all text-xs">{{ selected.id }}</code>
			<dl class="my-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
				<div>
					<dt class="text-slate-600">Обновлён</dt>
					<dd>
						{{ dateText(selected.updated_at) }}
					</dd>
				</div>
				<div v-if="selected.bank_reference">
					<dt class="text-slate-600">Номер операции банка</dt>
					<dd class="break-all">
						{{ selected.bank_reference }}
					</dd>
				</div>
				<div v-if="selected.receipt_number">
					<dt class="text-slate-600">Номер фискального документа</dt>
					<dd>{{ selected.receipt_number }}</dd>
				</div>
				<div v-if="selected.error_code">
					<dt class="text-slate-600">Код ошибки</dt>
					<dd class="break-all">
						{{ selected.error_code }}
					</dd>
				</div>
			</dl>
			<div class="overflow-x-auto">
				<table class="w-full border-collapse text-left text-sm">
					<caption class="mb-2 text-left font-semibold">
						Позиции возврата
					</caption>
					<thead>
						<tr class="border-b border-slate-200">
							<th scope="col" class="py-2 pr-4">Позиция</th>
							<th scope="col" class="py-2 pr-4 text-right">Количество</th>
							<th scope="col" class="py-2 pr-4 text-right">Цена продажи</th>
							<th scope="col" class="py-2 text-right">Сумма возврата</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="line in selected.lines"
							:key="line.line_index"
							class="border-b border-slate-100"
						>
							<td class="py-2 pr-4">
								{{ line.title }}
								<div class="text-xs text-slate-600">
									{{ line.kind === "service" ? "Услуга" : "Товар" }}
									· №{{ line.line_index + 1 }}
								</div>
							</td>
							<td class="py-2 pr-4 text-right">
								{{ line.quantity.replace(".", ",") }}
							</td>
							<td class="py-2 pr-4 text-right">
								{{ paymentAmount(line.unit_price_kopecks) }}
							</td>
							<td class="py-2 text-right">
								{{ paymentAmount(line.amount_kopecks) }}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</section>
	</section>
</template>
