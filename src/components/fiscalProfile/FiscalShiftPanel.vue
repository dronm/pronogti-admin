<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import { errorText } from "@katren/vue-collection-lib";
import { closeFiscalShift, type FiscalShiftResult } from "@/api/fiscalShift";

const props = defineProps<{
	profileID: number;
	profileName?: string | null;
	disabled?: boolean;
}>();
const emit = defineEmits<{ busy: [value: boolean] }>();
const confirming = ref(false);
const submitting = ref(false);
const error = ref("");
const result = shallowRef<FiscalShiftResult | null>(null);
const pendingKey = ref<string | null>(null);
const uncertain = computed(() => pendingKey.value !== null && (!result.value || result.value.state === "unknown"));
const failed = computed(() => result.value?.state === "failed");

watch(() => props.profileID, () => {
	confirming.value = false;
	error.value = "";
	result.value = null;
	pendingKey.value = null;
});

const closeShift = async (): Promise<void> => {
	if (submitting.value || props.disabled) {
		return;
	}
	const profileID = props.profileID;
	confirming.value = false;
	submitting.value = true;
	emit("busy", true);
	error.value = "";
	try {
		const key = pendingKey.value ?? crypto.randomUUID();
		pendingKey.value = key;
		const response = await closeFiscalShift(profileID, key);
		if (props.profileID === profileID) {
			result.value = response;
			if (response.state !== "unknown") {
				pendingKey.value = null;
			}
		}
	} catch (cause: unknown) {
		if (props.profileID === profileID) {
			error.value = errorText(cause);
		}
	} finally {
		submitting.value = false;
		emit("busy", false);
	}
};
</script>

<template>
	<section class="mt-5 space-y-3 rounded-md border border-slate-200 p-4" aria-label="Закрытие смены ККТ">
		<h3 class="font-semibold">Смена ККТ</h3>
		<p class="text-sm text-slate-600">Команда использует сохранённые настройки этого фискального профиля. Если смена уже закрыта, повторное закрытие не выполняется.</p>
		<p v-if="error" role="alert" class="whitespace-pre-wrap break-words text-red-700">{{ error }}</p>
		<template v-if="result">
			<p :role="failed || result.state === 'unknown' ? 'alert' : 'status'" class="whitespace-pre-wrap break-words" :class="failed || result.state === 'unknown' ? 'text-red-700' : 'text-green-800'">{{ result.message }}</p>
			<p v-if="result.shift_number !== undefined" class="text-sm">Номер смены: {{ result.shift_number }}</p>
			<details v-if="result.driver_response" class="text-sm">
				<summary class="cursor-pointer">Полный ответ ККТ</summary>
				<pre class="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-xs">{{ JSON.stringify(result.driver_response, null, 2) }}</pre>
			</details>
		</template>
		<p v-if="uncertain && !submitting" class="text-sm text-amber-800">Результат команды пока не подтверждён. Повторная проверка использует тот же запрос и не создаёт новое закрытие смены.</p>
		<Button
			type="button"
			:label="uncertain ? 'Повторить проверку' : failed ? 'Новая попытка закрытия' : 'Закрыть смену'"
			icon="pi pi-lock"
			severity="secondary"
			:loading="submitting"
			:disabled="props.disabled || submitting"
			@click="uncertain ? closeShift() : (confirming = true)"
		/>
		<Dialog v-model:visible="confirming" header="Закрыть смену ККТ?" modal class="w-full max-w-md">
			<p>Закрыть открытую смену для профиля «{{ props.profileName || props.profileID }}»?</p>
			<template #footer>
				<Button type="button" label="Отмена" severity="secondary" @click="confirming = false" />
				<Button type="button" label="Закрыть смену" :disabled="props.disabled || submitting" @click="closeShift" />
			</template>
		</Dialog>
	</section>
</template>
