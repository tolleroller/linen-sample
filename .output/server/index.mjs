globalThis.__nitro_main__ = import.meta.url;
import { a as toEventHandler, c as serve, i as defineLazyEventHandler, n as HTTPError, r as defineHandler, s as NodeResponse, t as H3Core } from "./_libs/h3+rou3+srvx.mjs";
import { i as withoutTrailingSlash, n as joinURL, r as withLeadingSlash, t as decodePath } from "./_libs/ufo.mjs";
import { promises } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
//#region node_modules/nitro/dist/runtime/internal/route-rules.mjs
var headers = ((m) => function headersRouteRule(event) {
	for (const [key, value] of Object.entries(m.options || {})) event.res.headers.set(key, value);
});
//#endregion
//#region #nitro/virtual/public-assets-data
var public_assets_data_default = {
	"/apple-touch-icon-120x120.png": {
		"type": "image/png",
		"etag": "\"36bb-t/HTexTI3iyU158OfxzcVBDa2tU\"",
		"mtime": "2026-10-14T17:41:05.117Z",
		"size": 14011,
		"path": "../public/apple-touch-icon-120x120.png"
	},
	"/apple-touch-icon-152x152.png": {
		"type": "image/png",
		"etag": "\"52b7-4BiwMzjNJXk5NTmyRy1j/kkerQE\"",
		"mtime": "2026-10-14T17:41:05.117Z",
		"size": 21175,
		"path": "../public/apple-touch-icon-152x152.png"
	},
	"/apple-touch-icon-180x180-precomposed.png": {
		"type": "image/png",
		"etag": "\"6f4f-i7Q6ZCP2Timg+r4t7R7vl9DMomI\"",
		"mtime": "2026-10-14T17:41:05.117Z",
		"size": 28495,
		"path": "../public/apple-touch-icon-180x180-precomposed.png"
	},
	"/apple-touch-icon-180x180.png": {
		"type": "image/png",
		"etag": "\"6f4f-i7Q6ZCP2Timg+r4t7R7vl9DMomI\"",
		"mtime": "2026-10-14T17:41:05.117Z",
		"size": 28495,
		"path": "../public/apple-touch-icon-180x180.png"
	},
	"/apple-touch-icon-precomposed.png": {
		"type": "image/png",
		"etag": "\"6f4f-i7Q6ZCP2Timg+r4t7R7vl9DMomI\"",
		"mtime": "2026-10-14T17:41:05.117Z",
		"size": 28495,
		"path": "../public/apple-touch-icon-precomposed.png"
	},
	"/favicon.svg": {
		"type": "image/svg+xml",
		"etag": "\"1f7-xcCxbMD1/TA1SMkj6e3XcE8YAk0\"",
		"mtime": "2026-10-14T17:41:05.117Z",
		"size": 503,
		"path": "../public/favicon.svg"
	},
	"/apple-touch-icon.png": {
		"type": "image/png",
		"etag": "\"6f4f-i7Q6ZCP2Timg+r4t7R7vl9DMomI\"",
		"mtime": "2026-10-14T17:41:05.117Z",
		"size": 28495,
		"path": "../public/apple-touch-icon.png"
	},
	"/icon-192.png": {
		"type": "image/png",
		"etag": "\"7c8d-yQWL+nNIRpklZIlJdUNBrgCdzAI\"",
		"mtime": "2026-10-14T17:41:05.117Z",
		"size": 31885,
		"path": "../public/icon-192.png"
	},
	"/linen-icon.png": {
		"type": "image/png",
		"etag": "\"6f4f-i7Q6ZCP2Timg+r4t7R7vl9DMomI\"",
		"mtime": "2026-10-14T17:41:05.117Z",
		"size": 28495,
		"path": "../public/linen-icon.png"
	},
	"/manifest.webmanifest": {
		"type": "application/manifest+json",
		"etag": "\"22a-TlGgV21MSHDOT4oqqOjh40wyJOg\"",
		"mtime": "2026-10-14T17:41:05.117Z",
		"size": 554,
		"path": "../public/manifest.webmanifest"
	},
	"/linen-leaf.png": {
		"type": "image/png",
		"etag": "\"6f4f-i7Q6ZCP2Timg+r4t7R7vl9DMomI\"",
		"mtime": "2026-10-14T17:41:05.117Z",
		"size": 28495,
		"path": "../public/linen-leaf.png"
	},
	"/og.jpg": {
		"type": "image/jpeg",
		"etag": "\"174b1-kjZNF/rOBp+zZYTorZ2zpO+AQ8w\"",
		"mtime": "2026-10-14T17:41:05.117Z",
		"size": 95409,
		"path": "../public/og.jpg"
	},
	"/icon-512.png": {
		"type": "image/png",
		"etag": "\"2d841-9iijTI65B68TFNdJjahSI1ycsXc\"",
		"mtime": "2026-10-14T17:41:05.117Z",
		"size": 186433,
		"path": "../public/icon-512.png"
	},
	"/olive-branch.png": {
		"type": "image/png",
		"etag": "\"2d841-9iijTI65B68TFNdJjahSI1ycsXc\"",
		"mtime": "2026-10-14T17:41:05.117Z",
		"size": 186433,
		"path": "../public/olive-branch.png"
	},
	"/assets/styles-CAaAN83T.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"4eab-/9orhrx1D4gW1nvCSd9SfgpZAFs\"",
		"mtime": "2026-10-14T17:41:04.937Z",
		"size": 20139,
		"path": "../public/assets/styles-CAaAN83T.css"
	},
	"/assets/index-BEhabqTZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"59a8c-v6gVuCR2fJyGWiipAoaeMwpC9uc\"",
		"mtime": "2026-10-14T17:41:04.937Z",
		"size": 367244,
		"path": "../public/assets/index-BEhabqTZ.js"
	},
	"/assets/routes-DaEJbguA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"721e1-PQr786VbZHJgGKiHoZ/MlKTYdlw\"",
		"mtime": "2026-10-14T17:41:04.937Z",
		"size": 467425,
		"path": "../public/assets/routes-DaEJbguA.js"
	},
	"/header.png": {
		"type": "image/png",
		"etag": "\"d9dd9-Hi0JfKh0oLoa55SqsOU0zEcRiuE\"",
		"mtime": "2026-10-14T17:41:05.117Z",
		"size": 892377,
		"path": "../public/header.png"
	}
};
//#endregion
//#region #nitro/virtual/public-assets-node
function readAsset(id) {
	const serverDir = dirname(fileURLToPath(globalThis.__nitro_main__));
	return promises.readFile(resolve(serverDir, public_assets_data_default[id].path));
}
//#endregion
//#region #nitro/virtual/public-assets
var publicAssetBases = {};
function isPublicAssetURL(id = "") {
	if (public_assets_data_default[id]) return true;
	for (const base in publicAssetBases) if (id.startsWith(base)) return true;
	return false;
}
function getAsset(id) {
	return public_assets_data_default[id];
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/static.mjs
var METHODS = /* @__PURE__ */ new Set(["HEAD", "GET"]);
var EncodingMap = {
	gzip: ".gz",
	br: ".br",
	zstd: ".zst"
};
var static_default = defineHandler((event) => {
	if (event.req.method && !METHODS.has(event.req.method)) return;
	let id = decodePath(withLeadingSlash(withoutTrailingSlash(event.url.pathname)));
	let asset;
	const encodings = [...(event.req.headers.get("accept-encoding") || "").split(",").map((e) => EncodingMap[e.trim()]).filter(Boolean).sort(), ""];
	for (const encoding of encodings) for (const _id of [id + encoding, joinURL(id, "index.html" + encoding)]) {
		const _asset = getAsset(_id);
		if (_asset) {
			asset = _asset;
			id = _id;
			break;
		}
	}
	if (!asset) {
		if (isPublicAssetURL(id)) {
			event.res.headers.delete("Cache-Control");
			throw new HTTPError({ status: 404 });
		}
		return;
	}
	if (encodings.length > 1) event.res.headers.append("Vary", "Accept-Encoding");
	if (event.req.headers.get("if-none-match") === asset.etag) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	const ifModifiedSinceH = event.req.headers.get("if-modified-since");
	const mtimeDate = new Date(asset.mtime);
	if (ifModifiedSinceH && asset.mtime && new Date(ifModifiedSinceH) >= mtimeDate) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	if (asset.type) event.res.headers.set("Content-Type", asset.type);
	if (asset.etag && !event.res.headers.has("ETag")) event.res.headers.set("ETag", asset.etag);
	if (asset.mtime && !event.res.headers.has("Last-Modified")) event.res.headers.set("Last-Modified", mtimeDate.toUTCString());
	if (asset.encoding && !event.res.headers.has("Content-Encoding")) event.res.headers.set("Content-Encoding", asset.encoding);
	if (asset.size > 0 && !event.res.headers.has("Content-Length")) event.res.headers.set("Content-Length", asset.size.toString());
	return readAsset(id);
});
//#endregion
//#region #nitro/virtual/routing
var findRouteRules = /* @__PURE__ */ (() => {
	const $0 = [{
		name: "headers",
		route: "/assets/**",
		handler: headers,
		options: { "cache-control": "public, max-age=31536000, immutable" }
	}];
	return (m, p) => {
		let r = [];
		if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1) || "/";
		let s = p.split("/");
		if (s.length > 1) {
			if (s[1] === "assets") r.unshift({
				data: $0,
				params: { "_": s.slice(2).join("/") }
			});
		}
		return r;
	};
})();
var _lazy_vCvXFM = defineLazyEventHandler(() => import("./_chunks/ssr-renderer.mjs"));
var findRoute = /* @__PURE__ */ (() => {
	const data = {
		route: "/**",
		handler: _lazy_vCvXFM
	};
	return ((_m, p) => {
		return {
			data,
			params: { "_": p.slice(1) }
		};
	});
})();
var globalMiddleware = [toEventHandler(static_default)].filter(Boolean);
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/prod.mjs
var errorHandler = (error, event) => {
	const res = defaultHandler(error, event);
	return new NodeResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
};
function defaultHandler(error, event) {
	const unhandled = error.unhandled ?? !HTTPError.isError(error);
	const { status = 500, statusText = "" } = unhandled ? {} : error;
	if (status === 404) {
		const url = event.url || new URL(event.req.url);
		const baseURL = "/";
		if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) return {
			status: 302,
			headers: new Headers({ location: `${baseURL}${url.pathname.slice(1)}${url.search}` })
		};
	}
	const headers = new Headers(unhandled ? {} : error.headers);
	headers.set("content-type", "application/json; charset=utf-8");
	return {
		status,
		statusText,
		headers,
		body: {
			error: true,
			...unhandled ? {
				status,
				unhandled: true
			} : typeof error.toJSON === "function" ? error.toJSON() : {
				status,
				statusText,
				message: error.message
			}
		}
	};
}
//#endregion
//#region #nitro/virtual/error-handler
var errorHandlers = [errorHandler];
async function error_handler_default(error, event) {
	for (const handler of errorHandlers) try {
		const response = await handler(error, event, { defaultHandler });
		if (response) return response;
	} catch (error) {
		console.error(error);
	}
}
//#endregion
//#region #nitro/virtual/app
function createNitroApp() {
	const captureError = (error, errorCtx) => {
		if (errorCtx?.event) {
			const errors = errorCtx.event.req.context?.nitro?.errors;
			if (errors) errors.push({
				error,
				context: errorCtx
			});
		}
	};
	const h3App = createH3App({ onError(error, event) {
		return error_handler_default(error, event);
	} });
	let appHandler = (req) => {
		req.context ||= {};
		req.context.nitro = req.context.nitro || { errors: [] };
		return h3App.fetch(req);
	};
	return {
		fetch: appHandler,
		h3: h3App,
		hooks: void 0,
		captureError
	};
}
function createH3App(config) {
	const h3App = new H3Core(config);
	h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);
	h3App["~middleware"].push(...globalMiddleware);
	h3App["~getMiddleware"] = (event, route) => {
		const pathname = event.url.pathname;
		const method = event.req.method;
		const middleware = [];
		const routeRules = getRouteRules(method, pathname);
		event.context.routeRules = routeRules?.routeRules;
		if (routeRules?.routeRuleMiddleware.length) middleware.push(...routeRules.routeRuleMiddleware);
		middleware.push(...h3App["~middleware"]);
		if (route?.data?.middleware?.length) middleware.push(...route.data.middleware);
		return middleware;
	};
	return h3App;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/app.mjs
