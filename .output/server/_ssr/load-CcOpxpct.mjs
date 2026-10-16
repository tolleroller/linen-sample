import { n as createServerFn, r as TSS_SERVER_FUNCTION } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/load-CcOpxpct.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var loadFinance_createServerFn_handler = createServerRpc({
	id: "6e917269a307c58683d8e0d7198ad60ce96a0a17f10a20c3c056a0c4da5535f0",
	name: "loadFinance",
	filename: "src/lib/finance/load.ts"
}, (opts) => loadFinance.__executeServer(opts));
var loadFinance = createServerFn({ method: "POST" }).handler(loadFinance_createServerFn_handler, async () => {
	try {
		const { setResponseHeader } = await import("./ssr.mjs").then((n) => n.a).then((n) => n.t);
		setResponseHeader("Cache-Control", "private, no-store");
	} catch {}
	const { demoSnapshot } = await import("./demo-snapshot-B9B5BDkr.mjs");
	return {
		...demoSnapshot,
		banksSyncedAt: demoSnapshot.syncedAt,
		liveSources: []
	};
});
//#endregion
export { loadFinance_createServerFn_handler };
