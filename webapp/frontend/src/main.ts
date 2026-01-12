import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import EquipmentCard from "./views/EquipmentCard.vue";
import "./style.css";

const routes = [
  {
    path: "/",
    redirect: "/equipment",
  },
  {
    path: "/equipment/:id?",
    name: "EquipmentCard",
    component: EquipmentCard,
  },
];

const router = createRouter({
  history: createWebHistory("/speq-bot/webapp/"),
  routes,
});

const app = createApp(App);
app.use(router);
app.mount("#app");
