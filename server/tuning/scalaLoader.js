const fs = require('fs');
const path = require('path');

function parseScalaFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0 && !line.trim().startsWith('!'));
  if (lines.length < 2) {
    return null;
  }
  const description = lines[0].trim();
  const count = parseInt(lines[1].trim(), 10);
  const intervals = [];
  for (let i = 2; i < lines.length && intervals.length < count; i += 1) {
    const part = lines[i].split('!')[0].trim();
    if (!part) continue;
    const asNumber = parseFloat(part);
    if (Number.isNaN(asNumber)) continue;
    intervals.push(asNumber);
  }
  return { description, count, intervals };
}

function listScalaFiles(scalesDir) {
  if (!fs.existsSync(scalesDir)) return [];
  return fs
    .readdirSync(scalesDir)
    .filter((file) => file.toLowerCase().endsWith('.scl'))
    .map((name) => ({
      name: path.basename(name, '.scl'),
      file: path.join(scalesDir, name),
    }))
    .filter((entry) => fs.existsSync(entry.file));
}

function loadScalaScales(scalesDir) {
  return listScalaFiles(scalesDir)
    .map((entry) => {
      try {
        const parsed = parseScalaFile(entry.file);
        if (!parsed) return null;
        return {
          name: entry.name,
          description: parsed.description,
          count: parsed.count,
          intervals: parsed.intervals,
        };
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

module.exports = { parseScalaFile, listScalaFiles, loadScalaScales };
