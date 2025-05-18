/**
 * Alternative image processing utility that doesn't rely on canvas
 * Uses pure Node.js Buffers or falls back to Python if installed
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('./logger');

class ImageProcessor {
  /**
   * Combine multiple image buffers into a single image buffer
   * Uses Python if available, otherwise uses a simpler approach
   * @param {Array<Buffer>} imageBuffers - Array of image buffers
   * @returns {Promise<Buffer|Array<Buffer>>} - Combined image or original array if combining fails
   */
  async combineImages(imageBuffers) {
    try {
      // First try using Python (if available)
      const pythonResult = await this._combineWithPython(imageBuffers);
      if (pythonResult) {
        return pythonResult;
      }
      
      // If Python fails, we'll just use the first image or return all images
      logger.warn('Falling back to simplified image handling');
      
      // If only one image, just return it
      if (imageBuffers.length === 1) {
        return imageBuffers[0];
      }
      
      // If multiple images, return the first one for simplicity
      // This is a fallback - ideally we'd use Python or another method
      return imageBuffers[0];
    } catch (error) {
      logger.error(`Error combining images: ${error.message}`, null, error);
      // Return the original image buffers if we couldn't combine them
      return imageBuffers;
    }
  }
  
  /**
   * Save buffers to temporary files and use Python to combine them
   * @param {Array<Buffer>} imageBuffers - Array of image buffers
   * @returns {Promise<Buffer|null>} - Combined image buffer or null if failed
   * @private
   */
  async _combineWithPython(imageBuffers) {
    try {
      // Create temp directory if it doesn't exist
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Save images to temp files
      const tempFiles = [];
      for (let i = 0; i < imageBuffers.length; i++) {
        const filePath = path.join(tempDir, `temp_img_${i}.png`);
        fs.writeFileSync(filePath, imageBuffers[i]);
        tempFiles.push(filePath);
      }
      
      // Output combined image path
      const outputPath = path.join(tempDir, 'combined.png');
      
      // Create a simple Python script to combine the images
      const pythonScript = `
import sys
from PIL import Image
import os

def combine_images(input_files, output_file, size=(400, 100)):
    try:
        # Create a new image with the desired size
        result = Image.new('RGB', size)
        
        # Calculate width for each image
        single_width = size[0] // len(input_files)
        
        # Paste each image into the result
        for i, file_path in enumerate(input_files):
            if os.path.exists(file_path):
                img = Image.open(file_path)
                img = img.resize((single_width, size[1]))
                result.paste(img, (i * single_width, 0))
        
        # Save the result
        result.save(output_file)
        return True
    except Exception as e:
        print(f"Error combining images: {e}", file=sys.stderr)
        return False

# Get input files and output file from command line arguments
input_files = sys.argv[1:-1]
output_file = sys.argv[-1]

success = combine_images(input_files, output_file)
sys.exit(0 if success else 1)
      `;
      
      const pythonScriptPath = path.join(tempDir, 'combine_images.py');
      fs.writeFileSync(pythonScriptPath, pythonScript);
      
      // Execute the Python script
      return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [pythonScriptPath, ...tempFiles, outputPath]);
        
        let errorData = '';
        pythonProcess.stderr.on('data', (data) => {
          errorData += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
          // Clean up temp files
          for (const file of tempFiles) {
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
            }
          }
          
          if (code === 0 && fs.existsSync(outputPath)) {
            // Read the combined image
            const combinedBuffer = fs.readFileSync(outputPath);
            
            // Clean up the output file
            fs.unlinkSync(outputPath);
            fs.unlinkSync(pythonScriptPath);
            
            resolve(combinedBuffer);
          } else {
            logger.warn(`Python image combining failed with code ${code}: ${errorData}`);
            resolve(null);
          }
        });
      });
    } catch (error) {
      logger.error(`Error using Python to combine images: ${error.message}`, null, error);
      return null;
    }
  }
  
  /**
   * Save an image buffer to a file
   * @param {Buffer} imageBuffer - Image buffer
   * @param {string} filePath - Path to save the image
   * @returns {boolean} - Whether the save was successful
   */
  saveImage(imageBuffer, filePath) {
    try {
      const directory = path.dirname(filePath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
      
      fs.writeFileSync(filePath, imageBuffer);
      return true;
    } catch (error) {
      logger.error(`Error saving image: ${error.message}`, null, error);
      return false;
    }
  }
}

module.exports = new ImageProcessor();