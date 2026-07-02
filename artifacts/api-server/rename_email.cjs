const fs = require('fs');
const path = require('path');

const emailFile = path.join(__dirname, 'src', 'lib', 'email.ts');
let content = fs.readFileSync(emailFile, 'utf8');

// Replace Tailor Book but keep email addresses
content = content.replace(/Tailor Book/g, 'Stitchix');

fs.writeFileSync(emailFile, content, 'utf8');
console.log('Updated email.ts');
