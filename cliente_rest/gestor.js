var gestorActual = null;
var categorias = [];
var modelos = [];
var ubicaciones = [];
var wsClient = null;

document.addEventListener("DOMContentLoaded", function() {
    wsClient = Object.create(WSClient);
});

function mostrarVista(vista) {
    document.getElementById("login-view").style.display = "none";
    document.getElementById("registro-view").style.display = "none";
    document.getElementById("main-view").style.display = "none";
    
    document.getElementById(vista + "-view").style.display = "block";
}

function mostrarSubVista(subvista) {
    document.getElementById("recursos-view").style.display = "none";
    document.getElementById("recurso-view").style.display = "none";
    
    document.getElementById(subvista + "-view").style.display = "block";
}

function handleLogin() {
    var usuario = document.getElementById("usuario").value;
    var password = document.getElementById("password").value;
    
    rest.post("/api/gestores/login", { login: usuario, password: password }, async function(status, response) {
        if (status == 200) {
            localStorage.setItem("jwt_token", response.token);
            gestorActual = response.id;
            
            rest.get("/api/gestores/" + gestorActual, async function(status, gestorData) {
                if (status == 200) {
                    try {
                        await wsClient.conectar(gestorActual, 'gestor', gestorData.nombre + " " + gestorData.apellidos);
                        wsClient.onAviso(function(aviso) {
                            agregarAvisoATabla(aviso);
                        });
                    } catch (e) {
                        // Ignorar errores de websocket si no se usan
                    }
                }
            });
            
            mostrarVista("main");
            cargarBienvenida();
            
            // Cargar auxiliares y después listar los recursos
            cargarDatosAuxiliares(function() {
                buscarRecursos();
            });

            cargarRankingMinisterio(); 
            document.getElementById("login-error").innerHTML = "";
        } else {
            document.getElementById("login-error").innerHTML = "Usuario o contraseña incorrectos";
        }
    });
}

function agregarAvisoATabla(aviso) {
    var tablaAvisos = document.getElementById('avisosBody');
    if (!tablaAvisos) return;
    
    var fila = document.createElement('tr');
    var claseColor = "";
    if (aviso.color === "rojo") claseColor = "aviso-rojo";
    else if (aviso.color === "azul") claseColor = "aviso-azul";
    else if (aviso.color === "verde") claseColor = "aviso-verde";
    fila.className = claseColor;
    
    fila.innerHTML = 
        "<td style='border:1px solid #ddd;padding:8px'>" + aviso.fecha + "</td>" +
        "<td style='border:1px solid #ddd;padding:8px'>" + aviso.origen + "</td>" +
        "<td style='border:1px solid #ddd;padding:8px'>" + aviso.texto + "</td>";
    
    tablaAvisos.insertBefore(fila, tablaAvisos.firstChild);
    
    while (tablaAvisos.children.length > 50) {
        tablaAvisos.removeChild(tablaAvisos.lastChild);
    }
}

function mostrarRegistro() {
    document.getElementById("registro-titulo").innerHTML = "Registro de Gestor";
    var gestorId = document.getElementById("gestor-id");
    if (gestorId) gestorId.value = "";
    document.getElementById("reg-nombre").value = "";
    document.getElementById("reg-apellidos").value = "";
    document.getElementById("reg-usuario").value = "";
    document.getElementById("reg-password").value = "";
    mostrarVista("registro");
}

function cancelarRegistro() {
    mostrarVista("login");
}

function handleRegistro() {
    var gestorData = {
        nombre: document.getElementById("reg-nombre").value,
        apellidos: document.getElementById("reg-apellidos").value,
        usuario: document.getElementById("reg-usuario").value,
        password: document.getElementById("reg-password").value
    };
    
    var gestorId = document.getElementById("gestor-id").value;
    
    if (gestorId) {
        rest.put("/api/gestores/" + gestorId, gestorData, function(status, response) {
            if (status == 200) {
                alert("Perfil actualizado");
                mostrarVista("main");
                cargarBienvenida();
            } else {
                document.getElementById("registro-error").innerHTML = "Error al actualizar";
            }
        });
    } else {
        rest.post("/api/gestores", gestorData, function(status, response) {
            if (status == 201) {
                alert("Registro exitoso. Ya puedes hacer login.");
                mostrarVista("login");
                document.getElementById("registro-error").innerHTML = "";
            } else {
                var mensaje = response && response.error ? response.error : "Error en el registro";
                document.getElementById("registro-error").innerHTML = mensaje;
            }
        });
    }
}

