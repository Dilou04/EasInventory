import Fastify from "fastify";
import Database from "better-sqlite3";
import cors from '@fastify/cors';
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import fs from "node:fs"
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { stringify } from "node:querystring";
import { REPL_MODE_SLOPPY } from "node:repl";
import { request } from "node:http";

const fastify = Fastify();
const db = new Database('./database/database.sqlite3');

// Dossier ou les images sont stockées sur le serveur 
const uploadDir = path.resolve("./uploads");
fs.mkdirSync(uploadDir, { recursive: true });

// White liste pour les images (liste types d'images acceptées)
const allowType: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
};

// Autorisation pour les routes (GET, POST, PUT, ...)
fastify.register(cors, {
    origin: "http://localhost:5173",
    methods: ["POST", "GET"]
});

// Active la lecture des requêtes multipart, avec une limite de 2 Mo par image
fastify.register(multipart, { limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

// Rend les images disponibles depuis le navigateur
fastify.register(fastifyStatic, {
    root: uploadDir,
    prefix: "/uploads/",
})


fastify.post("/produits", async (request, reply) => {
    let name = "";
    let quantiteBrut = "";
    let lieuBrut = "";
    let savedFileName: string | null = null;

    try {
        // On regarde ce que contient la requête
        for await (const part of request.parts()) {
            if (part.type === "field" && part.fieldname === "name") {
                // On récupère le nom du produit 
                name = String(part.value).trim();
            }
            else if (part.type === "field" && part.fieldname === "quantite") {
                quantiteBrut = String(part.value).trim();
            }
            else if (part.type === "field" && part.fieldname === "id_lieu") {
                lieuBrut = String(part.value).trim();
            }
            else if (part.type === "file" && part.fieldname === "image") {
                // On vérifie que le fichier recu à la bonne extension
                const ext = allowType[part.mimetype];
                if (!ext) {
                    part.file.resume();
                    return reply.code(400).send({ error: "Format d'image non supporté" });
                }

                // Génération d'un nom de fichier par le serveur
                const fileName = `${randomUUID()}${ext}`;

                // On met l'image qui arirve dans le fichier (elle arrive segmenté et on attend pas qu'elle soit arrivé en entier avant de la stocker)
                await pipeline(part.file, fs.createWriteStream(path.join(uploadDir, fileName)));

                // Si la limite est atteinte on tronque le fichier
                if (part.file.truncated) {
                    fs.unlinkSync(path.join(uploadDir, fileName));
                    return reply.code(413).send({ error: "Image trop lourde, 2Mo max" });
                }
                savedFileName = fileName;
            }
        }
    }
    catch (err) {

        // Erreur pendant l'upload on nettoie
        if (savedFileName) {
            fs.rmSync(path.join(uploadDir, savedFileName), { force: true });
            return reply.code(413).send({ error: "Erreur lors de l'envoie de l'image" });
        }
    }


    // Fonction qui supprime l'image si elle la validation échoue
    const nettoyerImage = () => {
        if (savedFileName) {
            fs.rmSync(path.join(uploadDir, savedFileName), { force: true });
        };
    }

    // Validation du nom
    if (!name) {
        nettoyerImage();
        return reply.code(400).send({ error: "Le nom n'est pas valide" });
    }

    const existant = db.prepare('SELECT id_produit FROM produits WHERE nom = ? COLLATE NOCASE').get(name); // COLLATE NOCASE <=> ne vois pas de diférence entre les majuscules et les minuscules
    if (existant) {
        nettoyerImage();
        return reply.code(409).send({ error: "Ce produit à déjà été saisie, veuillez le modifier" });
    }

    // Validation de la quantité (entier positif ou nul)
    const quantite = Number(quantiteBrut);
    if (quantiteBrut === "" || !Number.isInteger(quantite) || quantite < 0) {
        nettoyerImage();
        return reply.code(400).send({ error: "La quantité doit être un nombre entier et positif" })
    }

    // Validation du lieu (il doit exister dans la table)
    const idLieu = Number(lieuBrut);
    const lieu = db.prepare("SELECT id_lieu FROM 'lieu de stockage' where id_lieu = ?").get(idLieu);
    if (!lieu) {
        nettoyerImage();
        return reply.code(400).send({ error: "Lieu de stockage invalide" });
    }

    // Insertion dans les ddeux table en une seul transaction, si un échoue on n'enregistre rien
    const ajouterPrduit = db.transaction(() => {
        // 1) Le produit
        const res = db
            .prepare("INSERT INTO produits (nom, image) VALUES (?, ?)")
            .run(name, savedFileName);

        // 2) Le lien produit <-> lieu de stockage avec la qauntité 
        db.prepare("INSERT INTO stocker (quantite, id_produit, id_lieu) VALUES (?, ?, ?)")
            .run(quantite, res.lastInsertRowid, idLieu);

        return res.lastInsertRowid;
    });

    try {
        const idProduit = ajouterPrduit();
        return reply.code(201).send({ id_produit: idProduit, nom: name, image: savedFileName, quantite });
    }
    catch (e) {
        console.error(e);
        nettoyerImage();
        return reply.code(400).send({ error: "Erreur lors de l'enregistrement" });
    }
})


fastify.get("/produits", (request, reply) => {
    const query = db.prepare("SELECT p.id_produit, p.nom, p.image, s.quantite, s.id_lieu, l.nom AS lieu FROM produits p LEFT JOIN stocker s ON s.id_produit = p.id_produit LEFT JOIN 'lieu de stockage' l ON l.id_lieu = s.id_lieu");
    reply.send(query.all());
});

fastify.get("/lieux", (requets, reply) => {
    const query = db.prepare('SELECT id_lieu, nom FROM "lieu de stockage"');
    const lieux = query.all();
    reply.send(lieux);

})

fastify.post("/lieux", (request, reply) => {
    const { nom } = request.body as { nom : String };

    const name = nom ? nom.trim(): "";
    if (!name){
        return reply.code(400).send({error : "Le nom du lieu ne peux pas être vide"})
    }
    // On vérifie si le lieux existe déjà
    const existant = db.prepare('SELECT id_lieu FROM "lieu de stockage" WHERE nom = ? COLLATE NOCASE').get(name);
    if (existant){
        return reply.code(409).send({error : "Ce lieu existe déjà"});
    }

    try{
        const result = db.prepare('INSERT INTO "lieu de stockage" (nom) VALUES (?)').run(name);
        return reply.code(201).send({id_lieu : result.lastInsertRowid, nom: name});
    }
    catch(e){
        console.error(e);
        return reply.code(400).send({error : "Erreur lors de l'enregistrement du lieu"});
    }
})

fastify.post("/stocks", (request, reply ) => {
    const {id_produit, id_lieu, quantite} = request.body as any;

    const quantite_ajouter = Number(quantite);
    if(!Number.isInteger(quantite_ajouter) || quantite_ajouter <= 0){
        return reply.code(400).send({error : "La quantité doit être un entier supérieur à 0"});
    }

    // Le quantite = quantite + ? permet que la base de donnée fasse l'addition sans qu'on fasse tout le calcul en recupérant la valeur déjà en stock
    const result = db.prepare("UPDATE stocker SET quantite = quantite + ? where id_produit = ? and id_lieu = ?").run(quantite_ajouter, Number(id_produit), Number(id_lieu));

    if(result.changes === 0){
        return reply.code(404).send({error : "Le produit est introuvable dans ce lieu de stockage"});
    }
    const ligne = db.prepare("SELECT quantite FROM stocker WHERE id_produit = ? AND id_lieu = ?").get(Number(id_produit), Number(id_lieu)) as {quantite : number};
    return reply.send({ quantite : ligne.quantite});
})

fastify.listen({ port: 3000 });