const express = require("express");
const jwt = require("jsonwebtoken");
const { createClient } = require('@supabase/supabase-js');

const JWT_SECRET = process.env.JWT_SECRET || "secreto_super_seguro_telemedicina_2026";

// Configuración de Supabase con tus datos
const supabaseUrl = process.env.SUPABASE_URL || 'https://xgdyrzesndtjqmgmvmpg.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_2hEteSQ8KUEI_7yx3HGq3g_GJmCjyai';
const supabase = createClient(supabaseUrl, supabaseKey);

function verificarJWT(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
        return res.status(401).json({ error: "Acceso denegado: falta cabecera Authorization" });
    }

    const partes = authHeader.split(" ");
    if (partes.length !== 2 || partes[0] !== "Bearer") {
        return res.status(401).json({ error: "Formato de token no válido (debe ser Bearer <token>)" });
    }

    const token = partes[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: "Token inválido o expirado" });
        }
        req.usuarioAuth = decoded;
        next();
    });
}

function createRESTServer(data, siguientesIds, wsServer) {
    const app = express();

    app.use(express.json());
    app.use("/appCliente", express.static("cliente_rest"));

    app.get("/api/ubicaciones", verificarJWT, async function (req, res) {
        try {
            const { data, error } = await supabase.from('ubicaciones').select('*');
            if (error) {
                console.log("Error al obtener ubicaciones:", error);
                res.status(500).json("Error al realizar la consulta");
            } else {
                res.status(200).json(data);
            }
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });

    app.get("/api/categorias", verificarJWT, async function (req, res) {
        try {
            const { data, error } = await supabase.from('categorias').select('*');
            if (error) {
                console.log("Error al obtener categorias:", error);
                res.status(500).json("Error al realizar la consulta");
            } else {
                res.status(200).json(data);
            }
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });

    app.get("/api/models", verificarJWT, async function (req, res) {
        try {
            const { data, error } = await supabase.from('modelos').select('*');
            if (error) {
                console.log("Error al obtener modelos:", error);
                res.status(500).json("Error al realizar la consulta");
            } else {
                res.status(200).json(data);
            }
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });

    app.post("/api/gestores/login", async function (req, res) {
        var login = req.body.login || req.body.usuario;
        var password = req.body.password;
        
        try {
            const { data: gestores, error } = await supabase
                .from('gestores')
                .select('*')
                .eq('usuario', login)
                .eq('contrasena', password);

            if (error) {
                console.log("Error en login gestor:", error);
                return res.status(500).json({ error: "Error en el servidor" });
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
            return res.status(500).json({ error: "Error en el servidor" });
        }
    });

    app.post("/api/gestores", async function (req, res) {
        var datos = req.body;

        try {
            const { data: existe, error: errCheck } = await supabase
                .from('gestores')
                .select('*')
                .eq('usuario', datos.usuario);

            if (errCheck) {
                return res.status(500).json("Error al realizar la consulta");
            }

            if (existe && existe.length > 0) {
                return res.status(400).json({ error: "El usuario ya existe" });
            }

            const { data: insertRes, error: errInsert } = await supabase
                .from('gestores')
                .insert([{ 
                    nombre: datos.nombre, 
                    apellidos: datos.apellidos, 
                    usuario: datos.usuario, 
                    contrasena: datos.password || datos.contrasena 
                }])
                .select();

            if (errInsert) {
                return res.status(500).json("Error al registrar el gestor");
            }

            var nuevoGestor = insertRes[0];
            res.status(201).json(nuevoGestor);
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });

    app.put("/api/gestores/:id", verificarJWT, async function (req, res) {
        var id = req.params.id;
        var datos = req.body;

        try {
            const { data: gestores, error } = await supabase.from('gestores').select('*').eq('id', id);
            if (error || !gestores || gestores.length === 0) {
                return res.status(404).send("Gestor no encontrado");
            }

            var gestorActual = gestores[0];
            var nombre = datos.nombre !== undefined ? datos.nombre : gestorActual.nombre;
            var apellidos = datos.apellidos !== undefined ? datos.apellidos : gestorActual.apellidos;
            var usuario = datos.usuario !== undefined ? datos.usuario : gestorActual.usuario;
            var password = datos.password !== undefined ? datos.password : gestorActual.contrasena;

            const { error: updateErr } = await supabase
                .from('gestores')
                .update({ nombre, apellidos, usuario, contrasena: password })
                .eq('id', id);

            if (updateErr) {
                return res.status(500).json("Error al actualizar el gestor");
            }

            res.json({
                id: parseInt(id),
                nombre: nombre,
                apellidos: apellidos,
                usuario: usuario,
                password: password
            });
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });

    app.get("/api/gestores/:id", verificarJWT, async function (req, res) {
        var id = req.params.id;
        try {
            const { data: gestores, error } = await supabase
                .from('gestores')
                .select('id, nombre, apellidos, usuario')
                .eq('id', id);

            if (error) {
                res.status(500).json("Error al consultar el gestor");
            } else if (gestores && gestores.length === 1) {
                res.json(gestores[0]);
            } else {
                res.status(404).send("Gestor no encontrado");
            }
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });

    app.get("/api/sanitarios/:id", verificarJWT, async function (req, res) {
        var id = req.params.id;
        try {
            const { data: sanitarios, error } = await supabase
                .from('sanitarios')
                .select('id, nombre, apellidos, usuario')
                .eq('id', id);

            if (error) {
                res.status(500).json("Error al consultar el sanitario");
            } else if (sanitarios && sanitarios.length === 1) {
                res.json(sanitarios[0]);
            } else {
                res.status(404).send("Sanitario no encontrado");
            }
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });

    app.get("/api/recursos", verificarJWT, async function (req, res) {
        var categoria = req.query.categoria;
        var modelo = req.query.modelo;
        var ubicacion = req.query.ubicacion;
        var estado = req.query.estado;

        try {
            let query = supabase.from('recursos').select('*');

            if (modelo && modelo !== "Todos" && modelo !== "") {
                query = query.eq('modelo', modelo);
            }
            if (ubicacion && ubicacion !== "Todos" && ubicacion !== "") {
                query = query.eq('ubicacion', ubicacion);
            }
            if (estado && estado !== "Todos" && estado !== "") {
                query = query.eq('estado', estado);
            }

            const { data: recursos, error } = await query;
            if (error) {
                res.status(500).json("Error al consultar los recursos");
            } else {
                res.json(recursos);
            }
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });

    app.get("/api/recursos/:id", verificarJWT, async function (req, res) {
        var id = req.params.id;
        try {
            const { data: recursos, error } = await supabase.from('recursos').select('*').eq('id', id);
            if (error) {
                res.status(500).json("Error al consultar el recurso");
            } else if (recursos && recursos.length === 1) {
                res.json(recursos[0]);
            } else {
                res.status(404).send("Recurso no encontrado");
            }
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });

    app.post("/api/recursos", verificarJWT, async function (req, res) {
        var datos = req.body;
        try {
            const { data: resultado, error } = await supabase
                .from('recursos')
                .insert([{
                    modelo: parseInt(datos.modelo),
                    ubicacion: parseInt(datos.ubicacion),
                    numero_serie: datos.numero_serie,
                    estado: parseInt(datos.estado)
                }])
                .select();

            if (error) {
                return res.status(500).json("Error al insertar el recurso");
            }

            res.status(201).json(resultado[0]);
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });

    app.put("/api/recursos/:id", verificarJWT, async function (req, res) {
        var id = req.params.id;
        var datos = req.body;

        try {
            const { data: recursos, error } = await supabase.from('recursos').select('*').eq('id', id);
            if (error || !recursos || recursos.length === 0) {
                return res.status(404).send("Recurso no encontrado");
            }

            var actual = recursos[0];
            var modelo = datos.modelo !== undefined ? parseInt(datos.modelo) : actual.modelo;
            var ubicacion = datos.ubicacion !== undefined ? parseInt(datos.ubicacion) : actual.ubicacion;
            var numero_serie = datos.numero_serie !== undefined ? datos.numero_serie : actual.numero_serie;
            var estado = datos.estado !== undefined ? parseInt(datos.estado) : actual.estado;

            const { error: updateErr } = await supabase
                .from('recursos')
                .update({ modelo, ubicacion, numero_serie, estado })
                .eq('id', id);

            if (updateErr) {
                return res.status(500).json("Error al actualizar el recurso");
            }

            res.json({
                id: parseInt(id),
                modelo: modelo,
                ubicacion: ubicacion,
                numero_serie: numero_serie,
                estado: estado
            });
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });

    app.delete("/api/recursos/:id", verificarJWT, async function (req, res) {
        var id = req.params.id;
        try {
            const { data, error } = await supabase.from('recursos').delete().eq('id', id).select();
            if (error) {
                res.status(500).json("Error al realizar el borrado");
            } else if (data && data.length > 0) {
                res.status(200).json("Recurso eliminado");
            } else {
                res.status(404).json("No se ha encontrado el recurso a borrar");
            }
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });

    app.get("/api/recursos/:id/reservas", verificarJWT, async function (req, res) {
        var id = req.params.id;
        try {
            const { data: reservas, error } = await supabase.from('reservas').select('*').eq('recurso', id);
            if (error) {
                res.status(500).json("Error al consultar reservas");
            } else {
                res.json(reservas);
            }
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });

    app.get("/api/reservas/sin-activar/count", verificarJWT, async function (req, res) {
        try {
            const { count, error } = await supabase
                .from('reservas')
                .select('*', { count: 'exact', head: true })
                .is('fecha_inicio', null);

            if (error) {
                res.status(500).json("Error al contar reservas");
            } else {
                res.status(200).json({ count: count || 0 });
            }
        } catch (err) {
            res.status(500).json("Error en el servidor");
        }
    });
   
    return app;
}

// Arranque automático para que Render detecte el puerto abierto correctamente
const PORT = process.env.PORT || 3000;
const serverApp = createRESTServer();
serverApp.listen(PORT, function () {
    console.log("Servidor escuchando en el puerto " + PORT);
});

module.exports = createRESTServer;
