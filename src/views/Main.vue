<script setup lang="ts">
import { useAuthStore } from "@/stores/useAuthStore";

const auth = useAuthStore();
</script>

<template>
	<section
		class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
	>
		<p class="text-sm font-medium text-slate-500">Pronogti</p>
		<h1 class="mt-2 text-2xl font-semibold text-slate-900">
			Панель администратора
		</h1>
		<p class="mt-3 text-sm text-slate-600">
			Вы вошли как {{ auth.user?.name }}.
		</p>
	</section>
</template>
