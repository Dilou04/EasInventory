"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const cors_1 = __importDefault(require("@fastify/cors"));
const fastify = (0, fastify_1.default)();
const db = new better_sqlite3_1.default('./database/database.sqlite3');
fastify.register(cors_1.default, {
    origin: "http://localhost:5173",
    methods: ["POST", "GET"]
});
fastify.post("/produits", (request, reply) => {
    const { name } = request.body;
    if (!name || name.trim() === "") {
        return reply.code(400).send({ error: "Le nom ne peux pas être vide" });
    }
    const query = db.prepare("INSERT INTO produits (nom) VALUES (?)");
    const result = query.run(name);
    if (result.changes > 0) {
        reply.code(200).send();
    }
});
fastify.get("/produits", (request, reply) => {
    const query = db.prepare("SELECT * FROM produits");
    const product = query.all();
    reply.send(product);
});
fastify.listen({ port: 3000 });
