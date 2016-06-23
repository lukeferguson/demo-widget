var gulp = require('gulp'),
    coffee = require('gulp-coffee'),
    concat = require('gulp-concat'),
    gulpif = require('gulp-if'),
    filelog = require('gulp-filelog'),
    gutil = require('gulp-util'),
    del = require('del'),
    connect = require('gulp-connect'),
    templateCache = require('gulp-angular-templatecache'),
    imagemin = require('gulp-imagemin'),
    rename = require('gulp-rename'),
    flatten = require('gulp-flatten'),
    promptly = require('promptly'),
    argv = require('yargs').argv,
    awspublish = require('gulp-awspublish'),
    replace = require('gulp-replace'),
    awspublishRouter = require('gulp-awspublish-router'),
    template = require('gulp-template'),
    streamqueue = require('streamqueue'),
    sass = require('gulp-sass'),
    wait = require('gulp-wait'),
    mainBowerFiles = require('main-bower-files'),
    uglify = require('gulp-uglify'),
    tap = require('gulp-tap'),
    open = require('gulp-open'),
    intercept = require('gulp-intercept'),
    bower = require('gulp-bower'),
    bowerLink = require('gulp-bower-link'),
    path = require('path'),
    prompt = require('gulp-prompt'),
    runSequence = require('run-sequence'),
    rsync = require('gulp-rsync'),
    mergeStreams = require('merge-stream'),
    notify = require("gulp-notify"),
    shell = require('gulp-shell'),
    glob = require('glob'),
    Q = require('q'),
    username = require('git-user-name'),
    email = require('git-user-email'),
    plumber = require('gulp-plumber'),
    sourcemaps = require('gulp-sourcemaps'),
    modRewrite = require('connect-modrewrite')
    cssSelectorLimit = require('gulp-css-selector-limit');

require('../gulpfile.js');

// \/\/\/\/\/\/\/\/\/\/\/
// DECIDE CONFIG FILE
// \/\/\/\/\/\/\/\/\/\/\/

var config;
gulp.task('config-set', function(){
  return gulp.src('./config.json')
    // template the config.json with defaults
    .pipe(template({project_name: projectName()}))
      .pipe(gulp.dest('./'))
        .on('end', function(){
          gutil.log(gutil.colors.green(require.resolve('./config')));
          delete require.cache[require.resolve('./config.json')];
          var env = deploy_env || argv.env || 'staging';
          if((env.match(/dev/))){
            config = require('./config.json')['development'];
          }else if((env.match(/prod/))){
             config = require('./config.json')['production'];
          }else{
             config = require('./config.json')['staging'];
          }
        });
});

// \/\/\/\/\/\/\/\/\/\/\/
// SLACK NOTIFICATIONS
// \/\/\/\/\/\/\/\/\/\/\/

var webhook_config = {
  url: "https://hooks.slack.com/services/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",
  user: "ROBO",
  icon_emoji: ":cow:"
}
var slack = require('gulp-slack')(webhook_config);
function slackNotify(msg){
  return gulp.src('')
    .pipe(slack(msg));
}

// \/\/\/\/\/\/\/
// BOWER REFRESH
// \/\/\/\/\/\/\/

gulp.task('clean-bower-components', function(){
  desktopNotify('remove bower_components', '', 'bower.png');
  // delete bower_components directory
  return del.sync(['./bower_components']);
});
// run bower cache clean...
gulp.task('shell-bower-cache-clean', shell.task(['bower cache clean']));
gulp.task('bower-cache-clean', ['shell-bower-cache-clean'], function(){
  return desktopNotify('bower cache clean', '', 'bower.png');
});
gulp.task('bower-install', [], function(){
  desktopNotify('bower install', '', 'bower.png');
  // run bower install...
  return bower({cmd: 'install'}); // same as bower();
});
gulp.task('bower-init', function(cb){
  return runSequence('clean-bower-components', 'bower-cache-clean', 'bower-install', cb);
});

// \/\/\/\/\/\/\/\/\/
// DEPLOY OPTIONS
// \/\/\/\/\/\/\/\/\/

