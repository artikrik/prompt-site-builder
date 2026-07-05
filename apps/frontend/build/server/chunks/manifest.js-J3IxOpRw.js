const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.B7azuUMe.js",app:"_app/immutable/entry/app.6R17r7ch.js",imports:["_app/immutable/entry/start.B7azuUMe.js","_app/immutable/chunks/CgMlsj8G.js","_app/immutable/chunks/Dr5nq49l.js","_app/immutable/chunks/NNIDLwQB.js","_app/immutable/entry/app.6R17r7ch.js","_app/immutable/chunks/Dr5nq49l.js","_app/immutable/chunks/BwWWNAA1.js","_app/immutable/chunks/83kBhdSq.js","_app/immutable/chunks/JyzBMdJ3.js","_app/immutable/chunks/NNIDLwQB.js","_app/immutable/chunks/DRdcSOzW.js","_app/immutable/chunks/qa-PCl3P.js","_app/immutable/chunks/DvxprgMR.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./0-BqBHZvKG.js')),
			__memo(() => import('./1-CMOP745-.js')),
			__memo(() => import('./2-BWBknYRD.js')),
			__memo(() => import('./3-BBX_Q0Oh.js')),
			__memo(() => import('./4-73VNBo_x.js')),
			__memo(() => import('./5-C7wfVl8g.js')),
			__memo(() => import('./6-RF47b674.js')),
			__memo(() => import('./7-CPtkb8gj.js')),
			__memo(() => import('./8-DUnevZH_.js')),
			__memo(() => import('./9-h_kGdEKn.js')),
			__memo(() => import('./10-ljeJ8Roe.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/auth/login",
				pattern: /^\/auth\/login\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/auth/register",
				pattern: /^\/auth\/register\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/dashboard",
				pattern: /^\/dashboard\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/dashboard/leads",
				pattern: /^\/dashboard\/leads\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/dashboard/projects",
				pattern: /^\/dashboard\/projects\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/dashboard/projects/[id]",
				pattern: /^\/dashboard\/projects\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/dashboard/settings",
				pattern: /^\/dashboard\/settings\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 10 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

export { manifest as m };
//# sourceMappingURL=manifest.js-J3IxOpRw.js.map
