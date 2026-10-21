const express = require("express");
const jwt = require("jsonwebtoken");
const { createClient } = require('@supabase/supabase-js');

const JWT_SECRET = process.env.JWT_SECRET || "secreto_super_seguro_telemedicina_2026";

// Configuración de Supabase (puedes usar variables de entorno o ponerlas aquí directamente como el profesor)
const supabaseUrl = process.env.SUPABASE_URL || 'https://xgdyrzesndtjqmgmvmpg.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_2hEteSQ8KUEI_7yx3HGq3g_GJmCjyai';
const supabase = createClient(supabaseUrl, supabaseKey);

function createRESTServer() {
    const app = express();

    app.use("/appCliente", express.static("cliente_rest"));
    app.use(express.json());

    // --- RUTA DE LOGIN ---
    app.post("/api/gestores/login", async (req, res) => {
        var usuario = req.body.login || req.body.usuario;
        var contrasena = req.body.password;

        try {
            const { data: gestores, error } = await supabase
                .from('gestores')
                .select('*')
                .eq('usuario', usuario)
                .eq('contrasena', contrasena);

            if (error) {
                console.log("Error al realizar la select", error);
                return res.status(500).json("Error al realizar la consulta");
            }

            if (gestores && gestores.length === 1) {
                var token = jwt.sign(
                    { id: gestores[0].id, usuario: gestores[0].usuario },
                    JWT_SECRET,
                    { expiresIn: "8h" }
                );
                return res.status(200).json({ id: gestores[0].id, token: token });
            } else {
                return res.status(403).json({ error: "Credenciales incorrectas" });
            }
        } catch (err) {
            console.log("Excepción en login:", err);
            return res.status(500).json({ error: "Error en el servidor" });
        }
    });

    // --- OBTENER GESTOR POR ID ---
    app.get("/api/gestores/:id", async (req, res) => {
        var id = req.params.id;

        try {
            const { data: gestores, error } = await supabase
                .from('gestores')
                .select('id, nombre, apellidos, usuario')
                .eq('id', id);

            if (error) {
                return res.status(500).json("Error al consultar el gestor");
            } else if (gestores && gestores.length === 1) {
                res.json(gestores[0]);
            } else {
                res.status(404).send("Gestor no encontrado");
            }
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });

    // --- OBTENER CATEGORÍAS ---
    app.get("/api/categorias", async (req, res) => {
        try {
            const { data, error } = await supabase
                .from('categorias')
                .select('*');

            if (error) {
                return res.status(500).json("Error al realizar la consulta");
            }
            res.status(200).json(data);
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });

    // --- OBTENER UBICACIONES ---
    app.get("/api/ubicaciones", async (req, res) => {
        try {
            const { data, error } = await supabase
                .from('ubicaciones')
                .select('*');

            if (error) {
                return res.status(500).json("Error al realizar la consulta");
            }
            res.status(200).json(data);
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });

    // --- OBTENER MODELOS ---
    app.get("/api/models", async (req, res) => {
        try {
            const { data, error } = await supabase
                .from('modelos')
                .select('*');

            if (error) {
                return res.status(500).json("Error al realizar la consulta");
            }
            res.status(200).json(data);
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });

    return app;
}

module.exports = createRESTServer;
