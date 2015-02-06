'use strict';
/*jshint browser: true*/

var flamegraph = require('../')
  , initSearch = require('./init-search')
  , zoom = require('./zoom')()
  , xtend = require('xtend')
  , resolver;

var optsTemplate = require('./opts-template.hbs');

var flamegraphEl    = document.getElementById('flamegraph');
var callgraphFileEl = document.getElementById('callgraph-file')
var mapFileEl       = document.getElementById('map-file')
var optionsEl       = document.getElementById('options');
var instructionsEl  = document.getElementById('instructions');
var spinnerEl       = document.getElementById('spinner');

var map;
var showInternalsProfile = { 
    unresolveds  : true
  , v8internals  : true
  , v8gc         : true
  , sysinternals : true
}

var excludeOptions = [ 'fonttype', 'fontwidth', 'fontsize', 'imagewidth', 'countname', 'colors', 'timemax', 'factor', 'hash', 'title', 'titlestring', 'nametype', 'bgcolor1', 'bgcolor2' ];
var usedMetaKeys = Object.keys(flamegraph.defaultOptsMeta).filter(function (k) { return !~excludeOptions.indexOf(k) });

var currentTrace;

function renderOptions() {
  var opts = flamegraph.defaultOpts
    , meta = flamegraph.defaultOptsMeta;

  var context = usedMetaKeys
    .reduce(function (acc, k) {
      var type = meta[k].type;
      return acc.concat({
          name        : k
        , value       : opts[k]
        , type        : type
        , description : meta[k].description
        , min         : meta[k].min
        , max         : meta[k].max
        , step        : meta[k].step
      });
    }, []);
  var html = optsTemplate(context);
  optionsEl.innerHTML = html;

  // Need to set value in JS since it's not picked up when set in html that is added to DOM afterwards
  usedMetaKeys 
    .forEach(function (k) {
      var val = opts[k];
      var el = document.getElementById(k);
      el.value = val;
    });
}


function getOptions() {
  var meta = flamegraph.defaultOptsMeta;

  return usedMetaKeys 
    .reduce(function (acc, k) {
      var el = document.getElementById(k);
      var val = el.value;
      if (meta[k].type === 'number') {
        val = val.length ? parseFloat(val) : Infinity;
      } else if (meta[k].type === 'boolean') {
        val = val.length ? Boolean(val) : false; 
      } else if (meta[k].type === 'checkbox') {
        val = el.checked ? true : false
      }
      acc[k] = val;
      return acc;
    }, xtend(flamegraph.defaultOpts));
}

function onOptionsChange(e) {
  refresh();
}

function registerChange() {
  var inputs = optionsEl.getElementsByTagName('input')
    , i, el;
  
  for (i = 0; i < inputs.length; i++) {
    el = inputs[i];
    el.onchange = onOptionsChange;
  }
}

function hookHoverMethods() {
  var details = document.getElementById("details").firstChild;
  window.s = function s(info) { 
    details.nodeValue = "Function: " + info; 
  }
  window.c = function c() { 
    details.nodeValue = ' '; 
  }
}

function render(arr) {
  if (instructionsEl.parentElement) instructionsEl.parentElement.removeChild(instructionsEl);

  spinnerEl.classList.remove('hidden');
  // give spinner overlay a chance to appear before blocking EVERYTHING with our crunching
  // and for christ's sake find some time to refactor this to run on a web worker ;)
  setTimeout(doWork, 10);

  function doWork() {
    var opts = getOptions();

    var svg;
    try {
      currentTrace = arr;
      opts.removenarrows = false;
      if (opts.internals) opts.profile = xtend(showInternalsProfile);
      opts.profile.map = map;

      svg = flamegraph(arr, opts);
      flamegraphEl.innerHTML= svg;
      hookHoverMethods();
      zoom.init(opts);
    } catch (err) {
      flamegraphEl.innerHTML = '<br><p class="error">' + err.toString() + '</p>';
    }

    spinnerEl.classList.add('hidden');
  }
}

function refresh() {
  if (!currentTrace) return;
  render(currentTrace);
  initSearch.refresh();
}

function readFile(file, cb) {
  var fileReader = new FileReader();
  fileReader.readAsText(file, 'utf-8');
  fileReader.onload = function onload(err) {
    cb(err, fileReader.result);
  }
}

function onFile(e, process) {
  var file = e.target.files[0];
  if (!file) return;
  readFile(file, process);
}

function processCallgraphFile(e) {
  var arr = e.target.result.split('\n');
  if (resolver) arr = resolver.resolveMulti(arr);
  render(arr);
}

function processMapFile(e) {
  map = e.target.result;
  refresh();
}

function onCallgraphFile(e) {
  onFile(e, processCallgraphFile);
}

function onMapFile(e) {
  onFile(e, processMapFile);
}

// Event Listeners
callgraphFileEl.addEventListener('change', onCallgraphFile);
mapFileEl.addEventListener('change', onMapFile);

// Setup 
renderOptions();
registerChange();
initSearch(flamegraphEl);