function editarPerfil() {
    document.getElementById("registro-titulo").innerHTML = "Editar Perfil";
    
    rest.get("/api/gestores/" + gestorActual, function(status, response) {
        if (status == 200) {
            document.getElementById("reg-nombre").value = response.nombre;
            document.getElementById("reg-apellidos").value = response.apellidos;
            document.getElementById("reg-usuario").value = response.usuario;
            document.getElementById("reg-password").value = "";
            var gestorId = document.getElementById("gestor-id");
            if (gestorId) gestorId.value = gestorActual;
            mostrarVista("registro");
        }
    });
}

function logout() {
    if (wsClient) {
        try { wsClient.desconectar(); } catch(e) {}
    }
    localStorage.removeItem("jwt_token"); 
    gestorActual = null;
    mostrarVista("login");
}

function cargarBienvenida() {
    rest.get("/api/gestores/" + gestorActual, function(status, response) {
        if (status == 200) {
            document.getElementById("bienvenida").innerHTML = 
                "Bienvenido, " + response.nombre + " " + response.apellidos;
        }
    });
}

function cargarDatosAuxiliares(callback) {
    rest.get("/api/categorias", function(status, respCat) {
        if (status == 200) {
            categorias = respCat;
            cargarSelectCategorias();
        }
        rest.get("/api/models", function(status, respMod) {
            if (status == 200) {
                modelos = respMod;
                cargarSelectModelos();
            }
            rest.get("/api/ubicaciones", function(status, respUbic) {
                if (status == 200) {
                    ubicaciones = respUbic;
                    cargarSelectUbicaciones();
                }
                if (callback) callback();
            });
        });
    });
}

function cargarSelectCategorias() {
    var selectFiltro = document.getElementById("filtro-categoria");
    selectFiltro.innerHTML = "<option value='Todos'>Todos</option>";
    for (var i = 0; i < categorias.length; i++) {
        selectFiltro.innerHTML += "<option value='" + categorias[i].id + "'>" + categorias[i].nombre + "</option>";
    }
    
    var selectForm = document.getElementById("recurso-categoria");
    selectForm.innerHTML = "<option value=''>Seleccione categoría</option>";
    for (var i = 0; i < categorias.length; i++) {
        selectForm.innerHTML += "<option value='" + categorias[i].id + "'>" + categorias[i].nombre + "</option>";
    }
}

function cargarSelectModelos() {
    var selectFiltro = document.getElementById("filtro-modelo");
    selectFiltro.innerHTML = "<option value='Todos'>Todos</option>";
    for (var i = 0; i < modelos.length; i++) {
        selectFiltro.innerHTML += "<option value='" + modelos[i].id + "'>" + modelos[i].nombre + "</option>";
    }
}

function cargarSelectUbicaciones() {
    var selectFiltro = document.getElementById("filtro-ubicacion");
    selectFiltro.innerHTML = "<option value='Todos'>Todos</option>";
    for (var i = 0; i < ubicaciones.length; i++) {
        selectFiltro.innerHTML += "<option value='" + ubicaciones[i].id + "'>" + ubicaciones[i].nombre + "</option>";
    }
    
    var selectForm = document.getElementById("recurso-ubicacion");
    selectForm.innerHTML = "<option value=''>Seleccione ubicación</option>";
    for (var i = 0; i < ubicaciones.length; i++) {
        selectForm.innerHTML += "<option value='" + ubicaciones[i].id + "'>" + ubicaciones[i].nombre + "</option>";
    }
}

function cargarModelosPorCategoria() {
    var categoriaId = document.getElementById("recurso-categoria").value;
    var selectModelo = document.getElementById("recurso-modelo");
    
    selectModelo.innerHTML = "<option value=''>Seleccione modelo</option>";
    
    if (categoriaId) {
        for (var i = 0; i < modelos.length; i++) {
            if (modelos[i].categoria == categoriaId) {
                selectModelo.innerHTML += "<option value='" + modelos[i].id + "'>" + modelos[i].nombre + "</option>";
            }
        }
    }
}

