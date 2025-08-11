// Placeholder script for dataset preprocessing via API
// Usage: node scripts/run-prep.js
(async () => {
  const body = {
    inputDir: 'uploads/raw_audio',
    transcriptFile: 'uploads/transcripts.tsv',
    outputDir: 'data/house_en',
    speaker: 'spk1',
    language: 'en',
    sampleRate: 22050,
    maxLen: 15,
    vad: true
  };
  const res = await fetch('http://localhost:3000/api/data/prep', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.API_KEY || '' },
    body: JSON.stringify(body)
  });
  console.log(await res.json());
})();
