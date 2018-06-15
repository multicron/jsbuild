var gulp = require('gulp');
var babel = require('gulp-babel');
var jshint = require('gulp-jshint');
var nodemon = require('gulp-nodemon');
var uglify = require('gulp-uglify');
var util = require('gulp-util');
var mocha = require('gulp-mocha');
var todo = require('gulp-todo');
var webpack = require('webpack-stream');
var fs = require('fs');
var obfuscator = require('gulp-javascript-obfuscator');
var debug = require('gulp-debug');
var pump = require('pump');
var path = require('path');

gulp.task('build', ['build-client', 'move-client', 'build-server', 'test']);

gulp.task('test', ['lint'], function () {
    gulp.src(['test/**/*.js'])
        .pipe(mocha());
});

gulp.task('lint', function () {
  return gulp.src(['src/**/*.js'])
    .pipe(jshint({
        esnext: true,
	jquery: true,
	globals: {
	    "require" : false
	}
      }))
    .pipe(jshint.reporter('default', { verbose: true}))
    .pipe(jshint.reporter('fail'));
});

gulp.task('babel', ['lint'], function (cb) {
    pump([gulp.src(['src/**/*.js']),
	  babel({
	      babelrc: false,
	      compact: false,
	      presets: [
	  	  ['es2015']
	      ],
	  }),
	  debug({title:'babel'}),
	  gulp.dest('babel'),
	  ],cb);
});

gulp.task('build-client', ['lint','babel'], function (cb) {
    pump([gulp.src(['babel/client/js/app.js']),
	  webpack({
	      output: {
	  	  filename: "app.js"
	      },
	      resolve: {
		  modules: [
		      path.resolve('./babel/lib'),
		      path.resolve('./node_modules')
		  ]
	      }
	  }),
	  // obfuscator({
	  //     compact: true,
	  //     controlFlowFlattening: false,
	  //     deadCodeInjection: false,
	  //     debugProtection: false,
	  //     debugProtectionInterval: false,
	  //     disableConsoleOutput: true,
	  //     identifierNamesGenerator: 'hexadecimal',
	  //     log: false,
	  //     renameGlobals: false,
	  //     rotateStringArray: true,
	  //     selfDefending: true,
	  //     stringArray: true,
	  //     stringArrayEncoding: true,
	  //     stringArrayThreshold: 1.00,
	  //     unicodeEscapeSequence: false,
	  // }),
	  debug({title:'build-client'}),
	  gulp.dest('bin/client/js/'),
	  ],cb);
});

gulp.task('build-server', ['lint'], function (cb) {
    pump([
	gulp.src(['src/server/**/*.js']),
	// babel({
	//     babelrc: false,
	//     compact: false,
	//     presets: [
	// 	['es2015']
	//     ],
	// }),
	debug({title:'build-server'}),
	gulp.dest('bin/server/'),
    ],cb);
});

gulp.task('move-client', function (cb) {
    pump([gulp.src(['src/client/**/*.!(js)']),
	  debug({title:'move-client'}),
	  gulp.dest('./bin/client/')
	 ],cb);
});


gulp.task('watch', ['build'], function () {
  gulp.watch(['src/client/**/*.*'], ['build-client', 'move-client']);
  gulp.watch(['src/server/*.*', 'src/server/**/*.js'], ['build-server']);
  gulp.start('run-only');
});

gulp.task('todo', ['lint'], function() {
  gulp.src('src/**/*.js')
      .pipe(todo())
      .pipe(gulp.dest('./'));
});

gulp.task('run', ['build'], function () {
    process.env.NODE_PATH = "/home/olson/agar.io-clone/src/lib";
    process.env.DEBUG = "express*";
    process.env.DEBUG = "*,-socket*,-engine*,-splines:socket";
    nodemon({
        delay: 10,
        script: './server/server.js',
        cwd: "./bin/",
        args: ["config.json"],
        ext: 'html js css'
    })
    .on('restart', function () {
        util.log('server restarted!');
    });
});

gulp.task('run-only', function () {
    nodemon({
        delay: 10,
        script: './server/server.js',
        cwd: "./bin/",
        args: ["config.json"],
        ext: 'html js css'
    })
    .on('restart', function () {
        util.log('server restarted!');
    });
});

gulp.task('default', ['run']);