function buscarRecursos() {
    var categoria = document.getElementById("filtro-categoria").value;
    var modelo = document.getElementById("filtro-modelo").value;
    var ubicacion = document.getElementById("filtro-ubicacion").value;
    var estado = document.getElementById("filtro-estado").value;
    
    var url = "/api/recursos?";
    if (categoria != "Todos") url += "categoria=" + categoria + "&";
    if (modelo != "Todos") url += "modelo=" + modelo + "&";
    if (ubicacion != "Todos") url += "ubicacion=" + ubicacion + "&";
    if (estado != "Todos") url += "estado=" + estado + "&";
    
    rest.get(url, function(status, response) {
        if (status == 200) {
            mostrarRecursos(response);
        }
    });
}

function mostrarRecursos(recursos) {
    var tbody = document.getElementById("recursos-tbody");
    tbody.innerHTML = "";
    
    for (var i = 0; i < recursos.length; i++) {
        var recurso = recursos[i];
        
        var modelo = getModeloById(recurso.modelo);
        var categoria = getCategoriaById(modelo ? modelo.categoria : null);
        var ubicacion = getUbicacionById(recurso.ubicacion);
        
        var estadoTexto = ["Operativo", "De baja", "En mantenimiento"][recurso.estado] || "Desconocido";
        
        tbody.innerHTML += 
            "<tr>" +
            "<td>" + recurso.numero_serie + "</td>" +
            "<td>" + (categoria ? categoria.nombre : "Desconocida") + "</td>" +
            "<td>" + (modelo ? modelo.nombre : "Desconocido") + "</td>" +
            "<td>" + (ubicacion ? ubicacion.nombre : "Desconocida") + "</td>" +
            "<td>" + estadoTexto + "</td>" +
            "<td>" +
            "<button class='btn-editar' onclick='editarRecurso(" + recurso.id + ")'>Editar</button>" +
            "<button class='btn-borrar' onclick='borrarRecurso(" + recurso.id + ")'>Borrar</button>" +
            "</td>" +
            "</tr>";
    }
}

function nuevoRecurso() {
    document.getElementById("recurso-titulo").innerHTML = "Nuevo Recurso";
    document.getElementById("recurso-id").value = "";
    document.getElementById("recurso-form").reset();
    mostrarSubVista("recurso");
}

function editarRecurso(id) {
    document.getElementById("recurso-titulo").innerHTML = "Editar Recurso";
    
    rest.get("/api/recursos/" + id, function(status, response) {
        if (status == 200) {
            document.getElementById("recurso-id").value = response.id;
            
            var modelo = getModeloById(response.modelo);
            if (modelo) {
                document.getElementById("recurso-categoria").value = modelo.categoria;
                cargarModelosPorCategoria();
                setTimeout(function() {
                    document.getElementById("recurso-modelo").value = response.modelo;
                }, 100);
            }
            
            document.getElementById("recurso-serie").value = response.numero_serie;
            document.getElementById("recurso-ubicacion").value = response.ubicacion;
            document.getElementById("recurso-estado").value = response.estado;
            
            mostrarSubVista("recurso");
            cargarReservas(response.id);
            cargarResenvas(response.id);
        }
    });
}

function guardarRecurso() {
    var recursoData = {
        modelo: parseInt(document.getElementById("recurso-modelo").value),
        ubicacion: parseInt(document.getElementById("recurso-ubicacion").value),
        numero_serie: document.getElementById("recurso-serie").value,
        estado: parseInt(document.getElementById("recurso-estado").value),
        gestorNombre: document.getElementById("bienvenida").innerText.replace("Bienvenido, ", "")
    };
    
    var recursoId = document.getElementById("recurso-id").value;
    
    if (recursoId) {
        rest.put("/api/recursos/" + recursoId, recursoData, function(status, response) {
            if (status == 200) {
                volverALista();
                buscarRecursos();
            }
        });
    } else {
        rest.post("/api/recursos", recursoData, function(status, response) {
            if (status == 201) {
                volverALista();
                buscarRecursos();
            }
        });
    }
}

function borrarRecurso(id) {
    if (confirm("¿Está seguro de que desea borrar este recurso?")) {
        rest.delete("/api/recursos/" + id, function(status, response) {
            if (status == 200) {
                buscarRecursos();
            }
        });
    }
}

function volverALista() {
    mostrarSubVista("recursos");
    buscarRecursos();
}

