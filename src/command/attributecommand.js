/**
 * @license Copyright (c) 2003-2016, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

'use strict';

import Command from './command.js';
import TreeWalker from '../engine/treemodel/treewalker.js';
import Range from '../engine/treemodel/range.js';

/**
 * An extension of basic {@link ckeditor5.command.Command} class, which provides utilities for a command that sets a single
 * attribute on a text or element with value `true`. AttributeCommand uses {@link engine.treeModel.Document#selection} to
 * decide which nodes (if any) should be changed, and applies or removes attributes from them.
 * See {@link engine.treeView.Converter#execute} for more.
 *
 * The command checks {@link engine.treeModel.Document#schema} to decide if it should be enabled.
 * See {@link engine.treeView.Converter#checkSchema} for more.
 *
 * @memberOf ckeditor5.command
 */
export default class AttributeCommand extends Command {
	/**
	 * @see ckeditor5.command.Command
	 * @param {ckeditor5.Editor} editor
	 * @param {String} attributeKey Attribute that will be set by the command.
	 */
	constructor( editor, attributeKey ) {
		super( editor );

		/**
		 * Attribute that will be set by the command.
		 *
		 * @member {String} ckeditor5.command.AttributeCommand#attributeKey
		 */
		this.attributeKey = attributeKey;

		/**
		 * Flag indicating whether command is active. For collapsed selection it means that typed characters will have
		 * the command's attribute set. For range selection it means that all nodes inside have the attribute applied.
		 *
		 * @member {Boolean} ckeditor5.command.AttributeCommand#value
		 */
		this.set( 'value', false );

		this.listenTo( this.editor.document.selection, 'change:attribute', () => {
			this.value = this.editor.document.selection.hasAttribute( this.attributeKey );
		} );
	}

	/**
	 * Checks {@link engine.treeModel.Document#schema} to decide if the command should be enabled:
	 * * if selection is on range, the command is enabled if any of nodes in that range can have bold,
	 * * if selection is collapsed, the command is enabled if text with bold is allowed in that node.
	 *
	 * @private
	 * @returns {Boolean}
	 */
	_checkEnabled() {
		const selection = this.editor.document.selection;
		const schema = this.editor.document.schema;

		if ( selection.isCollapsed ) {
			// Check whether schema allows for a test with `attributeKey` in caret position.
			return schema.checkAtPosition( selection.getFirstPosition(), '$text', this.attributeKey );
		} else {
			const ranges = selection.getRanges();

			// For all ranges, check nodes in them until you find a node that is allowed to have `attributeKey` attribute.
			for ( let range of ranges ) {
				const walker = new TreeWalker( { boundaries: range, mergeCharacters: true } );
				let last = walker.position;
				let step = walker.next();

				// Walk the range.
				while ( !step.done ) {
					// If returned item does not have name property, it is a treeModel.TextFragment.
					const name = step.value.item.name || '$text';

					if ( schema.checkAtPosition( last, name, this.attributeKey ) ) {
						// If we found a node that is allowed to have the attribute, return true.
						return true;
					}

					last = walker.position;
					step = walker.next();
				}
			}
		}

		// If we haven't found such node, return false.
		return false;
	}

	/**
	 * Executes the command: adds or removes attributes to nodes or selection.
	 *
	 * If the command is active (`value == true`), it will remove attributes. Otherwise, it will set attributes.
	 *
	 * The execution result differs, depending on the {@link engine.treeModel.Document#selection}:
	 * * if selection is on a range, the command applies the attribute on all nodes in that ranges
	 * (if they are allowed to have this attribute by the{@link engine.treeModel.Schema schema}),
	 * * if selection is collapsed in non-empty node, the command applies attribute to the {@link engine.treeModel.Document#selection}
	 * itself (note that typed characters copy attributes from selection),
	 * * if selection is collapsed in empty node, the command applies attribute to the parent node of selection (note
	 * that selection inherits all attributes from a node if it is in empty node).
	 *
	 * If the command is disabled (`isEnabled == false`) when it is executed, nothing will happen.
	 *
	 * @private
	 * @param {Boolean} [forceValue] If set it will force command behavior. If `true`, command will apply attribute,
	 * otherwise command will remove attribute. If not set, command will look for it's current value to decide what it should do.
	 */
	_doExecute( forceValue ) {
		const document = this.editor.document;
		const selection = document.selection;
		const value = ( forceValue === undefined ) ? !this.value : forceValue;

		if ( selection.isCollapsed ) {
			if ( value ) {
				selection.setAttribute( this.attributeKey, true );
			} else {
				selection.removeAttribute( this.attributeKey );
			}
		} else {
			// If selection has non-collapsed ranges, we change attribute on nodes inside those ranges.
			document.enqueueChanges( () => {
				const ranges = this._getSchemaValidRanges( selection.getRanges() );

				// Keep it as one undo step.
				const batch = document.batch();

				for ( let range of ranges ) {
					if ( value ) {
						batch.setAttr( this.attributeKey, value, range );
					} else {
						batch.removeAttr( this.attributeKey, range );
					}
				}
			} );
		}
	}

	/**
	 * Walks through given array of ranges and removes parts of them that are not allowed by schema to have the
	 * attribute set. This is done by breaking a range in two and omitting the not allowed part.
	 *
	 * @private
	 * @param {Array.<engine.treeModel.Range>} ranges Ranges to be validated.
	 * @returns {Array.<engine.treeModel.Range>} Ranges without invalid parts.
	 */
	_getSchemaValidRanges( ranges ) {
		const validRanges = [];

		for ( let range of ranges ) {
			const walker = new TreeWalker( { boundaries: range, mergeCharacters: true } );
			let step = walker.next();

			let last = range.start;
			let from = range.start;
			let to = range.end;

			while ( !step.done ) {
				const name = step.value.item.name || '$text';

				if ( !this.editor.document.schema.checkAtPosition( last, name, this.attributeKey ) ) {
					if ( !from.isEqual( last ) ) {
						validRanges.push( new Range( from, last ) );
					}

					from = walker.position;
				}

				last = walker.position;
				step = walker.next();
			}

			if ( from && !from.isEqual( to ) ) {
				validRanges.push( new Range( from, to ) );
			}
		}

		return validRanges;
	}
}
