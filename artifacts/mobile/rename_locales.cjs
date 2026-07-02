const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'locales');
const files = ['en.json', 'hi.json', 'gu.json'];

files.forEach(file => {
  const filePath = path.join(localesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace Tailor Book
  content = content.replace(/Tailor Book/g, 'Stitchix');
  content = content.replace(/TAILOR BOOK/g, 'STITCHIX');
  
  // Replace Hindi
  content = content.replace(/टेलर बुक/g, 'स्टिचिक्स');
  
  // Replace Gujarati
  content = content.replace(/ટેલર બુક/g, 'સ્ટીચિક્સ');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${file}`);
});