function cargarReservas(recursoId) {
    rest.get("/api/recursos/" + recursoId + "/reservas", function(status, response) {
        if (status == 200) {
            var tbody = document.getElementById("reservas-tbody");
            tbody.innerHTML = "";
            
            for (var i = 0; i < response.length; i++) {
                var reserva = response[i];
                
                var claseColor = "";
                if (reserva.fecha_fin) {
                    claseColor = "reserva-finalizada";
                } else if (reserva.fecha_inicio) {
                    var ahora = new Date();
                    var inicio = new Date(reserva.fecha_inicio);
                    var horasUso = (ahora - inicio) / (1000 * 60 * 60);
                    if (horasUso > reserva.horas_estimadas) {
                        claseColor = "reserva-uso-excedido";
                    } else {
                        claseColor = "reserva-uso-normal";
                    }
                } else {
                    claseColor = "reserva-pendiente";
                }
                
                tbody.innerHTML += 
                    "<tr id='reserva-" + reserva.id + "' class='" + claseColor + "'>" +
                    "<td class='sanitario-" + reserva.id + "'>Cargando...</td>" +
                    "<td>" + reserva.horas_estimadas + "</td>" +
                    "<td>" + new Date(reserva.fecha_peticion).toLocaleString() + "</td>" +
                    "<td>" + (reserva.fecha_inicio ? new Date(reserva.fecha_inicio).toLocaleString() : "Pendiente") + "</td>" +
                    "</tr>";
                
                rest.get("/api/sanitarios/" + reserva.sanitario, function(status, resp) {
                    if (status == 200) {
                        var celdas = document.querySelectorAll(".sanitario-" + reserva.id);
                        for (var j = 0; j < celdas.length; j++) {
                            celdas[j].innerHTML = resp.nombre + " " + resp.apellidos;
                        }
                    }
                });
            }
        }
    });
}

function cargarResenvas(recursoId) {
    rest.get("/api/recursos/" + recursoId + "/resenvas", function(status, response) {
        if (status == 200) {
            var tbody = document.getElementById("resenvas-tbody");
            tbody.innerHTML = "";
            
            for (var i = 0; i < response.length; i++) {
                var resenva = response[i];
                
                rest.get("/api/sanitarios/" + resenva.sanitario, function(status, resp) {
                    if (status == 200) {
                        var estrellas = "";
                        for (var j = 0; j < resenva.valor; j++) estrellas += "★";
                        for (var j = resenva.valor; j < 5; j++) estrellas += "☆";
                        
                        tbody.innerHTML += 
                            "<tr>" +
                            "<td>" + new Date(resenva.fecha).toLocaleString() + "</td>" +
                            "<td>" + resp.nombre + " " + resp.apellidos + "</td>" +
                            "<td>" + estrellas + "</td>" +
                            "<td>" + resenva.descripcion + "</td>" +
                            "</tr>";
                    }
                });
            }
        }
    });
}

function getModeloById(id) {
    for (var i = 0; i < modelos.length; i++) {
        if (modelos[i].id == id) return modelos[i];
    }
    return null;
}

function getCategoriaById(id) {
    for (var i = 0; i < categorias.length; i++) {
        if (categorias[i].id == id) return categorias[i];
    }
    return null;
}

function getUbicacionById(id) {
    for (var i = 0; i < ubicaciones.length; i++) {
        if (ubicaciones[i].id == id) return ubicaciones[i];
    }
    return null;
}

function verReservasSinActivar() {
    rest.get("/api/reservas/sin-activar/count", function(status, response) {
        if (status == 200) {
            alert("Reservas sin activar (fecha_inicio = null): " + response.count);
        } else {
            alert("Error al obtener las reservas sin activar");
        }
    });
}

var AREAS_MEDICAS = {
    1: "Alergología",
    2: "Anestesiología",
    3: "Cardiología",
    4: "Cirugía General",
    5: "Dermatología",
    6: "Aparato Digestivo",
    7: "Endocrinología",
    8: "Ginecología",
    9: "Hematología",
    10: "Medicina Interna",
    11: "Neumología",
    12: "Neurología",
    13: "Oftalmología",
    14: "Oncología",
    15: "Pediatría",
    16: "Psiquiatría",
    17: "Traumatología",
    18: "Urología"
};

