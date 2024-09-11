// Import required modules
const gulp = require('gulp');
const browserSync = require('browser-sync').create();
const clean = require('gulp-clean');  // Optional: To clean the build folder before building

// File paths
const paths = {
  html: './src/*.html',
  css: './src/css/*.css',
  js: './src/js/*.js',
  data: './src/data/*.json',
  build: './build/',
};

// Task to serve the files with BrowserSync
function serve(done) {
  browserSync.init({
    server: {
      baseDir: './src',  // Serve files from the 'src' folder during development
    },
  });
  done();
}

function serveBuild(done) {
    browserSync.init({
      server: {
        baseDir: './build',  // Serve files from the 'src' folder during development
      },
    });
    done();
  }

// Task to reload the browser when files change
function reload(done) {
  browserSync.reload();
  done();
}

// Watch files for changes
function watchFiles() {
  gulp.watch(paths.html, reload);  // Watch HTML files for changes
  gulp.watch(paths.css, reload);   // Watch CSS files for changes
  gulp.watch(paths.js, reload);    // Watch JS files for changes
}

// Task to clean the build folder (optional)
function cleanBuild() {
  return gulp.src(paths.build, { read: false, allowEmpty: true }).pipe(clean());
}

// Task to copy HTML files to build folder
function copyHTML() {
  return gulp.src(paths.html).pipe(gulp.dest(paths.build));
}

// Task to process and minify CSS files and move them to build folder
function buildCSS() {
  return gulp.src(paths.css)
    // .pipe(cleanCSS())  // Minify CSS
    .pipe(gulp.dest(paths.build + 'css'));
}

// Task to minify JS files and move them to build folder
function buildJS() {
  return gulp.src(paths.js)
    // .pipe(uglify())  // Minify JS
    .pipe(gulp.dest(paths.build + 'js'));
}

function buildData() {
    return gulp.src(paths.data)
      .pipe(gulp.dest(paths.build + 'data'));
  }

// Build task: Clean the build folder, then copy and process HTML, CSS, and JS
const build = gulp.series(cleanBuild, gulp.parallel(copyHTML, buildCSS, buildJS, buildData), serveBuild);

// Default task: Serve files with BrowserSync and watch for changes
const defaultTask = gulp.series(serve, watchFiles);

// Export tasks
exports.default = defaultTask;
exports.build = build;