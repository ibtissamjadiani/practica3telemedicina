const conexion = require("./conexion_mysql");
const express = require("express");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "secreto_super_seguro_telemedicina_2026";

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

    app.get("/api/ubicaciones", verificarJWT, function (req, res) {
        var sql = "SELECT * FROM ubicaciones";
        conexion.query(sql, function (err, filas) {
            if (err) {
                console.log("Error al obtener ubicaciones:", err);
                res.status(500).json("Error al realizar la consulta");
            } else {
                res.status(200).json(filas);
            }
        });
    });

    app.get("/api/categorias", verificarJWT,  function (req, res) {
        var sql = "SELECT * FROM categorias";
        conexion.query(sql, function (err, filas) {
            if (err) {
                console.log("Error al obtener categorias:", err);
                res.status(500).json("Error al realizar la consulta");
            } else {
                res.status(200).json(filas);
            }
        });
    });

    app.get("/api/models", verificarJWT, function (req, res) {
        var sql = "SELECT * FROM modelos";
        conexion.query(sql, function (err, filas) {
            if (err) {
                console.log("Error al obtener modelos:", err);
                res.status(500).json("Error al realizar la consulta");
            } else {
                res.status(200).json(filas);
            }
        });
    });
    app.post("/api/gestores/login", function (req, res) {
    var login = req.body.login;
    var password = req.body.password;
    
    var sql = "SELECT * FROM gestores WHERE usuario = ? AND password = ?";
    conexion.query(sql, [login, password], function (err, gestores) {
        if (err) {
            console.log("Error en login gestor:", err);
            return res.status(500).json({ error: "Error en el servidor" });
        }
        
        if (gestores.length === 1) {
            var token = jwt.sign(
                { id: gestores[0].id, usuario: gestores[0].usuario },
                JWT_SECRET,
                { expiresIn: "8h" }
            );
            return res.status(200).json({ id: gestores[0].id, token: token });
        } else {
            return res.status(403).json({ error: "Credenciales incorrectas" });
        }
    });
});

    app.post("/api/gestores", function (req, res) {
        var datos = req.body;

        var checkSql = "SELECT * FROM gestores WHERE usuario = ?";
        conexion.query(checkSql, [datos.usuario], function (err, resultado) {
            if (err) {
                console.log("Error al comprobar usuario:", err);
                return res.status(500).json("Error al realizar la consulta");
            }

            if (resultado.length > 0) {
                console.log("REGISTRO - Usuario ya existe");
                return res.status(400).json({ error: "El usuario ya existe" });
            }

            var insertSql = "INSERT INTO gestores (nombre, apellidos, usuario, password) VALUES (?, ?, ?, ?)";
            conexion.query(insertSql, [datos.nombre, datos.apellidos, datos.usuario, datos.password], function (err, insertRes) {
                if (err) {
                    console.log("Error al registrar gestor:", err);
                    return res.status(500).json("Error al registrar el gestor");
                }

                var nuevoGestor = {
                    id: insertRes.insertId,
                    nombre: datos.nombre,
                    apellidos: datos.apellidos,
                    usuario: datos.usuario,
                    password: datos.password
                };

                console.log("REGISTRO - Gestor creado:", nuevoGestor);
                res.status(201).json(nuevoGestor);
            });
        });
    });

    app.put("/api/gestores/:id", verificarJWT, function (req, res) {
        var id = req.params.id;
        var datos = req.body;

        var sqlBuscar = "SELECT * FROM gestores WHERE id = ?";
        conexion.query(sqlBuscar, [id], function (err, gestores) {
            if (err) {
                return res.status(500).json("Error al consultar el gestor");
            }
            if (gestores.length === 0) {
                return res.status(404).send("Gestor no encontrado");
            }

            var gestorActual = gestores[0];

            var verificarYActualizar = function() {
                var nombre = datos.nombre !== undefined ? datos.nombre : gestorActual.nombre;
                var apellidos = datos.apellidos !== undefined ? datos.apellidos : gestorActual.apellidos;
                var usuario = datos.usuario !== undefined ? datos.usuario : gestorActual.usuario;
                var password = datos.password !== undefined ? datos.password : gestorActual.password;

                var updateSql = "UPDATE gestores SET nombre = ?, apellidos = ?, usuario = ?, password = ? WHERE id = ?";
                conexion.query(updateSql, [nombre, apellidos, usuario, password, id], function (err) {
                    if (err) {
                        return res.status(500).json("Error al actualizar el gestor");
                    }
                    res.json({
                        id: parseInt(id),
                        nombre: nombre,
                        apellidos: apellidos,
                        usuario: usuario,
                        password: password
                    });
                });
            };

            if (datos.usuario && datos.usuario !== gestorActual.usuario) {
                conexion.query("SELECT * FROM gestores WHERE usuario = ?", [datos.usuario], function (err, existe) {
                    if (err) return res.status(500).json("Error al validar usuario");
                    if (existe.length > 0) {
                        return res.status(400).json({ error: "El usuario ya existe" });
                    }
                    verificarYActualizar();
                });
            } else {
                verificarYActualizar();
            }
        });
    });

    app.get("/api/gestores/:id", verificarJWT, function (req, res) {
        var id = req.params.id;
        var sql = "SELECT id, nombre, apellidos, usuario FROM gestores WHERE id = ?";
        conexion.query(sql, [id], function (err, gestores) {
            if (err) {
                res.status(500).json("Error al consultar el gestor");
            } else if (gestores.length === 1) {
                res.json(gestores[0]);
            } else {
                res.status(404).send("Gestor no encontrado");
            }
        });
    });

    app.get("/api/sanitarios/:id", verificarJWT, function (req, res) {
        var id = req.params.id;
        var sql = "SELECT id, nombre, apellidos, usuario FROM sanitarios WHERE id = ?";
        conexion.query(sql, [id], function (err, sanitarios) {
            if (err) {
                res.status(500).json("Error al consultar el sanitario");
            } else if (sanitarios.length === 1) {
                res.json(sanitarios[0]);
            } else {
                res.status(404).send("Sanitario no encontrado");
            }
        });
    });

    app.get("/api/recursos", verificarJWT, function (req, res) {
        var categoria = req.query.categoria;
        var modelo = req.query.modelo;
        var ubicacion = req.query.ubicacion;
        var estado = req.query.estado;

        var sql = "SELECT r.* FROM recursos r";
        var condiciones = [];
        var params = [];

        if (categoria && categoria !== "Todos" && categoria !== "") {
            sql += " INNER JOIN modelos m ON r.modelo = m.id";
            condiciones.push("m.categoria = ?");
            params.push(categoria);
        }

        if (modelo && modelo !== "Todos" && modelo !== "") {
            condiciones.push("r.modelo = ?");
            params.push(modelo);
        }

        if (ubicacion && ubicacion !== "Todos" && ubicacion !== "") {
            condiciones.push("r.ubicacion = ?");
            params.push(ubicacion);
        }

        if (estado && estado !== "Todos" && estado !== "") {
            condiciones.push("r.estado = ?");
            params.push(estado);
        }

        if (condiciones.length > 0) {
            sql += " WHERE " + condiciones.join(" AND ");
        }

        conexion.query(sql, params, function (err, recursos) {
            if (err) {
                console.log("Error al obtener recursos:", err);
                res.status(500).json("Error al consultar los recursos");
            } else {
                res.json(recursos);
            }
        });
    });

    app.get("/api/recursos/:id", verificarJWT, function (req, res) {
        var id = req.params.id;
        var sql = "SELECT * FROM recursos WHERE id = ?";
        conexion.query(sql, [id], function (err, recursos) {
            if (err) {
                res.status(500).json("Error al consultar el recurso");
            } else if (recursos.length === 1) {
                res.json(recursos[0]);
            } else {
                res.status(404).send("Recurso no encontrado");
            }
        });
    });

    app.post("/api/recursos", verificarJWT, function (req, res) {
        var datos = req.body;
        var sql = "INSERT INTO recursos (modelo, ubicacion, numero_serie, estado) VALUES (?, ?, ?, ?)";
        var params = [parseInt(datos.modelo), parseInt(datos.ubicacion), datos.numero_serie, parseInt(datos.estado)];

        conexion.query(sql, params, function (err, resultado) {
            if (err) {
                console.log("Error al insertar recurso:", err);
                return res.status(500).json("Error al insertar el recurso");
            }

            var nuevoRecurso = {
                id: resultado.insertId,
                modelo: parseInt(datos.modelo),
                ubicacion: parseInt(datos.ubicacion),
                numero_serie: datos.numero_serie,
                estado: parseInt(datos.estado)
            };

            var sqlInfo = "SELECT m.nombre AS modeloNombre, c.nombre AS categoriaNombre FROM modelos m INNER JOIN categorias c ON m.categoria = c.id WHERE m.id = ?";
            conexion.query(sqlInfo, [nuevoRecurso.modelo], function (errInfo, filasInfo) {
                if (!errInfo && filasInfo.length > 0 && wsServer && wsServer.broadcastAvisoNuevoRecurso) {
                    wsServer.broadcastAvisoNuevoRecurso(
                        filasInfo[0].categoriaNombre,
                        filasInfo[0].modeloNombre,
                        nuevoRecurso.numero_serie,
                        datos.gestorNombre || "Gestor"
                    );
                }
            });

            res.status(201).json(nuevoRecurso);
        });
    });

    app.put("/api/recursos/:id", verificarJWT, function (req, res) {
        var id = req.params.id;
        var datos = req.body;

        var sqlBuscar = "SELECT * FROM recursos WHERE id = ?";
        conexion.query(sqlBuscar, [id], function (err, recursos) {
            if (err) {
                return res.status(500).json("Error al consultar el recurso");
            }
            if (recursos.length === 0) {
                return res.status(404).send("Recurso no encontrado");
            }

            var actual = recursos[0];
            var modelo = datos.modelo !== undefined ? parseInt(datos.modelo) : actual.modelo;
            var ubicacion = datos.ubicacion !== undefined ? parseInt(datos.ubicacion) : actual.ubicacion;
            var numero_serie = datos.numero_serie !== undefined ? datos.numero_serie : actual.numero_serie;
            var estado = datos.estado !== undefined ? parseInt(datos.estado) : actual.estado;

            var sqlUpdate = "UPDATE recursos SET modelo = ?, ubicacion = ?, numero_serie = ?, estado = ? WHERE id = ?";
            conexion.query(sqlUpdate, [modelo, ubicacion, numero_serie, estado, id], function (errUpdate) {
                if (errUpdate) {
                    return res.status(500).json("Error al actualizar el recurso");
                }
                res.json({
                    id: parseInt(id),
                    modelo: modelo,
                    ubicacion: ubicacion,
                    numero_serie: numero_serie,
                    estado: estado
                });
            });
        });
    });

    app.delete("/api/recursos/:id", verificarJWT, function (req, res) {
        var id = req.params.id;
        var sql = "DELETE FROM recursos WHERE id = ?";
        conexion.query(sql, [id], function (err, resultado) {
            if (err) {
                console.log("Error al borrar el recurso:", err);
                res.status(500).json("Error al realizar el borrado");
            } else if (resultado.affectedRows > 0) {
                res.status(200).json("Recurso eliminado");
            } else {
                res.status(404).json("No se ha encontrado el recurso a borrar");
            }
        });
    });

    app.get("/api/recursos/:id/reservas", verificarJWT, function (req, res) {
        var id = req.params.id;
        var sql = "SELECT * FROM reservas WHERE recurso = ?";
        conexion.query(sql, [id], function (err, reservas) {
            if (err) {
                res.status(500).json("Error al consultar reservas");
            } else {
                res.json(reservas);
            }
        });
    });

    app.get("/api/recursos/:id/resenvas", verificarJWT, function (req, res) {
        var id = req.params.id;
        var sql = "SELECT * FROM resenvas WHERE recurso = ?";
        conexion.query(sql, [id], function (err, resenvas) {
            if (err) {
                res.status(500).json("Error al consultar resenvas");
            } else {
                res.json(resenvas);
            }
        });
    });

    app.get("/api/reservas/sin-activar/count", verificarJWT, function (req, res) {
        var sql = "SELECT COUNT(*) AS total FROM reservas WHERE fecha_inicio IS NULL";
        conexion.query(sql, function (err, resultado) {
            if (err) {
                res.status(500).json("Error al contar reservas");
            } else {
                res.status(200).json({ count: resultado[0].total });
            }
        });
    });
   
    return app;
}

module.exports = createRESTServer;