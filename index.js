const async    = require('async');
const fs       = require('fs');
const mkdirp   = require('mkdirp');
const path     = require('path');
const request  = require('request');
const { keys } = Object;

const LIMIT = 1000;

const ENGINES = {
  9: 'processing.js',
  10: 'processing',
  11: 'p5'
};

const EXTENSIONS = {
  9: 'js',
  10: 'pde',
  11: 'js'
};

const genFormData = (offset = 0) => ({
  time:   'anytime',
  type:   'all',
  limit:  LIMIT,
  offset: LIMIT * offset
});

const getSketch = (visualID, callback) => {
  request(`https://www.openprocessing.org/sketch/${visualID}`, (error, _, body = '') => {
    const sketchLines  = body.split('\n').filter(line => line.indexOf('var sketch') >= 0);

    if (sketchLines.length === 0) { return callback(); }

    const sketchLine   = sketchLines[0];
    const sketchValue  = sketchLine.replace('var sketch = ', '').replace(/\;$/, '');
    let sketchData;

    try {
      sketchData = JSON.parse(sketchValue);
    }
    catch (e) {
      console.error(e);
      return callback();
    }

    if (sketchData.codeObjects.length === 0) { return callback(); }

    const sketchCode   = sketchData.codeObjects[0].code;
    const sketchTitle  = sketchData.title;
    const sketchEngine = parseInt(sketchData.engineID);
    const sketchName   = `${sketchTitle}-${visualID}.${EXTENSIONS[sketchEngine] || 'unknown'}`;
    const sketchPath   = path.join(__dirname, 'data', ENGINES[sketchEngine] || 'unknown', sketchName);

    console.log(sketchName);

    fs.writeFile(sketchPath, sketchCode, 'utf8', callback);
  });
};

const getPage = (offset = 0) => {
  request.post('https://www.openprocessing.org/home/search_ajax', { form: genFormData(offset) }, (error, _, body) => {
    console.log(`
      getting ${offset * LIMIT} - ${(offset + 1) * LIMIT}...
    `);

    let data;

    try {
      data = JSON.parse(body);
    }
    catch (e) {
      console.error(e);
    }

    if (data) {
      async.each(
        data.object,
        ({ visualID }, callback) => getSketch(visualID, callback),
        () => {
          if (data.object.length > 0) {
            getPage(offset + 1);
          }
        }
      );
    }
    else {
      console.log(`
        error with response, retrying soon...
      `);

      setTimeout(() => getPage(offset), 1000);
    }
  });
};

keys(ENGINES).map(key => {
  mkdirp.sync(path.join(__dirname, 'data', ENGINES[key]));
});

mkdirp.sync(path.join(__dirname, 'data', 'unknown'));

getPage();
