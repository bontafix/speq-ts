"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vue_1 = require("vue");
const vue_router_1 = require("vue-router");
const App_vue_1 = __importDefault(require("./App.vue"));
const EquipmentCard_vue_1 = __importDefault(require("./views/EquipmentCard.vue"));
require("./style.css");
const routes = [
    {
        path: "/",
        redirect: "/equipment",
    },
    {
        path: "/equipment/:id?",
        name: "EquipmentCard",
        component: EquipmentCard_vue_1.default,
    },
];
const router = (0, vue_router_1.createRouter)({
    history: (0, vue_router_1.createWebHistory)("/speq-bot/webapp/"),
    routes,
});
const app = (0, vue_1.createApp)(App_vue_1.default);
app.use(router);
app.mount("#app");
//# sourceMappingURL=main.js.map