var APP_ID = "default";
function useNitroApp() {
	let instance = useNitroApp._instance;
	if (instance) return instance;
	instance = useNitroApp._instance = createNitroApp();
	globalThis.__nitro__ = globalThis.__nitro__ || {};
	globalThis.__nitro__[APP_ID] = instance;
	return instance;
}
function getRouteRules(method, pathname) {
	const m = findRouteRules(method, pathname);
	if (!m?.length) return { routeRuleMiddleware: [] };
	const routeRules = {};
	for (const layer of m) for (const rule of layer.data) {
		const currentRule = routeRules[rule.name];
		if (currentRule) {
			if (rule.options === false) {
				delete routeRules[rule.name];
				continue;
			}
			if (typeof currentRule.options === "object" && typeof rule.options === "object") currentRule.options = {
				...currentRule.options,
				...rule.options
			};
			else currentRule.options = rule.options;
			currentRule.route = rule.route;
			currentRule.params = {
				...currentRule.params,
				...layer.params
			};
		} else if (rule.options !== false) routeRules[rule.name] = {
			...rule,
			params: layer.params
		};
	}
	const middleware = [];
	const orderedRules = Object.values(routeRules).sort((a, b) => (a.handler?.order || 0) - (b.handler?.order || 0));
	for (const rule of orderedRules) {
		if (rule.options === false || !rule.handler) continue;
		middleware.push(rule.handler(rule));
	}
	return {
		routeRules,
		routeRuleMiddleware: middleware
	};
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/hooks.mjs
function _captureError(error, type) {
	console.error(`[${type}]`, error);
	useNitroApp().captureError?.(error, { tags: [type] });
}
function trapUnhandledErrors() {
	process.on("unhandledRejection", (error) => _captureError(error, "unhandledRejection"));
	process.on("uncaughtException", (error) => _captureError(error, "uncaughtException"));
}
//#endregion
//#region #nitro/virtual/tracing
var tracingSrvxPlugins = [];
//#endregion
//#region node_modules/nitro/dist/presets/node/runtime/node-server.mjs
var _parsedPort = Number.parseInt(process.env.NITRO_PORT ?? process.env.PORT ?? "");
var port = Number.isNaN(_parsedPort) ? 3e3 : _parsedPort;
var host = process.env.NITRO_HOST || process.env.HOST;
var cert = process.env.NITRO_SSL_CERT;
var key = process.env.NITRO_SSL_KEY;
var nitroApp = useNitroApp();
serve({
	port,
	hostname: host,
	tls: cert && key ? {
		cert,
		key
	} : void 0,
	fetch: nitroApp.fetch,
	plugins: [...tracingSrvxPlugins]
});
trapUnhandledErrors();
var node_server_default = {};
//#endregion
export { node_server_default as default };
