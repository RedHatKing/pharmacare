const fs = require('fs');
const path = require('path');

// Create a local SQLite file using the system sqlite3 CLI if available, otherwise write schema to file for Tauri backend.
try {
	const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
	const outPath = path.join(__dirname, 'pharmacy.db.schema.sql');
	fs.writeFileSync(outPath, schema, 'utf8');
	console.log('Wrote schema to', outPath);
} catch (e) {
	console.error('Failed to write schema file:', e && e.message);
}