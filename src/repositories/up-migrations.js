import { emptyState } from '../services/up/domain.js';

export function migrateUpState(record, ownerId) {
  if (!record) return emptyState(ownerId);
  if (record.schemaVersion !== 1 || record.ownerId !== ownerId || !Array.isArray(record.challenges) || !Array.isArray(record.transactions)) {
    throw new Error('UP storage schema or ownership mismatch');
  }
  if (!Array.isArray(record.up_submissions)) {
    record.up_submissions = [];
  }
  return record;
}
