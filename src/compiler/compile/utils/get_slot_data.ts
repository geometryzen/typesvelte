import Attribute from '../nodes/Attribute';
import { p, x } from 'code-red';
import { string_literal } from './stringify';
import Block from '../render_dom/Block';
import { Node/*, Property, SpreadElement*/ } from 'estree';

// export type Xyz = (Property & { start: number; end: number; }) | (SpreadElement & { start: number; end: number });

export default function get_slot_data(values: Map<string, Attribute>, block: Block = null): { type: string, properties: unknown[] } {
	return {
		type: 'ObjectExpression',
		properties: Array.from(values.values())
			.filter(attribute => attribute.name !== 'name')
			.map(attribute => {
				if (attribute.is_spread) {
					const argument = get_spread_value(block, attribute);
					return {
						type: 'SpreadElement',
						argument
					};
				}

				const value = get_value(block, attribute);
				const mapped = p`${attribute.name}: ${value}`;
				return mapped;
			})
	};
}

function get_value(block: Block, attribute: Attribute) {
	if (attribute.is_true) return x`true`;
	if (attribute.chunks.length === 0) return x`""`;

	let value = attribute.chunks
		.map(chunk => chunk.type === 'Text' ? string_literal(chunk.data) : (block ? chunk.manipulate(block) : chunk.node))
		.reduce((lhs, rhs) => x`${lhs} + ${rhs}` as any);

	if (attribute.chunks.length > 1 && attribute.chunks[0].type !== 'Text') {
		value = x`"" + ${value}` as any;
	}

	return value;
}

function get_spread_value(block: Block, attribute: Attribute): Node {
	return block ? attribute.expression.manipulate(block) : attribute.expression.node;
}
