<script setup lang="ts">
import {
	CollectionGrid,
	SortDirect,
	type GridCommand,
} from "@katren/vue-collection-lib";
import { paymentOrderCollection } from "@/collections/paymentOrder.gen";
import PaymentStatusTag from "@/components/payment/PaymentStatusTag.vue";
import type { PaymentOrder, PaymentOrderKey } from "@/types/paymentOrder.gen";
import {
	paymentAmount,
	paymentEnvironment,
	paymentMethod,
	paymentOrderRoute,
	shortPaymentId,
} from "@/utils/paymentDisplay";

const api = { list: paymentOrderCollection.api.list };
const routes = { edit: (row: PaymentOrder) => paymentOrderRoute(row.id) };
const commands: GridCommand<PaymentOrder, PaymentOrderKey>[] = [
	{
		name: "edit",
		label: "Открыть",
		icon: "pi pi-eye",
		shortcut: "Enter",
	},
	{ name: "search" },
	{ name: "refresh" },
];
</script>

<template>
	<section class="py-4">
		<h1 class="mb-4 text-2xl font-semibold">Заказы на оплату</h1>
		<CollectionGrid
			:api="api"
			:columns="paymentOrderCollection.columns"
			editMode="page"
			:routes="routes"
			:commands="commands"
			commandsMode="replace"
			:showContextMenu="false"
			rowSelection
			:defaultSorter="[{ f: 'created_at', d: SortDirect.DESC }, { f: 'id', d: SortDirect.DESC }]"
			:dataKey="paymentOrderCollection.dataKey"
			:getKey="paymentOrderCollection.getKey"
			:stateKey="paymentOrderCollection.stateKey"
			:pageSize="paymentOrderCollection.pageSize"
		>
			<template #body-id="{ data }">
				<span :title="data.id" class="font-mono">{{ shortPaymentId(data.id) }}</span>
			</template>
			<template #body-kiosk_name="{ data }">
				{{ data.entry_mode === "public" ? "Онлайн" : (data.kiosk_name ?? "Киоск") }}
			</template>
			<template #body-payable_kopecks="{ data }">{{ paymentAmount(data.payable_kopecks) }}</template>
			<template #body-state="{ data }"><PaymentStatusTag :value="data.state" /></template>
			<template #body-payment_state="{ data }">
				<div class="flex flex-wrap items-center gap-1">
					<span v-if="data.payment_method">{{ paymentMethod(data.payment_method) }}</span>
					<PaymentStatusTag :value="data.payment_state" />
				</div>
			</template>
			<template #body-environment="{ data }">{{ paymentEnvironment(data.environment) }}</template>
			<template #body-yclients_sync_status="{ data }"><PaymentStatusTag :value="data.yclients_sync_status" /></template>
			<template #body-fiscal_status="{ data }"><PaymentStatusTag :value="data.fiscal_status" /></template>
		</CollectionGrid>
	</section>
</template>