var parseJSON = function(path){
  // use instead of require, because require caches the result
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

var getPublishVersion = function(){
  var bower = parseJSON('./bower.json');
  var version = parseJSON('../version.json').current;
  for(var i in bower.dependencies){
    if(i.toString().match(/bookingbug-angular-/)){
      if(bower.dependencies[i]){
        version = bower.dependencies[i];
      }
      break;
    }
  }
  return version;
}

gulp.task('publish', function(cb){
    // run deploy-rules first, when that's finished run assets, when assets is finished run deploy
    if(argv["media"]){
      runSequence('environment-prompt', 'config-set', 'deploy-rules', 'media-assets', 'deploy', cb); // images and fonts ONLY
    }else{
       runSequence('environment-prompt', 'config-set', 'deploy-rules', 'assets', 'deploy', cb); // ALL assets
    }

});
gulp.task('publish-rsync', function(cb){
  gulp.src('')
    .pipe(prompt.prompt({
      type: 'input',
      name: 'answer',
      message: gutil.colors.bgRed.white(' WARNING! ') + gutil.colors.yellow(' Are you sure you want to deploy using R-Sync?')
    }, function(res){
      if(res.answer.match(/[yY1]/)){
         // run deploy-rules first, when that's finished run assets, when assets is finished run deploy-rsync
       return runSequence('deploy-rules', 'assets', 'deploy-rsync', cb);
      }
      gutil.log(gutil.colors.red("=*=*=*= Deploy Terminated =*=*=*="));
      return false;
    }))
});

gulp.task('deploy-rules', [], function(cb){
  var deploy = function() {
    gutil.log(gutil.colors.green("Deploying to " + deploy_env + " using " + config.name) + "...");
    setTimeout(function(){
      cb();
    }, 3000);
  };

  gutil.beep();
  if(deploy_env == "production"){ // production...
    gulp.src('')
      .pipe(prompt.confirm(gutil.colors.bgRed.white(" WARNING! ") + " Deploy to " + gutil.colors.cyan(deploy_env) + " using " + gutil.colors.yellow(config.name + "? ")))
        .pipe(prompt.prompt({
          type: 'input',
          name: 'deploy',
          message: gutil.colors.bgYellow.black(' Seriously?! ')
        }, function(res){
          if(res.deploy.match(/[yY1]/)){
            return deploy();
          }
           gutil.log(gutil.colors.red("=*=*=*= Deploy Terminated =*=*=*="));
          return false;
        }));

  }else{ // development or staging...
    gulp.src('')
      .pipe(prompt.prompt({
          type: 'input',
          name: 'deploy',
          message: " Deploy to " + gutil.colors.cyan(deploy_env) + " using " + gutil.colors.yellow(config.name + "? ")
        }, function(res){
          if(res.deploy.match(/[yY1]/)){
            return deploy();
          }
          gutil.log(gutil.colors.red("=*=*=*= Deploy Terminated =*=*=*="));
          return false;
        }));
  }
});

var deploy_env = null; // default
gulp.task('environment-prompt', function(cb) {
  gulp.src('')
    .pipe(prompt.prompt({
      type: 'input',
      name: 'env',
      message: gutil.colors.green('Which environment do you wish to deploy - Development, Staging or Production?'),
      validate: function(pass){
        if(pass.match(/(dev|stag|prod)/i)){
          return true;
        }
        return false;
      }
    }, function(res){
      var environment = null;
      if(res.env.match(/dev/i)){
        deploy_env = "development";
        cb();
      }else if(res.env.match(/stag/i)){
        deploy_env = "staging";
        cb();
      }else if(res.env.match(/prod/i)){
        deploy_env = "production";
        cb();
      }else{
        return false;
      }
    }));
});

// \/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/
// GENERATE LIST OF BOWER DEPENDENCIES
// \/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/

var bower_components_promises = [];
var dependencies = [];
var dependencies_saved = false;
gulp.task('list-all-dependencies', function(cb){
  if(dependencies_saved){
    cb();
    return;
  }
  glob.sync("bower_components/*/.*bower.json").forEach(function(file_path){
      var defer = Q.defer();
      var pipeline = gulp.src(file_path)
        .pipe(intercept(function(file){
          if(JSON.parse(file.contents).version){
            dependencies.push('"' + JSON.parse(file.contents).name + " => " + JSON.parse(file.contents).version + '"');
          }else if(JSON.parse(file.contents)._source){
            // use _source if no version is specified...
            dependencies.push('"' + JSON.parse(file.contents).name + " => " + JSON.parse(file.contents)._source + '"');
          }
        }));
      pipeline.on('end', function(){
        defer.resolve();
      });
      bower_components_promises.push(defer.promise);
  });
  return Q.all(bower_components_promises);
});

gulp.task('list-deps', ['list-all-dependencies'],  function(cb){

  if(deploy_env && deploy_env.match(/prod/i)){
      // empty bower_list.js in javascripts folder
      fs.writeFile('./src/javascripts/bower_list.js', '');
  }

  if(dependencies_saved || (deploy_env && deploy_env.match(/prod/i))){
    cb();
    return;
  }

  // check if bower_list.js exists, if not copy it from ../project_template folder
  var bower_list;
  glob.sync("./bower_list.js").forEach(function(path){
    bower_list = path;
  });
  if(!bower_list){
     gulp.src('../project_template/bower_list.js')
    .pipe(gulp.dest('./'));
  }
  // check if ./images/bug.png exists, if not copy it from ../project_template folder
  var bug_png;
  glob.sync('./images/bug.png').forEach(function(path){
    bug_png = path;
  });
  if(!bug_png){
    gulp.src('../project_template/images/bug.png')
      .pipe(gulp.dest('./images'));
  }
  var sdk_version = getPublishVersion();
  dependencies.push('"' + "SDK => " + sdk_version + '"');

  dependencies_saved = true;
  return gulp.src('./bower_list.js')
    .pipe(template({deps: dependencies}))
    .pipe(gulp.dest('./src/javascripts/'));
});

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

gulp.task('clean-all', function() {
  del.sync(['release/*']);
  cb();
});

gulp.task('www', ['clean-html', 'config-set'], function(){
  return gulp.src(['www/*', 'src/www/*'])
    //.pipe(template(require(config)))
    .pipe(template(config))
    .pipe(gulp.dest('release'));
});

gulp.task('all-javascripts', ['bower-js', 'templates', 'javascripts'], function() {
  return gulp.src('tmpjs/**')
    .pipe(concat('booking-widget.js'))
    .pipe(gulp.dest('release'))
});

gulp.task('join-js', ['clean-js'], function() {
  return gulp.src('tmpjs/*')
    .pipe(concat('booking-widget.js'))
    .pipe(gulp.dest('release'));
});

gulp.task('javascripts', ['list-deps'], function() {
  return gulp.src(['src/javascripts/**/*', 'src/i18n/en.js'])
    .pipe(plumber())
    .pipe(gulpif(/.*coffee$/, coffee().on('error', function(e) {
      gutil.log(e)
      this.emit('end')
    })))
    .pipe(gulpif(argv.env != 'development' && argv.env != 'dev',
            uglify({mangle: false}))).on('error', gutil.log)
    .pipe(concat('booking-js.js'))
    .pipe(gulp.dest('tmpjs'))
});

//FIXIT: do it whatever the 'Gulp way' is
var languagesFiles = [];
if(fs.existsSync('src/i18n')) {
  languagesFiles = fs
    .readdirSync('src/i18n')
    .filter(function(file) {return file != 'en.js'});

  languagesFiles.forEach(function(file) {
    gulp.task(file, [], function() {
      return gulp.src(['bower_components/bookingbug-angular-core/i18n/' + file,
                'src/i18n/' + file])
          .pipe(concat(file))
          .pipe(uglify({mangle: false}))
          .pipe(gulp.dest('release/i18n'));
    });
  });
}

gulp.task('i18n', languagesFiles);

gulp.task('bower-js', ['bb-assets', 'bower'], function() {
  src = mainBowerFiles({filter: new RegExp('.js$')})
  return gulp.src(src)
    .pipe(plumber())
    .pipe(gulpif(/.*coffee$/, coffee().on('error', function(e) {
      gutil.log(e)
      this.emit('end')
    })))
    .pipe(gulpif(argv.env != 'development' && argv.env != 'dev',
            uglify({mangle: false}))).on('error', gutil.log)
    .pipe(concat('a-booking-bower.js'))
    .pipe(gulp.dest('tmpjs'))
});

gulp.task('templates', ['config-set'], function() {
  return gulp.src('./src/templates/*.html')
    .pipe(templateCache('x_templates.js', {module: 'BB'}))
    .pipe(flatten())
    //.pipe(template(require(config)))
    .pipe(template(config))
    .pipe(gulp.dest('tmpjs'));
});

gulp.task('images', function() {
  return gulp.src('src/images/*')
    // .pipe(imagemin())
    .pipe(flatten())
    .pipe(gulp.dest('release/images'));
});

function filterStylesheets(path) {
  return (
    path.match(new RegExp('.css$'))
    // Temporary exclude the compiled booking bug css files if they exist
    // until the new build process (as discussed) allows for their generation
    &&
    !path.match(new RegExp('(bookingbug-angular-).+(\.css)'))
  );
}

gulp.task('stylesheets', ['clean', 'bower', 'config-set'], function() {
  var src = mainBowerFiles({
      includeDev : true,
      filter: filterStylesheets
  });

  var bootstrapSCSS, appSCSS;

  bootstrapSCSS = gulp.src('src/stylesheets/bootstrap.scss')
    .pipe(sourcemaps.init())
    .pipe(sass({onError: function(e) { console.log(e); }, outputStyle: 'compressed'}).on('error', gutil.log));
  appSCSS = gulp.src('src/stylesheets/main.scss')
    .pipe(sourcemaps.init())
    .pipe(sass({onError: function(e) { console.log(e); }, outputStyle: 'compressed'}).on('error', gutil.log));
  dependenciesCSS = gulp.src(src)
    .pipe(sourcemaps.init())

  return streamqueue({objectMode: true }, bootstrapSCSS, dependenciesCSS, appSCSS)
    .pipe(plumber())
    .pipe(template(config))
    .pipe(template({project_name: projectName()}))
    .pipe(flatten())
    .pipe(concat('booking-widget.css'))
    .pipe(cssSelectorLimit.reporter('fail'))
    .pipe(sourcemaps.write('maps', {includeContent: false}))
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
gulp.task('html-files-in-www-folder', [], function(){
  return gulp.src('src/www/*')
    .pipe(tap(function(file, t){
      // ---------------------------------------------------------------------------------------
      // Build an array of all .html files in the "release" folder
      // This allows us to later watch for changes to the LAST file in the "release" folder
      // instead of hard-coding the watch to reference the last file at time of adding
      // this function, which happens to be "view_booking_admin.html"
      // ---------------------------------------------------------------------------------------
      html_files_in_www_folder.push(path.basename(file.path))
    }));
});

var task_started = 0;
var task_completed = 0;
var max_task_time = 0;
var gulp_started = false;

gulp.task('reloadCSS', [], function(){
  return gulp.src('release/booking-widget.css')
    .pipe(connect.reload());
});

gulp.task('reloadJS', [], function(){
  if (argv.nobrows){
    return false;
  }
  task_started = new Date().getTime();
  return gulp.src('release/booking-widget.js')
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
  return gulp.src('release/' + last_html_file_in_www_folder)
    .pipe(connect.reload());
});

function changeEventHandler(e){

  // var basename = path.basename(e.path);
  // desktopNotify(e.type, basename);

  // Timeout is here so that the changed log prints after all tasks have completed =D
  setTimeout(function(){
    gutil.log(gutil.colors.bgYellow.black(e.type + ":") + " " + gutil.colors.bgMagenta.white(path.basename(e.path)) + " " + gutil.colors.gray('"' + e.path + '"'));
  }, max_task_time);
};

function desktopNotify(title, massage, icon){
     var notify_config = {
        "title": title.toUpperCase(),
        "message": massage,
        "sound": "Frog"
      }
      if(icon){
        notify_config.icon =  path.join(path.resolve('../public-booking'), icon);
      }
      return gulp.src('')
        .pipe(notify(notify_config));
}

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
    process.env.srcpath+'/**/*',
    '!' + process.env.srcpath+'/**/*.scss'
  ], ['bower-js']).on('error', errorHandler);
  gulp.watch([
    '!./**/*~',
    process.env.srcpath+'/**/*.scss'
  ], ['sdk-css']).on('error', errorHandler);
});


