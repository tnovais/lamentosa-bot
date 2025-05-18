const Tesseract = require('tesseract.js');
const Jimp = require('jimp');

module.exports = async function solveCaptcha(imagePath) {
  const image = await Jimp.read(imagePath);
  image.greyscale().contrast(1).write(imagePath);

  const result = await Tesseract.recognize(imagePath, 'eng', {
    tessedit_char_whitelist: '0123456789',
  });

  return result.data.text.replace(/\D/g, '').trim();
};
