var gulp = require('gulp');
    coffee = require('gulp-coffee');
    concat = require('gulp-concat');
    gulpif = require('gulp-if');
    filelog = require('gulp-filelog');
    gutil = require('gulp-util');
    del = require('del');
    connect = require('gulp-connect');
    templateCache = require('gulp-angular-templatecache');
    imagemin = require('gulp-imagemin');
    rename = require('gulp-rename');
    flatten = require('gulp-flatten');
    promptly = require('promptly');
    argv = require('yargs').argv;
    awspublish = require('gulp-awspublish');
    replace = require('gulp-replace');
    awspublishRouter = require('gulp-awspublish-router');
    template = require('gulp-template');
    streamqueue = require('streamqueue');
    sass = require('gulp-sass');
    wait = require('gulp-wait');
    mainBowerFiles = require('main-bower-files');
    uglify = require('gulp-uglify');
    tap = require('gulp-tap');
    open = require('gulp-open');
    intercept = require('gulp-intercept');
var bower = require('gulp-bower');
    bowerLink = require('gulp-bower-link');
    path = require('path')

require('../gulpfile.js');

var config;
if(argv.env && argv.env.match(/dev/)){
  // development
  config = './development_config.json';
}else if(argv.env && argv.env.match(/prod/)){
  // production
  config = './config.json';
}else{
  // staging
  config = './staging_config.json';
}

process.env.srcpath = path.resolve('../bookingbug-angular/src')
process.env.releasepath = path.resolve('../release')

gulp.task('clean', function(cb) {
  del.sync([]);
  cb()
});

gulp.task('clean-js', function(cb) {
  del.sync(['release/*.js']);
  cb()
});

gulp.task('clean-css', function(cb) {
  del.sync(['release/*.css']);
  cb()
});

gulp.task('clean-html', function(cb) {
  del.sync(['release/*.html']);
  cb()
});

gulp.task('clean-images', function(cb) {
  del.sync(['release/images']);
  cb()
});

gulp.task('clean-fonts', function(cb) {
  del.sync(['release/fonts']);
  cb()
});


gulp.task('www', ['clean-html'], function() {
  return gulp.src(['www/*', 'src/www/*'])
      .pipe(template(require(config)))
      .pipe(gulp.dest('release'));
});

gulp.task('all-javascripts', ['bower-js', 'templates', 'javascripts'], function(cb) {
  // wait a second - since sometimes the bower file hasn't finisehd writing!
  setTimeout(function(){
    gulp.src('tmpjs/**')
      .pipe(concat('booking-widget.js'))
      .pipe(gulp.dest('release'))
    cb();
  },1000);
});

gulp.task('join-js', ['clean-js'], function(cb) {
  gulp.src('tmpjs/*')
    .pipe(concat('booking-widget.js'))
    .pipe(gulp.dest('release'));
  cb();
});

gulp.task('javascripts', [], function(cb) {
  gulp.src('src/javascripts/**/*')
    .pipe(gulpif(/.*coffee$/, coffee().on('error', function(e) {
      gutil.log(e)
      this.emit('end')
    })))
    .pipe(gulpif(argv.env != 'development' && argv.env != 'dev',
            uglify({mangle: false}))).on('error', gutil.log)
    .pipe(concat('booking-js.js'))
    .pipe(gulp.dest('tmpjs'))
  cb()
});


gulp.task('bower-js', ['bb-assets', 'bower'], function(cb) {
  src = mainBowerFiles({filter: new RegExp('.js$')})
  gulp.src(src)
    .pipe(gulpif(/.*coffee$/, coffee().on('error', function(e) {
      gutil.log(e)
      this.emit('end')
    })))
    .pipe(gulpif(argv.env != 'development' && argv.env != 'dev',
            uglify({mangle: false}))).on('error', gutil.log)
    .pipe(concat('a-booking-bower.js'))
    .pipe(gulp.dest('tmpjs'))
  gutil.log("done with bower")
  cb()
});


gulp.task('templates', [], function(cb) {
  adminTemplates = gulp.src('./src/templates/*.html')
    .pipe(templateCache('x_templates.js', {module: 'BB'}))
    .pipe(flatten())
    .pipe(template(require(config)))
    .pipe(gulp.dest('tmpjs'));
  cb()
});

