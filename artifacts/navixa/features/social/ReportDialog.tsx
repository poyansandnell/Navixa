/**
 * A lightweight report action: presents an ActionSheet-style alert to pick a
 * category, then calls the report-user edge function. Kept dependency-free
 * (uses RN Alert) so it works on native + web.
 */
import { showAlert } from '@/lib/alert';

import i18n from '@/i18n';
import { reportUser, type ReportCategory } from './api';

const CATEGORIES: ReportCategory[] = [
  'harassment',
  'cheating',
  'inappropriate_name',
  'spam',
  'other',
];

/**
 * Prompt the user to pick a report category and submit. Resolves after the
 * report is sent (or the user cancels). `onDone` is invoked with success state.
 */
export function promptReport(
  reportedId: string,
  onDone?: (ok: boolean) => void,
): void {
  const t = i18n.t.bind(i18n);
  const buttons = CATEGORIES.map((category) => ({
    text: t(`social.report.categories.${category}`),
    onPress: async () => {
      try {
        await reportUser(reportedId, category);
        showAlert(t('social.report.sentTitle'), t('social.report.sentBody'));
        onDone?.(true);
      } catch (error) {
        showAlert(t('social.report.errorTitle'), (error as Error).message);
        onDone?.(false);
      }
    },
  }));

  showAlert(t('social.report.title'), t('social.report.body'), [
    ...buttons,
    { text: t('common.cancel'), style: 'cancel' as const, onPress: () => onDone?.(false) },
  ]);
}
