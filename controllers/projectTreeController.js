const getTree = (req, res) => {
  res.json({ ok: true, tree: [] });
};

const listProjects = (req, res) => {
  res.json({ ok: true, projects: [] });
};

module.exports = { getTree, listProjects };
