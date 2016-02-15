'use strict';

var fs = require('fs');
var gulp = require('gulp');
    gutil = require('gulp-util');
    gulpif = require('gulp-if');
    coffee = require('gulp-coffee');
    concat = require('gulp-concat');
    uglify = require('gulp-uglify');
    sass = require('gulp-sass');
    flatten = require('gulp-flatten');
    file = require('gulp-file');
    versions = require('./version.json');
    git = require('gulp-git');
var wait = require('gulp-wait')
var imagemin = require('gulp-imagemin');
    flatten = require('gulp-flatten');
var bump = require('gulp-bump');
var filter = require('gulp-filter');
var tag_version = require('gulp-tag-version');
var templateCache = require('gulp-angular-templatecache');
var through = require('through2');
var path = require('path');

function updateDependencies(version) {
  var content, json;
  return through.obj(function(file, enc, cb) {
    if (file.isNull()) {
      return cb(null, file);
    }
    if (file.isStream()) {
      return cb(new gutil.PluginError('updateDependencies', 'Streaming not supported'));
    }

    json = file.contents.toString();
    try {
      content = JSON.parse(json);
    } catch (e) {
      return cb(new gutil.PluginError('updateDependencies', 'Problem parsing JSON file', {fileName: file.path, showStack: true}));
    }
    if (content.dependencies["bookingbug-angular-core"]) {
      content.dependencies["bookingbug-angular-core"] = version
    }
    if (content.dependencies["bookingbug-angular-admin"]) {
      content.dependencies["bookingbug-angular-admin"] = version
    }
    file.contents = new Buffer(JSON.stringify(content, null, space(json)) + possibleNewline(json));
    cb(null, file);
  });
};

// Preserver new line at the end of a file
function possibleNewline(json) {
  var lastChar = (json.slice(-1) === '\n') ? '\n' : '';
  return lastChar;
}

// Figured out which "space" params to be used for JSON.stringfiy.
function space(json) {
  var match = json.match(/^(?:(\t+)|( +))"/m);
  return match ? (match[1] ? '\t' : match[2].length) : '';
}

process.env.srcpath = process.env.srcpath || 'bookingbug-angular/src'
process.env.releasepath = process.env.releasepath || './release'

module.exports = {
  javascripts: function(module) {
    return gulp.src([
      process.env.srcpath+'/'+module+'/javascripts/main.js.coffee',
      process.env.srcpath+'/'+module+'/javascripts/**/*',
      '!'+process.env.srcpath+'/'+module+'/javascripts/**/*~',
      '!'+process.env.srcpath+'/**/*_test.js.coffee'])
      .pipe(gulpif(/.*coffee$/, coffee().on('error', gutil.log)))
      .pipe(concat('bookingbug-angular-'+module+'.js'))
      .pipe(gulp.dest(process.env.releasepath+'/'+module))
      .pipe(uglify({mangle: false})).on('error', gutil.log)
      .pipe(rename({extname: '.min.js'}))
      .pipe(gulp.dest(process.env.releasepath+'/'+module));
  },
  stylesheets: function(module) {
    return gulp.src(process.env.srcpath+'/'+module+'/stylesheets/main.scss')
      .pipe(sass({errLogToConsole: true}))
      .pipe(flatten())
      .pipe(concat('bookingbug-angular-'+module+'.css'))
      .pipe(gulp.dest(process.env.releasepath+'/'+module));
  },
  images: function(module) {
    return gulp.src(process.env.srcpath+'/'+module+'/images/*')
      .pipe(imagemin())
      .pipe(flatten())
      .pipe(gulp.dest(process.env.releasepath+'/'+module));
  },
  fonts: function(module) {
    return gulp.src(process.env.srcpath+'/'+module+'/fonts/*')
      .pipe(flatten())
      .pipe(gulp.dest(process.env.releasepath+'/'+module));
  },
  templates: function(module) {
    return gulp.src(process.env.srcpath+'/'+module+'/templates/**/*.html')
      .pipe(flatten())
      .pipe(templateCache({module: 'BB'}))
      .pipe(concat('bookingbug-angular-'+module+'-templates.js'))
      .pipe(gulp.dest(process.env.releasepath+'/'+module));
  },
  bump: function(module) {
    var version = versions.current;
    return gulp.src('release/'+module+'/bower.json')
      .pipe(bump({version: version}))
      .pipe(updateDependencies(version))
      .pipe(gulp.dest(process.env.releasepath+'/'+module));
  },
  git: function(module) {
    var cwd = path.resolve(process.env.releasepath+'/'+module);
    var version = versions.current;
    return gulp.src(['./*','!./bower_components'], {cwd: cwd})
      .pipe(rename({
        base: ""
      }))
      .pipe(git.add())
      .pipe(git.commit('Update to version: ' + version, {args: '--allow-empty', cwd: cwd}))
      .pipe(filter('bower.json'))
      .pipe(tag_version({cwd: cwd}))
      .pipe(wait(1000))
      .on('end', function() {
        git.push('origin', 'master', {args: '--tags', cwd: cwd});
      });
  }
}
