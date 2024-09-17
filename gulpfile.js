// Import required modules
import gulp from 'gulp';
import browserSync from 'browser-sync';
import clean from 'gulp-clean';  // Optional: To clean the build folder before building
import replace from 'gulp-replace';

import { DEFAULT_ANSWER_EVALUATION_API } from './src/js/Quiz.js';
// Any reference to this url, will be replaced with the actual API endpoint in the build process
// Make sure to set the ANSWER_EVALUATION_API environment variable when building for production

// File paths
const paths = {
  html: './src/*.html',
  css: './src/css/**/*.css',
  js: './src/js/**/*',  // Updated to include all subdirectories
  data: './src/data/*.json',
  images: './src/images/**/*',
  build: './build/',
};

// Task to serve the files with BrowserSync
function serveDev(done) {
  browserSync.init({
    server: {
      baseDir: './src',  // Serve files from the 'src' folder during development
    },
  });
  done();
}

function serveProd(done) {
    browserSync.init({
      server: {
        baseDir: './build',  // Serve files from the 'src' folder during development
      },
      open: false
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

function copyImages() {
  return gulp.src(paths.images, { buffer: false })
    .pipe(gulp.dest(paths.build + 'images'))
    .on('error', function(err) {
      console.error('Error in copyImages task:', err);
      this.emit('end');
    });
}

// Task to process and minify CSS files and move them to build folder
function buildCSS() {
  return gulp.src(paths.css)
    // .pipe(cleanCSS())  // Minify CSS
    .pipe(gulp.dest(paths.build + 'css'));
}

// Update the buildJS function to copy all JS files and subdirectories
// Might include minification in the future
function buildJS() {
  return gulp.src(paths.js)
    .pipe(gulp.dest(paths.build + 'js'))
    .on('error', function(err) {
      console.error('Error in buildJS task:', err);
      this.emit('end');
    });
}

function buildData() {
    return gulp.src(paths.data)
      .pipe(gulp.dest(paths.build + 'data'));
}

function replaceEnvVariables() {
  if (!process.env.ANSWER_EVALUATION_API) {
    console.log('ANSWER_EVALUATION_API not set, skipping replacement');
    return Promise.resolve(); // Return a resolved promise to signal task completion
  }
  return gulp.src([paths.build + '*.html', paths.build + 'js/*.js'], { base: paths.build })
    .pipe(replace('http://localhost:8000/evaluate', process.env.ANSWER_EVALUATION_API))
    .pipe(gulp.dest(paths.build));
}

// Build task: Clean the build folder, then copy and process HTML, CSS, and JS
const buildTask = gulp.series(
  cleanBuild, 
  gulp.parallel(copyHTML, copyImages, buildCSS, buildJS, buildData), 
  replaceEnvVariables
);

// Default task: Serve files with BrowserSync and watch for changes
const serveDevTask = gulp.series(serveDev, watchFiles);

function watchAndRebuild() {
  gulp.watch(paths.html, gulp.series(copyHTML, reload));
  gulp.watch(paths.css, gulp.series(buildCSS, reload));
  gulp.watch(paths.js, gulp.series(buildJS, reload));
  gulp.watch(paths.data, gulp.series(buildData, reload));
  gulp.watch(paths.images, gulp.series(copyImages, reload));
}

const serveProdTask = gulp.series(
  buildTask,
  serveProd,
  watchAndRebuild
);

// Export tasks
export { buildTask as build, serveDevTask as default, serveProdTask as serve };