gulp.task('images', function() {
  gulp.src('src/images/*')
    // .pipe(imagemin())
    .pipe(flatten())
    .pipe(gulp.dest('release/images'));
});

function filterStylesheets(path) {
  if (path.match(new RegExp('.css$')) &&
     !path.match(new RegExp('bookingbug-angular-public-booking.css$'))){
    return true;
  } else {
    return false;
  }
}

gulp.task('stylesheets', ['clean', 'bower'], function() {
  src = mainBowerFiles({filter: filterStylesheets})
  src.push('src/stylesheets/main.scss')
  return gulp.src(src)
    .pipe(gulpif(/.*scss$/, sass({errLogToConsole: true})))
    .pipe(template(require(config)))
    .pipe(flatten())
    .pipe(concat('booking-widget.css'))
    .pipe(gulp.dest('release'));
});

gulp.task('fonts', function() {
  return gulp.src(mainBowerFiles('**/*.{eot,svg,ttf,woff,woff2,otf}').concat('src/fonts/*'))
    .pipe(flatten())
    .pipe(gulp.dest('release/fonts'));
});

// =========================================================================
// Update bookingbug-angular-* dependency versions in bower.json - START
// 20-11-2015 14:08 GMT
// =========================================================================
// Ex 1. gulp update-bower-json
// Ex 2. gulp update-bower-json --sdk-version <version>
// =========================================================================
var versions = require('../version.json');
var sdk_version = "";
gulp.task('get-sdk-version', [], function(cb){
  if(argv["sdk-version"] && argv["sdk-version"] != ""){
    sdk_version = '"' + argv["sdk-version"] + '"';
  }else if(versions.current){
    sdk_version = '"' + versions.current + '"';
  };
  return cb();
});
var update_bower_json = false;
// Note: gulpif requires a function call to return truthy, and will not work with a var
function updateBowerJson(){
  return update_bower_json;
};
gulp.task('update-bower-json', ['get-sdk-version'], function(){
  if(sdk_version == ""){
    return false;
  };
  // Log SDK version to console?
  gutil.log(gutil.colors.bgMagenta(" SDK Version: ") + " " + gutil.colors.bgMagenta(" " + sdk_version + " "));
  // Open the local bower.json
  return gulp.src('./bower.json')
  // Read contents of bower.json into a file
  .pipe(intercept(function(f){
    // Convert file contents of bower.json to String so we can apply String methods for pattern matching and replace
    var bower_json_file = f.contents.toString();
    // Strip out bookingbug dependency JSON objects
    var submodule_pattern = /"bookingbug-angular-[^}\n\r,]+/g // Do NOT include newline, carriage return or } or , in the match!
    var version_pattern =  /:\s{0,1}"[^}\n\r,]+/ // Do NOT include newline, carriage return or } or , in the match!
    // Store matches to Array
    var matches = bower_json_file.match(submodule_pattern);
    var replacements = {};
    for(var i in matches){
      // Replace version in matches with current SDK version ONLY IF they are different
      if(matches[i].indexOf(sdk_version) == -1){
        replacements[i] = matches[i].replace(version_pattern, ": " + sdk_version);
      };
    };
    for(var i in replacements){
       // Build new bower.json file...
      bower_json_file = bower_json_file.replace(matches[i], replacements[i]);
      // Log changes to console?
      gutil.log(gutil.colors.bgYellow.black(" " + path.basename(f.path) + " updating >>> ") + " " + matches[i] + " to " + replacements[i]);
    };
    // Do NOT update bower.json if all bookingbug-angular-* versions match current SDK version or --sdk-version
    if(Object.keys(replacements).length > 0){
      update_bower_json = true;
    };
    // Set the file contents to Convert the bower_json_file String to binary using Buffer
    // and overwrite the file contents obtained from bower.json with the new data
    if(update_bower_json){
      f.contents = new Buffer(bower_json_file);
    }else{
      // bower.json will NOT be updated
      gutil.log(gutil.colors.bgYellow.black(" " + path.basename(f.path) + " >>> ") + " is already up-to-date with SDK version " + sdk_version);
    };
    return f;
  }))
  // Read the updated file contents into bower.json, then overwrite the current bower.json
  .pipe(gulpif(updateBowerJson, concat('bower.json')))
  .pipe(gulpif(updateBowerJson, gulp.dest('./')));
});
// =========================================================================
// Update bookingbug-angular-* dependency versions in bower.json - END
// =========================================================================

