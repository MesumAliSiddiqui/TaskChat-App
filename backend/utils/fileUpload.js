const path = require('path');
const fs = require('fs');

/**
 * Saves a base64-encoded image string to the backend /uploads directory on disk.
 * Supports data URLs (e.g. data:image/jpeg;base64,...) and raw base64.
 * Returns the relative static URL path (/uploads/<fileName>).
 */
const saveBase64Image = async (imageString, prefix = 'media') => {
  if (!imageString) return '';

  // If already a remote or static URL, return as-is
  if (
    imageString.startsWith('http://') ||
    imageString.startsWith('https://') ||
    imageString.startsWith('/uploads')
  ) {
    return imageString;
  }

  let ext = 'jpg';
  let base64Data = imageString;

  if (imageString.startsWith('data:image')) {
    const matches = imageString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      ext = matches[1].split('/')[1] || 'jpg';
      if (ext === 'jpeg') ext = 'jpg';
      base64Data = matches[2];
    }
  }

  const buffer = Buffer.from(base64Data, 'base64');
  const fileName = `${prefix}_${Date.now()}_${Math.round(Math.random() * 1e9)}.${ext}`;
  const uploadsDir = path.join(__dirname, '../uploads');

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filePath = path.join(uploadsDir, fileName);
  await fs.promises.writeFile(filePath, buffer);

  return `/uploads/${fileName}`;
};

module.exports = { saveBase64Image };
