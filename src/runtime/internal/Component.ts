import { children, detach, end_hydrating, start_hydrating } from './dom';
import { current_component, set_current_component } from './lifecycle';
import { add_render_callback, dirty_components, flush, schedule_update } from './scheduler';
import { transition_in } from './transitions';
import { blank_object, is_empty, is_function, noop, run, run_all } from './utils';

/**
 * INTERNAL, DO NOT USE. Code may change at any time.
 */
export interface Fragment {
	key?: string | null;
	first?: null;
	/* create  */ c: () => void;
	/* claim   */ l?: (nodes: any) => void;
	/* hydrate */ h?: () => void;
	/* mount   */ m: (target: Element | ShadowRoot, anchor: Element) => void;
	/* update  */ p: (ctx: any, dirty: any) => void;
	/* measure */ r?: () => void;
	/* fix     */ f?: () => void;
	/* animate */ a?: () => void;
	/* intro   */ i: (local: any) => void;
	/* outro   */ o: (local: any) => void;
	/* destroy */ d: (detaching: 0 | 1) => void;
}

interface T$$ {
	dirty: number[];
	ctx: null | any;
	bound: Array<((value: unknown) => unknown)>;
	update: () => void;
	callbacks: any;
	after_update: any[];
	props: Record<string, 0 | string>;
	fragment: null | false | Fragment;
	not_equal: (a: unknown, b: unknown) => boolean;
	before_update: any[];
	context: Map<any, any>;
	on_mount: any[];
	on_destroy: any[];
	skip_bound: boolean;
	on_disconnect: any[];
	root: Element | ShadowRoot
}

export function bind(component: SvelteComponent, name: string, callback: (context: unknown) => void): void {
	const index = component.$$.props[name];
	if (index !== undefined) {
		component.$$.bound[index] = callback;
		callback(component.$$.ctx[index]);
	}
}

export function create_component(block: Fragment): void {
	block && block.c();
}

export function claim_component(block: Fragment, parent_nodes): void {
	block && block.l(parent_nodes);
}

/**
 * 
 * @param component 
 * @param target 
 * @param anchor 
 * @param customElement 
 */
export function mount_component(component: SvelteComponent, target: Element | ShadowRoot, anchor: Element, customElement?: Element): void {
	const { fragment, on_mount, on_destroy, after_update } = component.$$;

	fragment && fragment.m(target, anchor);

	if (!customElement) {
		// onMount happens before the initial afterUpdate
		add_render_callback(() => {

			const new_on_destroy = on_mount.map(run).filter(is_function);
			if (on_destroy) {
				on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});
	}

	after_update.forEach(add_render_callback);
}

export function destroy_component(component: SvelteComponent, detaching: 0 | 1): void {
	const $$ = component.$$;
	if ($$.fragment !== null) {
		run_all($$.on_destroy);

		$$.fragment && $$.fragment.d(detaching);

		// TODO null out other refs, including component.$$ (but need to
		// preserve final state?)
		$$.on_destroy = $$.fragment = null;
		$$.ctx = [];
	}
}

function make_dirty(component: SvelteComponent, i: number): void {
	if (component.$$.dirty[0] === -1) {
		dirty_components.push(component);
		schedule_update();
		component.$$.dirty.fill(0);
	}
	component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}

export interface InitOptions {
	target: Element;
	context?: unknown;
	hydrate?: unknown;
	props?: unknown;
	intro?: unknown;
	anchor?: Element;
	customElement?: Element;
}

export interface InitInstance {
	(component: unknown, options: unknown, third: unknown): unknown;
}

export function init(component: SvelteComponent, options: InitOptions, instance: InitInstance | null, create_fragment: (ctx: unknown) => false | Fragment, not_equal: (a: unknown, b: unknown) => boolean, props, append_styles?: (root: Element | ShadowRoot) => void, dirty = [-1]) {
	const parent_component = current_component;
	set_current_component(component);

	const $$: T$$ = component.$$ = {
		fragment: null,
		ctx: null,

		// state
		props,
		update: noop,
		not_equal,
		bound: blank_object(),

		// lifecycle
		on_mount: [],
		on_destroy: [],
		on_disconnect: [],
		before_update: [],
		after_update: [],
		context: new Map(options.context || (parent_component ? parent_component.$$.context as any : [])),

		// everything else
		callbacks: blank_object(),
		dirty,
		skip_bound: false,
		root: options.target || parent_component.$$.root
	};

	append_styles && append_styles($$.root);

	let ready = false;

	$$.ctx = instance
		? instance(component, options.props || {}, (i: number, ret, ...rest) => {
			const value = rest.length ? rest[0] : ret;
			if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
				if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
				if (ready) make_dirty(component, i);
			}
			return ret;
		})
		: [];

	$$.update();
	ready = true;
	run_all($$.before_update);

	// `false` as a special case of no DOM component
	$$.fragment = create_fragment ? create_fragment($$.ctx) : false;

	if (options.target) {
		if (options.hydrate) {
			start_hydrating();
			const nodes = children(options.target);
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			$$.fragment && $$.fragment!.l(nodes);
			nodes.forEach(detach);
		} else {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			$$.fragment && $$.fragment!.c();
		}

		if (options.intro) transition_in(component.$$.fragment as Fragment);
		mount_component(component, options.target, options.anchor, options.customElement);
		end_hydrating();
		flush();
	}

	set_current_component(parent_component);
}

export let SvelteElement;
if (typeof HTMLElement === 'function') {
	SvelteElement = class extends HTMLElement {
		$$: T$$;
		$$set?: ($$props: any) => void;
		constructor() {
			super();
			this.attachShadow({ mode: 'open' });
		}

		connectedCallback() {
			const { on_mount } = this.$$;
			this.$$.on_disconnect = on_mount.map(run).filter(is_function);

			// @ts-ignore todo: improve typings
			for (const key in this.$$.slotted) {
				// @ts-ignore todo: improve typings
				this.appendChild(this.$$.slotted[key]);
			}
		}

		attributeChangedCallback(attr, _oldValue, newValue) {
			this[attr] = newValue;
		}

		disconnectedCallback() {
			run_all(this.$$.on_disconnect);
		}

		$destroy() {
			destroy_component(this, 1);
			this.$destroy = noop;
		}

		$on(type, callback) {
			// TODO should this delegate to addEventListener?
			const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
			callbacks.push(callback);

			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		$set($$props) {
			if (this.$$set && !is_empty($$props)) {
				this.$$.skip_bound = true;
				this.$$set($$props);
				this.$$.skip_bound = false;
			}
		}
	};
}

/**
 * Base class for Svelte components. Used when dev=false.
 */
export class SvelteComponent {
	$$: T$$;
	$$set?: ($$props: any) => void;

	$destroy(): void {
		destroy_component(this, 1);
		this.$destroy = noop;
	}

	$on(type, callback) {
		const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
		callbacks.push(callback);

		return () => {
			const index = callbacks.indexOf(callback);
			if (index !== -1) callbacks.splice(index, 1);
		};
	}

	$set($$props) {
		if (this.$$set && !is_empty($$props)) {
			this.$$.skip_bound = true;
			this.$$set($$props);
			this.$$.skip_bound = false;
		}
	}
}
