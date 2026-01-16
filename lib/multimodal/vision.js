/**
 * Vision Module
 * Multimodal image/vision support for Grok Code
 * Supports image analysis, screenshots, and visual context
 */

import fs from 'fs-extra';
import path from 'path';

export class VisionHandler {
  constructor(options = {}) {
    this.grokClient = options.grokClient;
    this.visionModel = options.visionModel || 'grok-4-vision';
    this.maxImageSize = options.maxImageSize || 20 * 1024 * 1024; // 20MB
    this.supportedFormats = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];

    // Image cache for conversation context
    this.imageCache = new Map();
    this.maxCacheSize = options.maxCacheSize || 10;
  }

  /**
   * Check if a file is a supported image
   * @param {string} filePath - File path
   * @returns {boolean} Is supported image
   */
  isSupportedImage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedFormats.includes(ext);
  }

  /**
   * Load and encode image as base64
   * @param {string} filePath - Image file path
   * @returns {Promise<Object>} Image data object
   */
  async loadImage(filePath) {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    // Check if file exists
    if (!await fs.pathExists(absolutePath)) {
      throw new Error(`Image not found: ${filePath}`);
    }

    // Check file size
    const stats = await fs.stat(absolutePath);
    if (stats.size > this.maxImageSize) {
      throw new Error(`Image too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB (max ${this.maxImageSize / 1024 / 1024}MB)`);
    }

    // Check format
    if (!this.isSupportedImage(absolutePath)) {
      throw new Error(`Unsupported image format: ${path.extname(filePath)}`);
    }

    // Read and encode
    const buffer = await fs.readFile(absolutePath);
    const base64 = buffer.toString('base64');
    const ext = path.extname(absolutePath).toLowerCase();
    const mimeType = this.getMimeType(ext);

    return {
      path: absolutePath,
      filename: path.basename(absolutePath),
      base64,
      mimeType,
      size: stats.size,
      dataUrl: `data:${mimeType};base64,${base64}`
    };
  }

  /**
   * Get MIME type for file extension
   * @param {string} ext - File extension
   * @returns {string} MIME type
   */
  getMimeType(ext) {
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Analyze an image using vision model
   * @param {string} imagePath - Path to image
   * @param {string} prompt - Analysis prompt
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Analysis result
   */
  async analyzeImage(imagePath, prompt = 'Describe this image in detail.', options = {}) {
    if (!this.grokClient) {
      throw new Error('Grok client not initialized');
    }

    const imageData = await this.loadImage(imagePath);

    // Add to cache
    this.addToCache(imagePath, imageData);

    // Build vision message
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: imageData.dataUrl,
              detail: options.detail || 'auto'
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }
    ];

    const response = await this.grokClient.chat({
      messages,
      model: this.visionModel,
      maxTokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
      stream: false
    });

    return response.choices[0].message.content;
  }

  /**
   * Analyze a screenshot for debugging
   * @param {string} imagePath - Screenshot path
   * @param {Object} options - Options
   * @returns {Promise<Object>} Analysis result with structured data
   */
  async analyzeScreenshot(imagePath, options = {}) {
    const prompt = `Analyze this screenshot from a development environment. Identify:

1. **Application/Tool**: What application or tool is shown?
2. **Error Messages**: Are there any error messages visible? Quote them exactly.
3. **UI State**: Describe the current state of the UI
4. **Code Visible**: Is there code visible? What language? Any obvious issues?
5. **Console Output**: Is there console/terminal output? What does it show?
6. **Suggestions**: Based on what you see, what actions might help?

Be specific and quote any visible text exactly as shown.`;

    const analysis = await this.analyzeImage(imagePath, prompt, options);

    return {
      path: imagePath,
      analysis,
      timestamp: Date.now(),
      type: 'screenshot-analysis'
    };
  }

  /**
   * Compare two images (e.g., before/after UI)
   * @param {string} imagePath1 - First image path
   * @param {string} imagePath2 - Second image path
   * @param {Object} options - Options
   * @returns {Promise<string>} Comparison result
   */
  async compareImages(imagePath1, imagePath2, options = {}) {
    if (!this.grokClient) {
      throw new Error('Grok client not initialized');
    }

    const image1 = await this.loadImage(imagePath1);
    const image2 = await this.loadImage(imagePath2);

    const prompt = options.prompt || `Compare these two images and describe:
1. What has changed between them?
2. Are there any new elements?
3. Are there any missing elements?
4. Has the layout or styling changed?
Be specific and detailed in your comparison.`;

    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: image1.dataUrl, detail: 'high' }
          },
          {
            type: 'image_url',
            image_url: { url: image2.dataUrl, detail: 'high' }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }
    ];

    const response = await this.grokClient.chat({
      messages,
      model: this.visionModel,
      maxTokens: options.maxTokens || 4096,
      stream: false
    });

    return response.choices[0].message.content;
  }

  /**
   * Extract text from image (OCR-like)
   * @param {string} imagePath - Image path
   * @param {Object} options - Options
   * @returns {Promise<string>} Extracted text
   */
  async extractText(imagePath, options = {}) {
    const prompt = `Extract ALL text visible in this image. Include:
- Code snippets (preserve formatting and indentation)
- UI labels and buttons
- Error messages
- Console output
- File paths and names

Format the output as closely as possible to how it appears in the image. Use code blocks for code.`;

    return await this.analyzeImage(imagePath, prompt, options);
  }

  /**
   * Analyze UI mockup or design
   * @param {string} imagePath - Image path
   * @param {Object} options - Options
   * @returns {Promise<Object>} UI analysis
   */
  async analyzeUIDesign(imagePath, options = {}) {
    const prompt = `Analyze this UI design/mockup and provide:

1. **Component Breakdown**: List all UI components visible
2. **Layout Structure**: Describe the layout (grid, flex, etc.)
3. **Color Scheme**: Primary colors used
4. **Typography**: Font styles and hierarchy
5. **Interactive Elements**: Buttons, inputs, links
6. **Suggested Implementation**: How would you implement this in code?

If this appears to be a web interface, suggest HTML/CSS structure.
If it's a mobile app, suggest the component hierarchy.`;

    const analysis = await this.analyzeImage(imagePath, prompt, options);

    return {
      path: imagePath,
      analysis,
      timestamp: Date.now(),
      type: 'ui-analysis'
    };
  }

  /**
   * Build message content with images for chat
   * @param {string} textContent - Text message
   * @param {Array<string>} imagePaths - Image paths to include
   * @returns {Promise<Array>} Message content array
   */
  async buildMessageWithImages(textContent, imagePaths) {
    const content = [];

    // Add images first
    for (const imagePath of imagePaths) {
      const imageData = await this.loadImage(imagePath);
      content.push({
        type: 'image_url',
        image_url: {
          url: imageData.dataUrl,
          detail: 'auto'
        }
      });
    }

    // Add text
    content.push({
      type: 'text',
      text: textContent
    });

    return content;
  }

  /**
   * Add image to cache
   * @param {string} key - Cache key
   * @param {Object} imageData - Image data
   */
  addToCache(key, imageData) {
    // Evict oldest if at capacity
    if (this.imageCache.size >= this.maxCacheSize) {
      const oldestKey = this.imageCache.keys().next().value;
      this.imageCache.delete(oldestKey);
    }

    this.imageCache.set(key, {
      ...imageData,
      cachedAt: Date.now()
    });
  }

  /**
   * Get image from cache
   * @param {string} key - Cache key
   * @returns {Object|null} Cached image data
   */
  getFromCache(key) {
    return this.imageCache.get(key) || null;
  }

  /**
   * Clear image cache
   */
  clearCache() {
    this.imageCache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    let totalSize = 0;
    for (const image of this.imageCache.values()) {
      totalSize += image.size || 0;
    }

    return {
      count: this.imageCache.size,
      maxSize: this.maxCacheSize,
      totalBytes: totalSize,
      images: Array.from(this.imageCache.keys())
    };
  }
}

/**
 * Screenshot Capture Helper
 * Note: Actual capture requires platform-specific tools
 */
export class ScreenshotHelper {
  constructor() {
    this.screenshotDir = '.grok/screenshots';
  }

  /**
   * Get the command to capture a screenshot (platform-specific)
   * @param {string} outputPath - Output file path
   * @returns {Object} Command info
   */
  getCaptureCommand(outputPath) {
    const platform = process.platform;

    switch (platform) {
      case 'darwin': // macOS
        return {
          command: `screencapture -i "${outputPath}"`,
          description: 'Use screencapture to take an interactive screenshot'
        };

      case 'win32': // Windows
        return {
          command: `snippingtool /clip`,
          description: 'Use Snipping Tool (paste result manually)'
        };

      case 'linux':
        return {
          command: `gnome-screenshot -a -f "${outputPath}"`,
          description: 'Use gnome-screenshot for area selection'
        };

      default:
        return {
          command: null,
          description: 'Screenshot capture not supported on this platform'
        };
    }
  }

  /**
   * Generate screenshot filename with timestamp
   * @returns {string} Screenshot filename
   */
  generateFilename() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `screenshot-${timestamp}.png`;
  }
}

export default VisionHandler;
