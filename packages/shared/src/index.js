export const APP_NAME = 'BPS Sulawesi Tengah WhatsApp Broadcast Platform';
export const TIMEZONE = 'Asia/Makassar';

export const MESSAGE_STATUSES = [
  'queued',
  'sending',
  'sent',
  'delivered',
  'read',
  'failed',
  'cancelled',
  'suppressed'
];

export const CAMPAIGN_STATUSES = [
  'draft',
  'scheduled',
  'processing',
  'completed',
  'paused',
  'cancelled',
  'failed'
];

export const CONTACT_TYPES = ['employee', 'public'];

export const CONTACT_STATUSES = [
  'active',
  'inactive',
  'unsubscribed',
  'invalid_number'
];

export const TEMPLATE_STATUSES = [
  'APPROVED',
  'PENDING',
  'REJECTED',
  'PAUSED',
  'ARCHIVED'
];

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN_DISEMINASI: 'admin_diseminasi',
  OPERATOR: 'operator',
  VIEWER: 'viewer'
};

export const PERMISSIONS = {
  CAMPAIGN_READ: 'campaign.read',
  CAMPAIGN_WRITE: 'campaign.write',
  CAMPAIGN_SEND: 'campaign.send',
  CAMPAIGN_CANCEL: 'campaign.cancel',
  CONTACT_READ: 'contact.read',
  CONTACT_WRITE: 'contact.write',
  CONTACT_EXPORT: 'contact.export',
  CONTACT_SENSITIVE_READ: 'contact.sensitive.read',
  TEMPLATE_READ: 'template.read',
  TEMPLATE_SYNC: 'template.sync',
  AUTOMATION_READ: 'automation.read',
  AUTOMATION_WRITE: 'automation.write',
  INTEGRATION_MANAGE: 'integration.manage',
  INTEGRATION_READ: 'integration.read',
  USER_MANAGE: 'user.manage',
  USER_READ: 'user.read',
  AUDIT_READ: 'audit.read',
  REPORT_READ: 'report.read',
  REPORT_EXPORT: 'report.export'
};

export const ROLE_PERMISSIONS_MAP = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.ADMIN_DISEMINASI]: [
    PERMISSIONS.CAMPAIGN_READ,
    PERMISSIONS.CAMPAIGN_WRITE,
    PERMISSIONS.CAMPAIGN_SEND,
    PERMISSIONS.CAMPAIGN_CANCEL,
    PERMISSIONS.CONTACT_READ,
    PERMISSIONS.CONTACT_WRITE,
    PERMISSIONS.CONTACT_EXPORT,
    PERMISSIONS.CONTACT_SENSITIVE_READ,
    PERMISSIONS.TEMPLATE_READ,
    PERMISSIONS.TEMPLATE_SYNC,
    PERMISSIONS.AUTOMATION_READ,
    PERMISSIONS.AUTOMATION_WRITE,
    PERMISSIONS.INTEGRATION_READ,
    PERMISSIONS.USER_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.REPORT_EXPORT
  ],
  [ROLES.OPERATOR]: [
    PERMISSIONS.CAMPAIGN_READ,
    PERMISSIONS.CAMPAIGN_WRITE,
    PERMISSIONS.CONTACT_READ,
    PERMISSIONS.CONTACT_WRITE,
    PERMISSIONS.TEMPLATE_READ,
    PERMISSIONS.AUTOMATION_READ,
    PERMISSIONS.REPORT_READ
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.CAMPAIGN_READ,
    PERMISSIONS.CONTACT_READ,
    PERMISSIONS.TEMPLATE_READ,
    PERMISSIONS.AUTOMATION_READ,
    PERMISSIONS.REPORT_READ
  ]
};

export * from './phone.js';
export * from './schemas/contact.js';
export * from './schemas/subscription.js';
export * from './schemas/meta.js';
export * from './schemas/campaign.js';

