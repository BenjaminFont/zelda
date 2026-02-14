// Run ID generation — <test-name>-<timestamp> format

export const generateRunId = (testName: string): string => {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('Z', '');
  return `${testName}-${timestamp}`;
};