// ===================================
// Auto-Reload Browser - START
// ===================================
var html_files_in_www_folder = [];
var last_html_file_in_www_folder = null;
gulp.task('html-files-in-www-folder', [], function(cb){
  gulp.src('src/www/*')
  .pipe(tap(function(file, t){
    // Build an array of all .html files in the "release" folder
    // This allows us to later watch for changes to the LAST file in the "release" folder
    // instead of hard-coding the watch to reference the last file at time of adding
    // this function, which happens to be "view_booking_admin.html"
    html_files_in_www_folder.push(path.basename(file.path))
  }));
  cb();
});

var task_started = 0;
var task_completed = 0;
var max_task_time = 0;
var gulp_started = false;

gulp.task('reloadCSS', [], function(){
  gulp.src('release/booking-widget.css')
  .pipe(connect.reload());
});

gulp.task('reloadJS', [], function(){
  task_started = new Date().getTime();
  gulp.src('release/booking-widget.js')
  .pipe(connect.reload()).on('end', function(){
    if(!gulp_started){
      gulp_started = true;
      printNewFeatures();
    };
    task_completed = new Date().getTime();
    var task_time = task_completed - task_started;
    if(task_time > max_task_time * 10){
      max_task_time = task_time * 10;
    };
  });
 });

gulp.task('reloadHTML', [], function(){
  gulp.src('release/' + last_html_file_in_www_folder)
  .pipe(connect.reload());
});

function changeEventHandler(e){
  // Timeout is here so that the changed log prints after all tasks have completed =D
  setTimeout(function(){
    gutil.log(gutil.colors.bgYellow.black(e.type + ":") + " " + gutil.colors.bgMagenta.white(path.basename(e.path)) + " " + gutil.colors.gray('"' + e.path + '"'));
  }, max_task_time);
};
// ===================================
// Auto-reload Browser - END
// ===================================

gulp.task('watch', ['assets'], function() {
  last_html_file_in_www_folder = html_files_in_www_folder.pop();
  gulp.watch(['release/booking-widget.css'], ['reloadCSS']).on('error', errorHandler).on('change', function(e){
    changeEventHandler(e)
  })
  gulp.watch(['release/booking-widget.js'], ['reloadJS']).on('error', errorHandler)
  gulp.watch(['release/' + last_html_file_in_www_folder], ['reloadHTML']).on('error', errorHandler)
  gulp.watch(['./src/images/*'], ['images']).on('error', errorHandler).on('change', function(e){
    changeEventHandler(e)
  })
  gulp.watch(['./src/stylesheets/**'], ['stylesheets']).on('error', errorHandler).on('change', function(e){
    changeEventHandler(e)
  })
  gulp.watch(['./src/templates/**'], ['templates']).on('error', errorHandler).on('change', function(e){
    changeEventHandler(e)
  })
  gulp.watch(['./src/www/**'], ['www']).on('error', errorHandler).on('change', function(e){
    changeEventHandler(e)
  })
  gulp.watch(['./src/javascripts/**'], ['javascripts']).on('error', errorHandler).on('change', function(e){
    changeEventHandler(e)
  })
  gulp.watch(['./tmpjs/*'], ['join-js']).on('error', errorHandler).on('change', function(e){
    changeEventHandler(e)
  })
  gulp.watch([
    '!./**/*~',
    process.env.srcpath+'/**/*'
  ], ['bower-js']).on('error', errorHandler);
});


// Default URL and Port settings
var connect_server = {
  uri: "http://localhost",
  port: 8000
}

gulp.task('webserver', function() {
  connect.server({
    root: [
      'release',
      '../bookingbug-angular/release'
    ],
    port: connect_server.port,
    livereload: true
  });
});

function projectName() {
  return path.basename(__dirname);
}

