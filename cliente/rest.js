// Realiza una petición REST con datos codificados en JSON
// Incluir en el HTML con <script src="rest.js"></script>
// uso:
// rest (metodo, url, [requestData], [callback])
// rest.metodo(url, [requestData], [callback])
// Cuando se completa la petición/respuesta se invoca callback con el estado y la respuesta: callback(status, response)
// Si no se pasa callback la petición es síncrona y retorna un objeto {status, response}
// ejemplos:
//  - rest("get", "http://www.miempresa.com/test", function (status, response) { ... });
//  - rest("post", "http://www.miempresa.com/persona", { nombre: "Luis" }, function (status, response) { ... });

(function () {
    function debug(...args) {
        if (rest.debug) console.log("REST", ...args);
    }

    function rest(method, url, data, callback) {
        method = method.toUpperCase(); 
        if (typeof data === "function") { 
            callback = data;
            data = null;
        }
        var async = typeof callback === "function"; 
        if (data && typeof data !== "string") data = JSON.stringify(data); 
        var xhr = new XMLHttpRequest();
        xhr.open(method, url, async);
       
        if (data) xhr.setRequestHeader("Content-type", "application/json;charset=UTF-8"); 

        // Solo inyectamos el token JWT si la ruta es de nuestra propia API local (/api/...)
        // y no cuando se consulta un servicio externo como la API del Ministerio
        var token = localStorage.getItem("jwt_token");
        var esRutaPropia = !url.startsWith("http://") && !url.startsWith("https://");
        if (token && esRutaPropia) {
            xhr.setRequestHeader("Authorization", "Bearer " + token);
        }

        debug(">>>", method, url, data);
        xhr.send(data); 

        function end() {
            debug("<<<", xhr.status, xhr.response);
            var response = xhr.response;

            // Consideramos éxito códigos 2xx (200, 201, 204) y también 304 Not Modified
            var statusOk = (xhr.status >= 200 && xhr.status < 300) || xhr.status === 304;

            if (statusOk && response && typeof response === "string") {
                try {
                    response = JSON.parse(response);
                } catch (e) {
                    console.warn("No se pudo parsear la respuesta JSON:", response);
                }
            }

            if (async) {
                callback(xhr.status, response);
            } else {
                return { status: xhr.status, response: response };
            }
        }

        if (async) {
            xhr.onload = end;
            xhr.onerror = end;
        } else {
            return end();
        }
    }

    rest.debug = false;

    rest.get = function (url, callback) { return rest("GET", url, callback); };
    rest.post = function (url, data, callback) { return rest("POST", url, data, callback); };
    rest.put = function (url, data, callback) { return rest("PUT", url, data, callback); };
    rest.delete = function (url, callback) { return rest("DELETE", url, callback); };

    window.rest = rest;
})();