// Placeholder script for starting XTTS training via API
// Usage: node scripts/run-train.js
(async () => {
  const body = {
    configPath: 'configs/xtts_house_en.json',
    runName: 'house_en_xtts'
  };
  const res = await fetch('http://localhost:3000/api/train/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.API_KEY || '' },
    body: JSON.stringify(body)
  });
  console.log(await res.json());
})();