gulp.task('publish', ['assets'], function() {
  var publisher = awspublish.create({
    key: process.env.AWS_ACCESS_KEY_ID,
    secret: process.env.AWS_SECRET_ACCESS_KEY,
    bucket: 'bespoke.bookingbug.com',
    region: 'eu-west-1'
  })
  var release = function(environment) {
    if (environment == 'production') {
      age = '300'
    } else {
      age = '10'
    }
    headers = {
      'Cache-Control': 'max-age=' + age
    }
    gulp.src('./release/**')
      .pipe(rename(function(path) {
        if (environment == 'production') {
          path.dirname = "/" + projectName() + "/" + path.dirname
        } else {
          path.dirname = "/" + projectName() + "/" + environment + '/' + path.dirname;
        }
      }))
      .pipe(awspublish.gzip({ext: ''}))
      .pipe(publisher.publish(headers, {force: true}))
      // .pipe(publisher.cache())
      .pipe(awspublish.reporter());
  }
  if (argv.production || argv.env == 'production') {
    var environment = 'production'
  } else {
    var environment = 'staging'
  }
  if (environment == 'production') {
    promptly.confirm('Are you sure you want to deploy production? ', function(err, value) {
      if (value) {
        return release(environment);
      } else {
        return;
      }
    });
  } else {
    return release(environment);
  }
});

gulp.task('assets', ['clean', 'all-javascripts', 'stylesheets', 'images', 'www', 'fonts'])

function isLink(module) {
  try {
    var stat = fs.lstatSync('bower_components/'+module);
    return stat && stat.isSymbolicLink();
  } catch(e) {
    return false
  }
}

function checkBower(name) {
  var dir = path.resolve('../release/' + name);
  var module = 'bookingbug-angular-' + name
  if (argv.env == 'development' || argv.env == 'dev') {
    if (!isLink(module)) {
      return bowerLink(dir, module);
    }
  } else if (isLink(module)) {
    return bower({cmd: 'uninstall'}, [[module]]);
  }
}

gulp.task('bowercore', ['bowerpublicbooking','boweradmin'], function() {
  return checkBower('core');
});

gulp.task('bowerpublicbooking', function() {
  return checkBower('public-booking');
});

gulp.task('boweradmin', ['boweradminbooking','bowermember','bowerservices','bowerevents','boweradmindashboard'], function() {
  return checkBower('admin');
});

gulp.task('boweradminbooking', function() {
  return checkBower('admin-booking');
});

gulp.task('bowermember', function() {
  return checkBower('member');
});

gulp.task('bowerservices', function() {
  return checkBower('services');
});

gulp.task('bowerevents', function() {
  return checkBower('events');
});

gulp.task('boweradmindashboard', function() {
  return checkBower('admin-dashboard');
});

gulp.task('bower', ['bowercore'], function() {
  if (argv.env != 'development') {
    return bower();
  }
});

// Use Gulp to open default browser
var openBrowser = function(){
  gulp.src('')
    .pipe(open({
      uri: connect_server.uri + ":" + connect_server.port
    }));
};

// Print new Gulp features circa 20-10-2015 18:44 GMT
var printNewFeatures = function(){
    gutil.log(gutil.colors.bgGreen.white(" Gulp ") + " now running in " + gutil.colors.bgRed.white(" EUF ") + " mode..."); // [E]xtreme [U]ser [F]riendliness
    gutil.log(gutil.colors.gray("*Extreme User Friendliness"));
    gutil.log(gutil.colors.gray("Oh boy oh boy oh boy, Gulp now watches for changes in the \"release\" folder and reloads the browser for you!"));
    gutil.log(gutil.colors.gray("Oh wow wow wow, console now logs file paths for the majority of file changes."));
    gutil.log(gutil.colors.gray("And lastly...") + " " + gutil.colors.red("If you DO NOT want Gulp to open the default browser for you:") + gutil.colors.gray(" --nobrows "));
    gutil.log(gutil.colors.green("Config is set to: " + config));
};

gulp.task('default', ['assets', 'html-files-in-www-folder', 'watch', 'webserver'], function(){
  // Open in default browser?
  if(argv.nobrows ? null : openBrowser());
});

// Handle the error
function errorHandler (error) {
  console.log(error.toString());
  this.emit('end');
}
