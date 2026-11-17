<script setup lang="ts">
import { CollectionListPage } from "@katren/vue-collection-lib";

import { companyCollection } from "@/collections/company.gen";
</script>

<template>
	<CollectionListPage :collection="companyCollection" />
</template>