function cargarRankingMinisterio() {
    var tbody = document.getElementById("ranking-ministerio-tbody");
    if (!tbody) return;

    rest.get("https://undefined.ua.es/telemedicina/api/datos", function(status, data) {
        if (status !== 200 || !Array.isArray(data)) {
            tbody.innerHTML = "<tr><td colspan='3' style='text-align:center;'>Error al consultar los datos del Ministerio</td></tr>";
            return;
        }

        var reservasPorArea = {};
        for (var i = 1; i <= 18; i++) {
            reservasPorArea[i] = 0;
        }

        data.forEach(function(item) {
            var areaId = parseInt(item.id_area);
            if (reservasPorArea[areaId] !== undefined) {
                var totalRegistros = Array.isArray(item.datos) ? item.datos.length : 1;
                reservasPorArea[areaId] += totalRegistros;
            }
        });

        var ranking = [];
        for (var id = 1; id <= 18; id++) {
            ranking.push({
                id: id,
                nombre: AREAS_MEDICAS[id] || ("Área " + id),
                total: reservasPorArea[id]
            });
        }

        ranking.sort(function(a, b) {
            return b.total - a.total;
        });

        tbody.innerHTML = "";
        ranking.forEach(function(area, index) {
            tbody.innerHTML += 
                "<tr>" +
                "<td style='text-align: center; font-weight: bold;'>" + (index + 1) + "</td>" +
                "<td>" + area.nombre + "</td>" +
                "<td style='text-align: right;'>" + area.total.toLocaleString() + "</td>" +
                "</tr>";
        });
    });
}

function peticionAsync(url) {
    return new Promise(function(resolve) {
        rest.get(url, function(status, data) {
            if (status >= 200 && status < 300) {
                resolve(data);
            } else {
                resolve(null);
            }
        });
    });
}

async function enviarReservasAlMinisterio() {
    var hoy = new Date().toISOString().split("T")[0];

    if (!categorias || categorias.length === 0 || !modelos || modelos.length === 0) {
        await new Promise(function(resolve) {
            cargarDatosAuxiliares(resolve);
        });
    }

    var recursos = await peticionAsync("/api/recursos");
    if (!recursos || !Array.isArray(recursos) || recursos.length === 0) {
        alert("No se han encontrado recursos en el hospital.");
        return;
    }

    var sanitariosCache = {}; 
    var listaDatos = [];

    for (var i = 0; i < recursos.length; i++) {
        var rec = recursos[i];
        
        var mod = getModeloById(rec.modelo);
        var cat = getCategoriaById(mod ? mod.categoria : null);
        var nombreCategoria = cat ? cat.nombre : "Equipamiento Médico";

        var reservasRecurso = await peticionAsync("/api/recursos/" + rec.id + "/reservas");

        if (reservasRecurso && Array.isArray(reservasRecurso)) {
            for (var j = 0; j < reservasRecurso.length; j++) {
                var res = reservasRecurso[j];
                var idSanitario = res.sanitario;

                if (!sanitariosCache[idSanitario]) {
                    var datosSanitario = await peticionAsync("/api/sanitarios/" + idSanitario);
                    sanitariosCache[idSanitario] = datosSanitario || { nombre: "Sanitario", apellidos: "Desconocido" };
                }

                var s = sanitariosCache[idSanitario];

                var fecPet = res.fecha_peticion ? res.fecha_peticion.split("T")[0] : hoy;
                var fecIni = res.fecha_inicio ? res.fecha_inicio.replace("T", " ").substring(0, 19) : (hoy + " 08:00:00");
                var fecFin = res.fecha_fin ? res.fecha_fin.replace("T", " ").substring(0, 19) : (hoy + " 10:00:00");
                var horas = res.horas_estimadas !== undefined && res.horas_estimadas !== null ? String(res.horas_estimadas) : "1";

                listaDatos.push({
                    nombre: s.nombre,
                    apellidos: s.apellidos,
                    categoría: nombreCategoria,
                    horas_estimadas: horas,
                    fec_pet: fecPet,
                    fec_ini: fecIni,
                    fecha_fin: fecFin
                });
            }
        }
    }

    if (listaDatos.length === 0) {
        alert("No hay reservas registradas en ningún recurso para enviar.");
        return;
    }

    var payload = {
        id_area: 13,
        fecha: hoy,
        datos: listaDatos
    };

    rest.post("https://undefined.ua.es/telemedicina/api/datos", payload, function(status, response) {
        if (status === 200 || status === 201) {
            alert("Se han enviado con éxito " + listaDatos.length + " reservas al Ministerio para el área 13 (" + (AREAS_MEDICAS[13] || "Área 13") + ").");
            cargarRankingMinisterio();
        } else {
            console.error("Error devuelto por el Ministerio:", status, response);
            alert("Error al enviar reservas al Ministerio (Status: " + status + ")");
        }
    });
}
