/**
 * @license Copyright (c) 2003-2015, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/* global describe, it, beforeEach, afterEach */

'use strict';

const chai = require( 'chai' );
const expect = chai.expect;
const sinon = require( 'sinon' );
const gulp = require( 'gulp' );
const gutil = require( 'gulp-util' );
const path = require( 'path' );
const stream = require( 'stream' );
const Vinyl = require( 'vinyl' );
const through = require( 'through2' );

describe( 'build-utils', () => {
	const utils = require( '../../tasks/build/utils' );
	let sandbox;

	beforeEach( () => {
		sandbox = sinon.sandbox.create();
	} );

	afterEach( () => {
		sandbox.restore();
	} );

	describe( 'noop', () => {
		it( 'should return PassTrough stream', () => {
			const PassThrough = stream.PassThrough;
			const ret = utils.noop();
			expect( ret instanceof PassThrough ).to.equal( true );
		} );

		it( 'should return a duplex stream when given a callback and call that callback', () => {
			const spy = sinon.spy();
			const ret = utils.noop( spy );

			ret.write( 'foo' );

			expect( spy.called ).to.equal( true );
			expect( ret.writable ).to.equal( true );
			expect( ret.readable ).to.equal( true );
		} );
	} );

	describe( 'dist', () => {
		it( 'should return stream created with gulp.dest', () => {
			const distDir = 'dist/';
			const format = 'amd';
			const destSpy = sandbox.spy( gulp, 'dest' );
			const stream = utils.dist( distDir, format );

			sinon.assert.calledOnce( destSpy );
			sinon.assert.calledWithExactly( destSpy, path.join( distDir, format ) );
			expect( stream ).to.equal( destSpy.firstCall.returnValue );
		} );
	} );

	describe( 'transpile', () => {
		it( 'should return babel transform stream', ( done ) => {
			const Stream = stream.Stream;
			const modulePath = '../files/utils/lib';
			const appendModuleExtensionSpy = sandbox.spy( utils, 'appendModuleExtension' );

			const babelStream = utils.transpile( 'amd', utils.getBabelOptionsForTests( 'amd' ) );

			expect( babelStream instanceof Stream ).to.equal( true );
			expect( babelStream.readable ).to.equal( true );
			expect( babelStream.writable ).to.equal( true );

			babelStream.on( 'finish', () => {
				sinon.assert.calledOnce( appendModuleExtensionSpy );
				expect( appendModuleExtensionSpy.args[ 0 ][ 0 ] ).to.equal( modulePath );

				done();
			} );

			babelStream.pipe(
				utils.noop( ( file ) => {
					expect( file.contents.toString() ).to.match( /define\(\'tests\'/ );
				} )
			);

			babelStream.write( new Vinyl( {
				cwd: '/',
				base: '/test/',
				path: '/test/file.js',
				contents: new Buffer( `import * as lib from '${ modulePath }';` )
			} ) );

			babelStream.end();
		} );

		it( 'should report error when transpiling fails', ( done ) => {
			const babelStream = utils.transpile( 'amd' );
			const utilLogStub = sandbox.stub( gutil, 'log' );
			const consoleLogStub = sandbox.stub( console, 'log' );

			babelStream.once( 'finish', () => {
				sinon.assert.calledTwice( utilLogStub );
				sinon.assert.calledOnce( consoleLogStub );
				done();
			} );

			babelStream.write( new Vinyl( {
				cwd: '/',
				base: '/test/',
				path: '/test/file.js',
				contents: new Buffer( 'class ;' )
			} ) );

			babelStream.end();
		} );
	} );

	describe( 'getBabelOptionsForSource', () => {
		it( 'should return plugins for amd format', () => {
			const plugins = [ 'foo' ];
			sandbox.stub( utils, 'getBabelPlugins', () => plugins );

			const options = utils.getBabelOptionsForSource( 'amd' );

			expect( options ).to.have.property( 'plugins', plugins );
			expect( options ).to.have.property( 'resolveModuleSource' );
			expect( options.resolveModuleSource ).to.equal( utils.appendModuleExtension );
		} );

		it( 'should return plugins for cjs format', () => {
			const plugins = [ 'foo' ];
			sandbox.stub( utils, 'getBabelPlugins', () => plugins );

			const options = utils.getBabelOptionsForSource( 'cjs' );

			expect( options ).to.have.property( 'plugins', plugins );
			expect( options ).to.have.property( 'resolveModuleSource' );
			expect( options.resolveModuleSource ).to.equal( utils.resolveModuleSource );
		} );
	} );

	describe( 'getBabelOptionsForTests', () => {
		it( 'should return plugins for amd format', () => {
			const plugins = [ 'foo' ];
			sandbox.stub( utils, 'getBabelPlugins', () => plugins );

			const options = utils.getBabelOptionsForTests( 'amd' );

			expect( options ).to.have.property( 'plugins', plugins );
			expect( options ).to.have.property( 'resolveModuleSource' );
			expect( options ).to.have.property( 'moduleIds', true );
			expect( options ).to.have.property( 'moduleId', 'tests' );
			expect( options.resolveModuleSource ).to.equal( utils.appendModuleExtension );
		} );

		it( 'should return plugins for cjs format', () => {
			const plugins = [ 'foo' ];
			sandbox.stub( utils, 'getBabelPlugins', () => plugins );

			const options = utils.getBabelOptionsForTests( 'cjs' );

			expect( options ).to.have.property( 'plugins', plugins );
			expect( options ).to.have.property( 'resolveModuleSource' );
			expect( options ).to.have.property( 'moduleIds', true );
			expect( options ).to.have.property( 'moduleId', 'tests' );
			expect( options.resolveModuleSource ).to.equal( utils.resolveModuleSource );
		} );
	} );

	describe( 'getBabelPlugins', () => {
		it( 'should return plugins for amd format', () => {
			expect( utils.getBabelPlugins( 'amd' ) ).to.be.an( 'array' );
		} );

		it( 'should return plugins for cjs format', () => {
			expect( utils.getBabelPlugins( 'cjs' ) ).to.be.an( 'array' );
		} );

		it( 'should throw an exception when incorrect format is provided', () => {
			const format = 'incorrect-format';

			expect( () => {
				utils.getBabelPlugins( format );
			} ).to.throw( Error, `Incorrect format: ${ format }` );
		} );
	} );

	describe( 'getBabelPlugins', () => {
		it( 'should return plugins for amd format', () => {
			expect( utils.getBabelPlugins( 'amd' ) ).to.be.an( 'array' );
		} );

		it( 'should throw an exception when incorrect format is provided', () => {
			const format = 'incorrect-format';

			expect( () => {
				utils.getBabelPlugins( format );
			} ).to.throw( Error, `Incorrect format: ${ format }` );
		} );
	} );

	describe( 'getConversionStreamGenerator', () => {
		beforeEach( () => {
			sandbox.stub( utils, 'getBabelOptionsForSource', () => 'src' );
			sandbox.stub( utils, 'getBabelOptionsForTests', () => 'tests' );

			// Stub to avoid writing to the fs.
			sandbox.stub( utils, 'dist', () => utils.noop() );

			// The transpile converted with append to file contents what was
			// passed to it as an options object and that's a result of getBabelOptions*,
			// which is stubbed above (will return 'src' or 'tests').
			sandbox.stub( utils, 'transpile', ( format, options ) => {
				return through( { objectMode: true }, ( file, encoding, callback ) => {
					file.contents = new Buffer( file.contents.toString() + ';' + format + ';' + options );

					callback( null, file );
				} );
			} );

			sandbox.stub( utils, 'appendBenderLauncher', () => {
				return through( { objectMode: true }, ( file, encoding, callback ) => {
					file.contents = new Buffer( file.contents.toString() + ';launcher' );

					callback( null, file );
				} );
			} );
		} );

		it( 'should return function that can be used for creating conversion streams', () => {
			const distDir = 'dist/';
			const formats = [ 'amd', 'cjs', 'esnext' ];
			const fn = utils.getConversionStreamGenerator( distDir );
			const streams = formats.reduce( fn, [] );

			expect( streams.length ).to.equal( formats.length );
		} );

		describe( 'created conversion stream', () => {
			it( 'should process source JS file', ( done ) => {
				const distDir = 'dist/';
				const formats = [ 'amd' ];
				const fn = utils.getConversionStreamGenerator( distDir );
				const streams = formats.reduce( fn, [] );

				expect( streams ).to.have.length( 1 );

				const stream = streams[ 0 ];

				stream.pipe(
					utils.noop( ( file ) => {
						expect( file.contents.toString() ).to.equal( 'foo();amd;src' );
						done();
					} )
				);

				stream.write( new Vinyl( {
					cwd: './',
					path: 'ckeditor5/core/file.js',
					contents: new Buffer( 'foo()' )
				} ) );
			} );
		} );

		describe( 'created conversion stream', () => {
			it( 'should process test file in amd format', ( done ) => {
				const distDir = 'dist/';
				const formats = [ 'amd' ];
				const fn = utils.getConversionStreamGenerator( distDir );
				const streams = formats.reduce( fn, [] );

				expect( streams ).to.have.length( 1 );

				const stream = streams[ 0 ];

				stream.pipe(
					utils.noop( ( file ) => {
						expect( file.contents.toString() ).to.equal( 'foo();amd;tests;launcher' );
						done();
					} )
				);

				stream.write( new Vinyl( {
					cwd: './',
					path: 'tests/core/file.js',
					contents: new Buffer( 'foo()' )
				} ) );
			} );
			it( 'should process test file in cjs format', ( done ) => {
				const distDir = 'dist/';
				const formats = [ 'cjs' ];
				const fn = utils.getConversionStreamGenerator( distDir );
				const streams = formats.reduce( fn, [] );

				expect( streams ).to.have.length( 1 );

				const stream = streams[ 0 ];

				stream.pipe(
					utils.noop( ( file ) => {
						expect( file.contents.toString() ).to.equal( 'foo();cjs;tests' );
						done();
					} )
				);

				stream.write( new Vinyl( {
					cwd: './',
					path: 'tests/core/file.js',
					contents: new Buffer( 'foo()' )
				} ) );
			} );
		} );
	} );

	describe( 'pickVersionedFile', () => {
		it( 'should rename file for provided format', ( done ) => {
			const rename = utils.pickVersionedFile( 'amd' );

			rename.pipe(
				utils.noop( ( data ) => {
					expect( data.basename ).to.equal( 'load.js' );
					done();
				} )
			);

			rename.write( new Vinyl( {
				cwd: '/',
				base: '/test/',
				path: '/test/load__amd.js',
				contents: new Buffer( '' )
			} ) );

			rename.end();
		} );

		it( 'should remove files in other formats', ( done ) => {
			const rename = utils.pickVersionedFile( 'amd' );
			const spy = sandbox.spy( ( data ) => {
				expect( data.basename ).to.equal( 'load.js' );
			} );

			rename.pipe(
				utils.noop( spy )
			);

			rename.on( 'end', () => {
				sinon.assert.calledOnce( spy );
				done();
			} );

			const amd = new Vinyl( {
				cwd: '/',
				base: '/test/',
				path: '/test/load__amd.js',
				contents: new Buffer( '' )
			} );

			const cjs = new Vinyl( {
				cwd: '/',
				base: '/test/',
				path: '/test/load__cjs.js',
				contents: new Buffer( '' )
			} );

			const esnext = new Vinyl( {
				cwd: '/',
				base: '/test/',
				path: '/test/load__esnext.js',
				contents: new Buffer( '' )
			} );

			rename.write( cjs );
			rename.write( amd );
			rename.write( esnext );
			rename.end();
		} );
	} );

	describe( 'renamePackageFiles', () => {
		it( 'should move source files to correct directories', ( done ) => {
			const rename = utils.renamePackageFiles();

			rename.pipe(
				utils.noop( ( data ) => {
					expect( data.path ).to.equal( path.normalize( 'ckeditor5/core/foo/file.js' ) );
					done();
				} )
			);

			rename.write( new Vinyl( {
				cwd: './',
				path: path.normalize( 'ckeditor5-core/src/foo/file.js' ),
				contents: new Buffer( '' )
			} ) );

			rename.end();
		} );

		it( 'should move test files to correct directories', ( done ) => {
			const rename = utils.renamePackageFiles();

			rename.pipe(
				utils.noop( ( data ) => {
					expect( data.path ).to.equal( path.normalize( 'tests/core/foo/file.js' ) );
					done();
				} )
			);

			rename.write( new Vinyl( {
				cwd: './',
				path: path.normalize( 'ckeditor5-core/tests/foo/file.js' ),
				contents: new Buffer( '' )
			} ) );

			rename.end();
		} );

		it( 'should throw error when wrong path provided 1', () => {
			const rename = utils.renamePackageFiles();

			expect( () => {
				rename.write( new Vinyl( {
					cwd: './',
					path: 'plugin/src/file.js',
					contents: new Buffer( '' )
				} ) );
			} ).to.throw( Error );
		} );

		it( 'should throw error when wrong path provided 2', () => {
			const rename = utils.renamePackageFiles();

			expect( () => {
				rename.write( new Vinyl( {
					cwd: './',
					path: 'ckeditor5-core/file.js',
					contents: new Buffer( '' )
				} ) );
			} ).to.throw( Error );
		} );
	} );

	describe( 'renameCKEditor5Files', () => {
		it( 'should move source files to correct directories', ( done ) => {
			const rename = utils.renameCKEditor5Files();

			rename.pipe(
				utils.noop( ( data ) => {
					expect( data.path ).to.equal( path.normalize( 'ckeditor5/foo/file.js' ) );
					done();
				} )
			);

			rename.write( new Vinyl( {
				cwd: './',
				path: path.normalize( 'src/foo/file.js' ),
				contents: new Buffer( '' )
			} ) );

			rename.end();
		} );

		it( 'should move test files to correct directories', ( done ) => {
			const rename = utils.renameCKEditor5Files();

			rename.pipe(
				utils.noop( ( data ) => {
					expect( data.path ).to.equal( path.normalize( 'tests/foo/file.js' ) );
					done();
				} )
			);

			rename.write( new Vinyl( {
				cwd: './',
				path: path.normalize( 'tests/foo/file.js' ),
				contents: new Buffer( '' )
			} ) );

			rename.end();
		} );

		it( 'should throw error when wrong path provided 1', () => {
			const rename = utils.renameCKEditor5Files();

			expect( () => {
				rename.write( new Vinyl( {
					cwd: './',
					path: 'plugin/src/file.js',
					contents: new Buffer( '' )
				} ) );
			} ).to.throw( Error );
		} );
	} );

	describe( 'appendModuleExtension', () => {
		it( 'appends module extension when path provided', () => {
			const filePath = './path/to/file';
			const source = utils.appendModuleExtension( filePath );

			expect( source ).to.equal( filePath + '.js' );
		} );

		it( 'appends module extension when URL is provided', () => {
			const url = 'http://example.com/lib';
			const source = utils.appendModuleExtension( url );

			expect( source ).to.equal( url + '.js' );
		} );

		it( 'returns unchanged if module is provided', () => {
			const module = 'lib/module';
			const source = utils.appendModuleExtension( module );

			expect( source ).to.equal( module );
		} );
	} );

	describe( 'appendBenderLauncher', () => {
		it( 'appends the launcher code to a file', ( done ) => {
			const stream = utils.appendBenderLauncher();

			stream.pipe(
				utils.noop( ( data ) => {
					expect( data.contents.toString() ).equal( 'foo();' + utils.benderLauncherCode );
					done();
				} )
			);

			stream.write( new Vinyl( {
				cwd: './',
				path: 'tests/file.js',
				contents: new Buffer( 'foo();' )
			} ) );

			stream.end();
		} );

		// #62
		it( 'does nothing to a null file', ( done ) => {
			const stream = utils.appendBenderLauncher();

			stream.pipe(
				utils.noop( ( data ) => {
					expect( data.contents ).to.equal( null );
					done();
				} )
			);

			stream.write( new Vinyl( {
				cwd: './',
				path: 'tests/file.js',
				contents: null
			} ) );

			stream.end();
		} );
	} );

	describe( 'isTestFile', () => {
		function test( path, expected ) {
			it( `returns ${ expected} for ${ path }`, () => {
				const file = new Vinyl( {
					cwd: './',
					path: path,
					contents: new Buffer( '' )
				} );

				expect( utils.isTestFile( file ) ).to.equal( expected );
			} );
		}

		test( 'tests/file.js', true );
		test( 'tests/foo/file.js', true );
		test( 'tests/tests.js', true );

		test( 'foo/file.js', false );
		test( 'foo/tests/file.js', false );
		test( 'tests/_foo/file.js', false );
	} );

	describe( 'resolveModuleSource', () => {
		it( 'does not modify relative source paths', () => {
			const source = '../module';
			const resolved = utils.resolveModuleSource( source, '' );
			expect( resolved ).to.equal( source );
		} );

		it( 'resolves absolute source paths', () => {
			const source = '/ckeditor5/path/to/module.js';
			const file = path.join( process.cwd(), 'tests', 'module', 'module.js' );

			const resolved = utils.resolveModuleSource( source, file );
			expect( resolved ).to.equal( '../../ckeditor5/path/to/module.js' );
		} );
	} );
} );
