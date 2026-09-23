import { Router } from 'express';
import multer from 'multer';
import {
  getContacts,
  getContactById,
  saveContact,
  exportContactsCsv
} from './service.js';
import {
  createImportJob,
  getImportJob,
  applyImportJob
} from '../imports/service.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateCsrf } from '../../middleware/csrf.js';
import { PERMISSIONS } from '@bps/shared';

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export const contactsRouter = Router();

// List contacts with pagination and filters
contactsRouter.get(
  '/contacts',
  authenticate,
  authorize(PERMISSIONS.CONTACT_READ),
  async (req, res, next) => {
    try {
      const result = await getContacts({ query: req.query, user: req.user });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Get single contact by ID
contactsRouter.get(
  '/contacts/:id',
  authenticate,
  authorize(PERMISSIONS.CONTACT_READ),
  async (req, res, next) => {
    try {
      const contact = await getContactById(req.params.id, req.user);
      if (!contact) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Kontak tidak ditemukan',
            correlationId: req.correlationId
          }
        });
      }
      res.json({ contact });
    } catch (err) {
      next(err);
    }
  }
);

// Create or update contact
contactsRouter.post(
  '/contacts',
  authenticate,
  validateCsrf,
  authorize(PERMISSIONS.CONTACT_WRITE),
  async (req, res, next) => {
    try {
      const contact = await saveContact(req.body, req.user);
      res.status(201).json({ contact });
    } catch (err) {
      next(err);
    }
  }
);

// Export contacts to CSV
contactsRouter.get(
  '/exports/contacts',
  authenticate,
  authorize(PERMISSIONS.CONTACT_EXPORT),
  async (req, res, next) => {
    try {
      const csv = await exportContactsCsv({ query: req.query, user: req.user });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="bps-contacts-export.csv"');
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }
);

// Staged upload for contact CSV/XLSX
contactsRouter.post(
  '/imports/contacts',
  authenticate,
  validateCsrf,
  authorize(PERMISSIONS.CONTACT_WRITE),
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'File spreadsheet (.csv / .xlsx) wajib diunggah',
            correlationId: req.correlationId
          }
        });
      }

      const result = await createImportJob({
        filename: req.file.originalname,
        buffer: req.file.buffer,
        user: req.user
      });

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// View staged import job report
contactsRouter.get(
  '/imports/contacts/:id',
  authenticate,
  authorize(PERMISSIONS.CONTACT_WRITE),
  async (req, res, next) => {
    try {
      const result = await getImportJob(req.params.id);
      if (!result) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Job impor tidak ditemukan',
            correlationId: req.correlationId
          }
        });
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Apply staged import job to contacts table
contactsRouter.post(
  '/imports/contacts/:id/apply',
  authenticate,
  validateCsrf,
  authorize(PERMISSIONS.CONTACT_WRITE),
  async (req, res, next) => {
    try {
      const result = await applyImportJob(req.params.id, req.user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);
