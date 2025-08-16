const test = require('node:test');
const assert = require('node:assert');

const uploadController = require('../controllers/uploadController');
const transcriptionController = require('../controllers/transcriptionController');
const projectTreeController = require('../controllers/projectTreeController');

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; };
  return res;
};

test('uploadController exports', () => {
  assert.deepStrictEqual(Object.keys(uploadController).sort(), ['handleUpload', 'uploadAudio']);
});

test('transcriptionController exports', () => {
  assert.deepStrictEqual(Object.keys(transcriptionController).sort(), ['fullTranscription', 'runTranscription']);
});

test('projectTreeController exports', () => {
  assert.deepStrictEqual(Object.keys(projectTreeController).sort(), ['getTree', 'listProjects']);
});

test('uploadAudio responds', () => {
  const req = { file: { originalname: 'a.wav' } };
  const res = mockRes();
  uploadController.uploadAudio(req, res);
  assert.ok(res.body.ok);
  assert.equal(res.body.file, 'a.wav');
});

test('runTranscription responds', () => {
  const res = mockRes();
  transcriptionController.runTranscription({}, res);
  assert.ok(res.body.ok);
});

test('getTree responds', () => {
  const res = mockRes();
  projectTreeController.getTree({}, res);
  assert.ok(res.body.ok);
  assert.deepStrictEqual(res.body.tree, []);
});
