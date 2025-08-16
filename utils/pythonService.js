const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const protoDir = path.join(__dirname, '..', 'proto');

function loadProto(filename) {
  return grpc.loadPackageDefinition(
    protoLoader.loadSync(path.join(protoDir, filename), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    })
  ).doccreator;
}

const translationProto = loadProto('translation.proto');
const ttsProto = loadProto('tts.proto');

const translationClient = new translationProto.TranslationService(
  process.env.PYTHON_GRPC_ADDR || 'localhost:50051',
  grpc.credentials.createInsecure()
);

const ttsClient = new ttsProto.TTSService(
  process.env.PYTHON_GRPC_ADDR || 'localhost:50051',
  grpc.credentials.createInsecure()
);

function translate(text, target_language) {
  return new Promise((resolve, reject) => {
    translationClient.Translate({ text, target_language }, (err, resp) => {
      if (err) return reject(err);
      resolve(resp.text);
    });
  });
}

function synthesize(text, voice) {
  return new Promise((resolve, reject) => {
    ttsClient.Synthesize({ text, voice }, (err, resp) => {
      if (err) return reject(err);
      resolve(resp.audio);
    });
  });
}

module.exports = { translate, synthesize };
