import { custom_event } from './dom';
import { Fragment } from './Component';

interface T$$ {
	dirty?: number[];
	ctx?: null | any;
	bound?: Array<((value: unknown) => unknown)>;
	update?: () => void;
	callbacks: any;
	after_update: any[];
	props?: Record<string, 0 | string>;
	fragment?: null | false | Fragment;
	not_equal?: any;
	before_update: any[];
	context: Map<any, any>;
	on_mount: any[];
	on_destroy: any[];
	skip_bound?: boolean;
	on_disconnect?: any[];
	root?: Element | ShadowRoot
}

export interface LifecycleComponent {
	$$: T$$;
}

export let current_component: LifecycleComponent;

export function set_current_component(component: LifecycleComponent) {
	current_component = component;
}

export function get_current_component() {
	if (!current_component) throw new Error('Function called outside component initialization');
	return current_component;
}

export function beforeUpdate(fn: () => any) {
	get_current_component().$$.before_update.push(fn);
}

export function onMount(fn: () => any) {
	get_current_component().$$.on_mount.push(fn);
}

export function afterUpdate(fn: () => any) {
	get_current_component().$$.after_update.push(fn);
}

export function onDestroy(fn: () => any) {
	get_current_component().$$.on_destroy.push(fn);
}

export function createEventDispatcher<
	EventMap extends {} = any
>(): <EventKey extends Extract<keyof EventMap, string>>(type: EventKey, detail?: EventMap[EventKey]) => void {
	const component = get_current_component();

	return (type: string, detail?: any) => {
		const callbacks = component.$$.callbacks[type];

		if (callbacks) {
			// TODO are there situations where events could be dispatched
			// in a server (non-DOM) environment?
			const event = custom_event(type, detail);
			callbacks.slice().forEach(fn => {
				fn.call(component, event);
			});
		}
	};
}

export function setContext<T>(key, context: T) {
	get_current_component().$$.context.set(key, context);
}

export function getContext<T>(key): T {
	return get_current_component().$$.context.get(key);
}

export function getAllContexts<T extends Map<any, any> = Map<any, any>>(): T {
	return get_current_component().$$.context as T;
}

export function hasContext(key): boolean {
	return get_current_component().$$.context.has(key);
}

// TODO figure out if we still want to support
// shorthand events, or if we want to implement
// a real bubbling mechanism
export function bubble(component: LifecycleComponent, event) {
	const callbacks = component.$$.callbacks[event.type];

	if (callbacks) {
		// @ts-ignore
		callbacks.slice().forEach(fn => fn.call(this, event));
	}
}
