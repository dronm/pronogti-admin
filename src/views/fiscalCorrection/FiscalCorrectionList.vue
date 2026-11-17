<script setup lang="ts">
import { onMounted, onScopeDispose, ref, shallowRef } from "vue";
import Button from "primevue/button";
import { errorText } from "@katren/vue-collection-lib";
import {
	listCorrections,
	type FiscalCorrection,
} from "@/api/paymentCorrection";
import CorrectionHistory from "@/components/payment/CorrectionHistory.vue";
import { correctionExplanation } from "@/utils/correctionReceipt";

const corrections = shallowRef<FiscalCorrection[]>([]);
const loading = ref(false);
const error = ref("");
const search = ref("");
let request: AbortController | undefined;
let disposed = false;
const reload = async (): Promise<void> => {
	if (request || disposed) {
		return;
	}
	const controller = new AbortController();
	request = controller;
	loading.value = true;
	try {
		const result = await listCorrections(controller.signal);
		if (!controller.signal.aborted && !disposed) {
			corrections.value = result;
			error.value = "";
		}
	} catch (cause: unknown) {
		if (!controller.signal.aborted && !disposed) {
			error.value = errorText(cause);
		}
	} finally {
		request = undefined;
		loading.value = false;
	}
};
onMounted(() => {
	void reload();
});
onScopeDispose(() => {
	disposed = true;
	request?.abort();
});
const matches = (item: FiscalCorrection): boolean => {
	const query = search.value.trim().toLocaleLowerCase("ru-RU");
	return (
		query === "" ||
		[
			item.id,
			item.order_id,
			item.reason,
			item.state,
			String(item.original.document_number),
			String(item.original.fiscal_sign),
		].some((value) =>
			value.toLocaleLowerCase("ru-RU").includes(query),
		)
	);
};
</script>

<template>
	<section class="space-y-4 p-4">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h1 class="text-xl font-semibold">Чеки коррекции</h1>
			<Button
				type="button"
				label="Обновить"
				icon="pi pi-refresh"
				severity="secondary"
				:loading="loading"
				@click="reload"
			/>
		</div>
		<p class="text-sm leading-relaxed text-slate-600">
			{{ correctionExplanation }}
		</p>
		<p class="text-sm text-slate-500">
			Показаны последние 200 операций. Для исправления чека
			или продолжения операции откройте соответствующий заказ.
		</p>
		<label class="flex max-w-xl flex-col gap-1 text-sm"
			>Поиск в загруженной истории<input
				v-model="search"
				type="search"
				placeholder="Заказ, ФД, ФП или причина"
				class="rounded border border-slate-300 p-2"
		/></label>
		<p v-if="error" role="alert" class="text-red-700">
			{{ error }}
		</p>
		<CorrectionHistory
			:corrections="corrections.filter(matches)"
			show-order
		/>
	</section>
</template>
