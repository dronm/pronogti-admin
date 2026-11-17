import { createApp } from "vue";
import { createPinia } from "pinia";
import { createBusinessApp } from "@katren/vue-business-app/core";
import PrimeVue from "primevue/config";
import ConfirmationService from "primevue/confirmationservice";
import Aura from "@primeuix/themes/aura";
import { ru } from "primelocale/js/ru.js";

import "primeicons/primeicons.css";
import "./style.css";
import "./styles/compact-grid.css";
import App from "./App.vue";
import { businessAppConfig } from "./config/businessApp";
import { i18n } from "./i18n";
import router from "./router";

const app = createApp(App);
app.use(createPinia());
app.use(i18n);
app.use(createBusinessApp(businessAppConfig));
app.use(PrimeVue, {
	theme: { preset: Aura },
	locale: { ...ru, dateFormat: "dd.mm.yy", firstDayOfWeek: 1 },
});
app.use(ConfirmationService);
app.use(router);
await router.isReady();
app.mount("#app");