gulp.task('sdk-css', function(cb){
  return runSequence('bb-css-assets', 'stylesheets', cb);
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

// \/\/\/\/\/\/\/\/\/\/\/\/\/\/\/
// STANDARD PUBLISH TASK
// \/\/\/\/\/\/\/\/\/\/\/\/\/\/\/

gulp.task('deploy', function() {
  var publisher = awspublish.create({
    key: process.env.AWS_ACCESS_KEY_ID,
    secret: process.env.AWS_SECRET_ACCESS_KEY,
    bucket: 'bespoke.bookingbug.com',
    region: 'eu-west-1'
  })
  var release = function(environment) {
    gutil.log(gutil.colors.green("Deploying to " + environment + " using SDK version " + getPublishVersion()));

    if (environment == 'production') {
      age = '300';
    } else {
      age = '10';
    }
    headers = {
      'Cache-Control': 'max-age=' + age
    }

    var release_files = './release/**';
    if(argv["media"]){
      // images and fonts ONLY
      release_files = ['./release/images/**', './release/fonts/**'];
    }
    return gulp.src(release_files)
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

  if(deploy_env){
    release(deploy_env);
    var user = username();
    var mail = email();
    var user_details = mail;
    if(user && user != undefined){
      user_details += " | " + user;
    }
    slackNotify(user_details + " deployed `" + projectName() + "` to " + deploy_env + " with SDK version " + getPublishVersion());
  }

});

// \/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/
// RSYNC PUBLISH TASK
// \/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/

gulp.task('deploy-rsync', [], function(){
  var release = function(environment) {

    gutil.log(gutil.colors.bgRed.white("DEPLOYING WITH RSYNC TO " + environment + "..."));

    if (environment == 'production') {
      var merged = mergeStreams(
      gulp.src('./release/**')
        .pipe(rsync({
          root: 'release',
          progress: true,
          silent: false,
          hostname: 'web01',
          destination: '/var/bespoke'
        })),
      gulp.src('./release/**')
        .pipe(rsync({
          root: 'release',
          progress: true,
          silent: false,
          hostname: 'web02',
          destination: '/var/bespoke'
        })));
      return merged.resume();
    } else {
      var merged = mergeStreams(
      gulp.src('./release/**')
        .pipe(rsync({
          root: 'release',
          progress: true,
          silent: false,
          hostname: 'dev01',
          destination: '/var/bespoke'
        })),
      gulp.src('./release/**')
        .pipe(rsync({
          root: 'release',
          progress: true,
          silent: false,
          hostname: 'staging01',
          destination: '/var/bespoke'
        })));
      return merged.resume();
    }
  }

  if(deploy_env){
    release(deploy_env);
    slackNotify(username() + " deployed `" + projectName() + "` to " + deploy_env + " with SDK version " + getPublishVersion());
  }

});

gulp.task('assets', ['clean', 'all-javascripts', 'stylesheets', 'images', 'www', 'fonts']);
gulp.task('media-assets', ['clean-all', 'images', 'fonts']);

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
  if (argv.env != 'development' && argv.env != 'dev') {
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

var printNewFeatures = function(){
  gutil.log(gutil.colors.gray("==================="));
  gutil.log(gutil.colors.gray("CUSTOM FLAGS =>"));
  gutil.log(gutil.colors.gray("==================="));
  console.log(gutil.colors.cyan("--nobrows") + " : " + gutil.colors.yellow("Prevent gulp from opening the browser"));
  console.log(gutil.colors.cyan("--media") + " : " + gutil.colors.yellow("Use with gulp publish to deploy only images and fonts"));
  gutil.log(gutil.colors.gray("==================="));
  gutil.log(gutil.colors.gray("CUSTOM TASKS =>"));
  gutil.log(gutil.colors.gray("==================="));
  console.log(gutil.colors.cyan("gulp update-bower-json") + " : " + gutil.colors.yellow("Updates bookingbug-angular-* module versions in bower.json"));
  console.log(gutil.colors.cyan("gulp bower-init") + " : " + gutil.colors.yellow("Deletes local bower_components, clears the cache and runs bower install"));
  gutil.log(gutil.colors.gray("==================="));
  gutil.log(gutil.colors.gray("CONFIG =>"));
  gutil.log(gutil.colors.gray("==================="));
  console.log(gutil.colors.cyan(config.name) + " :");
  console.log(gutil.colors.yellow(JSON.stringify(config)));
}

gulp.task('default', ['assets', 'html-files-in-www-folder', 'watch', 'webserver'], function(){
  // Open in default browser?
  if(argv.nobrows ? null : openBrowser());
  desktopNotify("GULP", "Started and watching for changes...")
});

// Handle the error
function errorHandler (error) {
  console.log(error.toString());
  this.emit('end');
}
