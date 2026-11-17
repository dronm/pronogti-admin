<script setup lang="ts">
import { CollectionListPage } from "@katren/vue-collection-lib";

import { salonCollection } from "@/collections/salon.gen";
</script>

<template>
	<CollectionListPage :collection="salonCollection" />
</template>
