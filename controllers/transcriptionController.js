const runTranscription = (req, res) => {
  res.json({ ok: true, transcription: 'started' });
};

const fullTranscription = (req, res) => {
  res.json({ ok: true, transcription: 'complete' });
};

module.exports = { runTranscription, fullTranscription };
