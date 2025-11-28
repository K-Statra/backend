const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Company } = require('../models/Company');

const router = express.Router({ mergeParams: true });

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeExt = ext.replace(/[^.\w]/g, '') || '.jpg';
    const prefix = (req.params.companyId || 'company').slice(0, 18);
    const filename = `${prefix}-${Date.now()}${safeExt}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.COMPANY_IMAGE_MAX_BYTES || 5 * 1024 * 1024) },
});

router.get('/', async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const company = await Company.findById(companyId).select('images');
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    res.json(company.images);
  } catch (err) {
    next(err);
  }
});

router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const company = await Company.findById(companyId);
    if (!company) {
      if (req.file) fs.promises.unlink(req.file.path).catch(() => { });
      return res.status(404).json({ message: 'Company not found' });
    }

    let imageUrl = '';
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    } else if (req.body.url) {
      imageUrl = req.body.url;
    } else {
      return res.status(400).json({ message: 'Image file or url required' });
    }

    const image = {
      url: imageUrl,
      caption: req.body.caption || '',
      alt: req.body.alt || company.name || '',
      tags: req.body.tags ? String(req.body.tags).split(',').map(s => s.trim()).filter(Boolean) : [],
    };

    company.images.push(image);
    await company.save();

    // Return the new image object (last in array)
    const savedImage = company.images[company.images.length - 1];
    res.status(201).json(savedImage);
  } catch (err) {
    next(err);
  }
});

router.delete('/:imageId', async (req, res, next) => {
  try {
    const { companyId, imageId } = req.params;
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    const initialLen = company.images.length;
    company.images = company.images.filter(img => img._id.toString() !== imageId);

    if (company.images.length === initialLen) {
      return res.status(404).json({ message: 'Image not found' });
    }

    await company.save();
    res.json({ message: 'Image deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

